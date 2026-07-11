import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

// Supabase Auth PKCE callback. Supabase redirects here after a magic link or
// password reset; we exchange the code for a session, then send the user on.
// Next 14: cookies() is synchronous.
// Only allow redirecting to our own /admin, /team or /portal surfaces. `next`
// is attacker-controllable (it rides in the magic-link URL), so anything else
// (external hosts, protocol-relative //evil, path traversal) falls back to a
// safe internal default. Closes open-redirect / landing-surface confusion.
function safeNext(raw: string | null): string {
  if (raw && /^\/(admin|team|portal)(\/|$)/.test(raw) && !raw.includes("..")) return raw;
  return "/admin";
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              for (const { name, value, options } of cookiesToSet) {
                cookieStore.set(name, value, options as CookieOptions);
              }
            } catch {
              // Headers may already be sent — ignore.
            }
          },
        },
      },
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/admin/login?error=auth_callback_failed`);
}
