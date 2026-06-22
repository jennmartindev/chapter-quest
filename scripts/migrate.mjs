// Runs every supabase/migrations/*.sql against the database in order, once.
// Reads the connection string from SUPABASE_DB_URL (kept in .env.local).
//   npm run db:migrate
// Tracks applied files in public._migrations, so it's safe to re-run — only
// new migrations execute.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const url = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("✗ Set SUPABASE_DB_URL in .env.local (Supabase → Connect → Session pooler URI).");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  await client.query(
    "create table if not exists public._migrations (name text primary key, run_at timestamptz default now())"
  );

  const dir = path.join(process.cwd(), "supabase", "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

  let applied = 0;
  for (const f of files) {
    const done = await client.query("select 1 from public._migrations where name = $1", [f]);
    if (done.rowCount) {
      console.log(`  skip    ${f} (already applied)`);
      continue;
    }
    const sql = readFileSync(path.join(dir, f), "utf8");
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into public._migrations(name) values ($1)", [f]);
      await client.query("commit");
      console.log(`  ✓ apply ${f}`);
      applied++;
    } catch (e) {
      await client.query("rollback");
      console.error(`  ✗ FAILED ${f}: ${e.message}`);
      process.exit(1);
    }
  }
  console.log(applied === 0 ? "\nUp to date — nothing to apply." : `\nDone — applied ${applied} migration(s).`);
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exit(1);
} finally {
  await client.end();
}
