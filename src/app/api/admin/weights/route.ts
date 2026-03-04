import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, hasPermission } from "@/lib/auth";
import { query } from "@/lib/db";
import type { FuzzyWeights } from "@/types";

const DEMO_MODE = process.env.DEMO_MODE === "true";

/**
 * Admin endpoint for managing fuzzy matching weights.
 */
export async function GET() {
  if (DEMO_MODE) {
    return NextResponse.json({
      weights: { levenshtein: 0.3, trigram: 0.3, soundex: 0.1, metaphone: 0.15, fullText: 0.15 },
      commonNameSuppressions: ["Smith", "Johnson", "Williams", "Jones"],
    });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { upn: string; role: string };
  if (!hasPermission(user.role as "analyst" | "reviewer" | "admin" | "readonly", "configure_thresholds")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [config] = await query<{ weights: FuzzyWeights; common_name_suppressions: string[] }>(
    `SELECT config_value as weights FROM app_config WHERE config_key = 'fuzzy_weights'
     UNION ALL
     SELECT config_value FROM app_config WHERE config_key = 'common_name_suppressions'`
  );

  return NextResponse.json(config ?? {
    weights: { levenshtein: 0.3, trigram: 0.3, soundex: 0.1, metaphone: 0.15, fullText: 0.15 },
    commonNameSuppressions: [],
  });
}

export async function PUT(request: NextRequest) {
  if (DEMO_MODE) {
    const body = await request.json();
    if (body.weights) {
      const w: FuzzyWeights = body.weights;
      const sum = w.levenshtein + w.trigram + w.soundex + w.metaphone + w.fullText;
      if (Math.abs(sum - 1.0) > 0.01) {
        return NextResponse.json({ error: "Weights must sum to 1.0" }, { status: 400 });
      }
    }
    return NextResponse.json({ success: true });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { upn: string; role: string };
  if (!hasPermission(user.role as "analyst" | "reviewer" | "admin" | "readonly", "configure_thresholds")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();

  if (body.weights) {
    const w: FuzzyWeights = body.weights;
    const sum = w.levenshtein + w.trigram + w.soundex + w.metaphone + w.fullText;
    if (Math.abs(sum - 1.0) > 0.01) {
      return NextResponse.json(
        { error: "Weights must sum to 1.0" },
        { status: 400 }
      );
    }

    await query(
      `INSERT INTO app_config (config_key, config_value, updated_by)
       VALUES ('fuzzy_weights', $1, $2)
       ON CONFLICT (config_key) DO UPDATE SET config_value = $1, updated_by = $2, updated_at = NOW()`,
      [JSON.stringify(w), user.upn]
    );
  }

  if (body.commonNameSuppressions) {
    await query(
      `INSERT INTO app_config (config_key, config_value, updated_by)
       VALUES ('common_name_suppressions', $1, $2)
       ON CONFLICT (config_key) DO UPDATE SET config_value = $1, updated_by = $2, updated_at = NOW()`,
      [JSON.stringify(body.commonNameSuppressions), user.upn]
    );
  }

  return NextResponse.json({ success: true });
}
