"use client";

// The "new conflict check" page simply renders the analyst home form.
// In the redesign, the home page IS the new check form for analysts.
// This route exists so reviewers can access it from their dashboard.

import { useState } from "react";
import type { CheckRequestType, SubjectRole, EntityType } from "@/types";

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

interface SubjectEntry { name: string; role: SubjectRole; type: EntityType | "unknown"; }

const ATTORNEYS = ["Michael Chen", "Sarah Johnson", "Robert Kim", "Lisa Park", "David Martinez", "Jennifer Walsh"];

export default function NewConflictCheckPage() {
  const [requestType, setRequestType] = useState<CheckRequestType>("new_client");
  const [prospectiveMatter, setProspectiveMatter] = useState("");
  const [requestingAttorney, setRequestingAttorney] = useState("");
  const [attorneySearch, setAttorneySearch] = useState("");
  const [showAttorneyList, setShowAttorneyList] = useState(false);
  const [subjects, setSubjects] = useState<SubjectEntry[]>([
    { name: "", role: "prospective_client", type: "unknown" },
  ]);
  const [loading, setLoading] = useState(false);

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
          subjects: subjects.map((s) => ({ subjectName: s.name, subjectRole: s.role, subjectType: s.type })),
        }),
      });
      const data = await res.json();
      window.location.href = `/conflict-checks/${data.id}`;
    } catch { setLoading(false); }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h1 className="text-xl font-bold text-gray-900 mb-6">New Conflict Check</h1>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">What is this check for?</label>
            <select value={requestType} onChange={(e) => setRequestType(e.target.value as CheckRequestType)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white">
              {Object.entries(REQUEST_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prospective matter name</label>
            <input type="text" value={prospectiveMatter} onChange={(e) => setProspectiveMatter(e.target.value)} placeholder="e.g., Acme Corp M&A Advisory" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" required />
          </div>
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Requesting attorney</label>
            <input type="text" value={attorneySearch || requestingAttorney} onChange={(e) => { setAttorneySearch(e.target.value); setRequestingAttorney(""); setShowAttorneyList(true); }} onFocus={() => setShowAttorneyList(true)} placeholder="Search by name..." className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" required />
            {showAttorneyList && filteredAttorneys.length > 0 && !requestingAttorney && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
                {filteredAttorneys.map((name) => (
                  <button key={name} type="button" onClick={() => { setRequestingAttorney(name); setAttorneySearch(""); setShowAttorneyList(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">{name}</button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Names to Search</label>
            <div className="space-y-3">
              {subjects.map((subject, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <select value={subject.role} onChange={(e) => updateSubject(i, { role: e.target.value as SubjectRole })} className="w-44 px-2 py-2 border border-gray-300 rounded-md text-sm bg-white shrink-0">
                    {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <input type="text" value={subject.name} onChange={(e) => updateSubject(i, { name: e.target.value })} placeholder="Enter name..." className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm" required />
                  <select value={subject.type} onChange={(e) => updateSubject(i, { type: e.target.value as EntityType | "unknown" })} className="w-28 px-2 py-2 border border-gray-300 rounded-md text-sm bg-white shrink-0">
                    <option value="unknown">Auto</option>
                    <option value="person">Person</option>
                    <option value="company">Company</option>
                  </select>
                  {subjects.length > 1 && <button type="button" onClick={() => removeSubject(i)} className="px-2 py-2 text-gray-400 hover:text-red-500 text-lg shrink-0">x</button>}
                </div>
              ))}
            </div>
            <button type="button" onClick={addSubject} className="mt-2 text-sm text-primary-600 hover:text-primary-700 font-medium">+ Add another name</button>
          </div>
          <button type="submit" disabled={loading || !prospectiveMatter.trim() || !requestingAttorney || subjects.some((s) => !s.name.trim())} className="w-full px-6 py-3 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
            {loading ? "Running Searches..." : "Run All Searches"}
          </button>
        </form>
      </div>
    </div>
  );
}
