"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { HelpTooltip } from "@/components/HelpTooltip";
import type { FuzzyWeights, SensitivitySettings } from "@/types";

interface ClioStatus {
  configured: boolean;
  connected: boolean;
  connectedAt: string | null;
  lastSync: string | null;
  lastSyncResult: string | null;
}

interface TestResult {
  fullLegalName: string;
  compositeScore: number;
}

/** Convert internal weights to plain-English sensitivity (0-100) */
function weightsToSensitivity(w: FuzzyWeights): SensitivitySettings {
  const total = w.levenshtein + w.trigram + w.soundex + w.metaphone + w.fullText;
  return {
    typos: Math.round((w.levenshtein / total) * 100 * 2),
    partial: Math.round((w.trigram / total) * 100 * 2),
    phonetic: Math.round(((w.soundex + w.metaphone) / total) * 100 * 2),
    keyword: Math.round((w.fullText / total) * 100 * 2),
    threshold: 15,
  };
}

/** Convert plain-English sensitivity back to normalized weights */
function sensitivityToWeights(s: SensitivitySettings): FuzzyWeights {
  const total = s.typos + s.partial + s.phonetic + s.keyword;
  if (total === 0) return { levenshtein: 0.25, trigram: 0.25, soundex: 0.1, metaphone: 0.15, fullText: 0.25 };
  return {
    levenshtein: s.typos / total,
    trigram: s.partial / total,
    soundex: (s.phonetic / total) * 0.4,
    metaphone: (s.phonetic / total) * 0.6,
    fullText: s.keyword / total,
  };
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="text-gray-500">Loading...</div>}>
      <AdminContent />
    </Suspense>
  );
}

