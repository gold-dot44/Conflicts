"use client";

import { useState } from "react";
import type { SearchResult, ConflictDisposition, SearchRequest } from "@/types";

type SearchType = "all" | "person" | "company";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState<SearchType>("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [auditLogId, setAuditLogId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<SearchRequest["filters"]>({});

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, searchType, filters }),
      });
      const data = await res.json();
      setResults(data.results ?? []);
      setAuditLogId(data.auditLogId);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDisposition(
    entityId: string,
    matterId: string | undefined,
    disposition: ConflictDisposition,
    rationale: string
  ) {
    if (!auditLogId) return;

    await fetch("/api/conflicts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        auditLogId,
        entityId,
        matterId,
        disposition,
        rationale,
      }),
    });
  }

  function confidenceColor(score: number): string {
    if (score >= 0.7) return "bg-red-500";
    if (score >= 0.4) return "bg-yellow-500";
    return "bg-gray-400";
  }

  function confidenceLabel(score: number): string {
    if (score >= 0.7) return "High";
    if (score >= 0.4) return "Moderate";
    return "Low";
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Conflict Search</h1>

      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex gap-3">
          <select
            value={searchType}
            onChange={(e) => setSearchType(e.target.value as SearchType)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
          >
            <option value="all">All</option>
            <option value="person">Person</option>
            <option value="company">Company</option>
          </select>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter name to search..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className="mt-2 text-xs text-gray-500 hover:text-gray-700"
        >
          {showFilters ? "Hide" : "Show"} advanced filters
        </button>

        {showFilters && (
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
            <select
              value={filters?.matterStatus ?? ""}
              onChange={(e) =>
                setFilters({ ...filters, matterStatus: e.target.value as SearchRequest["filters"] extends { matterStatus?: infer T } ? T : never || undefined })
              }
              className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
            >
              <option value="">Any status</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="pending">Pending</option>
            </select>
            <input
              type="text"
              value={filters?.sourceSystem ?? ""}
              onChange={(e) =>
                setFilters({ ...filters, sourceSystem: e.target.value || undefined })
              }
              placeholder="Source system..."
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <input
              type="text"
              value={filters?.practiceArea ?? ""}
              onChange={(e) =>
                setFilters({ ...filters, practiceArea: e.target.value || undefined })
              }
              placeholder="Practice area..."
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
        )}
      </form>

      {results.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            {results.length} result{results.length !== 1 ? "s" : ""} found
          </p>
          {results.map((result) => (
            <ResultCard
              key={result.entityId}
              result={result}
              expanded={expandedId === result.entityId}
              onToggle={() =>
                setExpandedId(
                  expandedId === result.entityId ? null : result.entityId
                )
              }
              onDisposition={handleDisposition}
              confidenceColor={confidenceColor}
              confidenceLabel={confidenceLabel}
            />
          ))}
        </div>
      )}

      {!loading && results.length === 0 && query && (
        <p className="text-gray-500 text-center py-12">No results found.</p>
      )}
    </div>
  );
}

