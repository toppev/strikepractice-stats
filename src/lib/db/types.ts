export type SqlParam = string | number | boolean | null;

/**
 * The whole database surface the app uses. Both backends take the same SQL with `?` placeholders,
 * so queries are written once; the few dialect differences go through {@link Database.dialect}.
 */
export interface Database {
  readonly kind: "mysql" | "sqlite";
  /** Where the data comes from, for logs and the doctor script. Never contains a password. */
  readonly description: string;
  all<T = Record<string, unknown>>(sql: string, params?: SqlParam[]): Promise<T[]>;
  get<T = Record<string, unknown>>(sql: string, params?: SqlParam[]): Promise<T | undefined>;
  /** Column names of a table, empty if the table doesn't exist */
  columns(table: string): Promise<string[]>;
  /** Index names of a table, for the doctor script */
  indexes(table: string): Promise<{ name: string; columns: string[] }[]>;
  readonly dialect: Dialect;
  close(): Promise<void>;
}

export interface Dialect {
  /** `column = ?` compared case-insensitively */
  equalsIgnoreCase(column: string): string;
  /** Integer division, e.g. bucketing millisecond timestamps into days */
  intDiv(a: string, b: string): string;
}
