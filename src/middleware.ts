import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/health"];
const SESSION_COOKIE = "ams_session";

/**
 * Middleware سبک (Edge runtime — بدون Prisma/Node crypto):
 * فقط وجود کوکی session را چک می‌کند. اعتبارسنجی واقعی توکن
 * در route handler ها با requireAuth انجام می‌شود (Node runtime).
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (isPublic) return NextResponse.next();

  const hasCookie = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
  if (hasCookie) return NextResponse.next();

  // API → 401 JSON | صفحه → redirect لاگین
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "ورود لازم است" } },
      { status: 401 },
    );
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // فایل‌های استاتیک (فونت/آیکون/لوگو) از auth مستثنا — مانند meetinghub
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|fonts/|icons/|logo.*\\.png|sw\\.js|offline\\.html|apple-touch-icon\\.png).*)",
  ],
};
