// HTTP helpers shared by all functions: CORS, JSON responses, typed errors.

const ALLOWED_ORIGINS = ["https://anupambuilds.github.io", "http://localhost:3000"];

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

/** Error the client can show on a specific form field. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public field?: string,
    public extra?: Record<string, unknown>
  ) {
    super(message);
  }
}

export function fail(req: Request, e: unknown): Response {
  if (e instanceof ApiError) {
    return json(req, { error: { code: e.code, message: e.message, field: e.field, ...e.extra } }, e.status);
  }
  console.error(e);
  return json(req, { error: { code: "server_error", message: "Something went wrong. Try again." } }, 500);
}

/** Wraps a handler with CORS preflight, POST-only and error handling. */
export function serve(handler: (req: Request, body: Record<string, unknown>) => Promise<Response>) {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
    if (req.method !== "POST") return json(req, { error: { code: "method", message: "POST only" } }, 405);
    try {
      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
      return await handler(req, body);
    } catch (e) {
      return fail(req, e);
    }
  });
}

export function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function deviceId(v: unknown): string {
  const d = str(v);
  if (!d || d.length < 8 || d.length > 64) throw new ApiError(400, "device", "Missing device id.");
  return d;
}
