import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, hasPermission } from "@/lib/auth";
import { compositeSearch, DEFAULT_WEIGHTS } from "@/lib/fuzzy-search";
import { logSearch } from "@/lib/audit";
import { searchEntities } from "@/lib/demo-data";
import { query } from "@/lib/db";
import type { SearchRequest, FuzzyWeights } from "@/types";

import { DEMO_MODE } from "@/lib/env";

/**
 * Fetch admin-configured weights and suppressions from app_config.
 * Falls back to DEFAULT_WEIGHTS if not configured.
 */
async function getSearchConfig(): Promise<{
  weights: FuzzyWeights;
  suppressions: string[];
}> {
  const rows = await query<{ config_key: string; config_value: string }>(
    `SELECT config_key, config_value FROM app_config
     WHERE config_key IN ('fuzzy_weights', 'common_name_suppressions')`
  );

  let weights = DEFAULT_WEIGHTS;
  let suppressions: string[] = [];

  for (const row of rows) {
    if (row.config_key === "fuzzy_weights") {
      try { weights = JSON.parse(row.config_value); } catch { /* use default */ }
    }
    if (row.config_key === "common_name_suppressions") {
      try { suppressions = JSON.parse(row.config_value); } catch { /* use default */ }
    }
  }

  return { weights, suppressions };
}

export async function POST(request: NextRequest) {
  if (DEMO_MODE) {
    const body: SearchRequest = await request.json();
    const results = searchEntities(body.query, body.searchType);
    return NextResponse.json({ auditLogId: "demo-audit-1", results });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { upn: string; role: string };
  if (!hasPermission(user.role as "analyst" | "reviewer" | "admin" | "readonly", "search")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body: SearchRequest = await request.json();

  // #5: Sanitize and limit search input
  const sanitizedQuery = body.query?.trim().slice(0, 500).replace(/[<>]/g, "") ?? "";
  if (sanitizedQuery.length < 2) {
    return NextResponse.json(
      { error: "Search query must be at least 2 characters" },
      { status: 400 }
    );
  }
  body.query = sanitizedQuery;

  // Fetch admin-configured weights and suppressions from DB
  const { weights, suppressions } = await getSearchConfig();

  // Use queryAsUser to activate RLS ethical wall policies
  const results = await compositeSearch(body, weights, 50, user.upn, suppressions);

  // Log to immutable audit trail (append-only INSERT)
  const auditLogId = await logSearch({
    searchedBy: user.upn,
    searchTerms: body.query,
    algorithmsApplied: {
      weights,
      extensions: ["pg_trgm", "fuzzystrmatch"],
    },
    resultsSnapshot: results,
  });

  return NextResponse.json({ auditLogId, results });
}
