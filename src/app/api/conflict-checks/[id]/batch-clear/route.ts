import { NextRequest, NextResponse } from "next/server";
import { batchClearLowRisk } from "@/lib/demo-data";

/**
 * POST /api/conflict-checks/[id]/batch-clear
 * Clear all low-risk subjects below a threshold in one action.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const threshold = body.threshold ?? 0.25;

  const cleared = batchClearLowRisk(id, threshold, "demo@example.com");

  return NextResponse.json({ cleared });
}
