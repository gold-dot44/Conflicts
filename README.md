# Practical Architecture for an Integrated Legal Conflict Checking System

**Built on Microsoft Azure · Secured by Microsoft Entra ID · Zero On-Premises Infrastructure**

*A response to the Gemini architectural blueprint,
rewritten for a firm already invested in the Microsoft ecosystem.*

*February 2026*

---

## 1. Executive Assessment

The referenced Gemini architectural blueprint correctly identifies every major risk vector in legal conflict checking: lateral hire tainted knowledge, corporate family trees, fuzzy name matching, audit trail requirements, and the failure of manual spreadsheet checks. Its legal analysis of ABA Model Rules 1.7, 1.9, and 1.10 is sound.

However, the blueprint prescribes enterprise infrastructure that is mismatched to this firm's constraints and existing technology investments. It calls for self-hosted Elasticsearch clusters, a separate Neo4j graph database, and multi-system ETL orchestration. That architecture assumes on-premises servers or self-managed VMs, dedicated DevOps staff, and willingness to take on the security obligations of administering bespoke database infrastructure.

This firm already operates within the Microsoft ecosystem through Office 365. The most natural, secure, and operationally simple path is to build the entire conflict checking system on Microsoft Azure, authenticated through the firm's existing Microsoft Entra ID (formerly Azure Active Directory) tenant. This keeps every component under one vendor umbrella, one billing relationship, one compliance framework, and one identity system the firm already manages daily.

### Governing Design Principle

Every component runs on Microsoft Azure managed services. Authentication flows through the firm's existing Office 365 / Entra ID tenant. The firm configures users and data — never servers, certificates, or network perimeters. No new security surface is introduced.

---

## 2. Why the Microsoft Azure Ecosystem

### 2.1 You Already Have the Foundation

Your Office 365 subscription includes a Microsoft Entra ID tenant. Every attorney and staff member in the firm already has a managed identity with multi-factor authentication, conditional access policies, and centralized lifecycle management. When someone joins the firm, they get an Office 365 account. When they leave, that account is disabled. Building on Azure means the conflict check tool plugs directly into this existing identity infrastructure with zero additional user management overhead.

### 2.2 One Vendor, One Compliance Framework

Microsoft Azure carries SOC 1/2/3, ISO 27001, ISO 27018, HIPAA BAA eligibility, FedRAMP, and dozens of other compliance certifications. By hosting the database, the application, and the identity layer all within Azure, the firm has a single vendor compliance relationship. There is no need to evaluate separate security postures for a database vendor, a hosting vendor, and an identity vendor. Microsoft's compliance documentation and BAA process are well-established and familiar to legal industry IT consultants.

### 2.3 The Practical Trust Argument

The firm's client files, emails, and internal communications already live in Microsoft's cloud through Exchange Online, SharePoint, and OneDrive. Adding a PostgreSQL database on Azure does not expand the firm's trust boundary — it operates within the same cloud infrastructure, the same data centers, the same encryption standards, and the same contractual protections that already govern the firm's most sensitive data.

---

## 3. System Architecture

### 3.1 Component Overview

The system comprises four managed Azure services and the firm's existing Clio Manage subscription. No component requires the firm to manage servers, operating systems, or network infrastructure.

| Component | Azure Service | Role |
|-----------|--------------|------|
| Identity | Microsoft Entra ID (existing Office 365 tenant) | Authentication, MFA, conditional access, user lifecycle — all using existing firm accounts |
| Database | Azure Database for PostgreSQL — Flexible Server | Unified index for all entities, matters, relationships, corporate linkages, and audit logs |
| Application | Azure App Service (Web App) | Hosts the conflict check web application; accessed through the browser like any other web app |
| File Storage | Azure Blob Storage | Stores generated audit trail PDFs and uploaded lateral hire import files |
| Practice Mgmt | Clio Manage (existing, external) | Source of truth for active clients, matters, and contacts; synced via API and webhooks |

#### What 'Managed' Means in Practice

Azure Database for PostgreSQL Flexible Server is not a VM with PostgreSQL installed on it. It is a fully managed database service. Microsoft handles operating system patching, PostgreSQL version upgrades, automated backups (with 35-day point-in-time recovery), TLS enforcement, encryption at rest with AES-256, high availability failover, and monitoring. The firm interacts with the database exclusively through the application — never through a server console.

### 3.2 Authentication Flow: How Users Log In

