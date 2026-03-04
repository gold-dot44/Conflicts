import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, hasPermission } from "@/lib/auth";
import { getAuditTrail } from "@/lib/audit";
import { generateAuditPdf } from "@/lib/pdf";

export async function GET(request: NextRequest) {
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

    return new NextResponse(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="audit-${entry.id}.pdf"`,
      },
    });
  }

  return NextResponse.json({ trail });
}
