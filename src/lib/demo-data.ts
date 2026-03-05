import type {
  SearchResult, EntityMatterRole, ConflictCheckRequest,
  CheckRequestSubject, CheckRequestType, CheckRequestStatus,
  SubjectRole, ConflictDisposition, CrossReference, MatchReason,
  EnrichedSearchResult, EntityType, MatterStaffMember, StaffRole,
  StaffLookupResult,
  DataShape, HistoricalImportDefaults, HistoricalColumnMapping,
  HistoricalImportPreview, HistoricalImportResult,
  HistoricalImportProblemRow, MatterStatus,
} from "@/types";

/** Standalone matter record with all linked parties */
export interface DemoMatter {
  matterId: string;
  matterName: string;
  matterNumber: string | null;
  status: "open" | "closed" | "pending";
  responsibleAttorney: string | null;
  practiceArea: string | null;
  openDate: string | null;
  closeDate: string | null;
  parties: Array<{
    entityId: string;
    role: EntityMatterRole;
  }>;
}

const SEED_ENTITIES: SearchResult[] = [
  {
    entityId: "demo-1",
    fullLegalName: "Acme Corporation",
    firstName: null, lastName: null, entityType: "company",
    aliases: ["Acme Corp", "Acme Inc."],
    compositeScore: 0, levenshteinScore: 0, trigramScore: 0,
    soundexMatch: false, metaphoneMatch: false, fullTextScore: 0,
    matters: [], corporateFamily: [
      { entityId: "demo-5", fullLegalName: "Acme Holdings LLC", relationshipType: "parent", direction: "parent", depth: 1 },
      { entityId: "demo-6", fullLegalName: "Acme Technologies Inc.", relationshipType: "subsidiary", direction: "child", depth: 1 },
    ],
  },
  {
    entityId: "demo-2",
    fullLegalName: "John Smith",
    firstName: "John", lastName: "Smith", entityType: "person",
    aliases: ["J. Smith", "Jonathan Smith"],
    compositeScore: 0, levenshteinScore: 0, trigramScore: 0,
    soundexMatch: false, metaphoneMatch: false, fullTextScore: 0,
    matters: [], corporateFamily: [],
  },
  {
    entityId: "demo-3",
    fullLegalName: "Widget Industries LLC",
    firstName: null, lastName: null, entityType: "company",
    aliases: ["Widget Industries"],
    compositeScore: 0, levenshteinScore: 0, trigramScore: 0,
    soundexMatch: false, metaphoneMatch: false, fullTextScore: 0,
    matters: [], corporateFamily: [],
  },
  {
    entityId: "demo-4",
    fullLegalName: "Jane Doe",
    firstName: "Jane", lastName: "Doe", entityType: "person",
    aliases: [],
    compositeScore: 0, levenshteinScore: 0, trigramScore: 0,
    soundexMatch: false, metaphoneMatch: false, fullTextScore: 0,
    matters: [], corporateFamily: [],
  },
  {
    entityId: "demo-5",
    fullLegalName: "Acme Holdings LLC",
    firstName: null, lastName: null, entityType: "company",
    aliases: [],
    compositeScore: 0, levenshteinScore: 0, trigramScore: 0,
    soundexMatch: false, metaphoneMatch: false, fullTextScore: 0,
    matters: [], corporateFamily: [],
  },
  {
    entityId: "demo-6",
    fullLegalName: "Acme Technologies Inc.",
    firstName: null, lastName: null, entityType: "company",
    aliases: ["Acme Tech"],
    compositeScore: 0, levenshteinScore: 0, trigramScore: 0,
    soundexMatch: false, metaphoneMatch: false, fullTextScore: 0,
    matters: [], corporateFamily: [],
  },
  {
    entityId: "demo-7",
    fullLegalName: "Globex Corporation",
    firstName: null, lastName: null, entityType: "company",
    aliases: ["Globex Corp"],
    compositeScore: 0, levenshteinScore: 0, trigramScore: 0,
    soundexMatch: false, metaphoneMatch: false, fullTextScore: 0,
    matters: [], corporateFamily: [],
  },
  {
    entityId: "demo-8",
    fullLegalName: "Jonathan Smith",
    firstName: "Jonathan", lastName: "Smith", entityType: "person",
    aliases: ["Jon Smith"],
    compositeScore: 0, levenshteinScore: 0, trigramScore: 0,
    soundexMatch: false, metaphoneMatch: false, fullTextScore: 0,
    matters: [], corporateFamily: [],
  },
  {
    entityId: "demo-9",
    fullLegalName: "Joan Smythe",
    firstName: "Joan", lastName: "Smythe", entityType: "person",
    aliases: [],
    compositeScore: 0, levenshteinScore: 0, trigramScore: 0,
    soundexMatch: false, metaphoneMatch: false, fullTextScore: 0,
    matters: [], corporateFamily: [],
  },
  {
    entityId: "demo-10",
    fullLegalName: "David Martinez",
    firstName: "David", lastName: "Martinez", entityType: "person",
    aliases: [],
    compositeScore: 0, levenshteinScore: 0, trigramScore: 0,
    soundexMatch: false, metaphoneMatch: false, fullTextScore: 0,
    matters: [], corporateFamily: [],
  },
];