When an attorney or conflicts analyst navigates to the conflict check application in their browser, they are redirected to the Microsoft Entra ID login page — the same login screen they see for Outlook, Teams, and SharePoint. They authenticate with their existing Office 365 credentials and complete MFA as required by the firm's existing policy. Entra ID issues a security token, and the application grants access based on the user's assigned role.

No new passwords. No new MFA enrollment. No separate user directory. If a staff member's Office 365 account is disabled (termination, leave of absence), access to the conflict tool is immediately and automatically revoked. The firm's existing identity governance controls every aspect of who can use the system.

### 3.3 Role-Based Access Through Entra ID Groups

The application maps Entra ID security groups (which the firm likely already maintains for email distribution and SharePoint permissions) to application roles. No user management happens inside the conflict tool itself.

| Entra ID Group | Application Role | Permissions |
|----------------|-----------------|-------------|
| Conflicts-Analysts | Analyst | Run searches, review results, assign dispositions, import lateral hire data, generate audit reports |
| Conflicts-Reviewers | Reviewer / Partner | Everything analysts can do, plus approve/reject conflict determinations and authorize ethical walls |
| Conflicts-Admins | Administrator | Everything reviewers can do, plus configure fuzzy matching thresholds, manage algorithm weights, and access system settings |
| Conflicts-ViewOnly | Read-Only | View search history and audit logs only; cannot run new searches or change dispositions |

Conditional Access policies already configured in the firm's Entra ID tenant apply automatically. If the firm requires that access to sensitive applications only occurs from compliant devices, from specific IP ranges, or from within the United States, those policies govern the conflict tool without any additional configuration.

---

## 4. How Data Flows Through the System

### 4.1 Initial Load: Getting Everything Into One Place

**From Clio Manage:** A one-time bulk import script connects to the Clio API v4, extracts all Contacts and Matters (respecting the mandatory fields parameter, first-level nesting limits, cursor pagination, and rate limiting), and loads them into PostgreSQL. Custom fields are extracted using the `custom_field_values{field_name,value,picklist_option}` format to capture human-readable values.

**From Legacy Systems:** Historical data exports (CSV, Excel) are uploaded through the application's import wizard, column-mapped to the unified schema, deduplicated against existing records, and imported with source provenance tags.

**From Lateral Hires:** Lateral Partner Questionnaires and prior-firm exports are processed through the same import wizard, tagged with the lateral hire's name and import date for permanent traceability.

### 4.2 Ongoing Sync: Staying Current With Clio

**Webhooks (primary):** The system registers Clio webhooks for Contact and Matter create, update, and delete events. When a paralegal creates a new client in Clio, Clio fires an HTTP POST to the application's webhook endpoint on Azure App Service. The endpoint fetches the full record from Clio with all required fields and upserts it into PostgreSQL. The conflict database stays within seconds of Clio.

**Reconciliation (safety net):** A lightweight Azure Function runs every 15 minutes, checking Clio for records modified since the last successful sync timestamp. This catches any missed webhooks due to transient network issues or application restarts, ensuring zero data gaps.

#### Clio API Constraints Respected in This Architecture

Every Clio API call specifies explicit field lists (the API returns only id and etag by default). Matter and Contact extraction are separate operations joined in PostgreSQL (Clio restricts nesting to one level). Cursor pagination uses `order=id(asc)` with `meta.paging.next` URLs. Token-bucket rate limiting with exponential backoff prevents HTTP 429 errors. Custom picklist fields always request the `picklist_option` object.

---

## 5. Unified Database Schema

All data from Clio, legacy systems, and lateral hires normalizes into four core PostgreSQL tables. Every field identified in the Gemini blueprint is preserved. The schema is designed for both fast fuzzy search and strong access control.

### 5.1 entities

The central table. Every person, company, or organization from any source is a row.

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID (primary key) | Stable identifier across all systems |
| clio_contact_id | INTEGER (nullable, unique) | Links to Clio Contact.id; null for legacy-only records |
| full_legal_name | TEXT (trigram + full-text indexed) | Primary search target for fuzzy matching |
| first_name | TEXT | Individual matching; phonetic indexed via soundex/dmetaphone |
| last_name | TEXT | Primary individual identifier; phonetic indexed |
| entity_type | ENUM (person, company) | Filters search by entity nature |
| aliases | TEXT[] (array, trigram indexed) | DBA names, maiden names, trade names, prior corporate names |
| tax_id_hash | TEXT | bcrypt hash of SSN/EIN — never stored in plaintext |
| date_of_birth | DATE | Differentiates individuals with identical names |
| email | TEXT | Secondary verification for entity resolution |
| phone | TEXT | Secondary verification |
| source_system | TEXT | Provenance: 'clio', 'lateral_smith_2024', 'legacy_firmware' |
| created_at / updated_at | TIMESTAMPTZ | Record lifecycle timestamps |

