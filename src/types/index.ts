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
