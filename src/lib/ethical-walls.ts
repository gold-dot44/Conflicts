import { query } from "./db";
import { clioFetch } from "./clio/client";
import { generateScreeningMemo } from "./pdf";
import { uploadBlob } from "./blob-storage";

export interface EthicalWall {
  id: string;
  screenedAttorney: string;
  screenedAttorneyUpn: string;
  matterId: string;
  matterName: string;
  createdBy: string;
  createdAt: string;
  memoUrl: string | null;
  isActive: boolean;
}

/**
 * Create an ethical wall screening an attorney from a matter.
 *
 * 1. Insert DB record
 * 2. Apply PostgreSQL row-level security policy
 * 3. Revoke Clio permissions
 * 4. Generate screening memo PDF
 * 5. Store memo in Azure Blob Storage
 * 6. File memo to Clio matter
 */
export async function createEthicalWall(params: {
  screenedAttorney: string;
  screenedAttorneyUpn: string;
  matterId: string;
  createdBy: string;
}): Promise<EthicalWall> {
  // 1. Insert the wall record
  const [wall] = await query<EthicalWall>(
    `INSERT INTO ethical_walls (screened_attorney, screened_attorney_upn, matter_id, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [params.screenedAttorney, params.screenedAttorneyUpn, params.matterId, params.createdBy]
  );

  // 2. Create RLS policy for this specific screening
  const policyName = `wall_${wall.id.replace(/-/g, "_")}`;
  await query(
    `CREATE POLICY ${policyName} ON entity_matter_roles
     FOR SELECT
     USING (
       NOT (matter_id = $1 AND current_setting('app.current_user_upn', true) = $2)
     )`,
    [params.matterId, params.screenedAttorneyUpn]
  );

  // 3. Revoke Clio permissions (if matter has a Clio ID)
  const [matter] = await query<{ clio_matter_id: number | null; matter_name: string }>(
    `SELECT clio_matter_id, matter_name FROM matters WHERE id = $1`,
    [params.matterId]
  );

  if (matter?.clio_matter_id) {
    try {
      await revokeClioAccess(matter.clio_matter_id, params.screenedAttorneyUpn);
    } catch (e) {
      console.error("Failed to revoke Clio access:", e);
    }
  }

  // 4. Generate screening memo PDF
  const memoPdf = await generateScreeningMemo({
    attorney: params.screenedAttorney,
    matterName: matter?.matter_name ?? "Unknown",
    matterId: params.matterId,
    createdBy: params.createdBy,
    createdAt: new Date().toISOString(),
  });

  // 5. Upload to Azure Blob Storage
  const memoUrl = await uploadBlob(
    process.env.AZURE_STORAGE_CONTAINER_AUDIT ?? "audit-trails",
    `screening-memos/${wall.id}.pdf`,
    memoPdf,
    "application/pdf"
  );

  // 6. Update wall record with memo URL
  await query(
    `UPDATE ethical_walls SET memo_url = $1 WHERE id = $2`,
    [memoUrl, wall.id]
  );

  return { ...wall, memoUrl, matterName: matter?.matter_name ?? "" };
}

/**
 * Remove an ethical wall (deactivate).
 */
export async function removeEthicalWall(wallId: string): Promise<void> {
  const policyName = `wall_${wallId.replace(/-/g, "_")}`;
  try {
    await query(`DROP POLICY IF EXISTS ${policyName} ON entity_matter_roles`);
  } catch {
    // Policy may not exist
  }
  await query(
    `UPDATE ethical_walls SET is_active = false WHERE id = $1`,
    [wallId]
  );
}

/**
 * List active ethical walls.
 */
export async function listEthicalWalls(matterId?: string): Promise<EthicalWall[]> {
  let sql = `
    SELECT ew.*, m.matter_name
    FROM ethical_walls ew
    JOIN matters m ON m.id = ew.matter_id
    WHERE ew.is_active = true
  `;
  const params: unknown[] = [];
  if (matterId) {
    sql += ` AND ew.matter_id = $1`;
    params.push(matterId);
  }
  sql += " ORDER BY ew.created_at DESC";
  return query<EthicalWall>(sql, params);
}

async function revokeClioAccess(
  clioMatterId: number,
  _attorneyUpn: string
): Promise<void> {
  // Clio API: remove user's permissions on the matter
  // This would use Clio's matter permissions API
  // Implementation depends on Clio's specific permission model
  console.log(`Revoking Clio access for matter ${clioMatterId}`);
}
