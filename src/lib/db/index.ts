import path from "node:path";
import fs from "node:fs";
import type { Database } from "./types";

export type { Database, SqlParam } from "./types";

/** The bundled demo database, used when DATABASE_URL is not set */
export const DEMO_DATABASE = path.resolve(/*turbopackIgnore: true*/ "sample-data/demo.db");

export function isDemo(): boolean {
  return !process.env.DATABASE_URL;
}

/**
 * DATABASE_URL forms:
 *   mysql://user:password@host:3306/strikepractice   (mariadb:// works too)
 *   sqlite:///absolute/path/to/database.db           (or file:..., or just a path ending in .db)
 */
async function connect(url: string | undefined): Promise<Database> {
  if (!url) {
    const { createSqlite } = await import("./sqlite");
    return createSqlite(DEMO_DATABASE);
  }
  if (/^(mysql|mariadb):\/\//.test(url)) {
    const { createMysql } = await import("./mysql");
    return createMysql(url);
  }
  const file = url.replace(/^sqlite:(\/\/)?/, "").replace(/^file:(\/\/)?/, "");
  if (!fs.existsSync(file)) {
    throw new Error(`DATABASE_URL points to a SQLite file that doesn't exist: ${file}`);
  }
  const { createSqlite } = await import("./sqlite");
  return createSqlite(path.resolve(/*turbopackIgnore: true*/ file));
}

// Kept on globalThis so dev-mode hot reloads don't open a new pool on every edit
const holder = globalThis as unknown as { __spDb?: Promise<Database> };

export function db(): Promise<Database> {
  holder.__spDb ??= connect(process.env.DATABASE_URL).catch((err) => {
    holder.__spDb = undefined; // try again on the next request
    throw err;
  });
  return holder.__spDb;
}
