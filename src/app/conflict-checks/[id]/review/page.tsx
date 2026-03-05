"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import type { ConflictCheckRequest, CheckRequestStatus } from "@/types";

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [request, setRequest] = useState<ConflictCheckRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [decision, setDecision] = useState<CheckRequestStatus | "">("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [createWall, setCreateWall] = useState(false);
  const [wallAttorney, setWallAttorney] = useState("");
  const [notifyAttorney, setNotifyAttorney] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch(`/api/conflict-checks/${id}`)
      .then((r) => r.json())
      .then((data) => { setRequest(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  async function handleSubmit() {
    if (!decision || !reviewNotes.trim()) return;
    await fetch(`/api/conflict-checks/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, reviewNotes }),
    });
    setSubmitted(true);
    const res = await fetch(`/api/conflict-checks/${id}`);
    setRequest(await res.json());
  }

  if (loading) return <div className="text-gray-500">Loading...</div>;
  if (!request) return <div className="text-red-600">Request not found.</div>;

  // Find the flagged subjects (those with potential_conflict or conflict_confirmed)
  const flaggedSubjects = request.subjects.filter(
    (s) => s.disposition === "potential_conflict" || s.disposition === "conflict_confirmed" || s.crossReferences?.length > 0
  );

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
        <Link href="/" className="hover:text-gray-700">Home</Link>
        <span>/</span>
        <span>Review</span>
      </div>

      <h1 className="text-xl font-bold text-gray-900 mb-1">
        Review: {request.prospectiveMatter}
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        Analyst: {request.assignedAnalystUpn?.split("@")[0]} &middot;
        Requesting Attorney: {request.requestingAttorney} &middot;
        {request.requestNumber}
      </p>

      {submitted && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-green-800 font-medium">
            Decision recorded: {request.status?.replace(/_/g, " ").toUpperCase()}
          </p>
          <Link href="/" className="text-sm text-green-600 hover:underline mt-1 inline-block">
            Return to dashboard
          </Link>
        </div>
      )}

      {/* Analyst's assessment for each flagged subject */}
      <div className="space-y-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Analyst&apos;s Assessment
        </h2>

        {flaggedSubjects.length === 0 && (
          <div className="bg-white rounded-lg border p-4 text-sm text-gray-500">
            No subjects were flagged for review.
          </div>
        )}

        {flaggedSubjects.map((subject) => (
          <div key={subject.id} className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-semibold text-gray-900">{subject.subjectName}</span>
              <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                {subject.subjectRole.replace(/_/g, " ")}
              </span>
            </div>

            {/* Cross-reference warnings */}
            {subject.crossReferences?.map((xref, i) => (
              <div key={i} className="bg-red-50 border border-red-200 rounded p-2 mb-2">
                <p className="text-sm text-red-800">
                  Entity is {xref.conflictType.toLowerCase()} in matter &quot;{xref.matterName}&quot;
                </p>
              </div>
            ))}

            {subject.results?.length > 0 && (
              <p className="text-sm text-gray-600 mb-2">
                Top match: {subject.results[0]?.fullLegalName} &mdash;{" "}
                {((subject.results[0]?.compositeScore ?? 0) * 100).toFixed(0)}% confidence
              </p>
            )}

            <div className="text-sm">
              <span className={`px-2 py-0.5 rounded text-xs ${
                subject.disposition === "potential_conflict" ? "bg-yellow-100 text-yellow-700" :
                subject.disposition === "conflict_confirmed" ? "bg-red-100 text-red-700" :
                subject.disposition === "no_conflict" ? "bg-green-100 text-green-700" :
                "bg-gray-100 text-gray-600"
              }`}>
                Analyst disposition: {subject.disposition?.replace(/_/g, " ") ?? "pending"}
              </span>
            </div>

            {subject.dispositionRationale && (
              <blockquote className="mt-2 text-sm text-gray-600 border-l-2 border-gray-300 pl-3 italic">
                &quot;{subject.dispositionRationale}&quot;
              </blockquote>
            )}
          </div>
        ))}
      </div>

      {/* Reviewer decision */}
      {!submitted && (
        <div className="bg-white rounded-lg border p-5">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
            Your Decision
          </h2>

          <div className="flex gap-2 mb-4">
            {(
              [
                { value: "cleared", label: "No Conflict \u2014 Override", color: "border-green-300 text-green-700 hover:bg-green-50" },
                { value: "blocked", label: "Conflict Confirmed", color: "border-red-300 text-red-700 hover:bg-red-50" },
                { value: "cleared_with_wall", label: "Cleared with Wall", color: "border-blue-300 text-blue-700 hover:bg-blue-50" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDecision(opt.value)}
                className={`px-4 py-2 rounded border text-sm font-medium transition-colors ${opt.color} ${
                  decision === opt.value ? "ring-2 ring-offset-1 ring-primary-500" : ""
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <textarea
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            placeholder="Rationale for your decision..."
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm mb-4"
            rows={3}
          />

          {/* Conditional wall creation */}
          {decision === "cleared_with_wall" && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-3">
              <h3 className="text-sm font-medium text-gray-700">If Confirmed</h3>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={createWall}
                  onChange={(e) => setCreateWall(e.target.checked)}
                  className="rounded"
                />
                Create ethical wall (select attorney to screen below)
              </label>

              {createWall && (
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Attorney:</label>
                  <select
                    value={wallAttorney}
                    onChange={(e) => setWallAttorney(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white"
                  >
                    <option value="">Select attorney...</option>
                    <option value="david.martinez@firm.com">David Martinez</option>
                    <option value="sarah.johnson@firm.com">Sarah Johnson</option>
                    <option value="michael.chen@firm.com">Michael Chen</option>
                  </select>
                </div>
              )}

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={notifyAttorney}
                  onChange={(e) => setNotifyAttorney(e.target.checked)}
                  className="rounded"
                />
                Notify requesting attorney ({request.requestingAttorney}) of outcome
              </label>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!decision || !reviewNotes.trim()}
            className="px-6 py-2 bg-primary-600 text-white rounded text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            Confirm Decision
          </button>
        </div>
      )}
    </div>
  );
}
