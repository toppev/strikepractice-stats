import { db, type SqlParam } from "../db";
import { cached } from "../cache";
import { getConfig } from "../config";
import { parsePlayerData } from "../sp/fight-data";
import { COLUMN_RE, currentNames, dashedUuid, placeholders, RANKED_MODES, toNumber, UUID_RE } from "./common";
import { getKits } from "./kits";

export type PlayerRef = { uuid: string; name: string };

/**
 * Finds a player by UUID, current name, or a name they used in an old fight (so links in old
 * fights keep working after a name change). Null when nobody matches.
 */
export function findPlayer(nameOrUuid: string): Promise<PlayerRef | null> {
  const key = nameOrUuid.trim();
  return cached(`find:${key.toLowerCase()}`, async () => {
    const database = await db();
    if (UUID_RE.test(key)) {
      const uuid = dashedUuid(key);
      const row =
        (await database.get<{ username: string }>("SELECT username FROM stats WHERE uuid = ?", [uuid])) ??
        (await database.get<{ username: string }>(
          "SELECT username FROM fight_players WHERE uuid = ? ORDER BY fight DESC LIMIT 1",
          [uuid],
        ));
      return row ? { uuid, name: row.username } : null;
    }
    if (!/^[A-Za-z0-9_.-]{1,32}$/.test(key)) return null;

    // Exact match first: uses the username index (and MySQL's default collation ignores case anyway)
    let rows = await database.all<{ uuid: string; username: string }>(
      "SELECT uuid, username FROM stats WHERE username = ? LIMIT 10",
      [key],
    );
    if (rows.length === 0) {
      rows = await database.all(`SELECT uuid, username FROM stats WHERE ${database.dialect.equalsIgnoreCase("username")} LIMIT 10`, [key]);
    }
    if (rows.length === 1) return { uuid: rows[0].uuid, name: rows[0].username };
    if (rows.length > 1) {
      // Same name on several rows (someone took over a name): the one who played last
      const last = await database.all<{ uuid: string; last: string }>(
        `SELECT uuid, MAX(fight) AS last FROM fight_players WHERE uuid IN (${placeholders(rows)}) GROUP BY uuid ORDER BY last DESC LIMIT 1`,
        rows.map((r) => r.uuid),
      );
      const uuid = last[0]?.uuid ?? rows[0].uuid;
      return { uuid, name: rows.find((r) => r.uuid === uuid)!.username };
    }

    // An old name: look it up in fight history, then show the player under their current name
    const old = await database.get<{ uuid: string }>(
      `SELECT uuid FROM fight_players WHERE ${database.dialect.equalsIgnoreCase("username")} ORDER BY fight DESC LIMIT 1`,
      [key],
    );
    if (!old) return null;
    const names = await currentNames([old.uuid]);
    return { uuid: old.uuid, name: names.get(old.uuid) ?? key };
  });
}

/** Search box: names containing the text anywhere, those starting with it first */
export function searchPlayers(text: string, limit = 8): Promise<PlayerRef[]> {
  const q = text.trim();
  if (!/^[A-Za-z0-9_]{1,16}$/.test(q)) return Promise.resolve([]);
  return cached(`search:${q.toLowerCase()}`, async () => {
    const database = await db();
    // LIKE is case-insensitive for ASCII in SQLite and with MySQL's default collations.
    // "_" is a wildcard in LIKE; an explicit ESCAPE is needed because SQLite has no default one.
    // A leading % can't use the username index: a scan of `stats`, fine at a few 100k players
    // with the cache and the search box's debounce.
    const escaped = q.replace(/_/g, "!_");
    const rows = await database.all<{ uuid: string; username: string }>(
      `SELECT uuid, username FROM stats WHERE username LIKE ? ESCAPE '!'
       ORDER BY CASE WHEN username LIKE ? ESCAPE '!' THEN 0 ELSE 1 END, LENGTH(username), username LIMIT ?`,
      [`%${escaped}%`, `${escaped}%`, limit],
    );
    return rows.map((r) => ({ uuid: r.uuid, name: r.username }));
  });
}

