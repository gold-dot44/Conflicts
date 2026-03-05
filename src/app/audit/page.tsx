"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { ConflictCheckRequest } from "@/types";

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
  const [checkRequests, setCheckRequests] = useState<ConflictCheckRequest[]>([]);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [filter, setFilter] = useState({ searchedBy: "", status: "", search: "" });
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"requests" | "legacy">("requests");
  const limit = 25;

  useEffect(() => {
    fetchData();
  }, [page]);

  async function fetchData() {
    setLoading(true);
    // Fetch conflict check requests
    const reqRes = await fetch("/api/conflict-checks?view=all");
    const reqData = await reqRes.json();
    setCheckRequests(reqData.requests ?? []);

    // Also fetch legacy audit entries
    const params = new URLSearchParams({ limit: String(limit), offset: String(page * limit) });
    if (filter.searchedBy) params.set("searchedBy", filter.searchedBy);
    const auditRes = await fetch(`/api/audit?${params}`);
    const auditData = await auditRes.json();
    setEntries(auditData.trail ?? []);
    setLoading(false);
  }

  function statusBadge(status: string): string {
    switch (status) {
      case "cleared": return "bg-green-100 text-green-700";
      case "blocked": return "bg-red-100 text-red-700";
      case "pending_review": return "bg-yellow-100 text-yellow-700";
      case "cleared_with_wall": return "bg-blue-100 text-blue-700";
      case "searching": return "bg-gray-100 text-gray-600";
      default: return "bg-gray-100 text-gray-500";
    }
  }

  function dispositionBadge(disposition: string | null): string {
    switch (disposition) {
      case "no_conflict": return "bg-green-100 text-green-700";
      case "potential_conflict": return "bg-yellow-100 text-yellow-700";
      case "conflict_confirmed": return "bg-red-100 text-red-700";
      case "waiver_obtained": return "bg-blue-100 text-blue-700";
      default: return "bg-gray-100 text-gray-500";
    }
  }

  // Filter requests
  const filteredRequests = checkRequests.filter((r) => {
    if (filter.status && r.status !== filter.status) return false;
    if (filter.searchedBy && !r.assignedAnalystUpn?.includes(filter.searchedBy)) return false;
    if (filter.search && !r.prospectiveMatter.toLowerCase().includes(filter.search.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Audit Trail</h1>

      {/* View mode toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setViewMode("requests")}
          className={`px-3 py-1.5 text-sm rounded ${viewMode === "requests" ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
        >
          By Conflict Check Request
        </button>
        <button
          onClick={() => setViewMode("legacy")}
          className={`px-3 py-1.5 text-sm rounded ${viewMode === "legacy" ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
        >
          Individual Searches
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <input
          type="text"
          value={filter.searchedBy}
          onChange={(e) => setFilter({ ...filter, searchedBy: e.target.value })}
          placeholder="Filter by analyst..."
          className="px-3 py-2 border border-gray-300 rounded text-sm"
        />
        {viewMode === "requests" && (
          <>
            <select
              value={filter.status}
              onChange={(e) => setFilter({ ...filter, status: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded text-sm bg-white"
            >
              <option value="">All statuses</option>
              <option value="cleared">Cleared</option>
              <option value="blocked">Blocked</option>
              <option value="cleared_with_wall">Cleared with Wall</option>
              <option value="pending_review">Pending Review</option>
              <option value="searching">Searching</option>
            </select>
            <input
              type="text"
              value={filter.search}
              onChange={(e) => setFilter({ ...filter, search: e.target.value })}
              placeholder="Search by matter name..."
              className="px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </>
        )}
        <button
          onClick={() => { setPage(0); fetchData(); }}
          className="px-4 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700"
        >
          Filter
        </button>
      </div>

      {/* Requests view */}
      {viewMode === "requests" && (
        <div className="space-y-3">
          {filteredRequests.length === 0 && !loading && (
            <div className="text-center py-12 text-gray-500">No conflict check requests found.</div>
          )}
          {filteredRequests.map((req) => {
            const conflictCount = req.subjects.filter(
              (s) => s.disposition === "conflict_confirmed" || s.disposition === "potential_conflict"
            ).length;
            const wallCreated = req.status === "cleared_with_wall";

            return (
              <div key={req.id} className="bg-white rounded-lg shadow-sm border p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-400">{req.requestNumber}</span>
                      <span className="font-semibold text-gray-900">{req.prospectiveMatter}</span>
                    </div>
                    <p className="text-sm text-gray-500">
                      {req.requestType.replace(/_/g, " ")} &middot; Requested by {req.requestingAttorney}
                    </p>
                    <p className="text-sm text-gray-500">
                      Analyst: {req.assignedAnalystUpn?.split("@")[0]} &middot;{" "}
                      {new Date(req.requestedAt).toLocaleDateString()} {new Date(req.requestedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${statusBadge(req.status)}`}>
                        {req.status.replace(/_/g, " ").toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-500">
                        {req.subjects.length} searched &middot;{" "}
                        {conflictCount > 0 ? `${conflictCount} conflict${conflictCount !== 1 ? "s" : ""}` : "No conflicts"}
                        {wallCreated && " \u00b7 Wall created"}
                      </span>
                    </div>
                    {req.reviewedByUpn && (
                      <p className="text-xs text-gray-400 mt-1">
                        Reviewed by: {req.reviewedByUpn.split("@")[0]} &middot;{" "}
                        {req.reviewedAt ? new Date(req.reviewedAt).toLocaleDateString() : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/conflict-checks/${req.id}`}
                      className="text-xs text-primary-600 hover:underline"
                    >
                      View Details
                    </Link>
                    <a
                      href={`/api/audit?format=pdf&matterId=${req.id}`}
                      className="text-xs text-primary-600 hover:underline"
                    >
                      Export PDF
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legacy individual searches view */}
      {viewMode === "legacy" && (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Searched By</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Search Terms</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Results</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Disposition</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-600">{new Date(entry.search_timestamp).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{entry.searched_by}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{entry.search_terms}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{Array.isArray(entry.results_snapshot) ? entry.results_snapshot.length : 0} matches</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${dispositionBadge(entry.disposition)}`}>
                      {entry.disposition?.replace("_", " ") ?? "Pending"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <a href={`/api/audit?format=pdf&matterId=${entry.id}`} className="text-xs text-primary-600 hover:underline">Export PDF</a>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && !loading && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No audit entries found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <div className="flex justify-between mt-4">
        <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50">Previous</button>
        <span className="text-sm text-gray-500">Page {page + 1}</span>
        <button onClick={() => setPage(page + 1)} disabled={viewMode === "requests" || entries.length < limit} className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50">Next</button>
      </div>
    </div>
  );
}
