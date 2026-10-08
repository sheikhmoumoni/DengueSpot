import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Pool } from "pg";
import { databaseSsl } from "../../config/src/index";
export async function migrate(
  connectionString = process.env.DIRECT_DATABASE_URL ||
    process.env.DATABASE_URL,
) {
  if (!connectionString)
    throw new Error(
      "Set DATABASE_URL or DIRECT_DATABASE_URL to PostgreSQL/PostGIS.",
    );
  const pool = new Pool({ connectionString, ssl: databaseSsl() });
  const client = await pool.connect();
  try {
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, applied_at timestamptz DEFAULT now())",
    );
    const dir = fileURLToPath(new URL("../migrations/", import.meta.url));
    for (const name of (await readdir(dir))
      .filter((x) => x.endsWith(".sql"))
      .sort()) {
      if (
        (
          await client.query("SELECT 1 FROM schema_migrations WHERE name=$1", [
            name,
          ])
        ).rowCount
      )
        continue;
      await client.query("BEGIN");
      try {
        await client.query(await readFile(path.join(dir, name), "utf8"));
        await client.query("INSERT INTO schema_migrations(name) VALUES($1)", [
          name,
        ]);
        await client.query("COMMIT");
        console.info(`Applied ${name}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  migrate().catch((error) => {
    console.error(error instanceof Error ? error.message : "Migration failed");
    process.exitCode = 1;
  });