export type PlayerStats = {
  uuid: string;
  name: string;
  kills: number;
  deaths: number;
  globalElo: number;
  /** kit name -> elo, only kits with an elo column */
  elo: Record<string, number>;
  events: { lms: number; brackets: number; sumo: number; juggernaut: number; partyVsParty: number };
};

export function getPlayerStats(uuid: string): Promise<PlayerStats | null> {
  return cached(`stats:${uuid}`, async () => {
    const database = await db();
    const row = await database.get<Record<string, unknown>>("SELECT * FROM stats WHERE uuid = ?", [uuid]);
    if (!row) return null;
    const elo: Record<string, number> = {};
    for (const [column, value] of Object.entries(row)) {
      if (column.startsWith("elo_")) elo[column.slice(4)] = toNumber(value);
    }
    return {
      uuid,
      name: String(row.username),
      kills: toNumber(row.kills),
      deaths: toNumber(row.deaths),
      globalElo: toNumber(row.global_elo),
      elo,
      events: {
        lms: toNumber(row.lms),
        brackets: toNumber(row.brackets),
        sumo: toNumber(row.sumo_wins),
        juggernaut: toNumber(row.juggernaut),
        partyVsParty: toNumber(row.party_vs_party_wins),
      },
    };
  });
}

export type Record_ = { wins: number; losses: number; fights: number; first: number | null; last: number | null };

export function getPlayerRecord(uuid: string): Promise<Record_> {
  return cached(`record:${uuid}`, async () => {
    const database = await db();
    const row = await database.get<{ total: number; wins: number | null; first: string | null; last: string | null }>(
      "SELECT COUNT(*) AS total, SUM(is_winner) AS wins, MIN(fight) AS first, MAX(fight) AS last FROM fight_players WHERE uuid = ?",
      [uuid],
    );
    const fights = toNumber(row?.total);
    const wins = toNumber(row?.wins);
    return {
      fights,
      wins,
      losses: fights - wins,
      first: row?.first ? Number(row.first) : null,
      last: row?.last ? Number(row.last) : null,
    };
  });
}

export function getStreaks(uuid: string): Promise<{ current: number; best: number }> {
  return cached(`streaks:${uuid}`, async () => {
    const database = await db();
    const rows = await database.all<{ is_winner: number | null }>(
      "SELECT is_winner FROM fight_players WHERE uuid = ? ORDER BY fight DESC LIMIT 10000",
      [uuid],
    );
    let current = 0;
    while (current < rows.length && toNumber(rows[current].is_winner) === 1) current++;
    let best = 0;
    let run = 0;
    for (const row of rows) {
      run = toNumber(row.is_winner) === 1 ? run + 1 : 0;
      best = Math.max(best, run);
    }
    return { current, best };
  });
}

export type KitRecord = { kit: string; fights: number; wins: number; last: number };

export function getKitRecords(uuid: string): Promise<KitRecord[]> {
  return cached(`kitrecords:${uuid}`, async () => {
    const database = await db();
    const rows = await database.all<{ kit: string; total: number; wins: number | null; last: number }>(
      `SELECT f.kit AS kit, COUNT(*) AS total, SUM(fp.is_winner) AS wins, MAX(f.started) AS last
       FROM fight_players fp JOIN fights f ON f.started = fp.fight
       WHERE fp.uuid = ? AND f.kit IS NOT NULL GROUP BY f.kit ORDER BY total DESC`,
      [uuid],
    );
    return rows.map((r) => ({ kit: r.kit, fights: toNumber(r.total), wins: toNumber(r.wins), last: Number(r.last) }));
  });
}

export type Rival = PlayerRef & { fights: number; wins: number };

/** The opponents this player has fought the most, from their last 1000 fights */
export function getRivals(uuid: string, limit = 5): Promise<Rival[]> {
  return cached(`rivals:${uuid}`, async () => {
    const database = await db();
    const rows = await database.all<{ uuid: string; name: string; fights: number; wins: number | null }>(
      `SELECT o.uuid AS uuid, MAX(o.username) AS name, COUNT(*) AS fights, SUM(me.is_winner) AS wins
       FROM (SELECT fight, is_winner FROM fight_players WHERE uuid = ? ORDER BY fight DESC LIMIT 1000) me
       JOIN fight_players o ON o.fight = me.fight AND o.uuid <> ?
       GROUP BY o.uuid ORDER BY fights DESC, wins DESC LIMIT ?`,
      [uuid, uuid, limit],
    );
    const names = await currentNames(rows.map((r) => r.uuid));
    return rows.map((r) => ({
      uuid: r.uuid,
      name: names.get(r.uuid) ?? r.name,
      fights: toNumber(r.fights),
      wins: toNumber(r.wins),
    }));
  }, 5);
}

