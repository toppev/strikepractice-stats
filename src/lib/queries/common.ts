import { db, type SqlParam } from "../db";

export const UUID_RE = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
/** Column names can't be query parameters; anything spliced into SQL must match this */
export const COLUMN_RE = /^[A-Za-z0-9_]+$/;

export const RANKED_MODES = ["DUEL_QUEUE_RANKED", "DUEL_QUEUE_PREMIUM"];

export function isRanked(mode: string | null | undefined): boolean {
  return !!mode && RANKED_MODES.includes(mode);
}

export function placeholders(values: unknown[]): string {
  return values.map(() => "?").join(",");
}

/** Normalizes "ec549c47c50241fe..." to the dashed form the plugin stores */
export function dashedUuid(uuid: string): string {
  const hex = uuid.replace(/-/g, "").toLowerCase();
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Current usernames (from the stats table) for a set of players */
export async function currentNames(uuids: string[]): Promise<Map<string, string>> {
  if (uuids.length === 0) return new Map();
  const database = await db();
  const rows = await database.all<{ uuid: string; username: string }>(
    `SELECT uuid, username FROM stats WHERE uuid IN (${placeholders(uuids)})`,
    uuids as SqlParam[],
  );
  return new Map(rows.map((r) => [r.uuid, r.username]));
}

export const toNumber = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));