const SEED_MATTERS: DemoMatter[] = [
  {
    matterId: "m-1",
    matterName: "Acme Corp v. Widget Industries",
    matterNumber: "2024-001",
    status: "open",
    responsibleAttorney: "Sarah Johnson",
    practiceArea: "Litigation",
    openDate: "2024-03-15",
    closeDate: null,
    parties: [
      { entityId: "demo-1", role: "client" },
      { entityId: "demo-3", role: "adverse_party" },
    ],
  },
  {
    matterId: "m-2",
    matterName: "Acme Corp - Series B Financing",
    matterNumber: "2023-047",
    status: "closed",
    responsibleAttorney: "Michael Chen",
    practiceArea: "Corporate",
    openDate: "2023-06-01",
    closeDate: "2023-12-15",
    parties: [
      { entityId: "demo-1", role: "client" },
    ],
  },
  {
    matterId: "m-3",
    matterName: "Smith Family Trust",
    matterNumber: "2024-012",
    status: "open",
    responsibleAttorney: "Lisa Park",
    practiceArea: "Estate Planning",
    openDate: "2024-01-10",
    closeDate: null,
    parties: [
      { entityId: "demo-2", role: "client" },
    ],
  },
  {
    matterId: "m-4",
    matterName: "Doe v. Metro Transit Authority",
    matterNumber: "2023-089",
    status: "closed",
    responsibleAttorney: "Robert Kim",
    practiceArea: "Personal Injury",
    openDate: "2023-02-20",
    closeDate: "2024-01-30",
    parties: [
      { entityId: "demo-4", role: "client" },
    ],
  },
  {
    matterId: "m-5",
    matterName: "Globex Corp Annual Compliance",
    matterNumber: "2024-033",
    status: "open",
    responsibleAttorney: "Lisa Park",
    practiceArea: "Regulatory",
    openDate: "2024-02-01",
    closeDate: null,
    parties: [
      { entityId: "demo-7", role: "client" },
    ],
  },
];

const SEED_STAFF: MatterStaffMember[] = [
  { id: "ms-1", matterId: "m-1", userUpn: "sarah.johnson@firm.com", userName: "Sarah Johnson", role: "responsible_attorney", startDate: "2024-03-15", endDate: null, sourceSystem: "manual", createdAt: "2024-03-15T10:00:00Z" },
  { id: "ms-2", matterId: "m-1", userUpn: "michael.chen@firm.com", userName: "Michael Chen", role: "associate", startDate: "2024-03-20", endDate: null, sourceSystem: "manual", createdAt: "2024-03-20T09:00:00Z" },
  { id: "ms-3", matterId: "m-2", userUpn: "michael.chen@firm.com", userName: "Michael Chen", role: "responsible_attorney", startDate: "2023-06-01", endDate: "2023-12-15", sourceSystem: "manual", createdAt: "2023-06-01T10:00:00Z" },
  { id: "ms-4", matterId: "m-3", userUpn: "lisa.park@firm.com", userName: "Lisa Park", role: "responsible_attorney", startDate: "2024-01-10", endDate: null, sourceSystem: "manual", createdAt: "2024-01-10T10:00:00Z" },
  { id: "ms-5", matterId: "m-4", userUpn: "robert.kim@firm.com", userName: "Robert Kim", role: "responsible_attorney", startDate: "2023-02-20", endDate: "2024-01-30", sourceSystem: "manual", createdAt: "2023-02-20T10:00:00Z" },
  { id: "ms-6", matterId: "m-4", userUpn: "emily.watson@firm.com", userName: "Emily Watson", role: "paralegal", startDate: "2023-03-01", endDate: "2024-01-30", sourceSystem: "manual", createdAt: "2023-03-01T10:00:00Z" },
  { id: "ms-7", matterId: "m-5", userUpn: "lisa.park@firm.com", userName: "Lisa Park", role: "responsible_attorney", startDate: "2024-02-01", endDate: null, sourceSystem: "manual", createdAt: "2024-02-01T10:00:00Z" },
  { id: "ms-8", matterId: "m-5", userUpn: "david.martinez@firm.com", userName: "David Martinez", role: "associate", startDate: "2024-02-15", endDate: null, sourceSystem: "manual", createdAt: "2024-02-15T10:00:00Z" },
];

// Mutable in-memory stores
const entities: SearchResult[] = [...SEED_ENTITIES];
const matters: DemoMatter[] = [...SEED_MATTERS];
const staffMembers: MatterStaffMember[] = [...SEED_STAFF];

let matterCounter = 100;
let entityCounter = 100;
let requestCounter = 147;
let subjectCounter = 500;

// --- Conflict Check Request seed data ---

