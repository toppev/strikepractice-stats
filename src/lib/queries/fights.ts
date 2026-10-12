import { db, type SqlParam } from "../db";
import { cached } from "../cache";
import { parseFightData, parsePlayerData, type FightData, type PlayerData } from "../sp/fight-data";
import { isRanked, placeholders, RANKED_MODES, toNumber } from "./common";

/**
 * Fights live in two tables: `fights` (one row per fight) and `fight_players` (one row per player
 * in it). NOTE the join: fight_players.fight is the fight's *start time* as a string, not fights.id.
 */

export type FightPlayer = {
  uuid: string;
  /** Name at the time of the fight */
  name: string;
  winner: boolean;
  /** Elo gained or lost, only for ranked fights */
  eloChange: number | null;
  newElo: number | null;
};

export type FightSummary = {
  id: number;
  started: number;
  ended: number;
  kit: string;
  arena: string | null;
  mode: string | null;
  ranked: boolean;
  winners: FightPlayer[];
  losers: FightPlayer[];
};

type FightRow = { id: number; started: number; ended: number; kit: string | null; arena: string | null; mode: string | null };
type PlayerRow = { fight: string; uuid: string; username: string; is_winner: number | null; player_data?: string | null };

const FIGHT_COLUMNS = "f.id, f.started, f.ended, f.kit, f.arena, f.mode";

async function attachPlayers(fights: FightRow[]): Promise<FightSummary[]> {
  if (fights.length === 0) return [];
  const database = await db();
  const keys = fights.map((f) => String(f.started));
  const rankedKeys = fights.filter((f) => isRanked(f.mode)).map((f) => String(f.started));
  // player_data is several kB per row: only fetch it where the elo change is needed
  const [players, ranked] = await Promise.all([
    database.all<PlayerRow>(
      `SELECT fight, uuid, username, is_winner FROM fight_players WHERE fight IN (${placeholders(keys)})`,
      keys,
    ),
    rankedKeys.length
      ? database.all<PlayerRow>(
          `SELECT fight, uuid, player_data FROM fight_players WHERE fight IN (${placeholders(rankedKeys)})`,
          rankedKeys,
        )
      : Promise.resolve([] as PlayerRow[]),
  ]);
  const elo = new Map<string, PlayerData>();
  for (const row of ranked) elo.set(`${row.fight}:${row.uuid}`, parsePlayerData(row.player_data));

  const byFight = new Map<string, PlayerRow[]>();
  for (const p of players) byFight.set(String(p.fight), [...(byFight.get(String(p.fight)) ?? []), p]);

  return fights.map((f) => {
    const rows = byFight.get(String(f.started)) ?? [];
    const toPlayer = (p: PlayerRow): FightPlayer => {
      const data = elo.get(`${p.fight}:${p.uuid}`);
      const has = data && (data.oldElo || data.newElo);
      return {
        uuid: p.uuid,
        name: p.username,
        winner: toNumber(p.is_winner) === 1,
        eloChange: has ? data.newElo - data.oldElo : null,
        newElo: has ? data.newElo : null,
      };
    };
    return {
      id: Number(f.id),
      started: Number(f.started),
      ended: Number(f.ended),
      kit: f.kit ?? "",
      arena: f.arena,
      mode: f.mode,
      ranked: isRanked(f.mode),
      winners: rows.filter((p) => toNumber(p.is_winner) === 1).map(toPlayer),
      losers: rows.filter((p) => toNumber(p.is_winner) !== 1).map(toPlayer),
    };
  });
}

export type FightFilter = { kit?: string; ranked?: boolean };

function filterSql(filter: FightFilter, params: SqlParam[]): string {
  let sql = "";
  if (filter.kit) {
    sql += " AND f.kit = ?";
    params.push(filter.kit);
  }
  if (filter.ranked === true) {
    sql += ` AND f.mode IN (${placeholders(RANKED_MODES)})`;
    params.push(...RANKED_MODES);
  } else if (filter.ranked === false) {
    sql += ` AND (f.mode IS NULL OR f.mode NOT IN (${placeholders(RANKED_MODES)}))`;
    params.push(...RANKED_MODES);
  }
  return sql;
}

export function recentFights(filter: FightFilter, limit: number, offset = 0): Promise<FightSummary[]> {
  return cached(`recent:${JSON.stringify(filter)}:${limit}:${offset}`, async () => {
    const database = await db();
    const params: SqlParam[] = [];
    const where = filterSql(filter, params);
    const rows = await database.all<FightRow>(
      `SELECT ${FIGHT_COLUMNS} FROM fights f WHERE 1=1${where} ORDER BY f.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    return attachPlayers(rows);
  });
}

export function playerFights(uuid: string, filter: FightFilter, limit: number, offset = 0): Promise<FightSummary[]> {
  return cached(`pfights:${uuid}:${JSON.stringify(filter)}:${limit}:${offset}`, async () => {
    const database = await db();
    const params: SqlParam[] = [uuid];
    const where = filterSql(filter, params);
    // Ordered by fp.fight (the start time as text, 13 digits until the year 2286) so the
    // (uuid, fight) index does the sorting
    const rows = await database.all<FightRow>(
      `SELECT ${FIGHT_COLUMNS} FROM fight_players fp JOIN fights f ON f.started = fp.fight
       WHERE fp.uuid = ?${where} ORDER BY fp.fight DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    return attachPlayers(rows);
  });
}

export function countPlayerFights(uuid: string, filter: FightFilter): Promise<number> {
  return cached(`pfightcount:${uuid}:${JSON.stringify(filter)}`, async () => {
    const database = await db();
    const params: SqlParam[] = [uuid];
    const where = filterSql(filter, params);
    const sql =
      where === ""
        ? "SELECT COUNT(*) AS n FROM fight_players fp WHERE fp.uuid = ?"
        : `SELECT COUNT(*) AS n FROM fight_players fp JOIN fights f ON f.started = fp.fight WHERE fp.uuid = ?${where}`;
    const row = await database.get<{ n: number }>(sql, params);
    return toNumber(row?.n);
  });
}

export type FightDetail = FightSummary & {
  data: FightData;
  players: (FightPlayer & { data: PlayerData })[];
};

export function getFight(id: number): Promise<FightDetail | null> {
  return cached(`fight:${id}`, async () => {
    const database = await db();
    const row = await database.get<FightRow & { fight_data: string | null; replay_id: string | null }>(
      `SELECT ${FIGHT_COLUMNS}, f.fight_data, f.replay_id FROM fights f WHERE f.id = ?`,
      [id],
    );
    if (!row) return null;
    const players = await database.all<PlayerRow>(
      "SELECT fight, uuid, username, is_winner, player_data FROM fight_players WHERE fight = ?",
      [String(row.started)],
    );
    const [summary] = await attachPlayers([row]);
    const data = parseFightData(row.fight_data);
    return {
      ...summary,
      data: { ...data, replayId: data.replayId ?? row.replay_id ?? undefined },
      players: players
        .map((p) => {
          const parsed = parsePlayerData(p.player_data);
          const has = parsed.oldElo || parsed.newElo;
          return {
            uuid: p.uuid,
            name: p.username,
            winner: toNumber(p.is_winner) === 1,
            eloChange: has && isRanked(row.mode) ? parsed.newElo - parsed.oldElo : null,
            newElo: has && isRanked(row.mode) ? parsed.newElo : null,
            data: parsed,
          };
        })
        .sort((a, b) => Number(b.winner) - Number(a.winner)),
    };
  }, 10);
}
