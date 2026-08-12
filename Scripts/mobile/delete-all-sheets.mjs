/**
 * Jednorazowe usunięcie wszystkich planów treningowych z Supabase.
 * Uruchom: node Scripts/mobile/delete-all-sheets.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "../import/.env") });

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;

if (!url || !key) {
  console.error("Brak SUPABASE_URL lub SUPABASE_SECRET_KEY w Scripts/import/.env");
  process.exit(1);
}

const supabase = createClient(url, key);

const { data: sheets, error: listError } = await supabase
  .from("workout_sheets")
  .select("id, name");

if (listError) {
  console.error("Błąd listowania:", listError.message);
  process.exit(1);
}

console.log(`Znaleziono ${sheets?.length ?? 0} planów:`);
for (const sheet of sheets ?? []) {
  console.log(`  - ${sheet.name} (${sheet.id})`);
}

if (!sheets?.length) {
  console.log("Nic do usunięcia.");
  process.exit(0);
}

const { error: deleteError } = await supabase
  .from("workout_sheets")
  .delete()
  .neq("id", "00000000-0000-0000-0000-000000000000");

if (deleteError) {
  console.error("Błąd usuwania:", deleteError.message);
  process.exit(1);
}

console.log("Usunięto wszystkie plany (kaskada: ćwiczenia, serie, sesje).");
