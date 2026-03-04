import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, hasPermission } from "@/lib/auth";
import { createEthicalWall, listEthicalWalls, removeEthicalWall } from "@/lib/ethical-walls";

const DEMO_MODE = process.env.DEMO_MODE === "true";

const DEMO_WALLS = [
  {
    id: "wall-1",
    screened_attorney: "David Martinez",
    screened_attorney_upn: "david.martinez@firm.com",
    matter_id: "m-1",
    matter_name: "Acme Corp v. Widget Industries",
    created_by: "robert.kim@firm.com",
    created_at: "2026-02-15T10:00:00Z",
    memo_url: null,
    is_active: true,
  },
  {
    id: "wall-2",
    screened_attorney: "Emily Watson",
    screened_attorney_upn: "emily.watson@firm.com",
    matter_id: "m-3",
    matter_name: "Smith Family Trust",
    created_by: "sarah.johnson@firm.com",
    created_at: "2026-01-20T14:30:00Z",
    memo_url: null,
    is_active: true,
  },
];

export async function GET(request: NextRequest) {
  if (DEMO_MODE) {
    return NextResponse.json({ walls: DEMO_WALLS });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const matterId = request.nextUrl.searchParams.get("matterId") ?? undefined;
  const walls = await listEthicalWalls(matterId);
  return NextResponse.json({ walls });
}

export async function POST(request: NextRequest) {
  if (DEMO_MODE) {
    const body = await request.json();
    return NextResponse.json({
      wall: {
        id: `wall-${Date.now()}`,
        screened_attorney: body.screenedAttorney,
        screened_attorney_upn: body.screenedAttorneyUpn,
        matter_id: body.matterId,
        matter_name: "Demo Matter",
        created_by: "demo@firm.com",
        created_at: new Date().toISOString(),
        memo_url: null,
        is_active: true,
      },
    });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { upn: string; role: string };
  if (!hasPermission(user.role as "analyst" | "reviewer" | "admin" | "readonly", "authorize_wall")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const wall = await createEthicalWall({
    screenedAttorney: body.screenedAttorney,
    screenedAttorneyUpn: body.screenedAttorneyUpn,
    matterId: body.matterId,
    createdBy: user.upn,
  });

  return NextResponse.json({ wall });
}

export async function DELETE(request: NextRequest) {
  if (DEMO_MODE) {
    return NextResponse.json({ success: true });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { upn: string; role: string };
  if (!hasPermission(user.role as "analyst" | "reviewer" | "admin" | "readonly", "authorize_wall")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const wallId = request.nextUrl.searchParams.get("id");
  if (!wallId) {
    return NextResponse.json({ error: "Wall ID required" }, { status: 400 });
  }

  await removeEthicalWall(wallId);
  return NextResponse.json({ success: true });
}
