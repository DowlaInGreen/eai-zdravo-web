import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Zaštita stranica. /api/calendar/events sam vraća 401 (JSON), ne redirect.
export default auth((req) => {
  if (!req.auth) {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }
});

export const config = { matcher: ["/", "/dashboard/:path*", "/week/:path*"] };
