"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { HelpTooltip } from "@/components/HelpTooltip";
import type { ConflictCheckRequest, ConflictDisposition, EnrichedSearchResult } from "@/types";

const DISPOSITION_HELP: Record<string, string> = {
  no_conflict: "You have reviewed this match and determined it does not present an ethical conflict. The entity is either a different person/company, or the prior representation is unrelated to the prospective matter.",
  potential_conflict: "You believe this match may be a conflict but you are not authorized to make the final determination, or you need more information. This will escalate the check to the conflicts chair for review.",
  conflict_confirmed: "A conflict of interest exists under ABA Model Rules 1.7 (current client) or 1.9 (former client). The prospective matter cannot proceed without a waiver or ethical wall.",
  waiver_obtained: "A conflict exists, but all affected parties have provided informed written consent to the concurrent representation. Upload the signed waiver document.",
};

const MATCH_HELP: Record<string, string> = {
  exact_name: "The search term and the entity name are identical or nearly identical.",
  similar_spelling: "The names differ by only a few characters. This catches typos, transpositions, and minor data entry errors.",
  sounds_similar: "The names are spelled differently but are pronounced similarly. This catches phonetic variations, especially common with names heard over the phone.",
  partial_match: "The names share significant portions of text but differ in abbreviations, word order, or missing elements.",
  corporate_family: "This entity was not found by searching its name directly, but it is a parent company, subsidiary, or affiliate of an entity that was found.",
  alias_match: "The entity was matched via a known alias or alternate name.",
};

type ExtendedSubject = ConflictCheckRequest["subjects"][0] & {
  results: EnrichedSearchResult[];
};

