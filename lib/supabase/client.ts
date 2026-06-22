import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_KEY } from "./env";

// Browser-side Supabase client (uses the public publishable/anon key + the
// user's session cookie).
export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
}