const SEED_CHECK_REQUESTS: ConflictCheckRequest[] = [
  {
    id: "cr-1",
    requestNumber: "#2024-0147",
    requestType: "new_client",
    prospectiveMatter: "Acme Corp M&A Advisory",
    requestingAttorney: "Michael Chen",
    requestedAt: "2026-03-05T14:30:00Z",
    requestedByUpn: "michael.chen@firm.com",
    assignedAnalystUpn: "sarah.johnson@firm.com",
    status: "pending_review",
    subjects: [
      {
        id: "sub-1",
        requestId: "cr-1",
        subjectName: "Acme Corporation",
        subjectRole: "prospective_client",
        subjectType: "company",
        searchCompleted: true,
        auditLogId: "audit-1",
        results: [],
        disposition: "no_conflict",
        dispositionBy: "sarah.johnson@firm.com",
        dispositionRationale: "Existing client — no adverse relationships.",
        dispositionAt: "2026-03-05T14:45:00Z",
        crossReferences: [],
      },
      {
        id: "sub-2",
        requestId: "cr-1",
        subjectName: "Widget Industries LLC",
        subjectRole: "adverse_party",
        subjectType: "company",
        searchCompleted: true,
        auditLogId: "audit-2",
        results: [],
        disposition: "potential_conflict",
        dispositionBy: "sarah.johnson@firm.com",
        dispositionRationale: "Widget is the defendant in an active case where Acme (our prospective client) is the plaintiff. Escalating per firm policy.",
        dispositionAt: "2026-03-05T14:50:00Z",
        crossReferences: [
          {
            subjectName: "Acme Corporation",
            subjectRole: "prospective_client",
            matchedEntityId: "demo-3",
            matchedEntityName: "Widget Industries LLC",
            conflictType: "Entity is adverse party in open matter with prospective client",
            matterName: "Acme Corp v. Widget Industries",
            severity: "critical",
          },
        ],
      },
      {
        id: "sub-3",
        requestId: "cr-1",
        subjectName: "John Smith",
        subjectRole: "related_individual",
        subjectType: "person",
        searchCompleted: true,
        auditLogId: "audit-3",
        results: [],
        disposition: null,
        dispositionBy: null,
        dispositionRationale: null,
        dispositionAt: null,
        crossReferences: [],
      },
    ],
    reviewedByUpn: null,
    reviewedAt: null,
    reviewNotes: null,
    createdAt: "2026-03-05T14:30:00Z",
    updatedAt: "2026-03-05T14:50:00Z",
  },
  {
    id: "cr-2",
    requestNumber: "#2024-0146",
    requestType: "new_matter",
    prospectiveMatter: "Widget Industries Trademark Filing",
    requestingAttorney: "Lisa Park",
    requestedAt: "2026-03-05T10:15:00Z",
    requestedByUpn: "lisa.park@firm.com",
    assignedAnalystUpn: "sarah.johnson@firm.com",
    status: "cleared",
    subjects: [
      {
        id: "sub-4",
        requestId: "cr-2",
        subjectName: "Widget Industries LLC",
        subjectRole: "prospective_client",
        subjectType: "company",
        searchCompleted: true,
        auditLogId: "audit-4",
        results: [],
        disposition: "no_conflict",
        dispositionBy: "sarah.johnson@firm.com",
        dispositionRationale: "Existing client, new matter type.",
        dispositionAt: "2026-03-05T10:30:00Z",
        crossReferences: [],
      },
      {
        id: "sub-5",
        requestId: "cr-2",
        subjectName: "National Trademark Board",
        subjectRole: "other",
        subjectType: "company",
        searchCompleted: true,
        auditLogId: "audit-5",
        results: [],
        disposition: "no_conflict",
        dispositionBy: "sarah.johnson@firm.com",
        dispositionRationale: "No matches found.",
        dispositionAt: "2026-03-05T10:32:00Z",
        crossReferences: [],
      },
    ],
    reviewedByUpn: null,
    reviewedAt: null,
    reviewNotes: null,
    createdAt: "2026-03-05T10:15:00Z",
    updatedAt: "2026-03-05T10:32:00Z",
  },
  {
    id: "cr-3",
    requestNumber: "#2024-0145",
    requestType: "lateral_hire",
    prospectiveMatter: "Lateral Hire — David Martinez from Baker & Sterling",
    requestingAttorney: "Robert Kim",
    requestedAt: "2026-03-04T09:00:00Z",
    requestedByUpn: "robert.kim@firm.com",
    assignedAnalystUpn: "sarah.johnson@firm.com",
    status: "pending_review",
    subjects: [
      {
        id: "sub-6",
        requestId: "cr-3",
        subjectName: "David Martinez",
        subjectRole: "related_individual",
        subjectType: "person",
        searchCompleted: true,
        auditLogId: "audit-6",
        results: [],
        disposition: "potential_conflict",
        dispositionBy: "sarah.johnson@firm.com",
        dispositionRationale: "Lateral hire previously represented Widget Industries at Baker & Sterling, creating a potential conflict with Acme Corp v. Widget.",
        dispositionAt: "2026-03-04T10:00:00Z",
        crossReferences: [],
      },
    ],
    reviewedByUpn: null,
    reviewedAt: null,
    reviewNotes: null,
    createdAt: "2026-03-04T09:00:00Z",
    updatedAt: "2026-03-04T10:00:00Z",
  },
];

const checkRequests: ConflictCheckRequest[] = [...SEED_CHECK_REQUESTS];

// --- Demo attorneys for search/autocomplete ---
export const DEMO_ATTORNEYS = [
  { name: "Michael Chen", upn: "michael.chen@firm.com", role: "partner" },
  { name: "Sarah Johnson", upn: "sarah.johnson@firm.com", role: "analyst" },
  { name: "Robert Kim", upn: "robert.kim@firm.com", role: "reviewer" },
  { name: "Lisa Park", upn: "lisa.park@firm.com", role: "partner" },
  { name: "David Martinez", upn: "david.martinez@firm.com", role: "associate" },
  { name: "Jennifer Walsh", upn: "jennifer.walsh@firm.com", role: "partner" },
];

// --- Entity operations ---

export function getAllEntities(): SearchResult[] {
  return entities;
}

export function getEntityById(id: string): SearchResult | undefined {
  return entities.find((e) => e.entityId === id);
}

export function addEntity(data: {
  fullLegalName: string;
  firstName?: string;
  lastName?: string;
  entityType: "person" | "company";
  aliases?: string[];
}): SearchResult {
  const entity: SearchResult = {
    entityId: `demo-${++entityCounter}`,
    fullLegalName: data.fullLegalName,
    firstName: data.firstName ?? null,
    lastName: data.lastName ?? null,
    entityType: data.entityType,
    aliases: data.aliases ?? [],
    compositeScore: 0, levenshteinScore: 0, trigramScore: 0,
    soundexMatch: false, metaphoneMatch: false, fullTextScore: 0,
    matters: [], corporateFamily: [],
  };
  entities.push(entity);
  return entity;
}

// --- Matter operations ---

export function getAllMatters(): DemoMatter[] {
  return matters;
}

export function getMatterById(id: string): DemoMatter | undefined {
  return matters.find((m) => m.matterId === id);
}

export function addPartyToMatter(
  matterId: string,
  entityId: string,
  role: EntityMatterRole
): boolean {
  const matter = matters.find((m) => m.matterId === matterId);
  if (!matter) return false;
  const entity = entities.find((e) => e.entityId === entityId);
  if (!entity) return false;
  if (matter.parties.some((p) => p.entityId === entityId)) return false;
  matter.parties.push({ entityId, role });
  return true;
}

export function createMatter(data: {
  matterName: string;
  matterNumber?: string;
  status: "open" | "closed" | "pending";
  responsibleAttorney?: string;
  practiceArea?: string;
  parties: Array<{ entityId: string; role: EntityMatterRole }>;
}): DemoMatter {
  const matter: DemoMatter = {
    matterId: `m-${++matterCounter}`,
    matterName: data.matterName,
    matterNumber: data.matterNumber ?? null,
    status: data.status,
    responsibleAttorney: data.responsibleAttorney ?? null,
    practiceArea: data.practiceArea ?? null,
    openDate: new Date().toISOString().split("T")[0],
    closeDate: null,
    parties: data.parties,
  };
  matters.push(matter);
  return matter;
}

