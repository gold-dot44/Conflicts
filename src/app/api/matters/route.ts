import { NextRequest, NextResponse } from "next/server";
import { createMatter, getAllMatters, getEntityById } from "@/lib/demo-data";

const DEMO_MODE = process.env.DEMO_MODE === "true";

export async function GET() {
  if (!DEMO_MODE) {
    return NextResponse.json({ error: "Not implemented" }, { status: 501 });
  }
  return NextResponse.json({ matters: getAllMatters() });
}

export async function POST(request: NextRequest) {
  if (!DEMO_MODE) {
    return NextResponse.json({ error: "Not implemented" }, { status: 501 });
  }

  const body = await request.json();

  if (!body.matterName?.trim()) {
    return NextResponse.json({ error: "Matter name is required" }, { status: 400 });
  }

  const parties = body.parties as Array<{ entityId: string; role: string }> | undefined;
  if (!parties || parties.length === 0) {
    return NextResponse.json({ error: "At least one party is required" }, { status: 400 });
  }

  // Validate all entity IDs exist
  for (const p of parties) {
    if (!getEntityById(p.entityId)) {
      return NextResponse.json({ error: `Entity ${p.entityId} not found` }, { status: 404 });
    }
  }

  const matter = createMatter({
    matterName: body.matterName.trim(),
    matterNumber: body.matterNumber?.trim() || undefined,
    status: body.status || "open",
    responsibleAttorney: body.responsibleAttorney?.trim() || undefined,
    practiceArea: body.practiceArea?.trim() || undefined,
    parties: parties.map((p) => ({
      entityId: p.entityId,
      role: p.role as "client" | "adverse_party" | "co_party" | "witness" | "expert" | "insurer" | "opposing_counsel" | "judge" | "other",
    })),
  });

  return NextResponse.json({ matter }, { status: 201 });
}
