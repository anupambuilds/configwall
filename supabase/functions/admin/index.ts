// Admin actions, all gated by the ADMIN_SECRET function secret.
//   verify                     → { ok }
//   set_hidden { id, hidden }  → hide (soft delete) or restore any post
//   set_read_only { on }       → pause/resume posting and deleting for everyone else
//   list_hidden                → hidden posts, for "Show hidden" on the wall
import { isAdminSecret } from "../_shared/admin.ts";
import { db, PUBLIC_COLUMNS } from "../_shared/db.ts";
import { ApiError, json, serve, str } from "../_shared/http.ts";

serve(async (req, body) => {
  if (!isAdminSecret(body.admin_secret)) {
    // Slow down guessing.
    await new Promise((r) => setTimeout(r, 600));
    if (body.action === "verify") return json(req, { ok: false });
    throw new ApiError(401, "not_admin", "Admin secret required.");
  }

  switch (body.action) {
    case "verify":
      return json(req, { ok: true });

    case "set_hidden": {
      const id = str(body.id);
      if (!id) throw new ApiError(400, "invalid", "Missing post id.");
      const hidden = body.hidden === true;
      const { data, error } = await db
        .from("posts")
        .update(hidden ? { hidden: true, deleted_at: new Date().toISOString(), deleted_by: "admin" } : { hidden: false, deleted_at: null, deleted_by: null })
        .eq("id", id)
        .select(PUBLIC_COLUMNS)
        .maybeSingle();
      if (error) throw error;
      return json(req, { post: data });
    }

    case "set_read_only": {
      const { error } = await db.from("settings").update({ read_only: body.on === true, updated_at: new Date().toISOString() }).eq("id", true);
      if (error) throw error;
      return json(req, { ok: true });
    }

    case "list_hidden": {
      const { data, error } = await db.from("posts").select(PUBLIC_COLUMNS).eq("hidden", true).order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return json(req, { posts: data });
    }

    default:
      throw new ApiError(400, "invalid", "Unknown admin action.");
  }
});
