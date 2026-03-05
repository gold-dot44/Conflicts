export type EntityType = "person" | "company";
export type MatterStatus = "open" | "closed" | "pending";
export type EntityMatterRole =
  | "client"
  | "adverse_party"
  | "co_party"
  | "witness"
  | "expert"
  | "insurer"
  | "opposing_counsel"
  | "judge"
  | "other";
export type CorporateLinkType = "parent" | "subsidiary" | "affiliate" | "division";
export type ConflictDisposition =
  | "no_conflict"
  | "potential_conflict"
  | "conflict_confirmed"
  | "waiver_obtained";

export interface SearchResult {
  entityId: string;
  fullLegalName: string;
  firstName: string | null;
  lastName: string | null;
  entityType: EntityType;
  aliases: string[];
  compositeScore: number;
  levenshteinScore: number;
  trigramScore: number;
  soundexMatch: boolean;
  metaphoneMatch: boolean;
  fullTextScore: number;
  matters: MatterResult[];
  corporateFamily: CorporateFamilyMember[];
}

export interface MatterResult {
  matterId: string;
  matterName: string;
  matterNumber: string | null;
  status: MatterStatus;
  role: EntityMatterRole;
  responsibleAttorney: string | null;
  practiceArea: string | null;
  openDate: string | null;
  closeDate: string | null;
  staff: Array<{ userName: string; role: string }>;
}

export interface CorporateFamilyMember {
  entityId: string;
  fullLegalName: string;
  relationshipType: CorporateLinkType;
  direction: "parent" | "child";
  depth: number;
}

export interface SearchRequest {
  query: string;
  searchType: "person" | "company" | "all";
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    matterStatus?: MatterStatus;
    sourceSystem?: string;
    practiceArea?: string;
  };
}

export interface DispositionRequest {
  auditLogId: string;
  entityId: string;
  matterId?: string;
  disposition: ConflictDisposition;
  rationale: string;
}

// --- Conflict Check Request types ---

export type CheckRequestType =
  | "new_client"
  | "new_matter"
  | "lateral_hire"
  | "new_party"
  | "general";

export type CheckRequestStatus =
  | "draft"
  | "searching"
  | "pending_review"
  | "cleared"
  | "blocked"
  | "cleared_with_wall";

export type SubjectRole =
  | "prospective_client"
  | "adverse_party"
  | "related_individual"
  | "opposing_counsel"
  | "witness"
  | "expert"
  | "insurer"
  | "co_party"
  | "other";

export interface CheckRequestSubject {
  id: string;
  requestId: string;
  subjectName: string;
  subjectRole: SubjectRole;
  subjectType: EntityType | "unknown";
  searchCompleted: boolean;
  auditLogId: string | null;
  results: SearchResult[];
  disposition: ConflictDisposition | null;
  dispositionBy: string | null;
  dispositionRationale: string | null;
  dispositionAt: string | null;
  crossReferences: CrossReference[];
}

export interface CrossReference {
  subjectName: string;
  subjectRole: SubjectRole;
  matchedEntityId: string;
  matchedEntityName: string;
  conflictType: string;
  matterName: string;
  severity: "critical" | "warning" | "info";
}

