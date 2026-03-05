import { NextRequest, NextResponse } from "next/server";
import { addMatterToEntity } from "@/lib/demo-data";

const DEMO_MODE = process.env.DEMO_MODE === "true";

export async function POST(request: NextRequest) {
  if (!DEMO_MODE) {
    return NextResponse.json({ error: "Not implemented" }, { status: 501 });
  }

  const body = await request.json();

  if (!body.entityId?.trim()) {
    return NextResponse.json({ error: "Entity ID is required" }, { status: 400 });
  }
  if (!body.matterName?.trim()) {
    return NextResponse.json({ error: "Matter name is required" }, { status: 400 });
  }
  if (!body.role?.trim()) {
    return NextResponse.json({ error: "Role is required" }, { status: 400 });
  }

  const result = addMatterToEntity(body.entityId, {
    matterName: body.matterName.trim(),
    matterNumber: body.matterNumber?.trim() || undefined,
    status: body.status || "open",
    role: body.role,
    responsibleAttorney: body.responsibleAttorney?.trim() || undefined,
    practiceArea: body.practiceArea?.trim() || undefined,
  });

  if (!result) {
    return NextResponse.json({ error: "Entity not found" }, { status: 404 });
  }

  return NextResponse.json(result, { status: 201 });
}
