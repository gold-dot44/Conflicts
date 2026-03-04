import Papa from "papaparse";
import * as XLSX from "xlsx";
import { query, withTransaction } from "./db";
import { compositeSearch } from "./fuzzy-search";
import type { EntityType, EntityMatterRole, LateralImportRow, ColumnMapping } from "@/types";
import { uploadBlob } from "./blob-storage";

// Common synonyms for auto-mapping column headers
const COLUMN_SYNONYMS: Record<string, keyof LateralImportRow> = {
  "name": "fullLegalName",
  "full name": "fullLegalName",
  "full_name": "fullLegalName",
  "full legal name": "fullLegalName",
  "entity name": "fullLegalName",
  "client name": "fullLegalName",
  "party name": "fullLegalName",
  "first name": "firstName",
  "first_name": "firstName",
  "last name": "lastName",
  "last_name": "lastName",
  "type": "entityType",
  "entity type": "entityType",
  "entity_type": "entityType",
  "case name": "matterName",
  "case_name": "matterName",
  "matter name": "matterName",
  "matter_name": "matterName",
  "matter": "matterName",
  "case": "matterName",
  "role": "role",
  "party role": "role",
  "relationship": "role",
  "opposing party": "role", // special handling
  "notes": "notes",
  "comments": "notes",
  "description": "notes",
};

// Role synonyms
const ROLE_SYNONYMS: Record<string, EntityMatterRole> = {
  "client": "client",
  "adverse": "adverse_party",
  "adverse party": "adverse_party",
  "opposing party": "adverse_party",
  "opposing": "adverse_party",
  "co-party": "co_party",
  "co party": "co_party",
  "witness": "witness",
  "expert": "expert",
  "insurer": "insurer",
  "insurance": "insurer",
  "opposing counsel": "opposing_counsel",
  "judge": "judge",
  "other": "other",
};

export interface ParsedFile {
  headers: string[];
  rows: Record<string, string>[];
  suggestedMappings: ColumnMapping[];
}

/**
 * Parse an uploaded file (CSV or Excel) and suggest column mappings.
 */
export function parseFile(
  buffer: Buffer,
  filename: string
): ParsedFile {
  let headers: string[] = [];
  let rows: Record<string, string>[] = [];

  if (filename.endsWith(".csv")) {
    const result = Papa.parse(buffer.toString("utf-8"), {
      header: true,
      skipEmptyLines: true,
    });
    headers = result.meta.fields ?? [];
    rows = result.data as Record<string, string>[];
  } else {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
    if (data.length > 0) {
      headers = Object.keys(data[0]);
    }
    rows = data;
  }

  // Auto-suggest mappings
  const suggestedMappings: ColumnMapping[] = headers
    .map((header) => {
      const normalized = header.toLowerCase().trim();
      const target = COLUMN_SYNONYMS[normalized];
      return target ? { sourceColumn: header, targetField: target } : null;
    })
    .filter((m): m is ColumnMapping => m !== null);

  return { headers, rows, suggestedMappings };
}

export interface DeduplicationResult {
  row: LateralImportRow;
  potentialDuplicates: Array<{
    entityId: string;
    fullLegalName: string;
    score: number;
  }>;
}

/**
 * Run deduplication: check each import row against existing entities.
 */
export async function checkDuplicates(
  rows: LateralImportRow[]
): Promise<DeduplicationResult[]> {
  const results: DeduplicationResult[] = [];

  for (const row of rows) {
    const searchResults = await compositeSearch({
      query: row.fullLegalName,
      searchType: row.entityType === "company" ? "company" : "person",
    });

    results.push({
      row,
      potentialDuplicates: searchResults
        .filter((r) => r.compositeScore > 0.5)
        .map((r) => ({
          entityId: r.entityId,
          fullLegalName: r.fullLegalName,
          score: r.compositeScore,
        })),
    });
  }

  return results;
}

/**
 * Import confirmed rows into the database.
 */
export async function importRows(
  rows: LateralImportRow[],
  lateralHireName: string,
  importDate: string
): Promise<{ imported: number; skipped: number }> {
  const sourceSystem = `lateral_${lateralHireName.replace(/\s+/g, "_").toLowerCase()}_${importDate}`;
  let imported = 0;
  let skipped = 0;

  await withTransaction(async (client) => {
    for (const row of rows) {
      try {
        // Insert entity
        const entityResult = await client.query(
          `INSERT INTO entities (full_legal_name, first_name, last_name, entity_type, source_system)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [
            row.fullLegalName,
            row.firstName ?? null,
            row.lastName ?? null,
            row.entityType ?? "person",
            sourceSystem,
          ]
        );

        const entityId = entityResult.rows[0].id;

        // Insert matter if provided
        if (row.matterName) {
          const matterResult = await client.query(
            `INSERT INTO matters (matter_name, source_system, status)
             VALUES ($1, $2, 'closed')
             RETURNING id`,
            [row.matterName, sourceSystem]
          );

          const matterId = matterResult.rows[0].id;
          const role = row.role
            ? ROLE_SYNONYMS[row.role.toLowerCase()] ?? "other"
            : "client";

          await client.query(
            `INSERT INTO entity_matter_roles (entity_id, matter_id, role, notes, source_system)
             VALUES ($1, $2, $3, $4, $5)`,
            [entityId, matterId, role, row.notes ?? null, sourceSystem]
          );
        }

        imported++;
      } catch (e) {
        console.error(`Failed to import row: ${row.fullLegalName}`, e);
        skipped++;
      }
    }
  });

  return { imported, skipped };
}

/**
 * Apply column mappings to raw rows.
 */
export function applyMappings(
  rawRows: Record<string, string>[],
  mappings: ColumnMapping[]
): LateralImportRow[] {
  return rawRows.map((raw) => {
    const mapped: Partial<LateralImportRow> = {};
    for (const { sourceColumn, targetField } of mappings) {
      const value = raw[sourceColumn]?.trim();
      if (value) {
        (mapped as Record<string, string>)[targetField] = value;
      }
    }
    // Default entity type
    if (!mapped.entityType) mapped.entityType = "person";
    return mapped as LateralImportRow;
  });
}
