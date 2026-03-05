import { NextRequest, NextResponse } from "next/server";
import { reviewCheckRequest } from "@/lib/demo-data";
import type { CheckRequestStatus } from "@/types";

/**
 * POST /api/conflict-checks/[id]/review
 * Reviewer decision on a conflict check request.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const { decision, reviewNotes } = body as {
    decision: CheckRequestStatus;
    reviewNotes: string;
  };

  if (!decision) {
    return NextResponse.json({ error: "Missing decision" }, { status: 400 });
  }

  const success = reviewCheckRequest(
    id,
    decision,
    reviewNotes ?? "",
    "demo@example.com"
  );

  if (!success) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