export interface ConflictCheckRequest {
  id: string;
  requestNumber: string;
  requestType: CheckRequestType;
  prospectiveMatter: string;
  requestingAttorney: string;
  requestedAt: string;
  requestedByUpn: string;
  assignedAnalystUpn: string | null;
  status: CheckRequestStatus;
  subjects: CheckRequestSubject[];
  reviewedByUpn: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Plain-English description of why a result matched */
export type MatchReason =
  | "exact_name"
  | "similar_spelling"
  | "sounds_similar"
  | "partial_match"
  | "corporate_family"
  | "alias_match";

export interface EnrichedSearchResult extends SearchResult {
  matchReasons: MatchReason[];
  matchDescription: string;
}

/** Admin sensitivity settings (plain-English wrapper around FuzzyWeights) */
export interface SensitivitySettings {
  typos: number;        // 0-100, maps to levenshtein
  partial: number;      // 0-100, maps to trigram
  phonetic: number;     // 0-100, maps to combined soundex + metaphone
  keyword: number;      // 0-100, maps to fullText
  threshold: number;    // 0-100, minimum composite score
}

// --- Historical Matter Import types ---

export type DataShape = "one_per_matter" | "one_per_party" | "mixed";

export type MissingStatusDefault = "closed" | "open" | "pending" | "leave_blank";
export type EntityTypeDetection = "auto" | "person" | "company";
export type MultiValueHandling = "split" | "keep_single";
export type DateErrorHandling = "skip" | "show_errors";

export interface HistoricalImportDefaults {
  missingStatus: MissingStatusDefault;
  entityTypeDetection: EntityTypeDetection;
  multiValueHandling: MultiValueHandling;
  dateErrorHandling: DateErrorHandling;
}

export interface HistoricalMappingTarget {
  field: string;
  category: "matter" | "party" | "entity";
  label: string;
  partyRole?: EntityMatterRole;
}

export interface HistoricalImportRow {
  matterName: string;
  matterNumber?: string;
  status?: string;
  responsibleAttorney?: string;
  practiceArea?: string;
  openDate?: string;
  closeDate?: string;
  clientName?: string;
  adversePartyName?: string;
  coPartyName?: string;
  witnessName?: string;
  expertName?: string;
  insurerName?: string;
  opposingCounselName?: string;
  otherPartyName?: string;
  entityType?: string;
}

export interface HistoricalColumnMapping {
  sourceColumn: string;
  targetField: string;   // key of HistoricalImportRow or "skip"
}

export interface HistoricalImportProblemRow {
  rowNumber: number;
  reason: string;
  data: Record<string, string>;
}

export interface HistoricalImportPreview {
  mattersToCreate: number;
  entitiesToCreate: number;
  roleLinksToCreate: number;
  duplicateEntities: Array<{
    importName: string;
    importRole: string;
    matterRef: string;
    matchedEntityId: string;
    matchedEntityName: string;
    matchScore: number;
    existingMatterCount: number;
    action: "link_existing" | "import_new" | "skip";
  }>;
  readyEntities: number;
  problemRows: HistoricalImportProblemRow[];
}

export interface HistoricalImportResult {
  mattersImported: number;
  entitiesCreated: number;
  entitiesLinked: number;
  roleLinksCreated: number;
  skippedRows: number;
  sourceLabel: string;
}

export interface LateralImportRow {
  fullLegalName: string;
  firstName?: string;
  lastName?: string;
  entityType: EntityType;
  matterName?: string;
  role?: EntityMatterRole;
  notes?: string;
}

export interface ColumnMapping {
  sourceColumn: string;
  targetField: keyof LateralImportRow;
}

export interface FuzzyWeights {
  levenshtein: number;
  trigram: number;
  soundex: number;
  metaphone: number;
  fullText: number;
}

export interface AppRole {
  name: "analyst" | "reviewer" | "admin" | "readonly";
  permissions: string[];
}

// --- Matter Staff types ---

export type StaffRole =
  | "responsible_attorney"
  | "originating_attorney"
  | "associate"
  | "paralegal"
  | "legal_secretary"
  | "contract_attorney"
  | "of_counsel"
  | "other";

export interface MatterStaffMember {
  id: string;
  matterId: string;
  userUpn: string;
  userName: string;
  role: StaffRole;
  startDate: string | null;
  endDate: string | null;
  sourceSystem: string;
  createdAt: string;
}

export interface StaffLookupResult {
  matterId: string;
  matterName: string;
  matterNumber: string | null;
  matterStatus: MatterStatus;
  practiceArea: string | null;
  staffRole: StaffRole;
  startDate: string | null;
  endDate: string | null;
  parties: Array<{
    entityName: string;
    role: EntityMatterRole;
  }>;
}

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  responsible_attorney: "Responsible Attorney",
  originating_attorney: "Originating Attorney",
  associate: "Associate",
  paralegal: "Paralegal",
  legal_secretary: "Legal Secretary",
  contract_attorney: "Contract Attorney",
  of_counsel: "Of Counsel",
  other: "Other",
};

export const ROLE_PERMISSIONS: Record<AppRole["name"], string[]> = {
  readonly: ["view_audit"],
  analyst: ["search", "disposition", "import", "view_audit", "generate_reports"],
  reviewer: [
    "search", "disposition", "import", "view_audit", "generate_reports",
    "approve_disposition", "authorize_wall",
  ],
  admin: [
    "search", "disposition", "import", "view_audit", "generate_reports",
    "approve_disposition", "authorize_wall",
    "configure_thresholds", "manage_weights", "system_settings",
  ],
};
