import { query, queryAsUser } from "./db";
import type { SearchResult, SearchRequest, FuzzyWeights, MatterResult, CorporateFamilyMember } from "@/types";

const DEFAULT_WEIGHTS: FuzzyWeights = {
  levenshtein: 0.30,
  trigram: 0.30,
  soundex: 0.10,
  metaphone: 0.15,
  fullText: 0.15,
};

/**
 * Composite fuzzy search query.
 * Layers Levenshtein, trigram similarity, Soundex, Double Metaphone,
 * and full-text search into a single ranked result set.
 *
 * @param upn - If provided, sets app.current_user_upn for RLS ethical wall enforcement
 * @param suppressions - Common last names whose phonetic weight should be reduced
 */
export async function compositeSearch(
  request: SearchRequest,
  weights: FuzzyWeights = DEFAULT_WEIGHTS,
  limit = 50,
  upn?: string,
  suppressions: string[] = []
): Promise<SearchResult[]> {
  const { query: searchTerm, searchType, filters } = request;

  const typeFilter =
    searchType === "all" ? "" : `AND e.entity_type = $2`;
  const params: unknown[] = [searchTerm];
  if (searchType !== "all") params.push(searchType);

  // Build filter clauses
  let filterClauses = "";
  let paramIdx = params.length + 1;

  if (filters?.sourceSystem) {
    filterClauses += ` AND e.source_system = $${paramIdx}`;
    params.push(filters.sourceSystem);
    paramIdx++;
  }

  // Build suppression set for phonetic weight reduction.
  // If the entity's last_name is on the suppression list, reduce
  // soundex/metaphone contribution by 75% to prevent alert fatigue.
  const suppressionSet = new Set(suppressions.map((s) => s.toLowerCase()));
  const hasSuppression = suppressionSet.size > 0;

  // Add the suppression list as an array parameter for the SQL query
  let suppressionClause = "";
  let soundexWeight = weights.soundex;
  let metaphoneWeight = weights.metaphone;

  if (hasSuppression) {
    // We pass the suppression list as a parameter and use CASE WHEN in SQL
    params.push(suppressions.map((s) => s.toLowerCase()));
    suppressionClause = `LOWER(e.last_name) = ANY($${paramIdx})`;
    paramIdx++;
  }

  // Build dynamic weight expressions for soundex/metaphone
  const soundexWeightExpr = hasSuppression
    ? `CASE WHEN ${suppressionClause} THEN ${soundexWeight * 0.25} ELSE ${soundexWeight} END`
    : `${soundexWeight}`;

  const metaphoneWeightExpr = hasSuppression
    ? `CASE WHEN ${suppressionClause} THEN ${metaphoneWeight * 0.25} ELSE ${metaphoneWeight} END`
    : `${metaphoneWeight}`;

  const sql = `
    WITH scored AS (
      SELECT
        e.id AS entity_id,
        e.full_legal_name,
        e.first_name,
        e.last_name,
        e.entity_type,
        e.aliases,

        -- Levenshtein distance normalized to 0-1 (1 = exact match)
        GREATEST(
          1.0 - (levenshtein(LOWER(e.full_legal_name), LOWER($1))::float
                 / GREATEST(LENGTH(e.full_legal_name), LENGTH($1), 1)),
          COALESCE(1.0 - (levenshtein(LOWER(e.last_name), LOWER($1))::float
                 / GREATEST(LENGTH(e.last_name), LENGTH($1), 1)), 0)
        ) AS levenshtein_score,

        -- Trigram similarity (0-1)
        GREATEST(
          similarity(e.full_legal_name, $1),
          COALESCE(similarity(array_to_string(e.aliases, ' '), $1), 0)
        ) AS trigram_score,

        -- Soundex match (boolean → 0 or 1)
        CASE WHEN soundex(e.full_legal_name) = soundex($1)
             OR soundex(e.last_name) = soundex($1)
             OR soundex(e.first_name) = soundex($1)
             THEN 1.0 ELSE 0.0 END AS soundex_score,

        -- Double Metaphone match
        CASE WHEN dmetaphone(e.full_legal_name) = dmetaphone($1)
             OR dmetaphone(e.last_name) = dmetaphone($1)
             OR dmetaphone(e.first_name) = dmetaphone($1)
             THEN 1.0 ELSE 0.0 END AS metaphone_score,

        -- Full-text search rank
        COALESCE(
          ts_rank(to_tsvector('english', e.full_legal_name), plainto_tsquery('english', $1)),
          0
        ) AS fulltext_score

      FROM entities e
      WHERE (
        -- Pre-filter: at least one algorithm must show potential
        similarity(e.full_legal_name, $1) > 0.1
        OR similarity(array_to_string(e.aliases, ' '), $1) > 0.1
        OR soundex(e.last_name) = soundex($1)
        OR dmetaphone(e.last_name) = dmetaphone($1)
        OR to_tsvector('english', e.full_legal_name) @@ plainto_tsquery('english', $1)
        OR levenshtein(LOWER(e.last_name), LOWER($1)) <= 3
      )
      ${typeFilter}
      ${filterClauses}
    )
    SELECT
      entity_id,
      full_legal_name,
      first_name,
      last_name,
      entity_type,
      aliases,
      levenshtein_score,
      trigram_score,
      soundex_score,
      metaphone_score,
      fulltext_score,
      (
        levenshtein_score * ${weights.levenshtein} +
        trigram_score * ${weights.trigram} +
        soundex_score * ${soundexWeightExpr} +
        metaphone_score * ${metaphoneWeightExpr} +
        fulltext_score * ${weights.fullText}
      ) AS composite_score
    FROM scored
    WHERE (
      levenshtein_score * ${weights.levenshtein} +
      trigram_score * ${weights.trigram} +
      soundex_score * ${soundexWeightExpr} +
      metaphone_score * ${metaphoneWeightExpr} +
      fulltext_score * ${weights.fullText}
    ) > 0.15
    ORDER BY composite_score DESC
    LIMIT ${limit}
  `;

  // Use queryAsUser if UPN provided (activates RLS ethical wall policies)
  const queryFn = upn
    ? <T>(text: string, p: unknown[]) => queryAsUser<T>(text, p, upn)
    : <T>(text: string, p: unknown[]) => query<T>(text, p);

  const rows = await queryFn<{
    entity_id: string;
    full_legal_name: string;
    first_name: string | null;
    last_name: string | null;
    entity_type: string;
    aliases: string[];
    levenshtein_score: number;
    trigram_score: number;
    soundex_score: number;
    metaphone_score: number;
    fulltext_score: number;
    composite_score: number;
  }>(sql, params);

  // Enrich each result with matters and corporate family
  const results: SearchResult[] = await Promise.all(
    rows.map(async (row) => {
      const [matters, corporateFamily] = await Promise.all([
        getEntityMatters(row.entity_id, filters?.matterStatus, filters?.practiceArea, upn),
        row.entity_type === "company"
          ? getCorporateFamily(row.entity_id)
          : Promise.resolve([]),
      ]);

      return {
        entityId: row.entity_id,
        fullLegalName: row.full_legal_name,
        firstName: row.first_name,
        lastName: row.last_name,
        entityType: row.entity_type as SearchResult["entityType"],
        aliases: row.aliases,
        compositeScore: Number(row.composite_score),
        levenshteinScore: Number(row.levenshtein_score),
        trigramScore: Number(row.trigram_score),
        soundexMatch: row.soundex_score > 0,
        metaphoneMatch: row.metaphone_score > 0,
        fullTextScore: Number(row.fulltext_score),
        matters,
        corporateFamily,
      };
    })
  );

  return results;
}

