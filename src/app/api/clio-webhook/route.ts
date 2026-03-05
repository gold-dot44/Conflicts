import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { upsertContactAsEntity, upsertMatter, syncMatterRelationships } from "@/lib/clio/sync";
import { clioFetch, CONTACT_FIELDS, MATTER_FIELDS } from "@/lib/clio/client";

/**
 * Verify the Clio webhook HMAC-SHA256 signature against the raw payload.
 */
function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  if (expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/**
 * Clio webhook endpoint.
 * Receives notifications when Contacts or Matters are created, updated, or deleted.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get("x-clio-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }

  // Read raw body for HMAC verification before parsing
  const rawBody = await request.text();

  const secret = process.env.CLIO_WEBHOOK_SECRET;
  if (!secret) {
    console.error("CLIO_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  if (!verifySignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody);
  const { type, data } = body;

  try {
    if (type === "contact.created" || type === "contact.updated") {
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
      // Also sync relationships (adverse parties, witnesses, etc.)
      await syncMatterRelationships(data.id);
    }

    if (type === "contact.deleted") {
      // Soft-delete: mark source as deleted but preserve for audit
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
