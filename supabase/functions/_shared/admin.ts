// Admin secret check (constant-time compare against the ADMIN_SECRET function secret).

export function isAdminSecret(secret: unknown): boolean {
  const expected = Deno.env.get("ADMIN_SECRET") ?? "";
  if (typeof secret !== "string" || !expected || secret.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < secret.length; i++) diff |= secret.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
