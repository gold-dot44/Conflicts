import type { SearchResult, EntityMatterRole } from "@/types";

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
];

// Mutable in-memory stores
const entities: SearchResult[] = [...SEED_ENTITIES];
const matters: DemoMatter[] = [...SEED_MATTERS];

let matterCounter = 100;
let entityCounter = 100;

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
  // Don't add duplicate
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
