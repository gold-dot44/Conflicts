import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, hasPermission } from "@/lib/auth";
import { recordDisposition } from "@/lib/audit";
import type { DispositionRequest } from "@/types";

const DEMO_MODE = process.env.DEMO_MODE === "true";

export async function POST(request: NextRequest) {
  if (DEMO_MODE) {
    return NextResponse.json({ success: true });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { upn: string; role: string };
  const body: DispositionRequest = await request.json();

  const requiresApproval =
    body.disposition === "conflict_confirmed" || body.disposition === "waiver_obtained";

  if (requiresApproval && !hasPermission(user.role as "analyst" | "reviewer" | "admin" | "readonly", "approve_disposition")) {
    return NextResponse.json(
      { error: "Only reviewers or admins can confirm conflicts or record waivers" },
      { status: 403 }
    );
  }

  if (!hasPermission(user.role as "analyst" | "reviewer" | "admin" | "readonly", "disposition")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await recordDisposition({
    auditLogId: body.auditLogId,
    disposition: body.disposition,
    dispositionBy: user.upn,
    rationale: body.rationale,
    entityId: body.entityId,
    matterId: body.matterId,
  });

  return NextResponse.json({ success: true });
}