/** Build matters list for an entity (used in search results) */
function mattersForEntity(entityId: string): SearchResult["matters"] {
  return matters
    .filter((m) => m.parties.some((p) => p.entityId === entityId))
    .map((m) => {
      const party = m.parties.find((p) => p.entityId === entityId)!;
      return {
        matterId: m.matterId,
        matterName: m.matterName,
        matterNumber: m.matterNumber,
        status: m.status,
        role: party.role,
        responsibleAttorney: m.responsibleAttorney,
        practiceArea: m.practiceArea,
        openDate: m.openDate,
        closeDate: m.closeDate,
        staff: staffMembers
          .filter((s) => s.matterId === m.matterId)
          .map((s) => ({ userName: s.userName, role: s.role })),
      };
    });
}

// --- Search ---

function similarity(a: string, b: string): number {
  const al = a.toLowerCase();
  const bl = b.toLowerCase();
  if (al === bl) return 1;
  if (al.includes(bl) || bl.includes(al)) return 0.8;

  const trigramsA: Record<string, boolean> = {};
  const trigramsB: Record<string, boolean> = {};
  for (let i = 0; i <= al.length - 3; i++) trigramsA[al.slice(i, i + 3)] = true;
  for (let i = 0; i <= bl.length - 3; i++) trigramsB[bl.slice(i, i + 3)] = true;

  const keysA = Object.keys(trigramsA);
  const keysB = Object.keys(trigramsB);
  if (keysA.length === 0 || keysB.length === 0) return 0;

  let intersection = 0;
  keysA.forEach((t) => { if (trigramsB[t]) intersection++; });
  return intersection / Math.max(keysA.length, keysB.length);
}

/** Simple phonetic check: do two strings start with the same sound? */
function soundsLike(a: string, b: string): boolean {
  const al = a.toLowerCase().replace(/[^a-z]/g, "");
  const bl = b.toLowerCase().replace(/[^a-z]/g, "");
  if (al.length < 2 || bl.length < 2) return false;
  // Simple: same first 2 consonants
  const consonants = (s: string) => s.replace(/[aeiou]/g, "").slice(0, 3);
  return consonants(al) === consonants(bl) && al !== bl;
}

/** Determine match reasons for a result */
function getMatchReasons(query: string, entity: SearchResult): MatchReason[] {
  const reasons: MatchReason[] = [];
  const q = query.toLowerCase();
  const name = entity.fullLegalName.toLowerCase();

  if (q === name) {
    reasons.push("exact_name");
  } else if (entity.aliases.some((a) => a.toLowerCase() === q)) {
    reasons.push("alias_match");
  } else {
    const sim = similarity(q, entity.fullLegalName);
    if (sim >= 0.7) reasons.push("similar_spelling");
    else if (sim >= 0.3) reasons.push("partial_match");

    if (soundsLike(q, entity.fullLegalName) || soundsLike(q, entity.lastName ?? "")) {
      reasons.push("sounds_similar");
    }
  }

  if (entity.corporateFamily.length > 0 && reasons.length === 0) {
    reasons.push("corporate_family");
  }

  if (reasons.length === 0) reasons.push("partial_match");
  return reasons;
}

/** Convert match reasons to plain English */
function matchDescription(reasons: MatchReason[], entity: SearchResult): string {
  const descriptions: string[] = [];
  for (const r of reasons) {
    switch (r) {
      case "exact_name": descriptions.push("exact name"); break;
      case "alias_match": descriptions.push(`alias "${entity.aliases[0]}"`); break;
      case "similar_spelling": descriptions.push("similar spelling (Levenshtein)"); break;
      case "sounds_similar": descriptions.push("sounds similar (phonetic match)"); break;
      case "partial_match": descriptions.push("partial name match"); break;
      case "corporate_family": descriptions.push("corporate family link"); break;
    }
  }
  return "Matched on: " + descriptions.join(" + ");
}

export function searchEntities(
  query: string,
  searchType: "all" | "person" | "company"
): SearchResult[] {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];

  return entities
    .filter((e) => searchType === "all" || e.entityType === searchType)
    .map((e) => {
      const nameScore = similarity(q, e.fullLegalName);
      const aliasScore = Math.max(0, ...e.aliases.map((a) => similarity(q, a)));
      const bestScore = Math.max(nameScore, aliasScore);

      return {
        ...e,
        matters: mattersForEntity(e.entityId),
        compositeScore: bestScore,
        trigramScore: bestScore,
        levenshteinScore: bestScore,
      };
    })
    .filter((e) => e.compositeScore >= 0.15)
    .sort((a, b) => b.compositeScore - a.compositeScore);
}

/** Enriched search with match reasons */
export function searchEntitiesEnriched(
  query: string,
  searchType: "all" | "person" | "company"
): EnrichedSearchResult[] {
  const results = searchEntities(query, searchType);
  return results.map((r) => {
    const reasons = getMatchReasons(query, r);
    return {
      ...r,
      matchReasons: reasons,
      matchDescription: matchDescription(reasons, r),
    };
  });
}

// --- Conflict Check Request operations ---

export function getAllCheckRequests(): ConflictCheckRequest[] {
  return checkRequests;
}

export function getCheckRequestById(id: string): ConflictCheckRequest | undefined {
  return checkRequests.find((r) => r.id === id);
}

export function getPendingReviewRequests(): ConflictCheckRequest[] {
  return checkRequests.filter((r) => r.status === "pending_review");
}

export function getRecentCheckRequests(limit = 20): ConflictCheckRequest[] {
  return [...checkRequests]
    .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())
    .slice(0, limit);
}

/**
 * Detect cross-references between subjects within a single check request.
 * If entity A is the prospective client and entity B (adverse party) is
 * adverse to A in an existing matter, that's a critical conflict.
 */
