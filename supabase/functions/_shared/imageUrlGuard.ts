// Validate that an imageUrl points to our own Supabase Storage, blocking
// SSRF attempts against internal/cloud-metadata endpoints.
export function isAllowedImageUrl(raw: string): boolean {
  if (!raw || typeof raw !== "string") return false;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;

  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  let supabaseHost = "";
  try {
    supabaseHost = supabaseUrl ? new URL(supabaseUrl).host : "";
  } catch {
    supabaseHost = "";
  }

  // Allow only our project's Supabase storage host.
  const host = u.host.toLowerCase();
  const okHost =
    (supabaseHost && host === supabaseHost) ||
    /^[a-z0-9-]+\.supabase\.co$/.test(host) ||
    /^[a-z0-9-]+\.supabase\.in$/.test(host);
  if (!okHost) return false;

  // Must be a storage object path.
  return u.pathname.startsWith("/storage/v1/object/");
}
