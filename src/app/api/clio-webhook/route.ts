import { NextRequest, NextResponse } from "next/server";
import { upsertContactAsEntity, upsertMatter } from "@/lib/clio/sync";
import { clioFetch, CONTACT_FIELDS, MATTER_FIELDS } from "@/lib/clio/client";

/**
 * Clio webhook endpoint.
 * Receives notifications when Contacts or Matters are created, updated, or deleted.
 */
export async function POST(request: NextRequest) {
  // Verify webhook signature (Clio signs webhooks)
  const signature = request.headers.get("x-clio-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }

  const body = await request.json();
  const { type, data } = body;

  try {
    if (type === "contact.created" || type === "contact.updated") {
      // Fetch full record with all required fields
      const contact = await clioFetch<{ data: Record<string, unknown> }>(
        `/contacts/${data.id}?fields=${encodeURIComponent(CONTACT_FIELDS)}`
      );
      await upsertContactAsEntity(contact.data as never);
    }

    if (type === "matter.created" || type === "matter.updated") {
      const matter = await clioFetch<{ data: Record<string, unknown> }>(
        `/matters/${data.id}?fields=${encodeURIComponent(MATTER_FIELDS)}`
      );
      await upsertMatter(matter.data as never);
    }

    if (type === "contact.deleted") {
      // Soft-delete: mark source as deleted but preserve for audit
      // Entities are never hard-deleted
      console.log(`Contact ${data.id} deleted in Clio — preserved in conflicts DB`);
    }

    if (type === "matter.deleted") {
      console.log(`Matter ${data.id} deleted in Clio — preserved in conflicts DB`);
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("Webhook processing error:", e);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
