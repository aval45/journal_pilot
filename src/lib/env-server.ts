import "server-only";

export function getSupabaseSecretKey() {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error("SUPABASE_SECRET_KEY is required for privileged auth cleanup.");
  }

  return key;
}
