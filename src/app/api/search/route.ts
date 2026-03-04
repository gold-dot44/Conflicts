import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, hasPermission } from "@/lib/auth";
import { compositeSearch, DEFAULT_WEIGHTS } from "@/lib/fuzzy-search";
import { logSearch } from "@/lib/audit";
import type { SearchRequest, SearchResult } from "@/types";

const DEMO_MODE = process.env.DEMO_MODE === "true";

const DEMO_DATA: SearchResult[] = [
  {
    entityId: "demo-1",
    fullLegalName: "Acme Corporation",
    firstName: null,
    lastName: null,
    entityType: "company",
    aliases: ["Acme Corp", "Acme Inc."],
    compositeScore: 0.92,
    levenshteinScore: 0.95,
    trigramScore: 0.88,
    soundexMatch: true,
    metaphoneMatch: true,
    fullTextScore: 0.9,
    matters: [
      {
        matterId: "m-1",
        matterName: "Acme Corp v. Widget Industries",
        matterNumber: "2024-001",
        status: "open",
        role: "client",
        responsibleAttorney: "Sarah Johnson",
        practiceArea: "Litigation",
        openDate: "2024-03-15",
        closeDate: null,
      },
      {
        matterId: "m-2",
        matterName: "Acme Corp - Series B Financing",
        matterNumber: "2023-047",
        status: "closed",
        role: "client",
        responsibleAttorney: "Michael Chen",
        practiceArea: "Corporate",
        openDate: "2023-06-01",
        closeDate: "2023-12-15",
      },
    ],
    corporateFamily: [
      { entityId: "demo-5", fullLegalName: "Acme Holdings LLC", relationshipType: "parent", direction: "parent", depth: 1 },
      { entityId: "demo-6", fullLegalName: "Acme Technologies Inc.", relationshipType: "subsidiary", direction: "child", depth: 1 },
      { entityId: "demo-7", fullLegalName: "Acme Digital Services", relationshipType: "division", direction: "child", depth: 2 },
    ],
  },
  {
    entityId: "demo-2",
    fullLegalName: "John Smith",
    firstName: "John",
    lastName: "Smith",
    entityType: "person",
    aliases: ["J. Smith", "Jonathan Smith"],
    compositeScore: 0.65,
    levenshteinScore: 0.7,
    trigramScore: 0.6,
    soundexMatch: true,
    metaphoneMatch: true,
    fullTextScore: 0.5,
    matters: [
      {
        matterId: "m-3",
        matterName: "Smith Family Trust",
        matterNumber: "2024-012",
        status: "open",
        role: "client",
        responsibleAttorney: "Lisa Park",
        practiceArea: "Estate Planning",
        openDate: "2024-01-10",
        closeDate: null,
      },
    ],
    corporateFamily: [],
  },
  {
    entityId: "demo-3",
    fullLegalName: "Widget Industries LLC",
    firstName: null,
    lastName: null,
    entityType: "company",
    aliases: ["Widget Industries"],
    compositeScore: 0.45,
    levenshteinScore: 0.3,
    trigramScore: 0.5,
    soundexMatch: false,
    metaphoneMatch: false,
    fullTextScore: 0.6,
    matters: [
      {
        matterId: "m-1",
        matterName: "Acme Corp v. Widget Industries",
        matterNumber: "2024-001",
        status: "open",
        role: "adverse_party",
        responsibleAttorney: "Sarah Johnson",
        practiceArea: "Litigation",
        openDate: "2024-03-15",
        closeDate: null,
      },
    ],
    corporateFamily: [],
  },
  {
    entityId: "demo-4",
    fullLegalName: "Jane Doe",
    firstName: "Jane",
    lastName: "Doe",
    entityType: "person",
    aliases: [],
    compositeScore: 0.28,
    levenshteinScore: 0.2,
    trigramScore: 0.3,
    soundexMatch: false,
    metaphoneMatch: false,
    fullTextScore: 0.35,
    matters: [
      {
        matterId: "m-4",
        matterName: "Doe v. Metro Transit Authority",
        matterNumber: "2023-089",
        status: "closed",
        role: "client",
        responsibleAttorney: "Robert Kim",
        practiceArea: "Personal Injury",
        openDate: "2023-02-20",
        closeDate: "2024-01-30",
      },
    ],
    corporateFamily: [],
  },
];

export async function POST(request: NextRequest) {
  if (DEMO_MODE) {
    const body: SearchRequest = await request.json();
    const q = body.query.toLowerCase();
    const filtered = DEMO_DATA.filter(
      (r) =>
        r.fullLegalName.toLowerCase().includes(q) ||
        r.aliases.some((a) => a.toLowerCase().includes(q)) ||
        q.length >= 2 // show all in demo for short queries
    );
    return NextResponse.json({ auditLogId: "demo-audit-1", results: filtered });
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
