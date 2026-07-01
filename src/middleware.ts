import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth-constants";
import { verifyAccessTokenEdge } from "@/lib/auth-jwt";

function enforceHttps(request: NextRequest): NextResponse | null {
  if (process.env.NODE_ENV !== "production") return null;

  const proto = request.headers.get("x-forwarded-proto");
  if (proto !== "http") return null;

  const httpsUrl = request.nextUrl.clone();
  httpsUrl.protocol = "https:";
  return NextResponse.redirect(httpsUrl, 308);
}

export async function middleware(request: NextRequest) {
  const httpsRedirect = enforceHttps(request);
  if (httpsRedirect) return httpsRedirect;

  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/enroll/")) {
    return NextResponse.next();
  }

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password")
  ) {
    const token = request.cookies.get(ACCESS_COOKIE)?.value;
    if (token && (await verifyAccessTokenEdge(token))) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/dashboard") || pathname.startsWith("/admin")) {
    const token = request.cookies.get(ACCESS_COOKIE)?.value;
    const refresh = request.cookies.get(REFRESH_COOKIE)?.value;

    if (token && (await verifyAccessTokenEdge(token))) {
      return NextResponse.next();
    }

    if (refresh) {
      return NextResponse.next();
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
