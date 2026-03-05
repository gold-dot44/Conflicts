"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useState, useEffect } from "react";
import type { ConflictCheckRequest, CheckRequestType, SubjectRole, EntityType } from "@/types";

export default function Home() {
  const { data: session, status } = useSession();
  const role = (session?.user as Record<string, string> | undefined)?.role ?? "analyst";

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

  // Reviewer/Partner view: pending queue + stats
  if (role === "reviewer" || role === "admin") {
    return <ReviewerHome />;
  }

  // Analyst view: new conflict check form IS the landing page
  return <AnalystHome />;
}

// ─── Analyst Home: The conflict check form IS the landing page ───

interface SubjectEntry {
  name: string;
  role: SubjectRole;
  type: EntityType | "unknown";
}

function AnalystHome() {
  const [requestType, setRequestType] = useState<CheckRequestType>("new_client");
  const [prospectiveMatter, setProspectiveMatter] = useState("");
  const [requestingAttorney, setRequestingAttorney] = useState("");
  const [attorneySearch, setAttorneySearch] = useState("");
  const [showAttorneyList, setShowAttorneyList] = useState(false);
  const [subjects, setSubjects] = useState<SubjectEntry[]>([
    { name: "", role: "prospective_client", type: "unknown" },
  ]);
  const [loading, setLoading] = useState(false);

  const ATTORNEYS = [
    "Michael Chen", "Sarah Johnson", "Robert Kim",
    "Lisa Park", "David Martinez", "Jennifer Walsh",
  ];

  const filteredAttorneys = ATTORNEYS.filter(
    (a) => a.toLowerCase().includes(attorneySearch.toLowerCase())
  );

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

    setLoading(true);
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
      setLoading(false);
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

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border p-6">
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
            disabled={loading || !prospectiveMatter.trim() || !requestingAttorney || subjects.some((s) => !s.name.trim())}
            className="w-full px-6 py-3 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? "Running Searches..." : "Run All Searches"}
          </button>
        </form>
      </div>

      {/* Quick links for other tasks */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Link
          href="/search"
          className="p-3 bg-white rounded-lg border text-center text-sm text-gray-600 hover:bg-gray-50"
        >
          Quick Search (ad-hoc)
        </Link>
        <Link
          href="/lateral-import"
          className="p-3 bg-white rounded-lg border text-center text-sm text-gray-600 hover:bg-gray-50"
        >
          Lateral Hire Import
        </Link>
      </div>
    </div>
  );
}

// ─── Reviewer Home: Pending queue + stats ───

function ReviewerHome() {
  const [pending, setPending] = useState<ConflictCheckRequest[]>([]);
  const [stats, setStats] = useState({ todayChecks: 0, weekChecks: 0, pending: 0, activeWalls: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/conflict-checks?view=pending")
      .then((r) => r.json())
      .then((data) => {
        setPending(data.requests ?? []);
        if (data.stats) setStats(data.stats);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function timeSince(dateStr: string): string {
    const ms = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(ms / 3600000);
    if (hours < 1) return "just now";
    if (hours < 24) return `${hours} hrs ago`;
    const days = Math.floor(hours / 24);
    return days === 1 ? "yesterday" : `${days} days ago`;
  }

  return (
    <div className="flex gap-6">
      {/* Left: Pending review queue */}
      <div className="flex-1">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          Pending Your Review ({pending.length})
        </h2>
        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : pending.length === 0 ? (
          <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
            No items pending review.
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((req) => {
              const conflictCount = req.subjects.filter(
                (s) => s.disposition === "potential_conflict" || s.disposition === "conflict_confirmed" || s.crossReferences.length > 0
              ).length;
              return (
                <Link
                  key={req.id}
                  href={`/conflict-checks/${req.id}/review`}
                  className="block bg-white rounded-lg border p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-yellow-500" />
                        <span className="font-semibold text-gray-900">
                          {req.prospectiveMatter}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        Flagged by {req.assignedAnalystUpn?.split("@")[0]}, {timeSince(req.updatedAt)}
                      </p>
                      {conflictCount > 0 && (
                        <p className="text-sm text-red-600 mt-1">
                          {conflictCount} potential conflict{conflictCount !== 1 ? "s" : ""} found
                        </p>
                      )}
                    </div>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      {req.requestType.replace(/_/g, " ")}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Right: Stats + quick search */}
      <div className="w-72 shrink-0">
        <div className="bg-white rounded-lg border p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent Activity</h3>
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
              <span className="text-gray-500">Pending:</span>
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
              placeholder="Search..."
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
          href="/conflict-checks/new"
          className="block w-full px-3 py-2 bg-green-600 text-white rounded-md text-sm text-center hover:bg-green-700"
        >
          New Conflict Check
        </Link>
      </div>
    </div>
  );
}