function detectCrossReferences(
  subjects: Array<{ subjectName: string; subjectRole: SubjectRole; results: SearchResult[] }>
): Map<string, CrossReference[]> {
  const crossRefs = new Map<string, CrossReference[]>();

  for (const subject of subjects) {
    const refs: CrossReference[] = [];

    for (const result of subject.results) {
      for (const matter of result.matters) {
        // Check if any other subject in this request is linked to the same matter
        for (const otherSubject of subjects) {
          if (otherSubject.subjectName === subject.subjectName) continue;

          for (const otherResult of otherSubject.results) {
            for (const otherMatter of otherResult.matters) {
              if (otherMatter.matterId === matter.matterId) {
                // Same matter, different parties — potential conflict
                const isAdverse = (
                  (matter.role === "client" && otherMatter.role === "adverse_party") ||
                  (matter.role === "adverse_party" && otherMatter.role === "client")
                );
                if (isAdverse && matter.status === "open") {
                  refs.push({
                    subjectName: otherSubject.subjectName,
                    subjectRole: otherSubject.subjectRole,
                    matchedEntityId: result.entityId,
                    matchedEntityName: result.fullLegalName,
                    conflictType: `Entity is adverse party in open matter with ${otherSubject.subjectRole.replace(/_/g, " ")}`,
                    matterName: matter.matterName,
                    severity: "critical",
                  });
                }
              }
            }
          }
        }
      }
    }

    crossRefs.set(subject.subjectName, refs);
  }

  return crossRefs;
}

export function createCheckRequest(data: {
  requestType: CheckRequestType;
  prospectiveMatter: string;
  requestingAttorney: string;
  subjects: Array<{
    subjectName: string;
    subjectRole: SubjectRole;
    subjectType: EntityType | "unknown";
  }>;
}): ConflictCheckRequest {
  const requestId = `cr-${++requestCounter}`;
  const now = new Date().toISOString();

  // Run search for each subject
  const searchedSubjects: CheckRequestSubject[] = data.subjects.map((s) => {
    const searchType = s.subjectType === "unknown" ? "all" : s.subjectType;
    const results = searchEntities(s.subjectName, searchType);

    return {
      id: `sub-${++subjectCounter}`,
      requestId,
      subjectName: s.subjectName,
      subjectRole: s.subjectRole,
      subjectType: s.subjectType,
      searchCompleted: true,
      auditLogId: `demo-audit-${subjectCounter}`,
      results,
      disposition: null,
      dispositionBy: null,
      dispositionRationale: null,
      dispositionAt: null,
      crossReferences: [],
    };
  });

  // Detect cross-references
  const crossRefMap = detectCrossReferences(searchedSubjects);
  for (const subject of searchedSubjects) {
    subject.crossReferences = crossRefMap.get(subject.subjectName) ?? [];
  }

  const hasAttentionItems = searchedSubjects.some(
    (s) => s.crossReferences.length > 0 || s.results.some((r) => r.compositeScore >= 0.5)
  );

  const request: ConflictCheckRequest = {
    id: requestId,
    requestNumber: `#2024-${String(requestCounter).padStart(4, "0")}`,
    requestType: data.requestType,
    prospectiveMatter: data.prospectiveMatter,
    requestingAttorney: data.requestingAttorney,
    requestedAt: now,
    requestedByUpn: "demo@example.com",
    assignedAnalystUpn: "demo@example.com",
    status: hasAttentionItems ? "searching" : "searching",
    subjects: searchedSubjects,
    reviewedByUpn: null,
    reviewedAt: null,
    reviewNotes: null,
    createdAt: now,
    updatedAt: now,
  };

  checkRequests.unshift(request);
  return request;
}

export function updateSubjectDisposition(
  requestId: string,
  subjectId: string,
  disposition: ConflictDisposition,
  rationale: string,
  dispositionBy: string
): boolean {
  const request = checkRequests.find((r) => r.id === requestId);
  if (!request) return false;

  const subject = request.subjects.find((s) => s.id === subjectId);
  if (!subject) return false;

  subject.disposition = disposition;
  subject.dispositionBy = dispositionBy;
  subject.dispositionRationale = rationale;
  subject.dispositionAt = new Date().toISOString();
  request.updatedAt = new Date().toISOString();

  // Check if all subjects have dispositions
  const allDisposed = request.subjects.every((s) => s.disposition !== null);
  const hasConflict = request.subjects.some(
    (s) => s.disposition === "potential_conflict" || s.disposition === "conflict_confirmed"
  );

  if (allDisposed) {
    request.status = hasConflict ? "pending_review" : "cleared";
  }

  return true;
}

export function batchClearLowRisk(
  requestId: string,
  threshold: number,
  dispositionBy: string
): number {
  const request = checkRequests.find((r) => r.id === requestId);
  if (!request) return 0;

  let cleared = 0;
  for (const subject of request.subjects) {
    if (subject.disposition !== null) continue;
    const maxScore = Math.max(0, ...subject.results.map((r) => r.compositeScore));
    if (maxScore < threshold && subject.crossReferences.length === 0) {
      subject.disposition = "no_conflict";
      subject.dispositionBy = dispositionBy;
      subject.dispositionRationale = `Auto-cleared: all results below ${(threshold * 100).toFixed(0)}% confidence threshold.`;
      subject.dispositionAt = new Date().toISOString();
      cleared++;
    }
  }

  request.updatedAt = new Date().toISOString();
  return cleared;
}

export function reviewCheckRequest(
  requestId: string,
  decision: CheckRequestStatus,
  reviewNotes: string,
  reviewerUpn: string
): boolean {
  const request = checkRequests.find((r) => r.id === requestId);
  if (!request) return false;

  request.status = decision;
  request.reviewedByUpn = reviewerUpn;
  request.reviewedAt = new Date().toISOString();
  request.reviewNotes = reviewNotes;
  request.updatedAt = new Date().toISOString();
  return true;
}

/** For search results page: get enriched results for a subject */
export function getEnrichedSubjectResults(
  subjectName: string,
  subjectType: EntityType | "unknown"
): EnrichedSearchResult[] {
  const searchType = subjectType === "unknown" ? "all" : subjectType;
  return searchEntitiesEnriched(subjectName, searchType);
}

// --- Historical Matter Import ---

/** Corporate suffix patterns for auto-detecting entity type */
const CORPORATE_SUFFIXES = /\b(inc\.?|llc|corp\.?|corporation|ltd\.?|limited|lp|llp|company|co\.?|association|foundation|trust|group|holdings|partners|partnership)\b/i;

export function detectEntityType(name: string): EntityType {
  return CORPORATE_SUFFIXES.test(name) ? "company" : "person";
}

