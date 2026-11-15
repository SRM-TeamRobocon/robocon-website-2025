import fs from "fs";
import postgres from "postgres";

async function run() {
  const directUrl = process.env.DATABASE_URL;
  if (!directUrl) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const u = new URL(directUrl);
  const projectRef = u.hostname.split(".")[1] || "fcdaqslblhrjzioeuloe";

  // Try direct connection first, then common pooler host
  const connectionCandidates = [
    directUrl,
    `postgresql://${encodeURIComponent(`postgres.${projectRef}`)}:${encodeURIComponent(u.password)}@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`,
    `postgresql://${encodeURIComponent(`postgres.${projectRef}`)}:${encodeURIComponent(u.password)}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`,
  ];

  let applied = false;

  for (const connStr of connectionCandidates) {
    const masked = connStr.replace(/:([^@]+)@/, ":****@");
    console.log(`Trying connection: ${masked}`);
    let sql: ReturnType<typeof postgres> | null = null;
    try {
      sql = postgres(connStr, { ssl: "require", connect_timeout: 5 });
      const test = await sql`select current_database() as db`;
      console.log(`Connected to database: ${test[0]?.db}`);

      const migration = fs.readFileSync("supabase/calendar-schema.sql", "utf8");
      console.log("Applying calendar migration...");
      await sql.unsafe(migration);
      console.log("Migration applied successfully!");

      const eventCols = await sql`
        select column_name, data_type 
        from information_schema.columns 
        where table_name = 'calendar_events'
        order by ordinal_position
      `;
      console.log("calendar_events columns:", eventCols.map((c) => `${c.column_name} (${c.data_type})`));

      const bdayCols = await sql`
        select column_name, data_type 
        from information_schema.columns 
        where table_name = 'calendar_birthdays'
        order by ordinal_position
      `;
      console.log("calendar_birthdays columns:", bdayCols.map((c) => `${c.column_name} (${c.data_type})`));

      applied = true;
      await sql.end();
      break;
    } catch (err: any) {
      console.log(`Failed with: ${err.message || err.code || err}`);
      if (sql) {
        try { await sql.end(); } catch {}
      }
    }
  }

  if (!applied) {
    console.log("Could not auto-apply migration via pooler/direct connection.");
    process.exit(2);
  }
}

run();
