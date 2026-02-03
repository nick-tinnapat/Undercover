import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const pathname = url.pathname;

  if (pathname.startsWith("/room/") || pathname.startsWith("/game/")) {
    const guest = req.cookies.get("uc_guest")?.value;
    if (!guest) {
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = "/";
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/room/:path*", "/game/:path*"],
};
