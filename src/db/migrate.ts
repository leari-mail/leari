import { getConnection } from "./connection";
import journal from "./migrations/meta/_journal.json";

const migrationFiles = import.meta.glob<string>("./migrations/*.sql", {
  query: "?raw",
  import: "default",
  eager: true,
});

const BREAKPOINT = "--> statement-breakpoint";

/**
 * Applies drizzle-kit generated migrations (src/db/migrations) that were not applied yet.
 * Generate new ones with `pnpm db:generate` after changing src/db/schema.
 */
export async function runMigrations(): Promise<void> {
  const connection = await getConnection();

  await connection.execute(
    "CREATE TABLE IF NOT EXISTS __leari_migrations (tag TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)",
  );
  const applied = new Set(
    (await connection.select<{ tag: string }[]>("SELECT tag FROM __leari_migrations")).map(
      (row) => row.tag,
    ),
  );

  for (const { tag } of journal.entries) {
    if (applied.has(tag)) continue;

    const sql = migrationFiles[`./migrations/${tag}.sql`];
    if (!sql) throw new Error(`Migration file for "${tag}" not found`);

    const statements = sql
      .split(BREAKPOINT)
      .map((statement) => statement.trim())
      .filter(Boolean);
    for (const statement of statements) await connection.execute(statement);

    await connection.execute("INSERT INTO __leari_migrations (tag, applied_at) VALUES ($1, $2)", [
      tag,
      Date.now(),
    ]);
  }
}