export default function ConflictCheckResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [request, setRequest] = useState<(ConflictCheckRequest & { subjects: ExtendedSubject[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [dispositionState, setDispositionState] = useState<Record<string, {
    show: boolean; disposition: ConflictDisposition; rationale: string;
  }>>({});

  useEffect(() => {
    fetch(`/api/conflict-checks/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setRequest(data);
        // Auto-expand subjects with attention items
        const expanded = new Set<string>();
        (data.subjects ?? []).forEach((s: ExtendedSubject) => {
          if (s.crossReferences?.length > 0 || s.results?.some((r: EnrichedSearchResult) => r.compositeScore >= 0.5)) {
            expanded.add(s.id);
          }
        });
        setExpandedSubjects(expanded);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  async function handleDisposition(subjectId: string) {
    const state = dispositionState[subjectId];
    if (!state) return;

    // Require rationale for high-confidence dispositions (except no_conflict on low-risk)
    if (state.disposition !== "no_conflict" && !state.rationale.trim()) return;

    await fetch(`/api/conflict-checks/${id}/disposition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subjectId,
        disposition: state.disposition,
        rationale: state.rationale,
      }),
    });

    // Refresh
    const res = await fetch(`/api/conflict-checks/${id}`);
    setRequest(await res.json());
    setDispositionState((prev) => ({ ...prev, [subjectId]: { ...prev[subjectId], show: false } }));
  }

  async function handleBatchClear() {
    await fetch(`/api/conflict-checks/${id}/batch-clear`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threshold: 0.25 }),
    });
    const res = await fetch(`/api/conflict-checks/${id}`);
    setRequest(await res.json());
  }

  async function handleEscalate() {
    await fetch(`/api/conflict-checks/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "pending_review", reviewNotes: "" }),
    });
    const res = await fetch(`/api/conflict-checks/${id}`);
    setRequest(await res.json());
  }

  function confidenceColor(score: number): string {
    if (score >= 0.7) return "bg-red-500";
    if (score >= 0.4) return "bg-yellow-500";
    return "bg-gray-300";
  }

  function confidenceBarColor(score: number): string {
    if (score >= 0.7) return "bg-red-400";
    if (score >= 0.4) return "bg-yellow-400";
    return "bg-gray-300";
  }

  if (loading) return <div className="text-gray-500">Loading...</div>;
  if (!request) return <div className="text-red-600">Request not found.</div>;

  const totalSubjects = request.subjects.length;
  const completedSubjects = request.subjects.filter((s) => s.searchCompleted).length;
  const disposedSubjects = request.subjects.filter((s) => s.disposition).length;
  const attentionSubjects = request.subjects.filter(
    (s) => s.crossReferences?.length > 0 || s.results?.some((r) => r.compositeScore >= 0.5)
  ).length;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/" className="hover:text-gray-700">Home</Link>
          <span>/</span>
          <span>Conflict Check</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900">
          {request.prospectiveMatter}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {request.requestNumber} &middot; Requested by {request.requestingAttorney} &middot;{" "}
          {totalSubjects} subjects &middot;{" "}
          {new Date(request.requestedAt).toLocaleDateString()}
        </p>
        <div className="mt-2">
          <span className={`text-xs px-2 py-1 rounded font-medium ${
            request.status === "cleared" ? "bg-green-100 text-green-700" :
            request.status === "blocked" ? "bg-red-100 text-red-700" :
            request.status === "pending_review" ? "bg-yellow-100 text-yellow-700" :
            request.status === "cleared_with_wall" ? "bg-blue-100 text-blue-700" :
            "bg-gray-100 text-gray-600"
          }`}>
            {request.status.replace(/_/g, " ").toUpperCase()}
          </span>
        </div>
      </div>

      {/* Subjects grouped */}
      <div className="space-y-6">
        {request.subjects.map((subject, idx) => {
          const hasAttention = subject.crossReferences?.length > 0 || subject.results?.some((r) => r.compositeScore >= 0.5);
          const isExpanded = expandedSubjects.has(subject.id);
          const dispState = dispositionState[subject.id];

          return (
            <div key={subject.id} className="bg-white rounded-lg shadow-sm border overflow-hidden">
              {/* Subject header */}
              <button
                onClick={() => {
                  const next = new Set(expandedSubjects);
                  if (isExpanded) next.delete(subject.id); else next.add(subject.id);
                  setExpandedSubjects(next);
                }}
                className="w-full px-5 py-3 flex items-center justify-between text-left bg-gray-50 hover:bg-gray-100 border-b"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-gray-400">{idx + 1}.</span>
                  <span className="font-semibold text-gray-900">{subject.subjectName}</span>
                  <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                    {subject.subjectRole.replace(/_/g, " ")}
                  </span>
                  {hasAttention && !subject.disposition && (
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded font-medium">
                      Attention required
                    </span>
                  )}
                  {subject.disposition && (
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      subject.disposition === "no_conflict" ? "bg-green-100 text-green-700" :
                      subject.disposition === "potential_conflict" ? "bg-yellow-100 text-yellow-700" :
                      subject.disposition === "conflict_confirmed" ? "bg-red-100 text-red-700" :
                      "bg-blue-100 text-blue-700"
                    }`}>
                      {subject.disposition.replace(/_/g, " ")}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span>{subject.results?.length ?? 0} result{(subject.results?.length ?? 0) !== 1 ? "s" : ""}</span>
                  <span>{isExpanded ? "\u25B2" : "\u25BC"}</span>
                </div>
              </button>

              {/* Expanded results */}
              {isExpanded && (
                <div className="p-5 space-y-3">
                  {/* Cross-reference warnings */}
                  {subject.crossReferences?.map((xref, i) => (
                    <div key={i} className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-sm font-medium text-red-800">
                        This entity is adverse to {xref.subjectName}, who is the {xref.subjectRole.replace(/_/g, " ")} in this same check.
                      </p>
                      <p className="text-xs text-red-600 mt-1">
                        Matter: {xref.matterName} &mdash; {xref.conflictType}
                      </p>
                    </div>
                  ))}

                  {subject.results?.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">No matches found.</p>
                  )}

                  {subject.results?.map((result) => (
                    <div key={result.entityId} className={`border rounded-lg p-4 ${
                      result.compositeScore >= 0.7 ? "border-red-200" :
                      result.compositeScore >= 0.4 ? "border-yellow-200" :
                      "border-gray-200"
                    }`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-2.5 h-2.5 rounded-full ${confidenceColor(result.compositeScore)}`} />
                            <span className="text-sm font-medium text-gray-500">
                              {(result.compositeScore * 100).toFixed(0)}% match
                              <HelpTooltip text={
                                result.compositeScore >= 0.7
                                  ? "High confidence match. The system found strong similarities across multiple matching methods. Carefully review this result."
                                  : result.compositeScore >= 0.4
                                  ? "Moderate confidence match. Some matching signals were found. May be the same entity with name variations, or may be a different entity with a similar name."
                                  : "Low confidence match. Weak similarities detected. Likely a different entity, but included for completeness."
                              } />
                            </span>
                          </div>
                          <span className="font-semibold text-gray-900">{result.fullLegalName}</span>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            {result.entityType}
                          </span>
                        </div>
                      </div>

                      {/* Plain English match description */}
                      <p className="text-sm text-gray-600 mt-2">
                        {(result as EnrichedSearchResult).matchDescription ?? "Matched on: similarity"}
                        {(result as EnrichedSearchResult).matchReasons?.map((reason) => (
                          <HelpTooltip key={reason} text={MATCH_HELP[reason] ?? ""} />
                        ))}
                      </p>

                      {/* Confidence bar */}
                      <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${confidenceBarColor(result.compositeScore)}`}
                          style={{ width: `${result.compositeScore * 100}%` }}
                        />
                      </div>

                      {/* Matter roles — visible without expanding */}
                      {result.matters.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {result.matters.map((matter) => (
                            <div key={matter.matterId} className="text-sm flex items-center gap-2">
                              <span className={`px-1.5 py-0.5 rounded text-xs ${
                                matter.role === "client" ? "bg-blue-100 text-blue-700" :
                                matter.role === "adverse_party" ? "bg-red-100 text-red-700" :
                                "bg-gray-100 text-gray-600"
                              }`}>
                                {matter.role.replace(/_/g, " ")}
                              </span>
                              <span className="text-gray-700">{matter.matterName}</span>
                              <span className={`text-xs ${matter.status === "open" ? "text-green-600" : "text-gray-400"}`}>
                                ({matter.status})
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Corporate family */}
                      {result.corporateFamily.length > 0 && (
                        <div className="mt-2 text-sm text-gray-500">
                          {result.corporateFamily.map((member) => (
                            <div key={member.entityId} className="flex items-center gap-1" style={{ paddingLeft: `${member.depth * 12}px` }}>
                              <span>{member.direction === "parent" ? "\u2191" : "\u2193"}</span>
                              <span>{member.fullLegalName}</span>
                              <span className="text-xs text-gray-400">({member.relationshipType})</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Technical details toggle */}
                      <details className="mt-2">
                        <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
                          Technical details
                        </summary>
                        <div className="mt-1 grid grid-cols-5 gap-2 text-xs text-gray-500">
                          <div>Levenshtein: {(result.levenshteinScore * 100).toFixed(0)}%</div>
                          <div>Trigram: {(result.trigramScore * 100).toFixed(0)}%</div>
                          <div>Soundex: {result.soundexMatch ? "Match" : "No"}</div>
                          <div>Metaphone: {result.metaphoneMatch ? "Match" : "No"}</div>
                          <div>Full-text: {(result.fullTextScore * 100).toFixed(0)}%</div>
                        </div>
                      </details>
                    </div>
                  ))}

                  {/* Disposition buttons */}
                  {!subject.disposition && (
                    <div className="pt-2">
                      {!dispState?.show ? (
                        <div className="flex gap-2">
                          {["no_conflict", "potential_conflict", "conflict_confirmed", "waiver_obtained"].map((d) => (
                            <button
                              key={d}
                              onClick={() => setDispositionState((prev) => ({
                                ...prev,
                                [subject.id]: { show: true, disposition: d as ConflictDisposition, rationale: "" },
                              }))}
                              className={`text-xs px-3 py-1.5 rounded border font-medium ${
                                d === "no_conflict" ? "border-green-300 text-green-700 hover:bg-green-50" :
                                d === "potential_conflict" ? "border-yellow-300 text-yellow-700 hover:bg-yellow-50" :
                                d === "conflict_confirmed" ? "border-red-300 text-red-700 hover:bg-red-50" :
                                "border-blue-300 text-blue-700 hover:bg-blue-50"
                              }`}
                            >
                              {d.replace(/_/g, " ")}
                              <HelpTooltip text={DISPOSITION_HELP[d]} />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="p-3 bg-gray-50 rounded-md space-y-2">
                          <p className="text-sm font-medium text-gray-700">
                            Recording: {dispState.disposition.replace(/_/g, " ")}
                          </p>
                          {/* Require rationale for high-confidence + non-trivial dispositions */}
                          {(dispState.disposition !== "no_conflict" || (subject.results?.some((r) => r.compositeScore >= 0.5))) && (
                            <textarea
                              value={dispState.rationale}
                              onChange={(e) => setDispositionState((prev) => ({
                                ...prev,
                                [subject.id]: { ...prev[subject.id], rationale: e.target.value },
                              }))}
                              placeholder="Enter rationale..."
                              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                              rows={2}
                            />
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleDisposition(subject.id)}
                              disabled={dispState.disposition !== "no_conflict" && !dispState.rationale.trim()}
                              className="px-3 py-1.5 bg-primary-600 text-white rounded text-sm hover:bg-primary-700 disabled:opacity-50"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setDispositionState((prev) => ({ ...prev, [subject.id]: { ...prev[subject.id], show: false } }))}
                              className="px-3 py-1.5 text-gray-600 border border-gray-300 rounded text-sm hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary bar */}
      <div className="mt-6 bg-white rounded-lg shadow-sm border p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Summary</h3>
        <div className="text-sm text-gray-600 space-y-1">
          <p>Searched: {completedSubjects} of {totalSubjects} subjects</p>
          {attentionSubjects > 0 && (
            <p className="text-yellow-700">
              {attentionSubjects} subject{attentionSubjects !== 1 ? "s" : ""} require{attentionSubjects === 1 ? "s" : ""} attention
            </p>
          )}
          <p>Dispositions recorded: {disposedSubjects} of {totalSubjects} subjects</p>
        </div>
        <div className="mt-4 flex gap-3">
          <button
            onClick={handleBatchClear}
            className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
          >
            Clear All Low-Risk (below 25%)
          </button>
          <button
            onClick={handleEscalate}
            className="px-4 py-2 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600"
          >
            Escalate to Reviewer
          </button>
        </div>
      </div>
    </div>
  );
}
