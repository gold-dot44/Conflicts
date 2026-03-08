import NextAuth from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { DEMO_MODE } from "@/lib/env";

const handler = NextAuth(authOptions);

// In demo mode, always return a valid session so SessionProvider
// never overwrites the client-side session with null.
export async function GET(req: NextRequest, ctx: Record<string, unknown>) {
  if (DEMO_MODE && req.nextUrl.pathname.endsWith("/session")) {
    return NextResponse.json({
      user: {
        name: "Demo User",
        email: "demo@example.com",
        upn: "demo@example.com",
        role: "admin",
        groups: [],
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
  }
  return handler(req, ctx);
}

export { handler as POST };
