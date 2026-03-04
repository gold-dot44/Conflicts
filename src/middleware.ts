import { withAuth } from "next-auth/middleware";

export default withAuth({
  callbacks: {
    authorized({ token }) {
      return !!token;
    },
  },
});

export const config = {
  matcher: [
    "/search/:path*",
    "/lateral-import/:path*",
    "/ethical-walls/:path*",
    "/audit/:path*",
    "/admin/:path*",
    "/api/search/:path*",
    "/api/conflicts/:path*",
    "/api/ethical-walls/:path*",
    "/api/lateral-import/:path*",
    "/api/audit/:path*",
    "/api/admin/:path*",
  ],
};
