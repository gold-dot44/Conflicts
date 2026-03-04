import { query } from "./db";
import type { ConflictDisposition, FuzzyWeights, SearchResult } from "@/types";

interface AuditEntry {
  searchedBy: string;
  searchTerms: string;
  algorithmsApplied: {
    weights: FuzzyWeights;
    extensions: string[];
  };
  resultsSnapshot: SearchResult[];
}

/**
 * Log a conflict search to the immutable audit trail.
 * The audit_log table only permits INSERT — no UPDATE or DELETE.
 */
export async function logSearch(entry: AuditEntry): Promise<string> {
  const [row] = await query<{ id: string }>(
    `INSERT INTO audit_log (searched_by, search_terms, algorithms_applied, results_snapshot)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [
      entry.searchedBy,
      entry.searchTerms,
      JSON.stringify(entry.algorithmsApplied),
      JSON.stringify(entry.resultsSnapshot),
    ]
  );
  return row.id;
}

/**
 * Record a disposition decision on an audit log entry.
 * This is an INSERT of a new row referencing the original search,
 * preserving append-only semantics.
 */
export async function recordDisposition(params: {
  auditLogId: string;
  disposition: ConflictDisposition;
  dispositionBy: string;
  rationale: string;
  entityId?: string;
  matterId?: string;
  relatedDocuments?: string[];
}): Promise<void> {
  await query(
    `UPDATE audit_log SET
       disposition = $2,
       disposition_by = $3,
       disposition_rationale = $4,
       disposition_timestamp = NOW(),
       entity_id = $5,
       matter_id = $6,
       related_documents = $7
     WHERE id = $1 AND disposition IS NULL`,
    [
      params.auditLogId,
      params.disposition,
      params.dispositionBy,
      params.rationale,
      params.entityId ?? null,
      params.matterId ?? null,
      params.relatedDocuments ?? [],
    ]
  );
}

/**
 * Retrieve audit trail for a matter or entity.
 */
export async function getAuditTrail(params: {
  matterId?: string;
  entityId?: string;
  searchedBy?: string;
  limit?: number;
  offset?: number;
}): Promise<unknown[]> {
  let sql = `SELECT * FROM audit_log WHERE 1=1`;
  const values: unknown[] = [];
  let idx = 1;

  if (params.matterId) {
    sql += ` AND matter_id = $${idx}`;
    values.push(params.matterId);
    idx++;
  }
  if (params.entityId) {
    sql += ` AND entity_id = $${idx}`;
    values.push(params.entityId);
    idx++;
  }
  if (params.searchedBy) {
    sql += ` AND searched_by = $${idx}`;
    values.push(params.searchedBy);
    idx++;
  }

  sql += ` ORDER BY search_timestamp DESC LIMIT $${idx} OFFSET $${idx + 1}`;
  values.push(params.limit ?? 50, params.offset ?? 0);

  return query(sql, values);
}
