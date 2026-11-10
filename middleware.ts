import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "@/lib/auth/session";
import { canAccessRoute } from "@/lib/permissions/rbac";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets and API routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const sessionUser = await verifySessionToken(token);

  // If not signed in, redirect all protected pages to /login
  if (!sessionUser) {
    if (pathname.startsWith("/login")) {
      return NextResponse.next();
    }
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // If already signed in and visiting /login, allow or proceed
  if (pathname.startsWith("/login")) {
    return NextResponse.next();
  }

  const activeRole = sessionUser.role;

  if (!canAccessRoute(activeRole, pathname)) {
    const redirectUrl = new URL("/", request.url);
    redirectUrl.searchParams.set("rbac_denied", pathname);
    redirectUrl.searchParams.set("role", activeRole);
    return NextResponse.redirect(redirectUrl);
  }

  const response = NextResponse.next();
  response.headers.set("X-Hotel-IT-Role", activeRole);
  response.headers.set("X-Hotel-IT-Timezone", "Asia/Jakarta");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
