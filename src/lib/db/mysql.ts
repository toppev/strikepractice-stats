import mysql from "mysql2/promise";
import type { Database, SqlParam } from "./types";

export function createMysql(url: string): Database {
  const parsed = new URL(url.replace(/^mariadb:/, "mysql:"));
  const pool = mysql.createPool({
    uri: parsed.toString(),
    connectionLimit: Number(parsed.searchParams.get("connectionLimit") ?? 5),
    // SUM() and AVG() come back as DECIMAL, which mysql2 would otherwise return as strings
    decimalNumbers: true,
    // Millisecond timestamps fit in a JS number; keep them numbers, not strings
    supportBigNumbers: true,
    bigNumberStrings: false,
    charset: "utf8mb4",
    enableKeepAlive: true,
  });
  const description = `MySQL/MariaDB ${parsed.hostname}:${parsed.port || 3306}${parsed.pathname}`;

  // query() rather than execute(): it escapes on the client, which also allows `LIMIT ?`
  // (prepared statements reject numbers there on some server versions)
  const all = async <T>(sql: string, params: SqlParam[] = []) => {
    const [rows] = await pool.query(sql, params);
    return rows as T[];
  };

  return {
    kind: "mysql",
    description,
    all,
    async get<T>(sql: string, params?: SqlParam[]) {
      return (await all<T>(sql, params))[0];
    },
    async columns(table) {
      const rows = await all<{ COLUMN_NAME: string }>(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION",
        [table],
      );
      return rows.map((r) => r.COLUMN_NAME);
    },
    async indexes(table) {
      const rows = await all<{ INDEX_NAME: string; COLUMN_NAME: string }>(
        "SELECT INDEX_NAME, COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY INDEX_NAME, SEQ_IN_INDEX",
        [table],
      );
      const byName = new Map<string, string[]>();
      for (const r of rows) byName.set(r.INDEX_NAME, [...(byName.get(r.INDEX_NAME) ?? []), r.COLUMN_NAME]);
      return [...byName].map(([name, columns]) => ({ name, columns }));
    },
    dialect: {
      equalsIgnoreCase: (column) => `LOWER(${column}) = LOWER(?)`,
      intDiv: (a, b) => `(${a} DIV ${b})`,
    },
    close: () => pool.end(),
  };
}
