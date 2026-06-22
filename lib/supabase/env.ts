// Centralizes the public Supabase credentials. Supabase renamed the public
// client key from "anon" to "publishable" (sb_publishable_…); we accept either
// env var name so the app works on new and older projects alike.
// NEXT_PUBLIC_* values are inlined at build time by Next.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_KEY = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;