### 5.2 matters

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID (primary key) | Stable matter identifier |
| clio_matter_id | INTEGER (nullable, unique) | Links to Clio Matter.id |
| matter_name | TEXT (full-text indexed) | Case name / description; searchable for context |
| matter_number | TEXT | Firm's internal file number |
| status | ENUM (open, closed, pending) | Rule 1.7 (current) vs. Rule 1.9 (former) analysis |
| responsible_attorney | TEXT | Identifies whose knowledge could taint the firm |
| practice_area | TEXT | Helps analysts assess substantial relationship |
| open_date / close_date | DATE | Timeline for conflict relevance |
| source_system | TEXT | Provenance tracking |

### 5.3 entity_matter_roles

The junction table mapping who played what role in which matter. This is the heart of conflict detection.

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID (primary key) | Row identifier |
| entity_id | UUID (FK → entities) | The person or company |
| matter_id | UUID (FK → matters) | The matter they're connected to |
| role | ENUM (client, adverse_party, co_party, witness, expert, insurer, opposing_counsel, judge, other) | Nature of the relationship |
| notes | TEXT | Free-text annotation (e.g., 'Board member, no legal representation') |
| source_system | TEXT | Where this link originated |

### 5.4 corporate_links

Stores corporate parent-child relationships for recursive traversal.

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID (primary key) | Row identifier |
| parent_entity_id | UUID (FK → entities) | Parent company |
| child_entity_id | UUID (FK → entities) | Subsidiary or affiliate |
| relationship_type | ENUM (parent, subsidiary, affiliate, division) | Nature of the corporate link |
| ownership_pct | DECIMAL (nullable) | Ownership percentage if known |
| source | TEXT | D&B, manual entry, SEC filing, etc. |

### 5.5 Security-Critical Design Decisions

**No plaintext SSNs or EINs.** The Gemini blueprint stores Social Security Numbers in Elasticsearch for exact-match deduplication. This architecture never stores the plaintext value. Instead, a salted bcrypt hash is stored. When an analyst needs to confirm that two 'John Smith' records are the same person, the system prompts for the SSN, hashes it in the browser, and compares hashes server-side. The raw SSN never reaches the database, never appears in logs, and never sits in a backup. This eliminates the single highest-risk data element from the system entirely.

**Row-level security for ethical walls.** Azure Database for PostgreSQL supports native PostgreSQL row-level security (RLS) policies. When an attorney is screened from a matter, an RLS policy prevents their database session from returning any rows associated with that matter. This is enforced by the database engine, not by application code that could be bypassed.

---

## 6. Fuzzy Matching: Full Elasticsearch Capability in PostgreSQL

The Gemini blueprint's treatment of fuzzy matching algorithms is its strongest technical section. Every algorithm it recommends is available natively in Azure Database for PostgreSQL through two standard extensions: `pg_trgm` and `fuzzystrmatch`. No separate search cluster is required.

| Algorithm | PostgreSQL Implementation | What It Catches |
|-----------|--------------------------|-----------------|
| Levenshtein Distance | fuzzystrmatch: `levenshtein(a, b)` with configurable edit threshold | Typos: 'Jonathn' → 'Jonathan'; transpositions: 'Teh' → 'The' |
| Trigram Similarity | pg_trgm: `similarity(a, b)` with GIN index for fast lookups | Partial matches: 'Smith Jones Co' → 'Smith, Jones & Company LLP' |
| Soundex | fuzzystrmatch: `soundex(name)` | Basic phonetics: 'Cyndi' → 'Cindy' → 'Sindy' |
| Double Metaphone | fuzzystrmatch: `dmetaphone(name)` | Advanced phonetics: 'Schneider' → 'Snyder'; multilingual names |
| Full-Text Search | Built-in `tsvector`/`tsquery` with ranking | Word stemming, boolean logic, relevance scoring across all text fields |

