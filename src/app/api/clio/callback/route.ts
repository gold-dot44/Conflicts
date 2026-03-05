import { NextRequest, NextResponse } from "next/server";
import { setClioTokens } from "@/lib/clio/client";

/**
 * OAuth 2.0 callback for Clio authorization.
 * Exchanges the authorization code for access + refresh tokens.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/admin?clio_error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/admin?clio_error=no_code", request.url)
    );
  }

  try {
    const res = await fetch("https://app.clio.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: process.env.CLIO_CLIENT_ID!,
        client_secret: process.env.CLIO_CLIENT_SECRET!,
        redirect_uri: process.env.CLIO_REDIRECT_URI!,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Clio token exchange failed:", text);
      return NextResponse.redirect(
        new URL("/admin?clio_error=token_exchange_failed", request.url)
      );
    }

    const data = await res.json();

    // Store tokens in memory (in production, use encrypted DB storage)
    setClioTokens({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    });

    // Store connection state in a global for the status endpoint
    (globalThis as Record<string, unknown>).__clioConnected = true;
    (globalThis as Record<string, unknown>).__clioConnectedAt = new Date().toISOString();

    return NextResponse.redirect(
      new URL("/admin?clio_success=true", request.url)
    );
  } catch (err) {
    console.error("Clio OAuth error:", err);
    return NextResponse.redirect(
      new URL("/admin?clio_error=internal_error", request.url)
    );
  }
}
