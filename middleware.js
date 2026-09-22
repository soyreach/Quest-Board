import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const role = req.nextauth.token?.role;

    // Faculty-only area.
    if (pathname.startsWith("/professor") && role !== "Professor") {
      return NextResponse.redirect(new URL("/student/dashboard", req.url));
    }

    // Anyone signed in (with a role already chosen) can reach the student
    // area, the board, and the AI sidekick.
    if (
      (pathname.startsWith("/student") ||
        pathname.startsWith("/board") ||
        pathname.startsWith("/ai-sidekick")) &&
      !role
    ) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // withAuth only runs the middleware above if this returns true —
      // i.e. the user must already have a valid session token.
      authorized: ({ token }) => !!token,
    },
    pages: { signIn: "/login" },
  }
);

export const config = {
  matcher: ["/professor/:path*", "/student/:path*", "/board/:path*", "/ai-sidekick/:path*"],
};
