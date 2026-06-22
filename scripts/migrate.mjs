// Runs every supabase/migrations/*.sql against the database in order, once.
// Reads SUPABASE_DB_URL from .env.local. Tracks applied files in
// public._migrations so it's safe to re-run — only new migrations execute.
//   npm run db:migrate
//
// NOTE: we parse .env.local and the connection string ourselves, on purpose:
//  - node --env-file treats `#` as a comment and truncates unquoted values
//  - new URL() can't parse an unencoded password (#, :, / etc.)
// Anchoring on the LAST `@` and FIRST `:` makes raw passwords Just Work.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import pg from "pg";

function loadEnvLocal() {
  const p = path.join(process.cwd(), ".env.local");
  const out = {};
  if (!existsSync(p)) return out;
  for (let line of readFileSync(p, "utf8").split(/\r?\n/)) {
    line = line.replace(/^\s+/, "");
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

// Parse postgresql://user:password@host:port/db?params WITHOUT a URL parser,
// so special characters in the password don't need encoding.
function parsePgUrl(raw) {
  const s = raw.trim();
  const scheme = s.match(/^postgres(?:ql)?:\/\//i);
  if (!scheme) throw new Error('SUPABASE_DB_URL must start with "postgresql://"');
  let rest = s.slice(scheme[0].length);
  const at = rest.lastIndexOf("@");
  if (at === -1) throw new Error('connection string is missing "@host" — did the value get truncated?');
  const userinfo = rest.slice(0, at);
  let hostpath = rest.slice(at + 1);
  const ci = userinfo.indexOf(":");
  const user = ci === -1 ? userinfo : userinfo.slice(0, ci);
  const password = ci === -1 ? "" : userinfo.slice(ci + 1);
  const qi = hostpath.indexOf("?");
  if (qi !== -1) hostpath = hostpath.slice(0, qi);
  let hostport = hostpath, database = "postgres";
  const slash = hostpath.indexOf("/");
  if (slash !== -1) {
    hostport = hostpath.slice(0, slash);
    database = hostpath.slice(slash + 1) || "postgres";
  }
  let host = hostport, port = 5432;
  const pc = hostport.lastIndexOf(":");
  if (pc !== -1 && /^\d+$/.test(hostport.slice(pc + 1))) {
    port = parseInt(hostport.slice(pc + 1), 10);
    host = hostport.slice(0, pc);
  }
  if (!host) throw new Error("could not parse host from SUPABASE_DB_URL");
  return { user, password, host, port, database };
}

const env = loadEnvLocal();
const url = process.env.SUPABASE_DB_URL || env.SUPABASE_DB_URL;
if (!url) {
  console.error("✗ Set SUPABASE_DB_URL in .env.local (Supabase → Connect → Session pooler URI).");
  process.exit(1);
}

let cfg;
try {
  cfg = parsePgUrl(url);
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exit(1);
}

const client = new pg.Client({ ...cfg, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  console.log(`Connected to ${cfg.host}:${cfg.port}/${cfg.database} as ${cfg.user}\n`);
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
