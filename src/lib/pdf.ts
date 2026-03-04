import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * Generate a screening memorandum PDF for an ethical wall.
 */
export async function generateScreeningMemo(params: {
  attorney: string;
  matterName: string;
  matterId: string;
  createdBy: string;
  createdAt: string;
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // Letter size
  const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const boldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

  const { width, height } = page.getSize();
  let y = height - 72;
  const margin = 72;
  const lineHeight = 16;

  // Header
  page.drawText("CONFIDENTIAL — ETHICAL WALL SCREENING MEMORANDUM", {
    x: margin,
    y,
    size: 14,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= lineHeight * 2;

  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: rgb(0, 0, 0),
  });
  y -= lineHeight * 1.5;

  const fields = [
    ["Date:", new Date(params.createdAt).toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    })],
    ["Screened Attorney:", params.attorney],
    ["Restricted Matter:", params.matterName],
    ["Matter ID:", params.matterId],
    ["Authorized By:", params.createdBy],
  ];

  for (const [label, value] of fields) {
    page.drawText(label, {
      x: margin,
      y,
      size: 11,
      font: boldFont,
    });
    page.drawText(value, {
      x: margin + 140,
      y,
      size: 11,
      font,
    });
    y -= lineHeight * 1.3;
  }

  y -= lineHeight;
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 0.5,
    color: rgb(0.5, 0.5, 0.5),
  });
  y -= lineHeight * 1.5;

  // Body
  const bodyLines = [
    "This memorandum documents the implementation of an ethical wall (screen)",
    `pursuant to ABA Model Rules 1.7, 1.9, and 1.10, screening ${params.attorney}`,
    `from all involvement in the matter identified above.`,
    "",
    "The following restrictions are in effect:",
    "",
    "1. The screened attorney shall have no access to any files, documents,",
    "   communications, or information related to the restricted matter.",
    "",
    "2. Database access controls have been implemented to prevent the screened",
    "   attorney from viewing any records associated with the restricted matter.",
    "",
    "3. Practice management system (Clio) permissions have been modified to",
    "   revoke access to the matter, including notes, documents, billing,",
    "   and calendar entries.",
    "",
    "4. The screened attorney shall not discuss the restricted matter with",
    "   any attorney or staff member working on the matter.",
    "",
    "5. No fees earned by the screened attorney shall be shared in connection",
    "   with the restricted matter.",
    "",
    "This screen was implemented on the date noted above and shall remain",
    "in effect until formally removed by the conflicts committee.",
  ];

  for (const line of bodyLines) {
    page.drawText(line, {
      x: margin,
      y,
      size: 10,
      font,
      color: rgb(0.15, 0.15, 0.15),
    });
    y -= lineHeight;
  }

  y -= lineHeight * 2;
  page.drawText("This document is auto-generated and constitutes a formal record.", {
    x: margin,
    y,
    size: 9,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });

  return pdfDoc.save();
}

/**
 * Generate an audit trail PDF for a conflict search.
 */
export async function generateAuditPdf(params: {
  searchTerms: string;
  searchedBy: string;
  searchTimestamp: string;
  results: unknown[];
  disposition?: string;
  dispositionBy?: string;
  dispositionRationale?: string;
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const boldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

  let y = 720;
  const margin = 72;
  const lineHeight = 14;

  page.drawText("CONFLICT CHECK — AUDIT TRAIL", {
    x: margin, y, size: 14, font: boldFont,
  });
  y -= lineHeight * 2;

  const details = [
    ["Search Terms:", params.searchTerms],
    ["Searched By:", params.searchedBy],
    ["Timestamp:", params.searchTimestamp],
    ["Results Count:", String(params.results.length)],
  ];

  if (params.disposition) {
    details.push(
      ["Disposition:", params.disposition],
      ["Disposition By:", params.dispositionBy ?? "N/A"],
      ["Rationale:", params.dispositionRationale ?? "N/A"],
    );
  }

  for (const [label, value] of details) {
    page.drawText(label, { x: margin, y, size: 10, font: boldFont });
    page.drawText(value, { x: margin + 120, y, size: 10, font });
    y -= lineHeight * 1.3;
  }

  return pdfDoc.save();
}
