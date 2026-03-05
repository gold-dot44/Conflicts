import { NextResponse } from "next/server";

export async function GET() {
  const connected = !!(globalThis as Record<string, unknown>).__clioConnected;
  const connectedAt = (globalThis as Record<string, unknown>).__clioConnectedAt as string | undefined;
  const lastSync = (globalThis as Record<string, unknown>).__clioLastSync as string | undefined;
  const lastSyncResult = (globalThis as Record<string, unknown>).__clioLastSyncResult as string | undefined;

  const configured = !!(process.env.CLIO_CLIENT_ID && process.env.CLIO_CLIENT_SECRET);

  return NextResponse.json({
    configured,
    connected,
    connectedAt: connectedAt ?? null,
    lastSync: lastSync ?? null,
    lastSyncResult: lastSyncResult ?? null,
  });
}
