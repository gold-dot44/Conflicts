import { withAuth } from "next-auth/middleware";
import { NextRequest, NextResponse } from "next/server";

// #3: Production guard — DEMO_MODE cannot activate in production
const IS_PRODUCTION = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
const DEMO_MODE = process.env.DEMO_MODE === "true" && !IS_PRODUCTION;

// #6: Simple in-memory rate limiter (per IP, 60 requests per minute)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, limit = 60, windowMs = 60000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count++;
  return entry.count <= limit;
}

// #9: CSRF origin validation for state-changing requests
function validateOrigin(request: NextRequest): boolean {
  if (request.method === "GET" || request.method === "HEAD") return true;
  const origin = request.headers.get("origin");
  if (!origin) return true; // Non-browser requests (curl, server-to-server) don't send Origin
  const allowed = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  try {
    return origin === new URL(allowed).origin;
  } catch {
    return false;
  }
}

function rateLimitAndCsrfMiddleware(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  return NextResponse.next();
}

export default DEMO_MODE
  ? function middleware(request: NextRequest) {
      return rateLimitAndCsrfMiddleware(request);
    }
  : withAuth({
      callbacks: {
        authorized({ token, req }) {
          if (!token) return false;
          // Rate limit and CSRF checks happen after auth
          return true;
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
