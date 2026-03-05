import { NextRequest, NextResponse } from "next/server";
import { addEntity, getAllEntities } from "@/lib/demo-data";

import { DEMO_MODE } from "@/lib/env";

export async function GET() {
  if (!DEMO_MODE) {
    return NextResponse.json({ error: "Not implemented" }, { status: 501 });
  }
  return NextResponse.json({ entities: getAllEntities() });
}

export async function POST(request: NextRequest) {
  if (!DEMO_MODE) {
    return NextResponse.json({ error: "Not implemented" }, { status: 501 });
  }

  const body = await request.json();

  if (!body.fullLegalName?.trim()) {
    return NextResponse.json({ error: "Full legal name is required" }, { status: 400 });
  }
  if (!body.entityType || !["person", "company"].includes(body.entityType)) {
    return NextResponse.json({ error: "Entity type must be person or company" }, { status: 400 });
  }

  const entity = addEntity({
    fullLegalName: body.fullLegalName.trim(),
    firstName: body.firstName?.trim() || undefined,
    lastName: body.lastName?.trim() || undefined,
    entityType: body.entityType,
    aliases: body.aliases?.filter((a: string) => a.trim()) ?? [],
  });

  return NextResponse.json({ entity }, { status: 201 });
}
