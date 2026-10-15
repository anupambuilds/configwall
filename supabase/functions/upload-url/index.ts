// Signed upload URL for a met-card photo (the bucket is public to read, not to write).
import { db, isReadOnly, PHOTO_URL_PREFIX } from "../_shared/db.ts";
import { ApiError, deviceId, json, serve } from "../_shared/http.ts";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

serve(async (req, body) => {
  const device = deviceId(body.device_id);
  const ext = TYPES[String(body.content_type)];
  if (!ext) throw new ApiError(400, "invalid", "Photos must be JPG, PNG or WebP.", "photos");
  if (await isReadOnly()) throw new ApiError(423, "read_only", "Posting is paused right now.");

  const path = `${device.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 40)}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await db.storage.from("photos").createSignedUploadUrl(path);
  if (error) throw error;
  return json(req, { path, token: data.token, signed_url: data.signedUrl, public_url: PHOTO_URL_PREFIX + path });
});
