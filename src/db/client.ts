import { drizzle } from "drizzle-orm/sqlite-proxy";
import { getConnection } from "./connection";
import * as schema from "./schema";

const RETURNS_ROWS = /^\s*(select|with|pragma)\b|\breturning\b/i;

/**
 * Drizzle over tauri-plugin-sql. The plugin returns rows as objects (column order preserved),
 * while the sqlite-proxy driver expects arrays of values.
 */
export const db = drizzle<typeof schema>(
  async (sql, params, method) => {
    const connection = await getConnection();

    if (!RETURNS_ROWS.test(sql)) {
      await connection.execute(sql, params);
      return { rows: [] };
    }

    const rows = (await connection.select<Record<string, unknown>[]>(sql, params)).map((row) =>
      Object.values(row),
    );
    return { rows: method === "get" ? (rows[0] ?? []) : rows };
  },
  { schema },
);

export type DB = typeof db;