### 6.1 The Composite Search Query

When a conflicts analyst enters a name, the application runs a single SQL query that layers all five algorithms simultaneously and returns a unified, relevance-ranked result set. Each algorithm produces a similarity score between 0 and 1; these are combined using configurable weights into a composite score. Results are sorted by descending composite score, so the most dangerous matches surface first.

**Threshold tuning:** Default weights prioritize exact matches and Levenshtein distance (highest signal) over trigram and phonetic matches (broader net). The admin panel allows authorized users to adjust these weights. Common surnames like 'Smith' or 'Johnson' can have their phonetic weight reduced to prevent alert fatigue, while unusual corporate names get a boosted trigram weight.

### 6.2 Corporate Family Tree Traversal

When a search matches a corporate entity, the system automatically runs a recursive Common Table Expression (CTE) query against the `corporate_links` table. The query walks the tree in both directions: upward to the ultimate parent, and downward to all subsidiaries and affiliates. Every entity found in the traversal is then cross-checked against `entity_matter_roles`.

If the firm represents the parent company and a new matter is adverse to a subsidiary three levels down, the system flags it. This recursive CTE approach handles corporate trees up to dozens of levels deep with sub-second performance on a standard Azure PostgreSQL Flexible Server. The Gemini blueprint's Neo4j recommendation solves a scaling problem that does not exist at this firm's data volume.

---

## 7. Clio API v4 Integration

The Gemini blueprint's section on Clio API mechanics is accurate. The following constraints are real and must be respected.

| Constraint | How This Architecture Handles It |
|-----------|--------------------------------|
| Fields parameter is mandatory | Every API call specifies exact fields. The app maintains a field registry mapping each sync operation to its required field list. |
| First-level nesting only | Matter sync and Contact sync are separate operations joined during PostgreSQL upsert. |
| Custom fields require picklist_option | Sync always requests `custom_field_values{field_name,value,picklist_option}` for readable values. |
| Rate limit: 50 req/min (peak) | Token-bucket rate limiter with exponential backoff; monitors `X-RateLimit-Remaining` headers. |
| Pagination: 200 records/page | Cursor pagination via `order=id(asc)` following `meta.paging.next` URLs with checkpoint recovery. |

**Webhook sync:** After bulk import, Clio webhooks fire on Contact and Matter create/update/delete events, hitting the Azure App Service endpoint. A reconciliation Azure Function runs every 15 minutes as a safety net for missed webhooks.

---

## 8. User Interface Design

The Gemini blueprint focuses almost entirely on backend infrastructure and says very little about how people actually use the system. For a tool used daily by conflicts analysts, intake staff, and reviewing attorneys, the interface is the product.

### 8.1 Conflict Search Screen

**What the user sees:** A single search bar at the top of the page with a dropdown for search type (Person, Company, or All). The user types a name and presses Enter. An advanced options panel (collapsed by default) allows power users to filter by date range, matter status, source system, or practice area.

**What happens:** The composite fuzzy query runs against PostgreSQL. If the query matches a corporate entity, the recursive CTE fires automatically. Results stream back within one to two seconds.

**Results display:** A ranked list of potential matches. Each result shows the entity name, a color-coded confidence bar (red = high match, yellow = moderate, gray = low), entity type, associated matter(s), role in each matter, matter status (open/closed), responsible attorney, and source system. The analyst can expand any result to see full details including aliases, linked corporate entities, and historical search activity.

### 8.2 Conflict Resolution Workflow

The analyst selects a disposition for each flagged match. The disposition is locked to the audit trail the moment it is recorded.

| Status | Meaning | System Action |
|--------|---------|--------------|
| No Conflict | False positive or irrelevant match | Logs decision and rationale; clears matter for intake |
| Potential Conflict | Requires partner / ethics committee review | Escalates with full context; pauses matter intake; sends Teams notification to reviewer |
| Conflict Confirmed | Actual conflict exists | Blocks matter creation; triggers ethical wall workflow if screening is possible |
| Waiver Obtained | Conflict exists but informed consent given | Logs waiver; requires upload of signed consent to Azure Blob Storage; clears matter with flag |

### 8.3 Ethical Wall Management

When a conflict is confirmed involving a lateral hire, the screening workflow proceeds as follows:

