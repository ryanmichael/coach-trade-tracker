import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/auth/callback
 * Supabase redirects here after magic link click.
 * Exchanges the code for a session, then redirects to /options-finder.
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/options-finder";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Call on-login to ensure User record exists
      const baseUrl = origin || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
      await fetch(`${baseUrl}/api/auth/on-login`, {
        method: "POST",
        headers: {
          cookie: req.headers.get("cookie") ?? "",
        },
      }).catch(() => {
        // Non-critical — on-login will be called on next page load if this fails
      });

      return NextResponse.redirect(new URL(next, origin));
    }
  }

  // Auth failed — redirect to login with error
  return NextResponse.redirect(new URL("/login?error=auth_failed", origin));
}
