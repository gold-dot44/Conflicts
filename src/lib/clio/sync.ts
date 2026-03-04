/**
 * Clio data synchronization: bulk import and incremental sync.
 */
import { clioFetch, clioPaginate, CONTACT_FIELDS, MATTER_FIELDS } from "./client";
import { query, withTransaction } from "../db";
import type { PoolClient } from "pg";

interface ClioContact {
  id: number;
  name: string;
  first_name: string | null;
  last_name: string | null;
  type: "Person" | "Company";
  email_addresses?: Array<{ address: string }>;
  phone_numbers?: Array<{ number: string }>;
  custom_field_values?: Array<{
    field_name: string;
    value: string | null;
    picklist_option?: { label: string } | null;
  }>;
}

interface ClioMatter {
  id: number;
  display_number: string | null;
  description: string;
  status: string;
  practice_area?: { name: string } | null;
  responsible_attorney?: { name: string } | null;
  open_date: string | null;
  close_date: string | null;
  client?: { id: number } | null;
  custom_field_values?: Array<{
    field_name: string;
    value: string | null;
    picklist_option?: { label: string } | null;
  }>;
}

/**
 * Bulk import all contacts from Clio into the entities table.
 */
export async function bulkImportContacts(): Promise<number> {
  const contacts = await clioPaginate<ClioContact>("/contacts", CONTACT_FIELDS);

  let imported = 0;
  for (const contact of contacts) {
    await upsertContactAsEntity(contact);
    imported++;
  }

  await query(
    `UPDATE clio_sync_state SET last_sync_at = NOW(), status = 'completed'
     WHERE resource_type = 'contacts'`
  );

  return imported;
}

/**
 * Bulk import all matters from Clio.
 */
export async function bulkImportMatters(): Promise<number> {
  const matters = await clioPaginate<ClioMatter>("/matters", MATTER_FIELDS);

  let imported = 0;
  for (const matter of matters) {
    await upsertMatter(matter);
    imported++;
  }

  await query(
    `UPDATE clio_sync_state SET last_sync_at = NOW(), status = 'completed'
     WHERE resource_type = 'matters'`
  );

  return imported;
}

/**
 * Upsert a Clio contact into the entities table.
 */
export async function upsertContactAsEntity(contact: ClioContact): Promise<void> {
  const email = contact.email_addresses?.[0]?.address ?? null;
  const phone = contact.phone_numbers?.[0]?.number ?? null;
  const entityType = contact.type === "Person" ? "person" : "company";

  await query(
    `INSERT INTO entities (clio_contact_id, full_legal_name, first_name, last_name,
                           entity_type, email, phone, source_system, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'clio', NOW())
     ON CONFLICT (clio_contact_id) DO UPDATE SET
       full_legal_name = EXCLUDED.full_legal_name,
       first_name = EXCLUDED.first_name,
       last_name = EXCLUDED.last_name,
       entity_type = EXCLUDED.entity_type,
       email = EXCLUDED.email,
       phone = EXCLUDED.phone,
       updated_at = NOW()`,
    [contact.id, contact.name, contact.first_name, contact.last_name, entityType, email, phone]
  );
}

/**
 * Upsert a Clio matter.
 */
export async function upsertMatter(matter: ClioMatter): Promise<void> {
  const status = matter.status === "Open" ? "open" : matter.status === "Closed" ? "closed" : "pending";

  await query(
    `INSERT INTO matters (clio_matter_id, matter_name, matter_number, status,
                          responsible_attorney, practice_area, open_date, close_date,
                          source_system, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'clio', NOW())
     ON CONFLICT (clio_matter_id) DO UPDATE SET
       matter_name = EXCLUDED.matter_name,
       matter_number = EXCLUDED.matter_number,
       status = EXCLUDED.status,
       responsible_attorney = EXCLUDED.responsible_attorney,
       practice_area = EXCLUDED.practice_area,
       open_date = EXCLUDED.open_date,
       close_date = EXCLUDED.close_date,
       updated_at = NOW()`,
    [
      matter.id,
      matter.description,
      matter.display_number,
      status,
      matter.responsible_attorney?.name ?? null,
      matter.practice_area?.name ?? null,
      matter.open_date,
      matter.close_date,
    ]
  );

  // Link client to matter if present
  if (matter.client?.id) {
    await linkClioClientToMatter(matter.client.id, matter.id);
  }
}

async function linkClioClientToMatter(
  clioContactId: number,
  clioMatterId: number
): Promise<void> {
  await query(
    `INSERT INTO entity_matter_roles (entity_id, matter_id, role, source_system)
     SELECT e.id, m.id, 'client', 'clio'
     FROM entities e, matters m
     WHERE e.clio_contact_id = $1 AND m.clio_matter_id = $2
     ON CONFLICT DO NOTHING`,
    [clioContactId, clioMatterId]
  );
}

/**
 * Reconciliation: fetch records modified since last sync.
 * Runs on a schedule (e.g., every 15 minutes via Azure Function).
 */
export async function reconcile(): Promise<{ contacts: number; matters: number }> {
  const [syncState] = await query<{ last_sync_at: string }>(
    `SELECT last_sync_at FROM clio_sync_state WHERE resource_type = 'contacts'`
  );

  const since = syncState?.last_sync_at ?? new Date(0).toISOString();

  // Fetch recently modified contacts
  const contacts = await clioPaginate<ClioContact>(
    `/contacts?updated_since=${encodeURIComponent(since)}`,
    CONTACT_FIELDS
  );

  for (const contact of contacts) {
    await upsertContactAsEntity(contact);
  }

  // Fetch recently modified matters
  const matters = await clioPaginate<ClioMatter>(
    `/matters?updated_since=${encodeURIComponent(since)}`,
    MATTER_FIELDS
  );

  for (const matter of matters) {
    await upsertMatter(matter);
  }

  await query(
    `UPDATE clio_sync_state SET last_sync_at = NOW(), status = 'completed'
     WHERE resource_type IN ('contacts', 'matters')`
  );

  return { contacts: contacts.length, matters: matters.length };
}
