import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATHS = [
  "/login",
  "/setup",
  "/api/v1/health",
  // Pratinjau UI tanpa login, hanya di development (halamannya 404 di production)
  ...(process.env.NODE_ENV === "development" ? ["/dev/preview"] : []),
];
// PRD §18: sesi otomatis keluar setelah 12 jam tidak aktif
const IDLE_LIMIT_MS = 12 * 60 * 60 * 1000;
const LAST_ACTIVITY_COOKIE = "bk_last_activity";

/** Refresh sesi Supabase, logout jika idle > 12 jam, dan arahkan ke /login bila belum masuk. */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.SUPABASE_INTERNAL_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims);
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (isLoggedIn) {
    const last = Number(request.cookies.get(LAST_ACTIVITY_COOKIE)?.value);
    if (last && Date.now() - last > IDLE_LIMIT_MS) {
      await supabase.auth.signOut();
      const redirect = redirectTo(request, "/login", "idle");
      response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
      redirect.cookies.delete(LAST_ACTIVITY_COOKIE);
      return redirect;
    }
    response.cookies.set(LAST_ACTIVITY_COOKIE, String(Date.now()), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });

    if (pathname === "/login" || pathname === "/") {
      return withCookies(redirectTo(request, "/dashboard"), response);
    }
    return response;
  }

  if (!isPublic) {
    return withCookies(redirectTo(request, "/login"), response);
  }
  return response;
}

function redirectTo(request: NextRequest, path: string, reason?: string) {
  const url = request.nextUrl.clone();
  url.pathname = path;
  url.search = reason ? `?reason=${reason}` : "";
  return NextResponse.redirect(url);
}

function withCookies(target: NextResponse, source: NextResponse) {
  source.cookies.getAll().forEach((c) => target.cookies.set(c));
  return target;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
