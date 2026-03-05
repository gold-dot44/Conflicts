import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, hasPermission } from "@/lib/auth";
import { query } from "@/lib/db";
import { DEMO_MODE } from "@/lib/env";
import { isValidUuid } from "@/lib/sanitize";
import {
  getStaffForMatter,
  addStaffToMatter,
  removeStaffFromMatter,
} from "@/lib/demo-data";
import type { StaffRole } from "@/types";

export async function GET(request: NextRequest) {
  const matterId = request.nextUrl.searchParams.get("matterId");
  if (!matterId || !isValidUuid(matterId)) {
    return NextResponse.json({ error: "Valid matterId required" }, { status: 400 });
  }

  if (DEMO_MODE) {
    return NextResponse.json({ staff: getStaffForMatter(matterId) });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await query(
    `SELECT * FROM matter_staff WHERE matter_id = $1 ORDER BY role, user_name`,
    [matterId]
  );
  return NextResponse.json({ staff: rows });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { matterId, userUpn, userName, role, startDate } = body;

  if (!matterId || !userUpn || !userName || !role) {
    return NextResponse.json(
      { error: "matterId, userUpn, userName, and role are required" },
      { status: 400 }
    );
  }

  if (DEMO_MODE) {
    const member = addStaffToMatter({
      matterId,
      userUpn,
      userName,
      role: role as StaffRole,
      startDate,
    });
    if (!member) {
      return NextResponse.json(
        { error: "This person is screened from this matter by an active ethical wall." },
        { status: 409 }
      );
    }
    return NextResponse.json({ staff: member });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isValidUuid(matterId)) {
    return NextResponse.json({ error: "Invalid matterId format" }, { status: 400 });
  }

  // Check ethical wall
  const wallRows = await query(
    `SELECT id FROM ethical_walls WHERE screened_attorney_upn = $1 AND matter_id = $2 AND is_active = true`,
    [userUpn, matterId]
  );
  if (wallRows.length > 0) {
    return NextResponse.json(
      { error: "This person is screened from this matter by an active ethical wall." },
      { status: 409 }
    );
  }

  // Insert with ON CONFLICT DO NOTHING
  const rows = await query(
    `INSERT INTO matter_staff (matter_id, user_upn, user_name, role, start_date)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (matter_id, user_upn, role) DO NOTHING
     RETURNING *`,
    [matterId, userUpn, userName, role, startDate || null]
  );

  if (rows.length === 0) {
    // Already exists — fetch the existing one
    const existing = await query(
      `SELECT * FROM matter_staff WHERE matter_id = $1 AND user_upn = $2 AND role = $3`,
      [matterId, userUpn, role]
    );
    return NextResponse.json({ staff: existing[0] });
  }

  return NextResponse.json({ staff: rows[0] });
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id || !isValidUuid(id)) {
    return NextResponse.json({ error: "Valid staff ID required" }, { status: 400 });
  }

  if (DEMO_MODE) {
    removeStaffFromMatter(id);
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

  await query(`DELETE FROM matter_staff WHERE id = $1`, [id]);
  return NextResponse.json({ success: true });
}
