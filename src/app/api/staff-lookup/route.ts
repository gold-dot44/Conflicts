import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, hasPermission } from "@/lib/auth";
import { query } from "@/lib/db";
import { DEMO_MODE } from "@/lib/env";
import { getMattersForStaff } from "@/lib/demo-data";
import type { StaffLookupResult, EntityMatterRole, StaffRole, MatterStatus } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const upn = request.nextUrl.searchParams.get("upn");
  if (!upn) {
    return NextResponse.json({ error: "upn parameter required" }, { status: 400 });
  }

  if (DEMO_MODE) {
    return NextResponse.json({ results: getMattersForStaff(upn) });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { upn: string; role: string };
  if (!hasPermission(user.role as "analyst" | "reviewer" | "admin" | "readonly", "approve_disposition")) {
    return NextResponse.json({ error: "Forbidden — admin or reviewer role required" }, { status: 403 });
  }

  const matterRows = await query<{
    staff_role: string;
    start_date: string | null;
    end_date: string | null;
    matter_id: string;
    matter_name: string;
    matter_number: string | null;
    matter_status: string;
    practice_area: string | null;
  }>(
    `SELECT
      ms.role AS staff_role,
      ms.start_date,
      ms.end_date,
      m.id AS matter_id,
      m.matter_name,
      m.matter_number,
      m.status AS matter_status,
      m.practice_area
    FROM matter_staff ms
    JOIN matters m ON m.id = ms.matter_id
    WHERE ms.user_upn = $1
    ORDER BY m.open_date DESC NULLS LAST`,
    [upn]
  );

  // Fetch parties for each matter
  const results: StaffLookupResult[] = await Promise.all(
    matterRows.map(async (row) => {
      const partyRows = await query<{
        entity_name: string;
        role: string;
      }>(
        `SELECT e.full_legal_name AS entity_name, emr.role
         FROM entity_matter_roles emr
         JOIN entities e ON e.id = emr.entity_id
         WHERE emr.matter_id = $1
         ORDER BY emr.role, e.full_legal_name`,
        [row.matter_id]
      );

      return {
        matterId: row.matter_id,
        matterName: row.matter_name,
        matterNumber: row.matter_number,
        matterStatus: row.matter_status as MatterStatus,
        practiceArea: row.practice_area,
        staffRole: row.staff_role as StaffRole,
        startDate: row.start_date,
        endDate: row.end_date,
        parties: partyRows.map((p) => ({
          entityName: p.entity_name,
          role: p.role as EntityMatterRole,
        })),
      };
    })
  );

  return NextResponse.json({ results });
}
