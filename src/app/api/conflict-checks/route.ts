import { NextRequest, NextResponse } from "next/server";
import {
  getAllCheckRequests, getRecentCheckRequests, getPendingReviewRequests,
  createCheckRequest, getDemoStats,
} from "@/lib/demo-data";
import type { CheckRequestType, SubjectRole, EntityType } from "@/types";

/**
 * GET /api/conflict-checks
 * Query params: ?view=pending|recent|all
 */
export async function GET(request: NextRequest) {
  const view = request.nextUrl.searchParams.get("view") ?? "recent";

  if (view === "pending") {
    return NextResponse.json({
      requests: getPendingReviewRequests(),
      stats: getDemoStats(),
    });
  }

  if (view === "all") {
    return NextResponse.json({ requests: getAllCheckRequests() });
  }

  return NextResponse.json({
    requests: getRecentCheckRequests(),
    stats: getDemoStats(),
  });
}

/**
 * POST /api/conflict-checks
 * Create a new conflict check request and run all searches.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();

  const { requestType, prospectiveMatter, requestingAttorney, subjects } = body as {
    requestType: CheckRequestType;
    prospectiveMatter: string;
    requestingAttorney: string;
    subjects: Array<{
      subjectName: string;
      subjectRole: SubjectRole;
      subjectType: EntityType | "unknown";
    }>;
  };

  if (!prospectiveMatter || !requestingAttorney || !subjects?.length) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const checkRequest = createCheckRequest({
    requestType,
    prospectiveMatter,
    requestingAttorney,
    subjects,
  });

  return NextResponse.json(checkRequest);
}
