import { db, type SqlParam } from "../db";
import { cached } from "../cache";
import { getConfig } from "../config";
import { COLUMN_RE, placeholders, toNumber } from "./common";
import { getKits, getLadders, type KitInfo } from "./kits";

export type Board = {
  /** URL segment: /leaderboards/<id> */
  id: string;
  label: string;
  /** What the number means, e.g. "elo" or "wins" */
  unit: string;
  group: "ladders" | "overall" | "events";
  kit?: KitInfo;
  /** stats column for column boards; undefined for wins (counted from fights) */
  column?: string;
};

/** Event wins are plain columns in `stats`; only boards with at least one win are shown */
const EVENT_BOARDS: { id: string; column: string; label: string }[] = [
  { id: "lms", column: "lms", label: "Last man standing" },
  { id: "brackets", column: "brackets", label: "Brackets" },
  { id: "sumo-event", column: "sumo_wins", label: "Sumo event" },
  { id: "juggernaut", column: "juggernaut", label: "Juggernaut" },
  { id: "party-vs-party", column: "party_vs_party_wins", label: "Party vs party" },
];

export async function getBoards(): Promise<Board[]> {
  const played = await playedLadders();
  const ladders = (await getLadders()).filter((kit) => played.has(kit.eloColumn!));
  const boards: Board[] = [
    { id: "elo", label: "Global elo", unit: "elo", group: "overall", column: "global_elo" },
    { id: "wins", label: "Fight wins", unit: "wins", group: "overall" },
    { id: "kills", label: "Kills", unit: "kills", group: "overall", column: "kills" },
    ...ladders.map((kit): Board => ({ id: kit.name, label: kit.label, unit: "elo", group: "ladders", kit, column: kit.eloColumn })),
  ];
  if (getConfig().leaderboards.events) {
    const active = await activeEventColumns();
    for (const e of EVENT_BOARDS) {
      if (active.has(e.column)) boards.push({ id: e.id, label: e.label, unit: "wins", group: "events", column: e.column });
    }
  }
  return boards;
}

/** Elo columns where at least one player has left the starting elo (a ladder nobody plays is hidden) */
function playedLadders(): Promise<Set<string>> {
  return cached(
    "played-ladders",
    async () => {
      const database = await db();
      const columns = (await database.columns("stats")).filter((c) => c.startsWith("elo_") && COLUMN_RE.test(c));
      if (columns.length === 0) return new Set<string>();
      const start = getConfig().startingElo;
      const row = await database.get<Record<string, number>>(
        `SELECT ${columns.map((c, i) => `SUM(CASE WHEN ${c} <> ? THEN 1 ELSE 0 END) AS c${i}`).join(", ")} FROM stats`,
        columns.map(() => start),
      );
      return new Set(columns.filter((_, i) => toNumber(row?.[`c${i}`]) > 0));
    },
    10,
  );
}

function activeEventColumns(): Promise<Set<string>> {
  return cached(
    "event-columns",
    async () => {
      const database = await db();
      const columns = new Set(await database.columns("stats"));
      const present = EVENT_BOARDS.filter((e) => columns.has(e.column));
      if (present.length === 0) return new Set<string>();
      const row = await database.get<Record<string, number>>(
        `SELECT ${present.map((e) => `MAX(${e.column}) AS ${e.column}`).join(", ")} FROM stats`,
      );
      return new Set(present.filter((e) => toNumber(row?.[e.column]) > 0).map((e) => e.column));
    },
    10,
  );
}

export type BoardRow = {
  rank: number;
  uuid: string;
  name: string;
  value: number;
  /** Fights won/lost in this board's kit (ladders only) */
  wins?: number;
  losses?: number;
};

export type BoardPage = { rows: BoardRow[]; total: number };

export function getBoardPage(board: Board, page: number, pageSize: number): Promise<BoardPage> {
  return cached(`board:${board.id}:${page}:${pageSize}`, () => loadBoardPage(board, page, pageSize), board.column ? 1 : 5);
}

async function loadBoardPage(board: Board, page: number, pageSize: number): Promise<BoardPage> {
  const database = await db();
  const offset = (page - 1) * pageSize;

  if (!board.column) {
    // Wins: counted over every fight, so this one is cached 5x longer
    const [rows, total] = await Promise.all([
      database.all<{ uuid: string; name: string; value: number }>(
        `SELECT fp.uuid AS uuid, COALESCE(MAX(s.username), MAX(fp.username)) AS name, COUNT(*) AS value
         FROM fight_players fp LEFT JOIN stats s ON s.uuid = fp.uuid
         WHERE fp.is_winner = 1 GROUP BY fp.uuid ORDER BY value DESC, name ASC LIMIT ? OFFSET ?`,
        [pageSize, offset],
      ),
      database.get<{ n: number }>("SELECT COUNT(DISTINCT uuid) AS n FROM fight_players WHERE is_winner = 1"),
    ]);
    return {
      rows: rows.map((r, i) => ({ rank: offset + i + 1, uuid: r.uuid, name: r.name, value: toNumber(r.value) })),
      total: toNumber(total?.n),
    };
  }

  const column = board.column;
  if (!COLUMN_RE.test(column)) throw new Error(`Refusing unsafe column name ${column}`);
  // Elo boards skip players still on the starting elo (never played it ranked); count boards skip zeros
  const isElo = board.unit === "elo";
  const filter = isElo ? `${column} <> ?` : `${column} > 0`;
  const filterParams: SqlParam[] = isElo ? [getConfig().startingElo] : [];
  const [rows, total] = await Promise.all([
    database.all<{ uuid: string; username: string; value: number }>(
      `SELECT uuid, username, ${column} AS value FROM stats WHERE ${filter} ORDER BY ${column} DESC, username ASC LIMIT ? OFFSET ?`,
      [...filterParams, pageSize, offset],
    ),
    database.get<{ n: number }>(`SELECT COUNT(*) AS n FROM stats WHERE ${filter}`, filterParams),
  ]);
  const result: BoardRow[] = rows.map((r, i) => ({ rank: offset + i + 1, uuid: r.uuid, name: r.username, value: toNumber(r.value) }));

  if (board.kit && result.length > 0) {
    const records = await database.all<{ uuid: string; total: number; wins: number | null }>(
      `SELECT fp.uuid AS uuid, COUNT(*) AS total, SUM(fp.is_winner) AS wins
       FROM fight_players fp JOIN fights f ON f.started = fp.fight
       WHERE f.kit = ? AND fp.uuid IN (${placeholders(result)}) GROUP BY fp.uuid`,
      [board.kit.name, ...result.map((r) => r.uuid)],
    );
    const byUuid = new Map(records.map((r) => [r.uuid, r]));
    for (const row of result) {
      const rec = byUuid.get(row.uuid);
      row.wins = toNumber(rec?.wins);
      row.losses = toNumber(rec?.total) - row.wins;
    }
  }
  return { rows: result, total: toNumber(total?.n) };
}

/** Top N of a board, for the home page */
export async function getTop(boardId: string, n: number): Promise<{ board: Board; rows: BoardRow[] } | null> {
  const board = (await getBoards()).find((b) => b.id === boardId);
  if (!board) return null;
  return { board, rows: (await getBoardPage(board, 1, n)).rows };
}

export { getKits };
