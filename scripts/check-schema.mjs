// Verifies that every field the frontend stores (POST_COLUMNS in src/lib/db.ts)
// exists as a column in the Supabase migration, and that both match the Post type.
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const types = read("src/lib/types.ts");
const db = read("src/lib/db.ts");
const sql = read("supabase/migrations/0001_init.sql");

const postBlock = types.match(/export interface Post \{([\s\S]*?)\n\}/)?.[1] ?? "";
const typeFields = [...postBlock.matchAll(/^\s+([a-z_]+)\??:/gm)].map((m) => m[1]);

const contract = [...(db.match(/POST_COLUMNS = \[([\s\S]*?)\]/)?.[1] ?? "").matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);

const tableBlock = sql.match(/create table public\.posts \(([\s\S]*?)\n\);/)?.[1] ?? "";
const sqlColumns = [...tableBlock.matchAll(/^\s+([a-z_]+)\s+(?:uuid|text|jsonb|int|boolean|timestamptz)/gm)].map((m) => m[1]);

const problems = [];
for (const f of typeFields) if (!contract.includes(f)) problems.push(`Post.${f} is missing from POST_COLUMNS`);
for (const c of contract) if (!typeFields.includes(c)) problems.push(`POST_COLUMNS has "${c}" which is not on Post`);
for (const c of contract) if (!sqlColumns.includes(c)) problems.push(`column "${c}" is missing from posts in 0001_init.sql`);

if (!typeFields.length || !contract.length || !sqlColumns.length) problems.push("could not parse one of the files");

if (problems.length) {
  console.error("Schema check failed:\n- " + problems.join("\n- "));
  process.exit(1);
}
console.log(`Schema check passed: ${contract.length} fields stored (${sqlColumns.length} columns in posts, incl. DB-only).`);
