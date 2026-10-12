import { DatabaseSync } from "node:sqlite";
import type { Database, SqlParam } from "./types";

/**
 * Opens the plugin's SQLite file read-only with Node's built-in driver (no native module to build).
 *
 * The plugin keeps writing to this file while the site reads it. Reads are short and the plugin
 * waits up to 10 s on a busy database (busy_timeout), so this is fine for small servers; bigger
 * ones should use MySQL/MariaDB. See docs/DEPLOYING.md for mounting the file into Docker.
 */
export function createSqlite(file: string): Database {
  const db = new DatabaseSync(file, { readOnly: true });
  db.exec("PRAGMA busy_timeout = 5000");

  const bind = (params: SqlParam[]) => params.map((p) => (typeof p === "boolean" ? (p ? 1 : 0) : p));
  const all = async <T>(sql: string, params: SqlParam[] = []) => db.prepare(sql).all(...bind(params)) as T[];

  return {
    kind: "sqlite",
    description: `SQLite ${file}`,
    all,
    async get<T>(sql: string, params: SqlParam[] = []) {
      return db.prepare(sql).get(...bind(params)) as T | undefined;
    },
    async columns(table) {
      const rows = await all<{ name: string }>(`SELECT name FROM pragma_table_info(?)`, [table]);
      return rows.map((r) => r.name);
    },
    async indexes(table) {
      const list = await all<{ name: string }>(`SELECT name FROM pragma_index_list(?)`, [table]);
      return Promise.all(
        list.map(async ({ name }) => ({
          name,
          columns: (await all<{ name: string }>(`SELECT name FROM pragma_index_info(?)`, [name])).map((c) => c.name),
        })),
      );
    },
    dialect: {
      equalsIgnoreCase: (column) => `${column} = ? COLLATE NOCASE`,
      intDiv: (a, b) => `(${a} / ${b})`,
    },
    async close() {
      db.close();
    },
  };
}
