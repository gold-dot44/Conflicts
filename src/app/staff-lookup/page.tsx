"use client";

import { useState } from "react";
import type { StaffLookupResult, StaffRole } from "@/types";
import { STAFF_ROLE_LABELS } from "@/types";

const PAGE_SIZE = 25;

export default function StaffLookupPage() {
  const [upn, setUpn] = useState("");
  const [results, setResults] = useState<StaffLookupResult[]>([]);
  const [personName, setPersonName] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [page, setPage] = useState(0);
  const [exportFormat, setExportFormat] = useState<"xlsx" | "pdf">("xlsx");
  const [exportScope, setExportScope] = useState<"full" | "client_only">("full");

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!upn.trim()) return;

    setLoading(true);
    setSearched(true);
    setPage(0);
    try {
      const res = await fetch(`/api/staff-lookup?upn=${encodeURIComponent(upn.trim())}`);
      const data = await res.json();
      setResults(data.results ?? []);
      // Try to infer name from results
      if (data.results?.length > 0) {
        // Fetch name from first matter's staff
        const firstResult = data.results[0];
        setPersonName(upn.split("@")[0].replace(".", " ").replace(/(^|\s)\S/g, (t: string) => t.toUpperCase()));
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function handleExport() {
    const url = `/api/staff-lookup/export?upn=${encodeURIComponent(upn.trim())}&format=${exportFormat}&scope=${exportScope}`;
    window.open(url, "_blank");
  }

  const paginatedResults = results.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(results.length / PAGE_SIZE);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Staff Lookup</h1>
      <p className="text-sm text-gray-500 mb-6">
        Find all matters associated with a specific firm member.
      </p>

      <form onSubmit={handleLookup} className="mb-8">
        <div className="flex gap-3">
          <input
            type="text"
            value={upn}
            onChange={(e) => setUpn(e.target.value)}
            placeholder="Enter email (UPN), e.g. sarah.johnson@firm.com"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? "Looking up..." : "Look Up"}
          </button>
        </div>
      </form>

      {searched && !loading && (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-600">
              {results.length === 0
                ? "No matters found for this person."
                : `${personName || upn} is associated with ${results.length} matter${results.length !== 1 ? "s" : ""}`}
            </p>

            {results.length > 0 && (
              <div className="flex items-center gap-3">
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as "xlsx" | "pdf")}
                  className="px-2 py-1.5 border border-gray-300 rounded text-sm bg-white"
                >
                  <option value="xlsx">Excel</option>
                  <option value="pdf">PDF</option>
                </select>
                <select
                  value={exportScope}
                  onChange={(e) => setExportScope(e.target.value as "full" | "client_only")}
                  className="px-2 py-1.5 border border-gray-300 rounded text-sm bg-white"
                >
                  <option value="full">Full Report</option>
                  <option value="client_only">Client Names Only</option>
                </select>
                <button
                  onClick={handleExport}
                  className="px-4 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 font-medium"
                >
                  Export
                </button>
              </div>
            )}
          </div>

          {results.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Matter</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Number</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Practice Area</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dates</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Parties</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedResults.map((r, i) => (
                    <tr key={`${r.matterId}-${r.staffRole}-${i}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{r.matterName}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{r.matterNumber ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            r.matterStatus === "open"
                              ? "bg-green-100 text-green-700"
                              : r.matterStatus === "pending"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {r.matterStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{r.practiceArea ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                          {STAFF_ROLE_LABELS[r.staffRole] ?? r.staffRole}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {r.startDate
                          ? `${r.startDate}${r.endDate ? ` — ${r.endDate}` : " — present"}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">
                        {r.parties
                          .slice(0, 3)
                          .map((p) => p.entityName)
                          .join(", ")}
                        {r.parties.length > 3 && ` +${r.parties.length - 3}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                  <button
                    onClick={() => setPage(Math.max(0, page - 1))}
                    disabled={page === 0}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-500">
                    Page {page + 1} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                    disabled={page >= totalPages - 1}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
