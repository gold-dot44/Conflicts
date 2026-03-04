"use client";

import { useState, useEffect } from "react";

interface AuditEntry {
  id: string;
  searched_by: string;
  search_terms: string;
  search_timestamp: string;
  algorithms_applied: Record<string, unknown>;
  results_snapshot: unknown[];
  disposition: string | null;
  disposition_by: string | null;
  disposition_rationale: string | null;
  disposition_timestamp: string | null;
  related_documents: string[];
}

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [filter, setFilter] = useState({ searchedBy: "", matterId: "" });
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const limit = 25;

  useEffect(() => {
    fetchEntries();
  }, [page]);

  async function fetchEntries() {
    setLoading(true);
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(page * limit),
    });
    if (filter.searchedBy) params.set("searchedBy", filter.searchedBy);
    if (filter.matterId) params.set("matterId", filter.matterId);

    const res = await fetch(`/api/audit?${params}`);
    const data = await res.json();
    setEntries(data.trail ?? []);
    setLoading(false);
  }

  function dispositionBadge(disposition: string | null): string {
    switch (disposition) {
      case "no_conflict":
        return "bg-green-100 text-green-700";
      case "potential_conflict":
        return "bg-yellow-100 text-yellow-700";
      case "conflict_confirmed":
        return "bg-red-100 text-red-700";
      case "waiver_obtained":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-gray-100 text-gray-500";
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Audit Trail</h1>

      <div className="flex gap-3 mb-6">
        <input
          type="text"
          value={filter.searchedBy}
          onChange={(e) => setFilter({ ...filter, searchedBy: e.target.value })}
          placeholder="Filter by user..."
          className="px-3 py-2 border border-gray-300 rounded text-sm"
        />
        <input
          type="text"
          value={filter.matterId}
          onChange={(e) => setFilter({ ...filter, matterId: e.target.value })}
          placeholder="Filter by matter ID..."
          className="px-3 py-2 border border-gray-300 rounded text-sm"
        />
        <button
          onClick={() => { setPage(0); fetchEntries(); }}
          className="px-4 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700"
        >
          Filter
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Timestamp
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Searched By
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Search Terms
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Results
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Disposition
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {entries.map((entry) => (
              <tr key={entry.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-600">
                  {new Date(entry.search_timestamp).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {entry.searched_by}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {entry.search_terms}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {Array.isArray(entry.results_snapshot)
                    ? entry.results_snapshot.length
                    : 0}{" "}
                  matches
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${dispositionBadge(entry.disposition)}`}
                  >
                    {entry.disposition?.replace("_", " ") ?? "Pending"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <a
                    href={`/api/audit?format=pdf&matterId=${entry.id}`}
                    className="text-xs text-primary-600 hover:underline"
                  >
                    Export PDF
                  </a>
                </td>
              </tr>
            ))}
            {entries.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No audit entries found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between mt-4">
        <button
          onClick={() => setPage(Math.max(0, page - 1))}
          disabled={page === 0}
          className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
        >
          Previous
        </button>
        <span className="text-sm text-gray-500">Page {page + 1}</span>
        <button
          onClick={() => setPage(page + 1)}
          disabled={entries.length < limit}
          className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
