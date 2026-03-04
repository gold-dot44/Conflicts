import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, hasPermission } from "@/lib/auth";
import { createEthicalWall, listEthicalWalls, removeEthicalWall } from "@/lib/ethical-walls";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const matterId = request.nextUrl.searchParams.get("matterId") ?? undefined;
  const walls = await listEthicalWalls(matterId);
  return NextResponse.json({ walls });
}

export async function POST(request: NextRequest) {
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