1. The conflicts chair identifies the attorney to be screened and the restricted matter(s).
2. The system creates a PostgreSQL row-level security policy barring the screened attorney's session from all data associated with the restricted matter.
3. The system calls the Clio API to revoke the attorney's permissions on the matter (notes, documents, billing, calendar).
4. The system generates a formal screening memorandum (PDF) documenting the wall, the date, and the restrictions.
5. The memo is auto-filed to the matter in Clio via the API and stored in Azure Blob Storage.
6. A Teams notification is sent to the conflicts chair confirming the wall is in place.

### 8.4 Lateral Hire Import Wizard

**Step 1 — Upload:** The lateral hire's conflicts data (CSV, Excel, or typed LPQ) is uploaded via drag-and-drop. The file is stored in Azure Blob Storage with encryption at rest.

**Step 2 — Column Mapping:** The system auto-detects headers and suggests schema mappings. Common synonyms ('Case Name' → matter_name, 'Opposing Party' → adverse_party role) are pre-configured. The analyst confirms or adjusts each mapping.

**Step 3 — Preview and Deduplication:** Before import, every incoming entity is run through the full fuzzy matching pipeline against existing records. Potential duplicates are flagged for the analyst to merge or keep separate.

**Step 4 — Import:** Confirmed records are imported with `source_system` tagged as the lateral hire's name and import date, preserving permanent provenance.

---

## 9. Immutable Audit Trail

The audit trail is the firm's evidentiary shield in the event of a malpractice claim, disqualification motion, or bar disciplinary proceeding. Every conflict search and resolution is logged.

