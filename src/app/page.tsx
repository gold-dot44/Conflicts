"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useState, useEffect } from "react";
import type { ConflictCheckRequest, CheckRequestType, SubjectRole, EntityType } from "@/types";

export default function Home() {
  const { data: session, status } = useSession();
  const role = (session?.user as Record<string, string> | undefined)?.role ?? "analyst";
  const canReview = role === "reviewer" || role === "admin";

  if (!session) {
    if (status === "loading") {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <p className="text-gray-500">Loading...</p>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Conflict Checking System
        </h1>
        <p className="text-lg text-gray-600 mb-8 text-center max-w-2xl">
          Integrated legal conflict checking powered by fuzzy matching,
          corporate family tree traversal, and immutable audit trails.
        </p>
        <p className="text-gray-500">
          Sign in with your Microsoft account to get started.
        </p>
      </div>
    );
  }

  return <Dashboard canReview={canReview} />;
}

// ─── Unified Dashboard ───

interface SubjectEntry {
  name: string;
  role: SubjectRole;
  type: EntityType | "unknown";
}

function Dashboard({ canReview }: { canReview: boolean }) {
  // --- New check form state ---
  const [requestType, setRequestType] = useState<CheckRequestType>("new_client");
  const [prospectiveMatter, setProspectiveMatter] = useState("");
  const [requestingAttorney, setRequestingAttorney] = useState("");
  const [attorneySearch, setAttorneySearch] = useState("");
  const [showAttorneyList, setShowAttorneyList] = useState(false);
  const [subjects, setSubjects] = useState<SubjectEntry[]>([
    { name: "", role: "prospective_client", type: "unknown" },
  ]);
  const [submitting, setSubmitting] = useState(false);

  // --- Recent checks + stats ---
  const [recentChecks, setRecentChecks] = useState<ConflictCheckRequest[]>([]);
  const [stats, setStats] = useState({ todayChecks: 0, weekChecks: 0, pending: 0, activeWalls: 0 });
  const [loadingChecks, setLoadingChecks] = useState(true);

  const ATTORNEYS = [
    "Michael Chen", "Sarah Johnson", "Robert Kim",
    "Lisa Park", "David Martinez", "Jennifer Walsh",
  ];

  const filteredAttorneys = ATTORNEYS.filter(
    (a) => a.toLowerCase().includes(attorneySearch.toLowerCase())
  );

  useEffect(() => {
    fetch("/api/conflict-checks?view=recent")
      .then((r) => r.json())
      .then((data) => {
        setRecentChecks(data.requests ?? []);
        if (data.stats) setStats(data.stats);
        setLoadingChecks(false);
      })
      .catch(() => setLoadingChecks(false));
  }, []);

  function addSubject() {
    setSubjects([...subjects, { name: "", role: "adverse_party", type: "unknown" }]);
  }

  function removeSubject(index: number) {
    setSubjects(subjects.filter((_, i) => i !== index));
  }

  function updateSubject(index: number, updates: Partial<SubjectEntry>) {
    setSubjects(subjects.map((s, i) => i === index ? { ...s, ...updates } : s));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prospectiveMatter.trim() || !requestingAttorney || subjects.some((s) => !s.name.trim())) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/conflict-checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestType,
          prospectiveMatter,
          requestingAttorney,
          subjects: subjects.map((s) => ({
            subjectName: s.name,
            subjectRole: s.role,
            subjectType: s.type,
          })),
        }),
      });
      const data = await res.json();
      window.location.href = `/conflict-checks/${data.id}`;
    } catch {
      setSubmitting(false);
    }
  }

  const REQUEST_TYPE_LABELS: Record<CheckRequestType, string> = {
    new_client: "New Client Intake",
    new_matter: "New Matter",
    lateral_hire: "Lateral Hire",
    new_party: "New Party Added to Existing Matter",
    general: "General Check",
  };

  const ROLE_LABELS: Record<SubjectRole, string> = {
    prospective_client: "Prospective Client",
    adverse_party: "Adverse Party",
    related_individual: "Related Individual",
    opposing_counsel: "Opposing Counsel",
    witness: "Witness",
    expert: "Expert",
    insurer: "Insurer",
    co_party: "Co-Party",
    other: "Other",
  };

  function timeSince(dateStr: string): string {
    const ms = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(ms / 3600000);
    if (hours < 1) return "just now";
    if (hours < 24) return `${hours} hrs ago`;
    const days = Math.floor(hours / 24);
    return days === 1 ? "yesterday" : `${days} days ago`;
  }

  function statusBadge(status: string) {
    const styles: Record<string, string> = {
      cleared: "bg-green-100 text-green-700",
      blocked: "bg-red-100 text-red-700",
      pending_review: "bg-yellow-100 text-yellow-700",
      cleared_with_wall: "bg-blue-100 text-blue-700",
      searching: "bg-gray-100 text-gray-600",
      draft: "bg-gray-100 text-gray-600",
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded font-medium ${styles[status] ?? "bg-gray-100 text-gray-600"}`}>
        {status.replace(/_/g, " ")}
      </span>
    );
  }

  // Separate pending review items for visibility
  const pendingReview = recentChecks.filter((r) => r.status === "pending_review");
  const otherChecks = recentChecks.filter((r) => r.status !== "pending_review");

  return (
    <div className="flex gap-6">
      {/* Left column: form + recent checks */}
      <div className="flex-1 min-w-0">
        {/* New Conflict Check form */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h1 className="text-xl font-bold text-gray-900 mb-6">New Conflict Check</h1>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                What is this check for?
              </label>
              <select
                value={requestType}
                onChange={(e) => setRequestType(e.target.value as CheckRequestType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
              >
                {Object.entries(REQUEST_TYPE_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prospective matter name
              </label>
              <input
                type="text"
                value={prospectiveMatter}
                onChange={(e) => setProspectiveMatter(e.target.value)}
                placeholder="e.g., Acme Corp M&A Advisory"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                required
              />
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Requesting attorney
              </label>
              <input
                type="text"
                value={attorneySearch || requestingAttorney}
                onChange={(e) => {
                  setAttorneySearch(e.target.value);
                  setRequestingAttorney("");
                  setShowAttorneyList(true);
                }}
                onFocus={() => setShowAttorneyList(true)}
                placeholder="Search by name..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                required
              />
              {showAttorneyList && filteredAttorneys.length > 0 && !requestingAttorney && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
                  {filteredAttorneys.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        setRequestingAttorney(name);
                        setAttorneySearch("");
                        setShowAttorneyList(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Names to Search
              </label>
              <div className="space-y-3">
                {subjects.map((subject, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <select
                      value={subject.role}
                      onChange={(e) => updateSubject(i, { role: e.target.value as SubjectRole })}
                      className="w-44 px-2 py-2 border border-gray-300 rounded-md text-sm bg-white shrink-0"
                    >
                      {Object.entries(ROLE_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={subject.name}
                      onChange={(e) => updateSubject(i, { name: e.target.value })}
                      placeholder="Enter name..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                      required
                    />
                    <select
                      value={subject.type}
                      onChange={(e) => updateSubject(i, { type: e.target.value as EntityType | "unknown" })}
                      className="w-28 px-2 py-2 border border-gray-300 rounded-md text-sm bg-white shrink-0"
                    >
                      <option value="unknown">Auto</option>
                      <option value="person">Person</option>
                      <option value="company">Company</option>
                    </select>
                    {subjects.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSubject(i)}
                        className="px-2 py-2 text-gray-400 hover:text-red-500 text-lg shrink-0"
                      >
                        x
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addSubject}
                className="mt-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                + Add another name
              </button>
            </div>

            <button
              type="submit"
              disabled={submitting || !prospectiveMatter.trim() || !requestingAttorney || subjects.some((s) => !s.name.trim())}
              className="w-full px-6 py-3 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              {submitting ? "Running Searches..." : "Run All Searches"}
            </button>
          </form>
        </div>

        {/* Pending Review section — visible to all, actionable by reviewers */}
        {pendingReview.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Pending Review ({pendingReview.length})
            </h2>
            <div className="space-y-2">
              {pendingReview.map((req) => {
                const conflictCount = req.subjects.filter(
                  (s) => s.disposition === "potential_conflict" || s.disposition === "conflict_confirmed" || s.crossReferences?.length > 0
                ).length;
                return (
                  <Link
                    key={req.id}
                    href={canReview ? `/conflict-checks/${req.id}/review` : `/conflict-checks/${req.id}`}
                    className="block bg-white rounded-lg border border-yellow-200 p-4 hover:bg-yellow-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-yellow-500" />
                          <span className="font-semibold text-gray-900">{req.prospectiveMatter}</span>
                          {statusBadge(req.status)}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {req.requestingAttorney} &middot; {timeSince(req.updatedAt)}
                        </p>
                        {conflictCount > 0 && (
                          <p className="text-sm text-red-600 mt-1">
                            {conflictCount} potential conflict{conflictCount !== 1 ? "s" : ""} found
                          </p>
                        )}
                      </div>
                      {canReview && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded font-medium">
                          Review
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent checks */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
            Recent Checks
          </h2>
          {loadingChecks ? (
            <p className="text-gray-500 text-sm">Loading...</p>
          ) : otherChecks.length === 0 ? (
            <div className="bg-white rounded-lg border p-6 text-center text-gray-500 text-sm">
              No recent checks.
            </div>
          ) : (
            <div className="space-y-2">
              {otherChecks.map((req) => (
                <Link
                  key={req.id}
                  href={`/conflict-checks/${req.id}`}
                  className="block bg-white rounded-lg border p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{req.prospectiveMatter}</span>
                        {statusBadge(req.status)}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {req.requestingAttorney} &middot; {req.subjects.length} subject{req.subjects.length !== 1 ? "s" : ""} &middot; {timeSince(req.updatedAt)}
                      </p>
                    </div>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      {req.requestType.replace(/_/g, " ")}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right sidebar: stats + quick links */}
      <div className="w-64 shrink-0">
        <div className="bg-white rounded-lg border p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Activity</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Today:</span>
              <span className="font-medium">{stats.todayChecks} checks</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">This week:</span>
              <span className="font-medium">{stats.weekChecks}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Pending review:</span>
              <span className="font-medium text-yellow-600">{stats.pending}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Active walls:</span>
              <span className="font-medium">{stats.activeWalls}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Quick Search</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const input = (e.target as HTMLFormElement).elements.namedItem("q") as HTMLInputElement;
              if (input.value.trim()) {
                window.location.href = `/search?q=${encodeURIComponent(input.value)}`;
              }
            }}
          >
            <input
              name="q"
              type="text"
              placeholder="Search entities..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-2"
            />
            <button
              type="submit"
              className="w-full px-3 py-2 bg-primary-600 text-white rounded-md text-sm hover:bg-primary-700"
            >
              Search
            </button>
          </form>
        </div>

        <Link
          href="/import"
          className="block w-full px-3 py-2 bg-white border text-gray-700 rounded-md text-sm text-center hover:bg-gray-50"
        >
          Import Data
        </Link>
      </div>
    </div>
  );
}
