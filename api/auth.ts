import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

type ServerSupabase = SupabaseClient;

const runtimeProcess = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
const supabaseUrl = runtimeProcess?.SUPABASE_URL || runtimeProcess?.VITE_SUPABASE_URL;
const supabasePublishableKey = runtimeProcess?.SUPABASE_PUBLISHABLE_KEY || runtimeProcess?.VITE_SUPABASE_PUBLISHABLE_KEY;

export type AuthenticatedSupabase = {
  user: User;
  supabase: ServerSupabase;
  isAnonymous: boolean;
};

export async function getAuthenticatedUser(
  request: Request,
): Promise<{ user: User | null; supabase: ServerSupabase | null; isAnonymous: boolean; error: string | null }> {
  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!token || !supabaseUrl || !supabasePublishableKey) {
    return { user: null, supabase: null, isAnonymous: false, error: "Authentication is required." };
  }

  const supabase = createClient(supabaseUrl, supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { user: null, supabase: null, isAnonymous: false, error: "Authentication is invalid or expired." };
  }

  const isAnonymous = data.user.is_anonymous === true
    || data.user.app_metadata?.provider === "anonymous";

  return { user: data.user, supabase, isAnonymous, error: null };
}

export async function getAuthorizedBusinessIds(
  supabase: ServerSupabase,
  userId: string,
): Promise<{ businessIds: string[]; error: string | null }> {
  const { data, error } = await supabase
    .from("business_members")
    .select("business_id")
    .eq("user_id", userId);

  if (error) {
    console.error(JSON.stringify({
      event: "auth.business_scope_failed",
      error: error.message,
    }));
    return { businessIds: [], error: "Unable to resolve business access." };
  }

  return {
    businessIds: [...new Set((data ?? []).map((row) => row.business_id).filter((id): id is string => typeof id === "string"))],
    error: null,
  };
}

export function getAdminSupabase(): ServerSupabase | null {
  const secretKey = runtimeProcess?.SUPABASE_SECRET_KEY || runtimeProcess?.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !secretKey) return null;
  return createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
