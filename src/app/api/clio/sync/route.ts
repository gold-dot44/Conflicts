import { NextResponse } from "next/server";
import { query } from "@/lib/db";

const DEMO_MODE = process.env.DEMO_MODE === "true";

export async function POST() {
  // Check connection: demo mode uses globalThis, production checks DB
  if (DEMO_MODE) {
    const connected = !!(globalThis as Record<string, unknown>).__clioConnected;
    if (!connected) {
      return NextResponse.json(
        { error: "Clio is not connected. Authorize first via Admin settings." },
        { status: 400 }
      );
    }
  } else {
    const tokenRows = await query<{ provider: string }>(
      `SELECT provider FROM oauth_tokens WHERE provider = 'clio'`
    );
    if (tokenRows.length === 0) {
      return NextResponse.json(
        { error: "Clio is not connected. Authorize first via Admin settings." },
        { status: 400 }
      );
    }
  }

  try {
    const { reconcile } = await import("@/lib/clio/sync");
    const result = await reconcile();

    const timestamp = new Date().toISOString();
    const resultMsg = `Synced ${result.contacts} contacts, ${result.matters} matters`;

    if (DEMO_MODE) {
      (globalThis as Record<string, unknown>).__clioLastSync = timestamp;
      (globalThis as Record<string, unknown>).__clioLastSyncResult = resultMsg;
    } else {
      await query(
        `INSERT INTO app_config (config_key, config_value, updated_by)
         VALUES ('clio_last_sync', $1, 'system')
         ON CONFLICT (config_key) DO UPDATE SET config_value = $1, updated_at = NOW()`,
        [JSON.stringify(timestamp)]
      );
      await query(
        `INSERT INTO app_config (config_key, config_value, updated_by)
         VALUES ('clio_last_sync_result', $1, 'system')
         ON CONFLICT (config_key) DO UPDATE SET config_value = $1, updated_at = NOW()`,
        [JSON.stringify(resultMsg)]
      );
    }

    return NextResponse.json({
      success: true,
      contacts: result.contacts,
      matters: result.matters,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const timestamp = new Date().toISOString();

    if (DEMO_MODE) {
      (globalThis as Record<string, unknown>).__clioLastSync = timestamp;
      (globalThis as Record<string, unknown>).__clioLastSyncResult = `Error: ${message}`;
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
