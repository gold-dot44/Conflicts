import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, hasPermission } from "@/lib/auth";
import { getAuditTrail } from "@/lib/audit";
import { generateAuditPdf } from "@/lib/pdf";

const DEMO_MODE = process.env.DEMO_MODE === "true";

const DEMO_AUDIT = [
  {
    id: "audit-1",
    searched_by: "sarah.johnson@firm.com",
    search_terms: "Acme Corporation",
    search_timestamp: "2026-03-03T14:30:00Z",
    algorithms_applied: { weights: { levenshtein: 0.3, trigram: 0.3, soundex: 0.1, metaphone: 0.15, fullText: 0.15 } },
    results_snapshot: [{ fullLegalName: "Acme Corporation", compositeScore: 0.92 }],
    disposition: "no_conflict",
    disposition_by: "sarah.johnson@firm.com",
    disposition_rationale: "Client relationship confirmed, no adverse parties identified.",
    disposition_timestamp: "2026-03-03T14:35:00Z",
    related_documents: [],
  },
  {
    id: "audit-2",
    searched_by: "michael.chen@firm.com",
    search_terms: "Widget Industries",
    search_timestamp: "2026-03-02T10:15:00Z",
    algorithms_applied: { weights: { levenshtein: 0.3, trigram: 0.3, soundex: 0.1, metaphone: 0.15, fullText: 0.15 } },
    results_snapshot: [{ fullLegalName: "Widget Industries LLC", compositeScore: 0.88 }],
    disposition: "potential_conflict",
    disposition_by: null,
    disposition_rationale: null,
    disposition_timestamp: null,
    related_documents: [],
  },
  {
    id: "audit-3",
    searched_by: "lisa.park@firm.com",
    search_terms: "John Smith",
    search_timestamp: "2026-03-01T09:00:00Z",
    algorithms_applied: { weights: { levenshtein: 0.3, trigram: 0.3, soundex: 0.1, metaphone: 0.15, fullText: 0.15 } },
    results_snapshot: [{ fullLegalName: "John Smith", compositeScore: 0.65 }, { fullLegalName: "Jonathan Smith", compositeScore: 0.45 }],
    disposition: "conflict_confirmed",
    disposition_by: "robert.kim@firm.com",
    disposition_rationale: "Lateral hire conflict — screened from matter per Rule 1.10.",
    disposition_timestamp: "2026-03-01T11:20:00Z",
    related_documents: ["screening-memo-001.pdf"],
  },
  {
    id: "audit-4",
    searched_by: "sarah.johnson@firm.com",
    search_terms: "Global Dynamics",
    search_timestamp: "2026-02-28T16:45:00Z",
    algorithms_applied: { weights: { levenshtein: 0.3, trigram: 0.3, soundex: 0.1, metaphone: 0.15, fullText: 0.15 } },
    results_snapshot: [],
    disposition: null,
    disposition_by: null,
    disposition_rationale: null,
    disposition_timestamp: null,
    related_documents: [],
  },
];

export async function GET(request: NextRequest) {
  if (DEMO_MODE) {
    return NextResponse.json({ trail: DEMO_AUDIT });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { upn: string; role: string };
  if (!hasPermission(user.role as "analyst" | "reviewer" | "admin" | "readonly", "view_audit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const format = params.get("format");

  const trail = await getAuditTrail({
    matterId: params.get("matterId") ?? undefined,
    entityId: params.get("entityId") ?? undefined,
    searchedBy: params.get("searchedBy") ?? undefined,
    limit: parseInt(params.get("limit") ?? "50", 10),
    offset: parseInt(params.get("offset") ?? "0", 10),
  });

  if (format === "pdf" && trail.length > 0) {
    const entry = trail[0] as Record<string, unknown>;
    const pdfBytes = await generateAuditPdf({
      searchTerms: entry.search_terms as string,
      searchedBy: entry.searched_by as string,
      searchTimestamp: entry.search_timestamp as string,
      results: entry.results_snapshot as unknown[],
      disposition: entry.disposition as string | undefined,
      dispositionBy: entry.disposition_by as string | undefined,
      dispositionRationale: entry.disposition_rationale as string | undefined,
    });

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="audit-${entry.id}.pdf"`,
      },
    });
  }

  return NextResponse.json({ trail });
}
