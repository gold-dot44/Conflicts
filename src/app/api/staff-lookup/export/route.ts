import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, hasPermission } from "@/lib/auth";
import { query } from "@/lib/db";
import { DEMO_MODE } from "@/lib/env";
import { getMattersForStaff, getStaffNameByUpn } from "@/lib/demo-data";
import type { StaffLookupResult, EntityMatterRole, StaffRole, MatterStatus } from "@/types";
import { STAFF_ROLE_LABELS } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const upn = request.nextUrl.searchParams.get("upn");
  const format = request.nextUrl.searchParams.get("format") ?? "xlsx";
  const scope = request.nextUrl.searchParams.get("scope") ?? "full";

  if (!upn) {
    return NextResponse.json({ error: "upn parameter required" }, { status: 400 });
  }

  let results: StaffLookupResult[];
  let personName: string;

  if (DEMO_MODE) {
    results = getMattersForStaff(upn);
    personName = getStaffNameByUpn(upn) ?? upn;
  } else {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { upn: string; role: string };
    if (!hasPermission(user.role as "analyst" | "reviewer" | "admin" | "readonly", "approve_disposition")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

    results = await Promise.all(
      matterRows.map(async (row) => {
        const partyRows = await query<{ entity_name: string; role: string }>(
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

    // Get name from first result or UPN
    const nameRow = await query<{ user_name: string }>(
      `SELECT user_name FROM matter_staff WHERE user_upn = $1 LIMIT 1`,
      [upn]
    );
    personName = nameRow[0]?.user_name ?? upn;
  }

  if (format === "pdf") {
    return generatePdfReport(results, personName, scope);
  }

  return generateXlsxReport(results, personName, scope);
}

function formatParties(result: StaffLookupResult, scope: string): string {
  let parties = result.parties;
  if (scope === "client_only") {
    parties = parties.filter((p) => p.role === "client");
  }
  return parties.map((p) => `${p.entityName} (${p.role.replace("_", " ")})`).join("; ");
}

async function generateXlsxReport(
  results: StaffLookupResult[],
  personName: string,
  scope: string
): Promise<NextResponse> {
  const XLSX = await import("xlsx");

  const headers =
    scope === "full"
      ? ["Matter Name", "Matter Number", "Status", "Practice Area", "Staff Role", "Start Date", "End Date", "Client(s)", "Adverse Parties", "Other Parties"]
      : ["Matter Name", "Matter Number", "Status", "Practice Area", "Staff Role", "Start Date", "End Date", "Client(s)"];

  const rows = results.map((r) => {
    const clients = r.parties.filter((p) => p.role === "client").map((p) => p.entityName).join("; ");
    const base = [
      r.matterName,
      r.matterNumber ?? "",
      r.matterStatus,
      r.practiceArea ?? "",
      STAFF_ROLE_LABELS[r.staffRole] ?? r.staffRole,
      r.startDate ?? "",
      r.endDate ?? "",
      clients,
    ];
    if (scope === "full") {
      const adverse = r.parties.filter((p) => p.role === "adverse_party").map((p) => p.entityName).join("; ");
      const others = r.parties
        .filter((p) => p.role !== "client" && p.role !== "adverse_party")
        .map((p) => `${p.entityName} (${p.role.replace("_", " ")})`)
        .join("; ");
      base.push(adverse, others);
    }
    return base;
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Staff Report");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="staff-report-${personName.replace(/\s+/g, "-")}.xlsx"`,
    },
  });
}

async function generatePdfReport(
  results: StaffLookupResult[],
  personName: string,
  scope: string
): Promise<NextResponse> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fontSize = 10;
  const lineHeight = 14;
  const margin = 50;

  let page = pdf.addPage([612, 792]); // Letter size
  let y = 742;

  function ensureSpace(needed: number) {
    if (y - needed < margin) {
      page = pdf.addPage([612, 792]);
      y = 742;
    }
  }

  // Title
  page.drawText(`STAFF MATTER REPORT — ${personName}`, {
    x: margin,
    y,
    size: 14,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  y -= 20;

  page.drawText(`Generated: ${new Date().toLocaleDateString()}  |  ${results.length} matters`, {
    x: margin,
    y,
    size: 9,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });
  y -= 25;

  for (const r of results) {
    ensureSpace(80);

    page.drawText(`${r.matterName}${r.matterNumber ? ` (#${r.matterNumber})` : ""}`, {
      x: margin,
      y,
      size: 11,
      font: boldFont,
    });
    y -= lineHeight;

    const details = [
      `Status: ${r.matterStatus}`,
      r.practiceArea ? `Practice Area: ${r.practiceArea}` : null,
      `Role: ${STAFF_ROLE_LABELS[r.staffRole] ?? r.staffRole}`,
      r.startDate ? `${r.startDate}${r.endDate ? ` — ${r.endDate}` : " — present"}` : null,
    ]
      .filter(Boolean)
      .join("  |  ");

    page.drawText(details, { x: margin, y, size: fontSize, font, color: rgb(0.3, 0.3, 0.3) });
    y -= lineHeight;

    const partiesText = formatParties(r, scope);
    if (partiesText) {
      const label = scope === "client_only" ? "Clients: " : "Parties: ";
      page.drawText(`${label}${partiesText}`, {
        x: margin,
        y,
        size: fontSize,
        font,
        color: rgb(0.3, 0.3, 0.3),
        maxWidth: 512,
      });
      y -= lineHeight;
    }

    y -= 8; // spacing between entries
  }

  const pdfBytes = await pdf.save();
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="staff-report-${personName.replace(/\s+/g, "-")}.pdf"`,
    },
  });
}
