"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { FuzzyWeights } from "@/types";

interface ClioStatus {
  configured: boolean;
  connected: boolean;
  connectedAt: string | null;
  lastSync: string | null;
  lastSyncResult: string | null;
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
  const [weights, setWeights] = useState<FuzzyWeights>({
    levenshtein: 0.3,
    trigram: 0.3,
    soundex: 0.1,
    metaphone: 0.15,
    fullText: 0.15,
  });
  const [suppressions, setSuppressions] = useState<string[]>([]);
  const [newSuppression, setNewSuppression] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [clioStatus, setClioStatus] = useState<ClioStatus | null>(null);
  const [clioSyncing, setClioSyncing] = useState(false);
  const [clioMessage, setClioMessage] = useState("");

  useEffect(() => {
    fetchConfig();
    fetchClioStatus();

    // Handle OAuth redirect params
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
        if (data.weights) setWeights(data.weights);
        if (data.commonNameSuppressions) setSuppressions(data.commonNameSuppressions);
      }
    } catch {
      // Use defaults
    }
  }

  async function handleSave() {
    const sum =
      weights.levenshtein + weights.trigram + weights.soundex +
      weights.metaphone + weights.fullText;

    if (Math.abs(sum - 1.0) > 0.01) {
      setMessage(`Weights must sum to 1.0 (currently ${sum.toFixed(2)})`);
      return;
    }

    setSaving(true);
    const res = await fetch("/api/admin/weights", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weights, commonNameSuppressions: suppressions }),
    });

    if (res.ok) {
      setMessage("Settings saved successfully.");
    } else {
      const data = await res.json();
      setMessage(data.error ?? "Failed to save.");
    }
    setSaving(false);
  }

  async function fetchClioStatus() {
    try {
      const res = await fetch("/api/clio/status");
      if (res.ok) setClioStatus(await res.json());
    } catch {
      // ignore
    }
  }

  function connectClio() {
    const clientId = process.env.NEXT_PUBLIC_CLIO_CLIENT_ID;
    // Construct OAuth authorization URL
    const redirectUri = encodeURIComponent(window.location.origin + "/api/clio/callback");
    const url = `https://app.clio.com/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}`;
    window.location.href = url;
  }

  async function syncClio() {
    setClioSyncing(true);
    setClioMessage("");
    try {
      const res = await fetch("/api/clio/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setClioMessage(`Sync complete: ${data.contacts} contacts, ${data.matters} matters`);
      } else {
        setClioMessage(`Sync failed: ${data.error}`);
      }
      fetchClioStatus();
    } catch {
      setClioMessage("Sync failed: network error");
    } finally {
      setClioSyncing(false);
    }
  }

  const weightSum =
    weights.levenshtein + weights.trigram + weights.soundex +
    weights.metaphone + weights.fullText;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Settings</h1>

      {/* Clio Integration */}
      <section className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Clio Integration
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Connect to Clio to automatically sync contacts and matters into the conflict checking system.
        </p>

        {clioStatus && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${clioStatus.connected ? "bg-green-500" : clioStatus.configured ? "bg-yellow-500" : "bg-gray-400"}`} />
              <span className="text-sm font-medium text-gray-700">
                {clioStatus.connected
                  ? "Connected"
                  : clioStatus.configured
                  ? "Configured but not connected"
                  : "Not configured"}
              </span>
            </div>

            {clioStatus.connectedAt && (
              <p className="text-xs text-gray-500">
                Connected: {new Date(clioStatus.connectedAt).toLocaleString()}
              </p>
            )}
            {clioStatus.lastSync && (
              <p className="text-xs text-gray-500">
                Last sync: {new Date(clioStatus.lastSync).toLocaleString()}
                {clioStatus.lastSyncResult && ` — ${clioStatus.lastSyncResult}`}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              {!clioStatus.connected && clioStatus.configured && (
                <button
                  onClick={connectClio}
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                >
                  Connect to Clio
                </button>
              )}
              {clioStatus.connected && (
                <button
                  onClick={syncClio}
                  disabled={clioSyncing}
                  className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                >
                  {clioSyncing ? "Syncing..." : "Sync Now"}
                </button>
              )}
              {!clioStatus.configured && (
                <p className="text-xs text-gray-500">
                  Set CLIO_CLIENT_ID and CLIO_CLIENT_SECRET environment variables to enable.
                </p>
              )}
            </div>
          </div>
        )}

        {clioMessage && (
          <p className={`mt-3 text-sm ${clioMessage.includes("fail") || clioMessage.includes("error") ? "text-red-600" : "text-green-600"}`}>
            {clioMessage}
          </p>
        )}
      </section>

      <section className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Fuzzy Matching Weights
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Adjust the relative importance of each matching algorithm.
          Weights must sum to 1.0.
        </p>

        <div className="space-y-4">
          {(Object.keys(weights) as Array<keyof FuzzyWeights>).map((key) => (
            <div key={key} className="flex items-center gap-4">
              <label className="w-32 text-sm font-medium text-gray-700 capitalize">
                {key}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={weights[key]}
                onChange={(e) =>
                  setWeights({ ...weights, [key]: parseFloat(e.target.value) })
                }
                className="flex-1"
              />
              <span className="w-16 text-sm text-gray-600 text-right">
                {weights[key].toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        <p
          className={`mt-3 text-sm ${
            Math.abs(weightSum - 1.0) > 0.01
              ? "text-red-600"
              : "text-green-600"
          }`}
        >
          Total: {weightSum.toFixed(2)}
          {Math.abs(weightSum - 1.0) > 0.01 && " (must equal 1.0)"}
        </p>
      </section>

      <section className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Common Name Suppressions
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Reduce phonetic matching weight for common surnames to prevent alert fatigue.
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
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm"
            >
              {name}
              <button
                onClick={() =>
                  setSuppressions(suppressions.filter((_, j) => j !== i))
                }
                className="text-gray-400 hover:text-gray-600"
              >
                x
              </button>
            </span>
          ))}
        </div>
      </section>

      {message && (
        <p
          className={`mb-4 text-sm ${
            message.includes("success") ? "text-green-600" : "text-red-600"
          }`}
        >
          {message}
        </p>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-6 py-2 bg-primary-600 text-white rounded text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Settings"}
      </button>
    </div>
  );
}
