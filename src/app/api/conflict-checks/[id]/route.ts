import { NextRequest, NextResponse } from "next/server";
import { getCheckRequestById, getEnrichedSubjectResults } from "@/lib/demo-data";

/**
 * GET /api/conflict-checks/[id]
 * Returns the conflict check request with enriched search results.
 */
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const checkRequest = getCheckRequestById(id);

  if (!checkRequest) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Enrich subjects with current search results and match descriptions
  const enrichedSubjects = checkRequest.subjects.map((subject) => {
    const enrichedResults = getEnrichedSubjectResults(
      subject.subjectName,
      subject.subjectType
    );
    return {
      ...subject,
      results: enrichedResults,
    };
  });

  return NextResponse.json({
    ...checkRequest,
    subjects: enrichedSubjects,
  });
}
