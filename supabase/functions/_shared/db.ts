// Service-role database client and small shared queries.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { ApiError } from "./http.ts";

export const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
export const db = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

/** Columns the public may see (mirrors POST_COLUMNS in src/lib/db.ts). */
export const PUBLIC_COLUMNS =
  "id,type,author_handle,body,source,kind,link_url,tweet,tagged,met_name,met_role,met_company,met_handle,met_linkedin,photos,talk,upvotes,hidden,is_seed,created_at";

export const PHOTO_URL_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/photos/`;

export async function isReadOnly(): Promise<boolean> {
  const { data } = await db.from("settings").select("read_only").eq("id", true).maybeSingle();
  return !!data?.read_only;
}

/** Throws 429 if `column` has >= max rows matching `match` in the last 10 minutes. */
export async function rateLimit(column: "device_id" | "deleted_by", value: string, timeColumn: "created_at" | "deleted_at", max: number, what: string) {
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const { count, error } = await db.from("posts").select("id", { count: "exact", head: true }).eq(column, value).gte(timeColumn, since);
  if (error) throw error;
  if ((count ?? 0) >= max) throw new ApiError(429, "rate_limited", `You've ${what} a lot in the last few minutes. Try again in a bit.`);
}
