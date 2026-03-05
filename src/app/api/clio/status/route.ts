import { NextResponse } from "next/server";
import { query } from "@/lib/db";

const DEMO_MODE = process.env.DEMO_MODE === "true";

export async function GET() {
  const configured = !!(process.env.CLIO_CLIENT_ID && process.env.CLIO_CLIENT_SECRET);

  if (DEMO_MODE) {
    // Demo mode: use globalThis fallback
    const connected = !!(globalThis as Record<string, unknown>).__clioConnected;
    const connectedAt = (globalThis as Record<string, unknown>).__clioConnectedAt as string | undefined;
    const lastSync = (globalThis as Record<string, unknown>).__clioLastSync as string | undefined;
    const lastSyncResult = (globalThis as Record<string, unknown>).__clioLastSyncResult as string | undefined;

    return NextResponse.json({
      configured,
      connected,
      connectedAt: connectedAt ?? null,
      lastSync: lastSync ?? null,
      lastSyncResult: lastSyncResult ?? null,
    });
  }

  // Production: check DB for tokens and connection state
  const tokenRows = await query<{ provider: string }>(
    `SELECT provider FROM oauth_tokens WHERE provider = 'clio'`
  );
  const connected = tokenRows.length > 0;

  const configRows = await query<{ config_key: string; config_value: string }>(
    `SELECT config_key, config_value FROM app_config
     WHERE config_key IN ('clio_connected_at', 'clio_last_sync', 'clio_last_sync_result')`
  );

  const configMap: Record<string, string> = {};
  for (const row of configRows) {
    try { configMap[row.config_key] = JSON.parse(row.config_value); } catch {
      configMap[row.config_key] = row.config_value;
    }
  }

  return NextResponse.json({
    configured,
    connected,
    connectedAt: configMap.clio_connected_at ?? null,
    lastSync: configMap.clio_last_sync ?? null,
    lastSyncResult: configMap.clio_last_sync_result ?? null,
  });
}
