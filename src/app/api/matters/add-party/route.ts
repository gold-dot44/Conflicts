import { NextRequest, NextResponse } from "next/server";
import { addPartyToMatter } from "@/lib/demo-data";

import { DEMO_MODE } from "@/lib/env";

export async function POST(request: NextRequest) {
  if (!DEMO_MODE) {
    return NextResponse.json({ error: "Not implemented" }, { status: 501 });
  }

  const body = await request.json();

  if (!body.matterId?.trim()) {
    return NextResponse.json({ error: "Matter ID is required" }, { status: 400 });
  }
  if (!body.entityId?.trim()) {
    return NextResponse.json({ error: "Entity ID is required" }, { status: 400 });
  }
  if (!body.role?.trim()) {
    return NextResponse.json({ error: "Role is required" }, { status: 400 });
  }

  const ok = addPartyToMatter(body.matterId, body.entityId, body.role);

  if (!ok) {
    return NextResponse.json(
      { error: "Matter or entity not found, or party already linked" },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
