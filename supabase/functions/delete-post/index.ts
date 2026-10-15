// Removes a post from the wall (soft delete, restorable by admin).
// Only the device that posted it can delete it; admin can delete anything.
import { isAdminSecret } from "../_shared/admin.ts";
import { db, isReadOnly, rateLimit } from "../_shared/db.ts";
import { ApiError, deviceId, json, serve, str } from "../_shared/http.ts";

const DELETES_PER_10_MIN = 20;

serve(async (req, body) => {
  const device = deviceId(body.device_id);
  const admin = isAdminSecret(body.admin_secret);
  const id = str(body.id);
  if (!id) throw new ApiError(400, "invalid", "Missing post id.");

  const { data: post } = await db.from("posts").select("id, device_id, hidden").eq("id", id).maybeSingle();
  if (!post || post.hidden) return json(req, { ok: true }); // already gone

  if (!admin) {
    if (await isReadOnly()) throw new ApiError(423, "read_only", "Deleting is paused right now.");
    if (!post.device_id || post.device_id !== device) throw new ApiError(403, "not_owner", "Only the person who posted this can delete it.");
    await rateLimit("deleted_by", device, "deleted_at", DELETES_PER_10_MIN, "deleted");
  }

  const { error } = await db
    .from("posts")
    .update({ hidden: true, deleted_at: new Date().toISOString(), deleted_by: admin ? "admin" : device })
    .eq("id", id);
  if (error) throw error;
  return json(req, { ok: true });
});
