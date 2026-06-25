import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const globalForSupabase = globalThis as unknown as {
  supabase: SupabaseClient | undefined;
};

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  return { url, anonKey };
}

/** Create a new Supabase client (browser or server components / route handlers). */
export function createSupabaseClient(): SupabaseClient {
  const { url, anonKey } = getSupabaseConfig();
  return createClient(url, anonKey);
}

/** Reuse one client in dev to avoid extra connections during hot reload. */
export function getSupabaseClient(): SupabaseClient {
  if (!globalForSupabase.supabase) {
    globalForSupabase.supabase = createSupabaseClient();
  }
  return globalForSupabase.supabase;
}

/** Ping Supabase REST API (storage/realtime); does not use Supabase Auth. */
export async function checkSupabaseHealth(): Promise<{
  configured: boolean;
  ok: boolean;
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return { configured: false, ok: false, error: "not_configured" };
  }

  const { url, anonKey } = getSupabaseConfig();

  try {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: anonKey },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return { configured: true, ok: false, error: `HTTP ${res.status}` };
    }
    return { configured: true, ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    return { configured: true, ok: false, error: message };
  }
}
