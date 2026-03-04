"use client";

import { useState, useEffect } from "react";
import type { FuzzyWeights } from "@/types";

export default function AdminPage() {
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

  useEffect(() => {
    fetchConfig();
  }, []);

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

  const weightSum =
    weights.levenshtein + weights.trigram + weights.soundex +
    weights.metaphone + weights.fullText;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Settings</h1>

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