| Field | Contents |
|-------|----------|
| search_id | UUID identifying the search session |
| searched_by | Entra ID user principal name (the attorney's Office 365 email) |
| search_terms | Exact text entered by the analyst |
| search_timestamp | UTC timestamp to millisecond precision |
| algorithms_applied | Which fuzzy algorithms ran and at what threshold settings |
| results_snapshot | Complete snapshot of every result row with scores and entity details |
| disposition | No Conflict / Potential Conflict / Confirmed / Waiver Obtained |
| disposition_by | Entra ID identity of the decision-maker |
| disposition_rationale | Free-text explanation of the reasoning |
| disposition_timestamp | When the decision was recorded |
| related_documents | Azure Blob Storage links to waiver letters or screening memos |

The audit log table is append-only: the PostgreSQL role used by the application has INSERT permission only—no UPDATE, no DELETE. Even a database administrator connecting directly to Azure PostgreSQL cannot alter historical audit records without first changing the role permissions, which itself is logged by Azure's activity log. The audit trail is exportable as a tamper-evident PDF filed to the Clio matter via the API.

---

## 10. Security and Compliance: Nothing New to Manage

Every security obligation is handled by Azure managed services or the firm's existing Entra ID configuration. The firm's security perimeter does not expand.

| Concern | How It's Handled | Responsible Party |
|---------|-----------------|-------------------|
| Authentication | Microsoft Entra ID SSO with existing Office 365 credentials and MFA | Firm (existing configuration) |
| Authorization | Entra ID security groups mapped to app roles + PostgreSQL row-level security | Firm (configuration only) |
| Conditional Access | Existing Entra ID policies (device compliance, geo-fencing, IP restrictions) apply automatically | Firm (existing policies) |
| Encryption at rest | Azure PostgreSQL: AES-256 by default; Azure Blob Storage: AES-256 by default | Microsoft Azure |
| Encryption in transit | TLS 1.2+ enforced on all connections | Microsoft Azure |
| Backups | Automated daily with 35-day point-in-time recovery | Microsoft Azure |
| HIPAA | Azure HIPAA BAA covers PostgreSQL Flexible Server and Blob Storage | Microsoft Azure + firm BAA |
| SSN/EIN protection | bcrypt hashed only; plaintext never stored, transmitted, or logged | Architecture design |
| Audit log integrity | Append-only table; no UPDATE/DELETE; Azure activity logging for admin actions | Architecture design + Azure |
| User offboarding | Disable Office 365 account = instant loss of conflict tool access | Firm (existing process) |
| Patching / updates | Azure manages OS, PostgreSQL engine, and platform updates automatically | Microsoft Azure |
| Disaster recovery | Azure zone-redundant deployment with automatic failover | Microsoft Azure |

### What the Firm Does NOT Need to Do

Patch operating systems. Manage TLS certificates. Configure firewalls or network security groups. Set up intrusion detection. Manage database replication. Handle backup rotation. Run vulnerability scans on infrastructure. All of this is handled by Microsoft Azure under the firm's existing enterprise agreement.

---

## 11. Build Phases and Timeline

### Phase 1: Foundation (Weeks 1–4)

Provision Azure Database for PostgreSQL Flexible Server with `pg_trgm` and `fuzzystrmatch` extensions enabled. Register an Entra ID application for SSO. Deploy Azure App Service with the application skeleton. Create the schema tables and indexes. Build and test the Clio API bulk import pipeline with cursor pagination, rate limiting, and field management. Run the initial data load from Clio.

### Phase 2: Core Search and UI (Weeks 5–8)

Implement the composite fuzzy search query with configurable weights. Build the search interface with ranked, color-coded results. Implement the conflict resolution workflow with disposition tracking. Build the audit log with append-only enforcement. Calibrate fuzzy thresholds against the firm's actual data to optimize the balance between false positives and false negatives.

### Phase 3: Automation and Integration (Weeks 9–12)

Register Clio webhooks for real-time sync. Build the reconciliation Azure Function as a webhook safety net. Build the lateral hire import wizard with column mapping and deduplication. Implement the ethical wall workflow with Clio permission modification, screening memo PDF generation, and Azure Blob Storage filing. Integrate audit trail PDF export with Clio document filing.

### Phase 4: Refinement and Rollout (Weeks 13–16)

Corporate family tree management (manual entry initially; D&B API integration if warranted by client complexity). Admin panel for threshold tuning, common-name suppression, and algorithm weight adjustment. Microsoft Teams notifications for escalations and wall confirmations. User training, documentation, and staged rollout. Production monitoring via Azure Monitor and Application Insights.

### On Using Claude Code for Development

The Gemini blueprint's recommendation to use Claude Code for development acceleration is sound. Claude Code is particularly effective at generating Clio API integration code (pagination logic, field parameter management, webhook handlers), writing PostgreSQL fuzzy search queries with `pg_trgm` and `fuzzystrmatch`, and scaffolding the Next.js application components. It is a development tool — not a component of the production architecture.

---

## 12. Architecture Comparison

| Dimension | Gemini Blueprint | This Architecture |
|-----------|-----------------|-------------------|
| Database systems | Elasticsearch + Neo4j + staging SQL | Single Azure PostgreSQL Flexible Server |
| Identity / Auth | Unspecified | Microsoft Entra ID SSO via existing Office 365 tenant |
| Infrastructure | Self-hosted or self-managed VMs | Fully managed Azure services |
| Vendor relationships | 3+ (Elastic, Neo4j, hosting, identity) | 1 (Microsoft Azure, already in place) |
| Security surface | Firm manages 3+ DB engines, TLS, patching | Azure manages all infrastructure security |
| SSN/EIN storage | Plaintext in Elasticsearch (encrypted at rest) | Never stored; bcrypt hash comparison only |
| Fuzzy matching | Elasticsearch custom analyzers | PostgreSQL pg_trgm + fuzzystrmatch |
| Corporate trees | Neo4j graph + Cypher | PostgreSQL recursive CTEs |
| HIPAA path | Firm certifies each component separately | Single Azure BAA covers all components |
| User offboarding | Manual per-system deprovisioning | Disable Office 365 account = done |
| Time to production | 6–12 months | 3–4 months |
| Ongoing maintenance | Dedicated DevOps staff required | Application updates only |

---

## 13. Conclusion

The ethical obligation to perform thorough conflict checks is non-negotiable, and the Gemini blueprint correctly maps every dimension of that obligation. Where it falls short is in prescribing infrastructure that assumes resources and risk appetite this firm does not have and should not acquire.

This architecture delivers identical fuzzy matching rigor, identical corporate tree traversal, identical audit trail defensibility, and identical ethical wall enforcement. It does so within the Microsoft ecosystem the firm already trusts with its email, documents, and internal communications. Authentication is the Office 365 login the firm already manages. The database is a managed Azure service covered by the same compliance certifications and BAA that govern the firm's existing Microsoft footprint. No new vendor relationships, no new security obligations, no servers to manage.

The conflicts analysts get a fast, intuitive search interface they log into with their existing credentials. Firm leadership gets a system deployable in months, maintainable without DevOps staff, and defensible before any bar committee or malpractice carrier. The best conflict checking system is the one that is actually built, actually used, and actually catches conflicts. This architecture is designed to be that system.