/** Split multi-value cells on semicolons or " and " */
export function splitMultiValue(value: string): string[] {
  return value
    .split(/[;]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Column synonym map for auto-detecting headers */
const COLUMN_SYNONYMS: Record<string, string[]> = {
  matterName: ["matter name", "matter", "case name", "case", "caption", "description", "matter description", "case caption", "file name", "re:"],
  matterNumber: ["matter #", "matter number", "file #", "file number", "case number", "case #", "docket", "our ref", "reference"],
  clientName: ["client", "client name", "our client", "petitioner", "applicant"],
  adversePartyName: ["adverse", "adverse party", "opposing party", "defendant", "respondent", "opposing side", "other side", "against", "vs"],
  coPartyName: ["co-party", "co party", "co-defendant", "co-plaintiff", "co defendant"],
  witnessName: ["witness", "witness name"],
  expertName: ["expert", "expert name"],
  insurerName: ["insurer", "insurance", "carrier"],
  opposingCounselName: ["opposing counsel", "opp counsel", "opposing attorney"],
  otherPartyName: ["other party", "other"],
  status: ["status", "matter status", "case status", "open/closed", "active"],
  responsibleAttorney: ["attorney", "responsible attorney", "lead attorney", "partner", "originating attorney", "billing attorney", "responsible lawyer", "atty"],
  practiceArea: ["practice area", "area of law", "type", "matter type", "case type", "category", "department"],
  openDate: ["open date", "date opened", "opened", "start date", "intake date", "date retained"],
  closeDate: ["close date", "date closed", "closed", "end date", "disposition date"],
};

export function autoDetectMappings(headers: string[]): HistoricalColumnMapping[] {
  const mappings: HistoricalColumnMapping[] = [];
  for (const header of headers) {
    const h = header.toLowerCase().trim();
    let matched = false;
    for (const [targetField, synonyms] of Object.entries(COLUMN_SYNONYMS)) {
      if (synonyms.some((s) => s === h || h.includes(s))) {
        mappings.push({ sourceColumn: header, targetField });
        matched = true;
        break;
      }
    }
    if (!matched) {
      mappings.push({ sourceColumn: header, targetField: "skip" });
    }
  }
  return mappings;
}

/** Detect data shape from headers and sample rows */
export function detectDataShape(
  headers: string[],
  sampleRows: Record<string, string>[]
): DataShape {
  const h = headers.map((h) => h.toLowerCase());
  // If columns like "Client" and "Adverse Party" exist → one row per matter
  const hasClientCol = h.some((x) => x.includes("client"));
  const hasAdverseCol = h.some((x) => x.includes("adverse") || x.includes("defendant") || x.includes("respondent"));
  if (hasClientCol && hasAdverseCol) return "one_per_matter";

  // If there's a "Party Role" or "Role" column and multiple rows share the same matter → one per party
  const hasRoleCol = h.some((x) => x === "role" || x === "party role" || x.includes("party role"));
  if (hasRoleCol && sampleRows.length >= 2) {
    const matterCol = h.find((x) => x.includes("matter") || x.includes("case"));
    if (matterCol) {
      const matterNames = sampleRows.map((r) => r[matterCol]);
      const uniqueMatters = new Set(matterNames);
      if (uniqueMatters.size < matterNames.length) return "one_per_party";
    }
  }

  return "one_per_matter";
}

/** Try to parse a date string in various formats */
function tryParseDate(value: string): string | null {
  if (!value || !value.trim()) return null;
  const v = value.trim();
  // Try ISO
  const isoMatch = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;
  // Try M/D/YYYY or M-D-YYYY
  const usMatch = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (usMatch) return `${usMatch[3]}-${usMatch[1].padStart(2, "0")}-${usMatch[2].padStart(2, "0")}`;
  // Try YYYY alone
  const yearMatch = v.match(/^(\d{4})$/);
  if (yearMatch) return `${yearMatch[1]}-01-01`;
  return null;
}

function parseStatus(value: string | undefined, defaultStatus: MatterStatus): MatterStatus {
  if (!value || !value.trim()) return defaultStatus;
  const v = value.toLowerCase().trim();
  if (v === "open" || v === "active" || v === "yes") return "open";
  if (v === "closed" || v === "inactive" || v === "no") return "closed";
  if (v === "pending") return "pending";
  return defaultStatus;
}

/**
 * Process rows into a preview of what the import will create.
 */
export function buildHistoricalImportPreview(
  rows: Record<string, string>[],
  mappings: HistoricalColumnMapping[],
  defaults: HistoricalImportDefaults,
  dataShape: DataShape,
): HistoricalImportPreview {
  const activeMappings = mappings.filter((m) => m.targetField !== "skip");
  const fieldMap = new Map<string, string>(); // targetField → sourceColumn
  for (const m of activeMappings) {
    fieldMap.set(m.targetField, m.sourceColumn);
  }

  const partyFields = [
    { field: "clientName", role: "client" as EntityMatterRole },
    { field: "adversePartyName", role: "adverse_party" as EntityMatterRole },
    { field: "coPartyName", role: "co_party" as EntityMatterRole },
    { field: "witnessName", role: "witness" as EntityMatterRole },
    { field: "expertName", role: "expert" as EntityMatterRole },
    { field: "insurerName", role: "insurer" as EntityMatterRole },
    { field: "opposingCounselName", role: "opposing_counsel" as EntityMatterRole },
    { field: "otherPartyName", role: "other" as EntityMatterRole },
  ];

  const problemRows: HistoricalImportProblemRow[] = [];
  const entityNames = new Set<string>();
  let matterCount = 0;
  let roleLinks = 0;
  const duplicateEntities: HistoricalImportPreview["duplicateEntities"] = [];

  // Group rows by matter for one_per_party shape
  if (dataShape === "one_per_party") {
    const matterGroups = new Map<string, Record<string, string>[]>();
    const matterNameCol = fieldMap.get("matterName");
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const matterName = matterNameCol ? row[matterNameCol]?.trim() : "";
      if (!matterName) {
        problemRows.push({ rowNumber: i + 2, reason: "Empty matter name", data: row });
        continue;
      }
      if (!matterGroups.has(matterName)) matterGroups.set(matterName, []);
      matterGroups.get(matterName)!.push(row);
    }
    matterCount = matterGroups.size;
    // Count entities from grouped rows
    for (const groupRows of Array.from(matterGroups.values())) {
      for (const row of groupRows) {
        for (const pf of partyFields) {
          const col = fieldMap.get(pf.field);
          if (!col) continue;
          const value = row[col]?.trim();
          if (!value) continue;
          const names = defaults.multiValueHandling === "split" ? splitMultiValue(value) : [value];
          for (const name of names) {
            entityNames.add(name.toLowerCase());
            roleLinks++;
          }
        }
      }
    }
  } else {
    // one_per_matter: each row is one matter
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const matterNameCol = fieldMap.get("matterName");
      const matterName = matterNameCol ? row[matterNameCol]?.trim() : "";
      if (!matterName) {
        problemRows.push({ rowNumber: i + 2, reason: "Empty matter name", data: row });
        continue;
      }
      // Check dates
      const openDateCol = fieldMap.get("openDate");
      const closeDateCol = fieldMap.get("closeDate");
      if (openDateCol && row[openDateCol]?.trim()) {
        const parsed = tryParseDate(row[openDateCol]);
        if (!parsed && defaults.dateErrorHandling === "show_errors") {
          problemRows.push({ rowNumber: i + 2, reason: `Date "${row[openDateCol]}" couldn't be parsed`, data: row });
          continue;
        }
      }
      if (closeDateCol && row[closeDateCol]?.trim()) {
        const parsed = tryParseDate(row[closeDateCol]);
        if (!parsed && defaults.dateErrorHandling === "show_errors") {
          problemRows.push({ rowNumber: i + 2, reason: `Date "${row[closeDateCol]}" couldn't be parsed`, data: row });
          continue;
        }
      }

      matterCount++;
      for (const pf of partyFields) {
        const col = fieldMap.get(pf.field);
        if (!col) continue;
        const value = row[col]?.trim();
        if (!value) continue;
        const names = defaults.multiValueHandling === "split" ? splitMultiValue(value) : [value];
        for (const name of names) {
          entityNames.add(name.toLowerCase());
          roleLinks++;
        }
      }
    }
  }

  // Check for duplicates against existing entities
  for (const name of Array.from(entityNames)) {
    for (const existing of entities) {
      const score = similarity(name, existing.fullLegalName);
      if (score >= 0.7) {
        const existingMatterCount = matters.filter((m) =>
          m.parties.some((p) => p.entityId === existing.entityId)
        ).length;
        duplicateEntities.push({
          importName: name,
          importRole: "client",
          matterRef: "",
          matchedEntityId: existing.entityId,
          matchedEntityName: existing.fullLegalName,
          matchScore: score,
          existingMatterCount,
          action: "link_existing",
        });
        break; // Only report first match per entity
      }
    }
  }

  const readyEntities = entityNames.size - duplicateEntities.length;

  return {
    mattersToCreate: matterCount,
    entitiesToCreate: entityNames.size,
    roleLinksToCreate: roleLinks,
    duplicateEntities,
    readyEntities,
    problemRows,
  };
}

