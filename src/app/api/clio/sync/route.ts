import { NextResponse } from "next/server";

export async function POST() {
  const connected = !!(globalThis as Record<string, unknown>).__clioConnected;

  if (!connected) {
    return NextResponse.json(
      { error: "Clio is not connected. Authorize first via Admin settings." },
      { status: 400 }
    );
  }

  try {
    // Dynamic import to avoid loading DB code when not needed
    const { reconcile } = await import("@/lib/clio/sync");
    const result = await reconcile();

    (globalThis as Record<string, unknown>).__clioLastSync = new Date().toISOString();
    (globalThis as Record<string, unknown>).__clioLastSyncResult =
      `Synced ${result.contacts} contacts, ${result.matters} matters`;

    return NextResponse.json({
      success: true,
      contacts: result.contacts,
      matters: result.matters,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    (globalThis as Record<string, unknown>).__clioLastSync = new Date().toISOString();
    (globalThis as Record<string, unknown>).__clioLastSyncResult = `Error: ${message}`;

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
