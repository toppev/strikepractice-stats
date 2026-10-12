import { db } from "../db";
import { cached } from "../cache";
import { toNumber } from "./common";

export type ServerSummary = {
  fights: number;
  players: number;
  /** Fights per week (Monday-based, UTC) for the last `weeks` weeks, oldest first */
  perWeek: { start: number; fights: number }[];
  /** Most played kits over the same period */
  popularKits: { kit: string; fights: number }[];
  /** Start of the newest fight; null when no fights are saved */
  newest: number | null;
};

const DAY = 86_400_000;
const WEEK = 7 * DAY;
// 1970-01-01 was a Thursday; shifting by 3 days makes weeks start on Monday
const MONDAY_OFFSET = 3 * DAY;

export function getServerSummary(weeks = 26): Promise<ServerSummary> {
  return cached(
    `summary:${weeks}`,
    async () => {
      const database = await db();
      const [fights, players, newest] = await Promise.all([
        database.get<{ n: number }>("SELECT COUNT(*) AS n FROM fights"),
        database.get<{ n: number }>("SELECT COUNT(*) AS n FROM stats"),
        database.get<{ t: number | null }>("SELECT MAX(started) AS t FROM fights"),
      ]);
      const end = newest?.t ? Number(newest.t) : null;
      if (end === null) return { fights: 0, players: toNumber(players?.n), perWeek: [], popularKits: [], newest: null };

      // Count back from now, or from the newest fight if the server has gone quiet (e.g. the demo)
      const anchor = end > Date.now() - 4 * WEEK ? Date.now() : end;
      const lastWeek = Math.floor((anchor + MONDAY_OFFSET) / WEEK);
      const since = (lastWeek - weeks + 1) * WEEK - MONDAY_OFFSET;
      const [rows, popular] = await Promise.all([
        database.all<{ week: number; n: number }>(
          `SELECT ${database.dialect.intDiv(`(started + ${MONDAY_OFFSET})`, String(WEEK))} AS week, COUNT(*) AS n
           FROM fights WHERE started >= ? GROUP BY week`,
          [since],
        ),
        database.all<{ kit: string; n: number }>(
          "SELECT kit, COUNT(*) AS n FROM fights WHERE started >= ? AND kit IS NOT NULL GROUP BY kit ORDER BY n DESC LIMIT 8",
          [since],
        ),
      ]);
      const counts = new Map(rows.map((r) => [toNumber(r.week), toNumber(r.n)]));
      return {
        fights: toNumber(fights?.n),
        players: toNumber(players?.n),
        perWeek: Array.from({ length: weeks }, (_, i) => {
          const week = lastWeek - weeks + 1 + i;
          return { start: week * WEEK - MONDAY_OFFSET, fights: counts.get(week) ?? 0 };
        }),
        popularKits: popular.map((r) => ({ kit: r.kit, fights: toNumber(r.n) })),
        newest: end,
      };
    },
    5,
  );
}
