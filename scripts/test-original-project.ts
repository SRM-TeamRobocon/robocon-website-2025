import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const envContent = fs.readFileSync(".env", "utf8");
const envVars: Record<string, string> = {};
for (const line of envContent.split("\n")) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || "";
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    envVars[match[1]] = value.trim();
  }
}

async function checkCalendarTables() {
  const client = createClient(envVars.SUPABASE_URL, envVars.SUPABASE_SECRET_KEY);
  const q1 = await client.from("calendar_events").select("*").limit(2);
  console.log("fcdaqslblhrjzioeuloe calendar_events:", q1.error ? q1.error.message : q1.data);

  const q2 = await client.from("member_accounts").select("id, name, date_of_birth").not("date_of_birth", "is", null).limit(5);
  console.log("fcdaqslblhrjzioeuloe members with DOB:", q2.error ? q2.error.message : q2.data);
}

checkCalendarTables().catch(console.error);