function ResultCard({
  result,
  expanded,
  onToggle,
  onDisposition,
  confidenceColor,
  confidenceLabel,
}: {
  result: SearchResult;
  expanded: boolean;
  onToggle: () => void;
  onDisposition: (
    entityId: string,
    matterId: string | undefined,
    disposition: ConflictDisposition,
    rationale: string
  ) => void;
  confidenceColor: (score: number) => string;
  confidenceLabel: (score: number) => string;
}) {
  const [showDisposition, setShowDisposition] = useState(false);
  const [rationale, setRationale] = useState("");
  const [selectedDisposition, setSelectedDisposition] =
    useState<ConflictDisposition>("no_conflict");

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50"
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${confidenceColor(result.compositeScore)}`}
            />
            <span className="text-xs font-medium text-gray-500">
              {confidenceLabel(result.compositeScore)} (
              {(result.compositeScore * 100).toFixed(0)}%)
            </span>
          </div>
          <span className="font-semibold text-gray-900">
            {result.fullLegalName}
          </span>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
            {result.entityType}
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span>{result.matters.length} matter(s)</span>
          <span>{expanded ? "\u25B2" : "\u25BC"}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-6 pb-4 border-t border-gray-100">
          {result.aliases.length > 0 && (
            <div className="mt-3">
              <span className="text-xs font-medium text-gray-500">Aliases: </span>
              <span className="text-xs text-gray-600">
                {result.aliases.join(", ")}
              </span>
            </div>
          )}

          <div className="mt-3 grid grid-cols-5 gap-2 text-xs">
            <div>
              <span className="text-gray-500">Levenshtein:</span>{" "}
              <span className="font-medium">
                {(result.levenshteinScore * 100).toFixed(0)}%
              </span>
            </div>
            <div>
              <span className="text-gray-500">Trigram:</span>{" "}
              <span className="font-medium">
                {(result.trigramScore * 100).toFixed(0)}%
              </span>
            </div>
            <div>
              <span className="text-gray-500">Soundex:</span>{" "}
              <span className="font-medium">
                {result.soundexMatch ? "Match" : "No"}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Metaphone:</span>{" "}
              <span className="font-medium">
                {result.metaphoneMatch ? "Match" : "No"}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Full-text:</span>{" "}
              <span className="font-medium">
                {(result.fullTextScore * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          {result.matters.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Associated Matters
              </h4>
              <div className="space-y-2">
                {result.matters.map((matter) => (
                  <div
                    key={matter.matterId}
                    className="flex items-center justify-between text-sm bg-gray-50 rounded px-3 py-2"
                  >
                    <div>
                      <span className="font-medium">{matter.matterName}</span>
                      {matter.matterNumber && (
                        <span className="text-gray-400 ml-2">
                          #{matter.matterNumber}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span
                        className={`px-2 py-0.5 rounded ${
                          matter.role === "client"
                            ? "bg-blue-100 text-blue-700"
                            : matter.role === "adverse_party"
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {matter.role.replace("_", " ")}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded ${
                          matter.status === "open"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {matter.status}
                      </span>
                      {matter.responsibleAttorney && (
                        <span className="text-gray-400">
                          {matter.responsibleAttorney}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.corporateFamily.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Corporate Family
              </h4>
              <div className="space-y-1">
                {result.corporateFamily.map((member) => (
                  <div
                    key={member.entityId}
                    className="text-sm text-gray-600 flex items-center gap-2"
                    style={{ paddingLeft: `${member.depth * 16}px` }}
                  >
                    <span className="text-gray-400">
                      {member.direction === "parent" ? "\u2191" : "\u2193"}
                    </span>
                    <span>{member.fullLegalName}</span>
                    <span className="text-xs text-gray-400">
                      ({member.relationshipType})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setShowDisposition(!showDisposition)}
              className="text-sm px-3 py-1.5 bg-primary-600 text-white rounded hover:bg-primary-700"
            >
              Set Disposition
            </button>
          </div>

          {showDisposition && (
            <div className="mt-3 p-3 bg-gray-50 rounded-md space-y-3">
              <select
                value={selectedDisposition}
                onChange={(e) =>
                  setSelectedDisposition(e.target.value as ConflictDisposition)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white"
              >
                <option value="no_conflict">No Conflict</option>
                <option value="potential_conflict">Potential Conflict</option>
                <option value="conflict_confirmed">Conflict Confirmed</option>
                <option value="waiver_obtained">Waiver Obtained</option>
              </select>
              <textarea
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                placeholder="Enter rationale for this disposition..."
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                rows={3}
              />
              <button
                onClick={() => {
                  onDisposition(
                    result.entityId,
                    result.matters[0]?.matterId,
                    selectedDisposition,
                    rationale
                  );
                  setShowDisposition(false);
                  setRationale("");
                }}
                disabled={!rationale.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
              >
                Record Disposition
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
