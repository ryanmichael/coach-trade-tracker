import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only protect these routes
  const isProtected =
    pathname.startsWith("/options-finder") || pathname.startsWith("/admin");
  const isLogin = pathname === "/login";
  const isAuthCallback = pathname.startsWith("/api/auth/callback");
  const isAuthApi =
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/admin/");

  // Let auth callback and API routes through (they handle their own auth)
  if (isAuthCallback || (isAuthApi && !pathname.startsWith("/api/admin/"))) {
    return NextResponse.next();
  }

  // Create Supabase client for middleware
  let response = NextResponse.next({ request: req });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            req.cookies.set(name, value)
          );
          response = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If logged in and hitting /login, redirect to options-finder
  if (isLogin && user) {
    return NextResponse.redirect(new URL("/options-finder", req.url));
  }

  // If not logged in and hitting a protected route, redirect to login
  if (isProtected && !user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/login",
    "/options-finder/:path*",
    "/admin/:path*",
    "/api/admin/:path*",
  ],
};