/** Names this player has used in fights, newest first */
export function getNameHistory(uuid: string): Promise<{ name: string; first: number; last: number }[]> {
  return cached(`names:${uuid}`, async () => {
    const database = await db();
    const rows = await database.all<{ username: string; first: string; last: string }>(
      "SELECT username, MIN(fight) AS first, MAX(fight) AS last FROM fight_players WHERE uuid = ? GROUP BY username ORDER BY last DESC",
      [uuid],
    );
    return rows.map((r) => ({ name: r.username, first: Number(r.first), last: Number(r.last) }));
  }, 5);
}

export type Placement = { rank: number; of: number };

/**
 * The player's position on the global ladder and every kit ladder, in one scan of the stats
 * table. Like the boards, it only counts players who have left the starting elo; a player
 * still on it gets no placement for that ladder.
 */
export function getPlacements(stats: PlayerStats): Promise<Record<string, Placement>> {
  return cached(`placements:${stats.uuid}`, async () => {
    const database = await db();
    const kits = await getKits();
    const columns = ["global_elo", ...[...kits.values()].flatMap((k) => (k.eloColumn ? [k.eloColumn] : []))].filter((c) =>
      COLUMN_RE.test(c),
    );
    const start = getConfig().startingElo;
    const parts: string[] = [];
    const params: SqlParam[] = [];
    for (const column of columns) {
      const value = column === "global_elo" ? stats.globalElo : (stats.elo[column.slice(4)] ?? start);
      parts.push(
        `SUM(CASE WHEN ${column} > ? AND ${column} <> ? THEN 1 ELSE 0 END)`,
        `SUM(CASE WHEN ${column} <> ? THEN 1 ELSE 0 END)`,
      );
      params.push(value, start, start);
    }
    if (parts.length === 0) return {};
    const row = await database.get<Record<string, number>>(
      `SELECT ${parts.map((p, i) => `${p} AS c${i}`).join(", ")} FROM stats`,
      params,
    );
    const out: Record<string, Placement> = {};
    columns.forEach((column, i) => {
      const key = column === "global_elo" ? "global" : column.slice(4);
      const value = column === "global_elo" ? stats.globalElo : stats.elo[key];
      // Still on the starting elo: not on that board, so no placement
      if (value === undefined || value === start) return;
      out[key] = { rank: toNumber(row?.[`c${i * 2}`]) + 1, of: toNumber(row?.[`c${i * 2 + 1}`]) };
    });
    return out;
  });
}

export type EloPoint = { at: number; elo: number; change: number; fightId: number; won: boolean };

/** Elo after each ranked fight, per kit, oldest first (from the player's last 300 ranked fights) */
export function getEloHistory(uuid: string): Promise<Record<string, EloPoint[]>> {
  return cached(`elohistory:${uuid}`, async () => {
    const database = await db();
    const rows = await database.all<{ id: number; started: number; kit: string; is_winner: number | null; player_data: string | null }>(
      `SELECT f.id, f.started, f.kit, fp.is_winner, fp.player_data
       FROM fight_players fp JOIN fights f ON f.started = fp.fight
       WHERE fp.uuid = ? AND f.mode IN (${placeholders(RANKED_MODES)})
       ORDER BY fp.fight DESC LIMIT 300`,
      [uuid, ...RANKED_MODES],
    );
    const out: Record<string, EloPoint[]> = {};
    for (const row of rows.reverse()) {
      const data = parsePlayerData(row.player_data);
      if (!data.oldElo && !data.newElo) continue;
      (out[row.kit] ??= []).push({
        at: Number(row.started),
        elo: data.newElo,
        change: data.newElo - data.oldElo,
        fightId: Number(row.id),
        won: toNumber(row.is_winner) === 1,
      });
    }
    return out;
  }, 5);
}
