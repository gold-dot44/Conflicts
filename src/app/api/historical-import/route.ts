import { NextRequest, NextResponse } from "next/server";
import { parseFile } from "@/lib/lateral-import";
import {
  autoDetectMappings, detectDataShape,
  buildHistoricalImportPreview, executeHistoricalImport,
} from "@/lib/demo-data";
import type {
  HistoricalColumnMapping, HistoricalImportDefaults, DataShape,
} from "@/types";

/**
 * Historical Matter Import API
 *
 * Supports three steps via POST:
 *  - "parse": Upload CSV, return headers + auto-detected mappings + shape
 *  - "preview": Given rows + mappings + defaults, return preview of what will be created
 *  - "import": Execute the import
 */
export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";

  // Step: parse (multipart form data with file)
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const step = formData.get("step") as string;

    if (step === "parse" && file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const parsed = parseFile(buffer, file.name);

      const suggestedMappings = autoDetectMappings(parsed.headers);
      const detectedShape = detectDataShape(parsed.headers, parsed.rows.slice(0, 10));

      return NextResponse.json({
        headers: parsed.headers,
        suggestedMappings,
        rowCount: parsed.rows.length,
        preview: parsed.rows, // In demo mode, send all rows (real: paginate)
        detectedShape,
      });
    }

    return NextResponse.json({ error: "Invalid step or missing file" }, { status: 400 });
  }

  // Steps: preview and import (JSON body)
  const body = await request.json();
  const { step } = body;

  if (step === "preview") {
    const {
      rows,
      mappings,
      defaults: importDefaults,
      dataShape,
    } = body as {
      rows: Record<string, string>[];
      mappings: HistoricalColumnMapping[];
      defaults: HistoricalImportDefaults;
      dataShape: DataShape;
    };

    const preview = buildHistoricalImportPreview(rows, mappings, importDefaults, dataShape);
    return NextResponse.json(preview);
  }

  if (step === "import") {
    const {
      rows,
      mappings,
      defaults: importDefaults,
      dataShape,
      sourceLabel,
      duplicateActions,
    } = body as {
      rows: Record<string, string>[];
      mappings: HistoricalColumnMapping[];
      defaults: HistoricalImportDefaults;
      dataShape: DataShape;
      sourceLabel: string;
      duplicateActions: Record<string, "link_existing" | "import_new" | "skip">;
    };

    if (!sourceLabel) {
      return NextResponse.json({ error: "Source label required" }, { status: 400 });
    }

    const result = executeHistoricalImport(
      rows, mappings, importDefaults, dataShape, sourceLabel, duplicateActions
    );
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Invalid step" }, { status: 400 });
}
