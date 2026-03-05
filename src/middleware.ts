import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const DEMO_MODE = process.env.DEMO_MODE === "true";

export default DEMO_MODE
  ? function middleware() {
      return NextResponse.next();
    }
  : withAuth({
      callbacks: {
        authorized({ token }) {
          return !!token;
        },
      },
    });

export const config = {
  matcher: [
    "/search/:path*",
    "/import/:path*",
    "/ethical-walls/:path*",
    "/audit/:path*",
    "/admin/:path*",
    "/conflict-checks/:path*",
    "/help/:path*",
    "/api/search/:path*",
    "/api/conflicts/:path*",
    "/api/conflict-checks/:path*",
    "/api/ethical-walls/:path*",
    "/api/lateral-import/:path*",
    "/api/historical-import/:path*",
    "/api/audit/:path*",
    "/api/admin/:path*",
  ],
};
