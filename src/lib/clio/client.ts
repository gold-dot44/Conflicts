/**
 * Clio API v4 client with rate limiting, cursor pagination, and field management.
 *
 * Tokens are stored in the PostgreSQL oauth_tokens table (encrypted at rest
 * via column-level encryption or Azure TDE). Falls back to in-memory storage
 * only in demo mode.
 */

import { query } from "../db";

const DEMO_MODE = process.env.DEMO_MODE === "true";

interface ClioTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

// Token bucket rate limiter: 50 req/min peak
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens = 45; // conservative buffer below 50
  private readonly refillRate = 45; // tokens per 60s

  constructor() {
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens < 1) {
      const waitMs = ((60 * 1000) / this.refillRate) * (1 - this.tokens);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      this.refill();
    }
    this.tokens -= 1;
  }

  updateFromHeaders(remaining: string | null): void {
    if (remaining !== null) {
      this.tokens = Math.min(parseInt(remaining, 10), this.maxTokens);
    }
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(
      this.maxTokens,
      this.tokens + (elapsed / 60) * this.refillRate
    );
    this.lastRefill = now;
  }
}

const rateLimiter = new RateLimiter();

// In-memory cache to avoid hitting DB on every request
let cachedTokens: ClioTokens | null = null;

/**
 * Persist Clio tokens to the database (or in-memory for demo mode).
 */
export async function setClioTokens(t: ClioTokens): Promise<void> {
  cachedTokens = t;

  if (DEMO_MODE) return;

  await query(
    `INSERT INTO oauth_tokens (provider, access_token, refresh_token, expires_at, updated_at)
     VALUES ('clio', $1, $2, to_timestamp($3 / 1000.0), NOW())
     ON CONFLICT (provider) DO UPDATE SET
       access_token = $1,
       refresh_token = $2,
       expires_at = to_timestamp($3 / 1000.0),
       updated_at = NOW()`,
    [t.accessToken, t.refreshToken, t.expiresAt]
  );
}

/**
 * Load Clio tokens from the database (with in-memory caching).
 */
async function loadTokens(): Promise<ClioTokens | null> {
  if (cachedTokens) return cachedTokens;
  if (DEMO_MODE) return null;

  const rows = await query<{
    access_token: string;
    refresh_token: string;
    expires_at: string;
  }>(
    `SELECT access_token, refresh_token, EXTRACT(EPOCH FROM expires_at) * 1000 AS expires_at
     FROM oauth_tokens WHERE provider = 'clio'`
  );

  if (rows.length === 0) return null;

  cachedTokens = {
    accessToken: rows[0].access_token,
    refreshToken: rows[0].refresh_token,
    expiresAt: Number(rows[0].expires_at),
  };
  return cachedTokens;
}

async function refreshAccessToken(): Promise<void> {
  const tokens = await loadTokens();
  if (!tokens) throw new Error("Clio tokens not configured");

  const res = await fetch("https://app.clio.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokens.refreshToken,
      client_id: process.env.CLIO_CLIENT_ID!,
      client_secret: process.env.CLIO_CLIENT_SECRET!,
    }),
  });

  if (!res.ok) throw new Error(`Clio token refresh failed: ${res.status}`);

  const data = await res.json();
  const newTokens: ClioTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  // Persist refreshed tokens to DB
  await setClioTokens(newTokens);
}

async function getAccessToken(): Promise<string> {
  const tokens = await loadTokens();
  if (!tokens) throw new Error("Clio tokens not configured");
  if (Date.now() >= tokens.expiresAt - 60000) {
    await refreshAccessToken();
  }
  return cachedTokens!.accessToken;
}

export async function clioFetch<T>(
  endpoint: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  await rateLimiter.acquire();

  const accessToken = await getAccessToken();
  const baseUrl = process.env.CLIO_API_BASE_URL ?? "https://app.clio.com/api/v4";

  const url = endpoint.startsWith("http") ? endpoint : `${baseUrl}${endpoint}`;

  const res = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  // Update rate limiter from response headers
  rateLimiter.updateFromHeaders(res.headers.get("X-RateLimit-Remaining"));

  if (res.status === 429) {
    // Exponential backoff on rate limit
    const retryAfter = parseInt(res.headers.get("Retry-After") ?? "5", 10);
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
    return clioFetch<T>(endpoint, options);
  }

  if (!res.ok) {
    throw new Error(`Clio API error: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

/**
 * Paginate through all results using cursor pagination.
 * Clio uses order=id(asc) with meta.paging.next URLs.
 */
export async function clioPaginate<T>(
  endpoint: string,
  fields: string
): Promise<T[]> {
  const allResults: T[] = [];
  let url = `${endpoint}?fields=${encodeURIComponent(fields)}&order=id(asc)&limit=200`;

  while (url) {
    const response = await clioFetch<{
      data: T[];
      meta: { paging: { next?: string } };
    }>(url);

    allResults.push(...response.data);
    url = response.meta?.paging?.next ?? "";
  }

  return allResults;
}

// Field registries for each resource type
export const CONTACT_FIELDS =
  "id,name,first_name,last_name,type,company,email_addresses,phone_numbers,custom_field_values{field_name,value,picklist_option}";

export const MATTER_FIELDS =
  "id,display_number,description,status,practice_area,responsible_attorney,open_date,close_date,client,custom_field_values{field_name,value,picklist_option}";

export const RELATIONSHIP_FIELDS =
  "id,description,contact{id,name,type},matter{id}";
