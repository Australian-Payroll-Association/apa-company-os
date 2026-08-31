import { createBrowserClient } from "@supabase/ssr";

// Browser Supabase client (publishable key only) for the login form and any
// client island that needs the auth session. NEVER use this to read company_os
// CRM data — the publishable key has no RLS grants there by design.
export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
