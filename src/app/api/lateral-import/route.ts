import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, hasPermission } from "@/lib/auth";
import { parseFile, checkDuplicates, importRows, applyMappings } from "@/lib/lateral-import";
import { uploadBlob } from "@/lib/blob-storage";
import type { ColumnMapping } from "@/types";

/**
 * Step 1: Upload and parse file, return headers and suggested mappings.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { upn: string; role: string };
  if (!hasPermission(user.role as "analyst" | "reviewer" | "admin" | "readonly", "import")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const step = formData.get("step") as string;

  if (step === "parse") {
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Store in Azure Blob Storage
    const containerName = process.env.AZURE_STORAGE_CONTAINER_IMPORTS ?? "lateral-imports";
    await uploadBlob(containerName, `uploads/${Date.now()}_${file.name}`, buffer, file.type);

    const parsed = parseFile(buffer, file.name);
    return NextResponse.json({
      headers: parsed.headers,
      suggestedMappings: parsed.suggestedMappings,
      rowCount: parsed.rows.length,
      preview: parsed.rows.slice(0, 5),
    });
  }

  if (step === "deduplicate") {
    const mappingsJson = formData.get("mappings") as string;
    const rowsJson = formData.get("rows") as string;
    const mappings: ColumnMapping[] = JSON.parse(mappingsJson);
    const rawRows: Record<string, string>[] = JSON.parse(rowsJson);

    const mappedRows = applyMappings(rawRows, mappings);
    const deduplicationResults = await checkDuplicates(mappedRows);

    return NextResponse.json({ results: deduplicationResults });
  }

  if (step === "import") {
    const rowsJson = formData.get("rows") as string;
    const lateralHireName = formData.get("lateralHireName") as string;

    if (!lateralHireName) {
      return NextResponse.json({ error: "Lateral hire name required" }, { status: 400 });
    }

    const rows = JSON.parse(rowsJson);
    const importDate = new Date().toISOString().split("T")[0];
    const result = await importRows(rows, lateralHireName, importDate);

    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Invalid step" }, { status: 400 });
}
