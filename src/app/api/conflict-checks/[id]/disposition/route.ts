import { NextRequest, NextResponse } from "next/server";
import { updateSubjectDisposition } from "@/lib/demo-data";
import type { ConflictDisposition } from "@/types";

/**
 * POST /api/conflict-checks/[id]/disposition
 * Record a disposition for a specific subject within a check request.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const { subjectId, disposition, rationale } = body as {
    subjectId: string;
    disposition: ConflictDisposition;
    rationale: string;
  };

  if (!subjectId || !disposition) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const success = updateSubjectDisposition(
    id,
    subjectId,
    disposition,
    rationale ?? "",
    "demo@example.com"
  );

  if (!success) {
    return NextResponse.json({ error: "Request or subject not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