async function getEntityMatters(
  entityId: string,
  statusFilter?: string,
  practiceAreaFilter?: string,
  upn?: string
): Promise<MatterResult[]> {
  let sql = `
    SELECT
      m.id AS matter_id,
      m.matter_name,
      m.matter_number,
      m.status,
      emr.role,
      m.responsible_attorney,
      m.practice_area,
      m.open_date,
      m.close_date
    FROM entity_matter_roles emr
    JOIN matters m ON m.id = emr.matter_id
    WHERE emr.entity_id = $1
  `;
  const params: unknown[] = [entityId];
  let idx = 2;

  if (statusFilter) {
    sql += ` AND m.status = $${idx}`;
    params.push(statusFilter);
    idx++;
  }
  if (practiceAreaFilter) {
    sql += ` AND m.practice_area = $${idx}`;
    params.push(practiceAreaFilter);
  }
  sql += " ORDER BY m.open_date DESC";

  // Use RLS-aware query if UPN available
  if (upn) {
    return queryAsUser<MatterResult>(sql, params, upn);
  }
  return query<MatterResult>(sql, params);
}

/**
 * Recursive CTE to traverse corporate family tree in both directions.
 */
async function getCorporateFamily(
  entityId: string,
  maxDepth = 10
): Promise<CorporateFamilyMember[]> {
  const sql = `
    WITH RECURSIVE family AS (
      -- Base: direct parents
      SELECT
        cl.parent_entity_id AS entity_id,
        cl.relationship_type,
        'parent'::text AS direction,
        1 AS depth
      FROM corporate_links cl
      WHERE cl.child_entity_id = $1

      UNION ALL

      -- Recurse upward
      SELECT
        cl.parent_entity_id,
        cl.relationship_type,
        'parent'::text,
        f.depth + 1
      FROM corporate_links cl
      JOIN family f ON f.entity_id = cl.child_entity_id AND f.direction = 'parent'
      WHERE f.depth < $2

      UNION ALL

      -- Base: direct children
      SELECT
        cl.child_entity_id AS entity_id,
        cl.relationship_type,
        'child'::text AS direction,
        1 AS depth
      FROM corporate_links cl
      WHERE cl.parent_entity_id = $1

      UNION ALL

      -- Recurse downward
      SELECT
        cl.child_entity_id,
        cl.relationship_type,
        'child'::text,
        f.depth + 1
      FROM corporate_links cl
      JOIN family f ON f.entity_id = cl.parent_entity_id AND f.direction = 'child'
      WHERE f.depth < $2
    )
    SELECT DISTINCT
      f.entity_id,
      e.full_legal_name,
      f.relationship_type,
      f.direction,
      f.depth
    FROM family f
    JOIN entities e ON e.id = f.entity_id
    WHERE f.entity_id != $1
    ORDER BY f.depth ASC
  `;

  return query<CorporateFamilyMember>(sql, [entityId, maxDepth]);
}

export { DEFAULT_WEIGHTS };