/**
 * Execute the historical matter import.
 */
export function executeHistoricalImport(
  rows: Record<string, string>[],
  mappings: HistoricalColumnMapping[],
  defaults: HistoricalImportDefaults,
  dataShape: DataShape,
  sourceLabel: string,
  duplicateActions: Record<string, "link_existing" | "import_new" | "skip">,
): HistoricalImportResult {
  const activeMappings = mappings.filter((m) => m.targetField !== "skip");
  const fieldMap = new Map<string, string>();
  for (const m of activeMappings) {
    fieldMap.set(m.targetField, m.sourceColumn);
  }

  const partyFields = [
    { field: "clientName", role: "client" as EntityMatterRole },
    { field: "adversePartyName", role: "adverse_party" as EntityMatterRole },
    { field: "coPartyName", role: "co_party" as EntityMatterRole },
    { field: "witnessName", role: "witness" as EntityMatterRole },
    { field: "expertName", role: "expert" as EntityMatterRole },
    { field: "insurerName", role: "insurer" as EntityMatterRole },
    { field: "opposingCounselName", role: "opposing_counsel" as EntityMatterRole },
    { field: "otherPartyName", role: "other" as EntityMatterRole },
  ];

  let mattersImported = 0;
  let entitiesCreated = 0;
  let entitiesLinked = 0;
  let roleLinksCreated = 0;
  let skippedRows = 0;

  const defaultStatus = (defaults.missingStatus === "leave_blank" ? "closed" : defaults.missingStatus) as MatterStatus;

  function resolveEntity(name: string): string | null {
    const key = name.toLowerCase();
    const action = duplicateActions[key];

    if (action === "skip") return null;

    if (action === "link_existing") {
      // Find existing entity
      for (const existing of entities) {
        if (similarity(key, existing.fullLegalName) >= 0.7) {
          entitiesLinked++;
          return existing.entityId;
        }
      }
    }

    // Import as new
    const entityType = defaults.entityTypeDetection === "auto"
      ? detectEntityType(name)
      : defaults.entityTypeDetection as EntityType;

    const newEntity = addEntity({
      fullLegalName: name,
      entityType,
      firstName: entityType === "person" ? name.split(" ")[0] : undefined,
      lastName: entityType === "person" ? name.split(" ").slice(1).join(" ") || undefined : undefined,
    });
    entitiesCreated++;
    return newEntity.entityId;
  }

  function importMatterRow(row: Record<string, string>) {
    const matterNameCol = fieldMap.get("matterName");
    const matterName = matterNameCol ? row[matterNameCol]?.trim() : "";
    if (!matterName) { skippedRows++; return; }

    const matterNumberCol = fieldMap.get("matterNumber");
    const statusCol = fieldMap.get("status");
    const attorneyCol = fieldMap.get("responsibleAttorney");
    const practiceCol = fieldMap.get("practiceArea");
    const openDateCol = fieldMap.get("openDate");
    const closeDateCol = fieldMap.get("closeDate");

    const matterParties: Array<{ entityId: string; role: EntityMatterRole }> = [];

    for (const pf of partyFields) {
      const col = fieldMap.get(pf.field);
      if (!col) continue;
      const value = row[col]?.trim();
      if (!value) continue;
      const names = defaults.multiValueHandling === "split" ? splitMultiValue(value) : [value];
      for (const name of names) {
        const entityId = resolveEntity(name);
        if (entityId) {
          matterParties.push({ entityId, role: pf.role });
          roleLinksCreated++;
        }
      }
    }

    const openDate = openDateCol ? tryParseDate(row[openDateCol]) : null;
    const closeDate = closeDateCol ? tryParseDate(row[closeDateCol]) : null;

    const matter = createMatter({
      matterName,
      matterNumber: matterNumberCol ? row[matterNumberCol]?.trim() : undefined,
      status: parseStatus(statusCol ? row[statusCol] : undefined, defaultStatus),
      responsibleAttorney: attorneyCol ? row[attorneyCol]?.trim() : undefined,
      practiceArea: practiceCol ? row[practiceCol]?.trim() : undefined,
      parties: matterParties,
    });

    // Patch dates onto the created matter
    if (openDate) matter.openDate = openDate;
    if (closeDate) matter.closeDate = closeDate;
    if (matter.status === "closed" && closeDate) matter.closeDate = closeDate;

    mattersImported++;
  }

  if (dataShape === "one_per_party") {
    // Group by matter, then create one matter per group
    const matterGroups = new Map<string, Record<string, string>[]>();
    const matterNameCol = fieldMap.get("matterName");
    for (const row of rows) {
      const matterName = matterNameCol ? row[matterNameCol]?.trim() : "";
      if (!matterName) { skippedRows++; continue; }
      if (!matterGroups.has(matterName)) matterGroups.set(matterName, []);
      matterGroups.get(matterName)!.push(row);
    }
    // Merge each group into a single combined row and import
    for (const [, groupRows] of Array.from(matterGroups.entries())) {
      // Take metadata from first row, merge party names
      const combined = { ...groupRows[0] };
      // For party columns, concatenate all values
      for (const pf of partyFields) {
        const col = fieldMap.get(pf.field);
        if (!col) continue;
        const allValues = groupRows.map((r) => r[col]?.trim()).filter(Boolean);
        combined[col] = allValues.join("; ");
      }
      importMatterRow(combined);
    }
  } else {
    for (const row of rows) {
      importMatterRow(row);
    }
  }

  return {
    mattersImported,
    entitiesCreated,
    entitiesLinked,
    roleLinksCreated,
    skippedRows,
    sourceLabel,
  };
}