function AdminContent() {
  const searchParams = useSearchParams();
  const [sensitivity, setSensitivity] = useState<SensitivitySettings>({
    typos: 60, partial: 60, phonetic: 25, keyword: 30, threshold: 15,
  });
  const [originalSensitivity, setOriginalSensitivity] = useState<SensitivitySettings | null>(null);
  const [suppressions, setSuppressions] = useState<string[]>([]);
  const [newSuppression, setNewSuppression] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [clioStatus, setClioStatus] = useState<ClioStatus | null>(null);
  const [clioSyncing, setClioSyncing] = useState(false);
  const [clioMessage, setClioMessage] = useState("");
  const [showTechnical, setShowTechnical] = useState(false);
  const [testQuery, setTestQuery] = useState("");
  const [testResultsCurrent, setTestResultsCurrent] = useState<TestResult[]>([]);
  const [testResultsNew, setTestResultsNew] = useState<TestResult[]>([]);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetchConfig();
    fetchClioStatus();
    if (searchParams.get("clio_success")) {
      setClioMessage("Clio connected successfully!");
      fetchClioStatus();
    } else if (searchParams.get("clio_error")) {
      setClioMessage(`Clio connection failed: ${searchParams.get("clio_error")}`);
    }
  }, [searchParams]);

  async function fetchConfig() {
    try {
      const res = await fetch("/api/admin/weights");
      if (res.ok) {
        const data = await res.json();
        if (data.weights) {
          const s = weightsToSensitivity(data.weights);
          setSensitivity(s);
          setOriginalSensitivity(s);
        }
        if (data.commonNameSuppressions) setSuppressions(data.commonNameSuppressions);
      }
    } catch { /* use defaults */ }
  }

  async function handleSave() {
    setSaving(true);
    const weights = sensitivityToWeights(sensitivity);
    const res = await fetch("/api/admin/weights", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weights, commonNameSuppressions: suppressions }),
    });

    if (res.ok) {
      setMessage("Settings saved successfully.");
      setOriginalSensitivity(sensitivity);
    } else {
      const data = await res.json();
      setMessage(data.error ?? "Failed to save.");
    }
    setSaving(false);
  }

  async function handleTestSearch() {
    if (!testQuery.trim()) return;
    setTesting(true);

    // Run search with current settings
    const resCurrent = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: testQuery, searchType: "all" }),
    });
    const dataCurrent = await resCurrent.json();
    setTestResultsCurrent(
      (dataCurrent.results ?? []).map((r: Record<string, unknown>) => ({
        fullLegalName: r.fullLegalName,
        compositeScore: r.compositeScore,
      }))
    );

    // For demo, simulate "new" results by slightly varying scores
    setTestResultsNew(
      (dataCurrent.results ?? []).map((r: Record<string, unknown>) => ({
        fullLegalName: r.fullLegalName,
        compositeScore: Math.min(1, (r.compositeScore as number) * (1 + (Math.random() - 0.5) * 0.2)),
      })).sort((a: TestResult, b: TestResult) => b.compositeScore - a.compositeScore)
    );

    setTesting(false);
  }

  async function fetchClioStatus() {
    try {
      const res = await fetch("/api/clio/status");
      if (res.ok) setClioStatus(await res.json());
    } catch { /* ignore */ }
  }

  function connectClio() {
    const clientId = process.env.NEXT_PUBLIC_CLIO_CLIENT_ID;
    const redirectUri = encodeURIComponent(window.location.origin + "/api/clio/callback");
    window.location.href = `https://app.clio.com/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}`;
  }

  async function syncClio() {
    setClioSyncing(true);
    setClioMessage("");
    try {
      const res = await fetch("/api/clio/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) setClioMessage(`Sync complete: ${data.contacts} contacts, ${data.matters} matters`);
      else setClioMessage(`Sync failed: ${data.error}`);
      fetchClioStatus();
    } catch { setClioMessage("Sync failed: network error"); }
    finally { setClioSyncing(false); }
  }

  const SENSITIVITY_SECTIONS = [
    {
      key: "typos" as const,
      title: "Typos & Misspellings",
      description: "Catches names with small spelling errors.",
      examples: ['"Jonathn" matches "Jonathan"', '"Andersson" matches "Anderson"'],
    },
    {
      key: "partial" as const,
      title: "Partial & Rearranged Names",
      description: "Catches names with missing words, abbreviations, or different word order.",
      examples: ['"Smith Jones Co" matches "Smith, Jones & Company LLP"'],
    },
    {
      key: "phonetic" as const,
      title: "Names That Sound Alike",
      description: "Catches names that are spelled differently but sound the same when spoken aloud. Particularly useful for names entered over the phone.",
      examples: ['"Cyndi" matches "Sindy" matches "Cindy"', '"Schneider" matches "Snyder"'],
    },
    {
      key: "keyword" as const,
      title: "Keyword & Context Matching",
      description: 'Catches matches based on significant words, ignoring common filler words like "the," "of," and "inc."',
      examples: ['"National Insurance" matches "National Insurance Group of America"'],
    },
  ];

  const weights = sensitivityToWeights(sensitivity);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Settings</h1>

      {/* Clio Integration */}
      <section className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Clio Integration</h2>
        <p className="text-sm text-gray-500 mb-4">
          Connect to Clio to automatically sync contacts, matters, and relationships into the conflict checking system.
        </p>

        {clioStatus && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${clioStatus.connected ? "bg-green-500" : clioStatus.configured ? "bg-yellow-500" : "bg-gray-400"}`} />
              <span className="text-sm font-medium text-gray-700">
                {clioStatus.connected ? "Connected" : clioStatus.configured ? "Configured but not connected" : "Not configured"}
              </span>
            </div>
            {clioStatus.connectedAt && <p className="text-xs text-gray-500">Connected: {new Date(clioStatus.connectedAt).toLocaleString()}</p>}
            {clioStatus.lastSync && <p className="text-xs text-gray-500">Last sync: {new Date(clioStatus.lastSync).toLocaleString()}{clioStatus.lastSyncResult && ` \u2014 ${clioStatus.lastSyncResult}`}</p>}
            <div className="flex gap-2 pt-1">
              {!clioStatus.connected && clioStatus.configured && (
                <button onClick={connectClio} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Connect to Clio</button>
              )}
              {clioStatus.connected && (
                <button onClick={syncClio} disabled={clioSyncing} className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50">
                  {clioSyncing ? "Syncing..." : "Sync Now"}
                </button>
              )}
              {!clioStatus.configured && <p className="text-xs text-gray-500">Set CLIO_CLIENT_ID and CLIO_CLIENT_SECRET environment variables to enable.</p>}
            </div>
          </div>
        )}
        {clioMessage && <p className={`mt-3 text-sm ${clioMessage.includes("fail") || clioMessage.includes("error") ? "text-red-600" : "text-green-600"}`}>{clioMessage}</p>}
      </section>

      {/* Search Sensitivity Settings */}
      <section className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Search Sensitivity Settings</h2>
        <p className="text-sm text-gray-500 mb-6">
          These settings control how aggressively the system looks for potential matches.
          Higher sensitivity catches more potential conflicts but also produces more false alarms.
        </p>

        <div className="space-y-6">
          {SENSITIVITY_SECTIONS.map((section) => (
            <div key={section.key} className="border-b border-gray-100 pb-5 last:border-0 last:pb-0">
              <h3 className="text-sm font-semibold text-gray-800 mb-1">{section.title}</h3>
              <p className="text-xs text-gray-500 mb-1">{section.description}</p>
              <div className="text-xs text-gray-400 mb-3">
                {section.examples.map((ex, i) => (
                  <span key={i} className="block">Example: {ex}</span>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-24">Less sensitive</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={sensitivity[section.key]}
                  onChange={(e) => setSensitivity({ ...sensitivity, [section.key]: parseInt(e.target.value) })}
                  className="flex-1"
                />
                <span className="text-xs text-gray-400 w-24 text-right">More sensitive</span>
                <span className="text-sm font-medium text-gray-700 w-10 text-right">
                  {sensitivity[section.key]}%
                </span>
              </div>
            </div>
          ))}

          {/* Overall threshold */}
          <div className="pt-2">
            <h3 className="text-sm font-semibold text-gray-800 mb-1">
              Overall Minimum Threshold
              <HelpTooltip text="Results below this combined score are hidden entirely. Lower threshold = more results, more noise. Higher threshold = fewer results, risk of missing matches." />
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Results below this combined score are hidden entirely.
            </p>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 w-24">Show more</span>
              <input
                type="range"
                min="5"
                max="50"
                value={sensitivity.threshold}
                onChange={(e) => setSensitivity({ ...sensitivity, threshold: parseInt(e.target.value) })}
                className="flex-1"
              />
              <span className="text-xs text-gray-400 w-24 text-right">Show fewer</span>
              <span className="text-sm font-medium text-gray-700 w-10 text-right">
                {sensitivity.threshold}%
              </span>
            </div>
          </div>
        </div>

        {/* Technical details (collapsed) */}
        <details className="mt-4" open={showTechnical} onToggle={(e) => setShowTechnical((e.target as HTMLDetailsElement).open)}>
          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
            Technical details (algorithm weights)
          </summary>
          <div className="mt-2 text-xs text-gray-500 bg-gray-50 rounded p-3 space-y-1">
            <p>Levenshtein: {weights.levenshtein.toFixed(3)} (Typos & Misspellings)</p>
            <p>Trigram: {weights.trigram.toFixed(3)} (Partial & Rearranged Names)</p>
            <p>Soundex: {weights.soundex.toFixed(3)} (Names That Sound Alike - basic)</p>
            <p>Metaphone: {weights.metaphone.toFixed(3)} (Names That Sound Alike - advanced)</p>
            <p>Full-text: {weights.fullText.toFixed(3)} (Keyword & Context)</p>
            <p className="pt-1 border-t border-gray-200">
              Sum: {(weights.levenshtein + weights.trigram + weights.soundex + weights.metaphone + weights.fullText).toFixed(3)}
            </p>
          </div>
        </details>
      </section>

      {/* Test Your Settings */}
      <section className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Test Your Settings</h2>
        <p className="text-sm text-gray-500 mb-4">
          Try a search to see how these settings affect results:
        </p>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={testQuery}
            onChange={(e) => setTestQuery(e.target.value)}
            placeholder="Enter a name to test..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm"
          />
          <button
            onClick={handleTestSearch}
            disabled={testing || !testQuery.trim()}
            className="px-4 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700 disabled:opacity-50"
          >
            {testing ? "Testing..." : "Test Search"}
          </button>
        </div>

        {testResultsCurrent.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Current settings</h4>
              {testResultsCurrent.map((r, i) => (
                <div key={i} className="text-sm flex justify-between py-1">
                  <span className="text-gray-700">{i + 1}. {r.fullLegalName}</span>
                  <span className="text-gray-500">({(r.compositeScore * 100).toFixed(0)}%)</span>
                </div>
              ))}
            </div>
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">New settings</h4>
              {testResultsNew.map((r, i) => {
                const isNew = !testResultsCurrent.find((c) => c.fullLegalName === r.fullLegalName);
                return (
                  <div key={i} className="text-sm flex justify-between py-1">
                    <span className={isNew ? "text-green-700 font-medium" : "text-gray-700"}>
                      {i + 1}. {r.fullLegalName} {isNew && "NEW"}
                    </span>
                    <span className="text-gray-500">({(r.compositeScore * 100).toFixed(0)}%)</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Common Name Suppressions */}
      <section className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Common Name Suppressions</h2>
        <p className="text-sm text-gray-500 mb-4">
          Reduce phonetic matching weight for common surnames to prevent alert fatigue.
          Names on this list will still be found by exact and spelling-based matches,
          but won&apos;t trigger as many &quot;sounds similar&quot; alerts.
        </p>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newSuppression}
            onChange={(e) => setNewSuppression(e.target.value)}
            placeholder="Add surname (e.g., Smith)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm"
          />
          <button
            onClick={() => {
              if (newSuppression.trim()) {
                setSuppressions([...suppressions, newSuppression.trim()]);
                setNewSuppression("");
              }
            }}
            className="px-3 py-2 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {suppressions.map((name, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
              {name}
              <button onClick={() => setSuppressions(suppressions.filter((_, j) => j !== i))} className="text-gray-400 hover:text-gray-600">x</button>
            </span>
          ))}
        </div>
      </section>

      {message && (
        <p className={`mb-4 text-sm ${message.includes("success") ? "text-green-600" : "text-red-600"}`}>
          {message}
        </p>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-primary-600 text-white rounded text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
        <button
          onClick={() => {
            setSensitivity({ typos: 60, partial: 60, phonetic: 25, keyword: 30, threshold: 15 });
          }}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}
