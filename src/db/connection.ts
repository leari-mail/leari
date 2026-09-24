import Database from "@tauri-apps/plugin-sql";

const DATABASE_URL = "sqlite:leari.db";

let connection: Promise<Database> | undefined;

/** Lazily opens (once) the SQLite database living in the app config dir. */
export function getConnection(): Promise<Database> {
  connection ??= Database.load(DATABASE_URL);
  return connection;
}