// --- Matter Staff operations ---

export function getStaffForMatter(matterId: string): MatterStaffMember[] {
  return staffMembers
    .filter((s) => s.matterId === matterId)
    .sort((a, b) => a.role.localeCompare(b.role) || a.userName.localeCompare(b.userName));
}

export function addStaffToMatter(data: {
  matterId: string;
  userUpn: string;
  userName: string;
  role: StaffRole;
  startDate?: string;
}): MatterStaffMember | null {
  // Check for ethical wall conflict
  const demoWalls = [
    { upn: "david.martinez@firm.com", matterId: "m-1", active: true },
    { upn: "emily.watson@firm.com", matterId: "m-3", active: true },
  ];
  const blocked = demoWalls.find(
    (w) => w.upn === data.userUpn && w.matterId === data.matterId && w.active
  );
  if (blocked) return null; // ethical wall conflict

  // Check for duplicate
  const exists = staffMembers.find(
    (s) => s.matterId === data.matterId && s.userUpn === data.userUpn && s.role === data.role
  );
  if (exists) return exists;

  const member: MatterStaffMember = {
    id: `ms-${Date.now()}`,
    matterId: data.matterId,
    userUpn: data.userUpn,
    userName: data.userName,
    role: data.role,
    startDate: data.startDate ?? null,
    endDate: null,
    sourceSystem: "manual",
    createdAt: new Date().toISOString(),
  };
  staffMembers.push(member);
  return member;
}

export function removeStaffFromMatter(id: string): boolean {
  const idx = staffMembers.findIndex((s) => s.id === id);
  if (idx === -1) return false;
  staffMembers.splice(idx, 1);
  return true;
}

export function getMattersForStaff(upn: string): StaffLookupResult[] {
  const staffEntries = staffMembers.filter((s) => s.userUpn === upn);
  return staffEntries.map((s) => {
    const matter = matters.find((m) => m.matterId === s.matterId);
    const parties = matter
      ? matter.parties.map((p) => {
          const entity = entities.find((e) => e.entityId === p.entityId);
          return {
            entityName: entity?.fullLegalName ?? "Unknown",
            role: p.role,
          };
        })
      : [];
    return {
      matterId: s.matterId,
      matterName: matter?.matterName ?? "Unknown",
      matterNumber: matter?.matterNumber ?? null,
      matterStatus: (matter?.status ?? "open") as MatterStatus,
      practiceArea: matter?.practiceArea ?? null,
      staffRole: s.role as StaffRole,
      startDate: s.startDate,
      endDate: s.endDate,
      parties,
    };
  });
}

export function getAllStaffUpns(): Array<{ upn: string; name: string }> {
  const seen = new Map<string, string>();
  for (const s of staffMembers) {
    if (!seen.has(s.userUpn)) {
      seen.set(s.userUpn, s.userName);
    }
  }
  return Array.from(seen.entries()).map(([upn, name]) => ({ upn, name }));
}

export function getStaffNameByUpn(upn: string): string | null {
  const member = staffMembers.find((s) => s.userUpn === upn);
  return member?.userName ?? null;
}

/** Demo stats for the reviewer dashboard */
export function getDemoStats() {
  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  return {
    todayChecks: checkRequests.filter((r) => r.requestedAt >= today).length || 12,
    weekChecks: checkRequests.filter((r) => r.requestedAt >= weekAgo).length || 47,
    pending: checkRequests.filter((r) => r.status === "pending_review").length,
    activeWalls: 2,
  };
}
