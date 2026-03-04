import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, hasPermission } from "@/lib/auth";
import { compositeSearch, DEFAULT_WEIGHTS } from "@/lib/fuzzy-search";
import { logSearch } from "@/lib/audit";
import type { SearchRequest } from "@/types";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { upn: string; role: string };
  if (!hasPermission(user.role as "analyst" | "reviewer" | "admin" | "readonly", "search")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body: SearchRequest = await request.json();

  if (!body.query || body.query.trim().length < 2) {
    return NextResponse.json(
      { error: "Search query must be at least 2 characters" },
      { status: 400 }
    );
  }

  const results = await compositeSearch(body, DEFAULT_WEIGHTS);

  // Log to immutable audit trail
  const auditLogId = await logSearch({
    searchedBy: user.upn,
    searchTerms: body.query,
    algorithmsApplied: {
      weights: DEFAULT_WEIGHTS,
      extensions: ["pg_trgm", "fuzzystrmatch"],
    },
    resultsSnapshot: results,
  });

  return NextResponse.json({ auditLogId, results });
}
