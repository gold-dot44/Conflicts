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
 * Record a disposition decision as a NEW row referencing the original search.
 * The audit_log table is append-only (INSERT only, no UPDATE/DELETE),
 * so dispositions are stored as separate rows linked via parent_search_id.
 */
export async function recordDisposition(params: {
  auditLogId: string;
  disposition: ConflictDisposition;
  dispositionBy: string;
  rationale: string;
  entityId?: string;
  matterId?: string;
  relatedDocuments?: string[];
}): Promise<string> {
  const [row] = await query<{ id: string }>(
    `INSERT INTO audit_log
       (parent_search_id, searched_by, search_terms, disposition,
        disposition_by, disposition_rationale, disposition_timestamp,
        entity_id, matter_id, related_documents)
     SELECT
       $1, searched_by, search_terms, $2,
       $3, $4, NOW(),
       $5, $6, $7
     FROM audit_log WHERE id = $1
     RETURNING id`,
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
  return row.id;
}

/**
 * Retrieve audit trail for a matter or entity.
 * Joins search rows with their disposition rows (linked via parent_search_id).
 */
export async function getAuditTrail(params: {
  matterId?: string;
  entityId?: string;
  searchedBy?: string;
  limit?: number;
  offset?: number;
}): Promise<unknown[]> {
  let sql = `
    SELECT
      s.*,
      d.id AS disposition_id,
      d.disposition,
      d.disposition_by,
      d.disposition_rationale,
      d.disposition_timestamp,
      d.entity_id AS disposition_entity_id,
      d.matter_id AS disposition_matter_id,
      d.related_documents
    FROM audit_log s
    LEFT JOIN audit_log d ON d.parent_search_id = s.id
    WHERE s.parent_search_id IS NULL
  `;
  const values: unknown[] = [];
  let idx = 1;

  if (params.matterId) {
    sql += ` AND (s.matter_id = $${idx} OR d.matter_id = $${idx})`;
    values.push(params.matterId);
    idx++;
  }
  if (params.entityId) {
    sql += ` AND (s.entity_id = $${idx} OR d.entity_id = $${idx})`;
    values.push(params.entityId);
    idx++;
  }
  if (params.searchedBy) {
    sql += ` AND s.searched_by = $${idx}`;
    values.push(params.searchedBy);
    idx++;
  }

  sql += ` ORDER BY s.search_timestamp DESC LIMIT $${idx} OFFSET $${idx + 1}`;
  values.push(params.limit ?? 50, params.offset ?? 0);

  return query(sql, values);
}
