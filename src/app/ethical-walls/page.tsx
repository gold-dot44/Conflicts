"use client";

import { useState, useEffect } from "react";
import { HelpTooltip } from "@/components/HelpTooltip";

interface EthicalWall {
  id: string;
  screened_attorney: string;
  screened_attorney_upn: string;
  matter_id: string;
  matter_name: string;
  created_by: string;
  created_at: string;
  memo_url: string | null;
  is_active: boolean;
}

const DEMO_ATTORNEYS = [
  { name: "David Martinez", upn: "david.martinez@firm.com" },
  { name: "Sarah Johnson", upn: "sarah.johnson@firm.com" },
  { name: "Michael Chen", upn: "michael.chen@firm.com" },
  { name: "Lisa Park", upn: "lisa.park@firm.com" },
  { name: "Robert Kim", upn: "robert.kim@firm.com" },
];

const DEMO_MATTERS = [
  { id: "m-1", name: "Acme Corp v. Widget Industries (#2024-001)" },
  { id: "m-2", name: "Acme Corp - Series B Financing (#2023-047)" },
  { id: "m-3", name: "Smith Family Trust (#2024-012)" },
  { id: "m-4", name: "Doe v. Metro Transit Authority (#2023-089)" },
  { id: "m-5", name: "Globex Corp Annual Compliance (#2024-033)" },
];

export default function EthicalWallsPage() {
  const [walls, setWalls] = useState<EthicalWall[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedAttorney, setSelectedAttorney] = useState<typeof DEMO_ATTORNEYS[0] | null>(null);
  const [attorneySearch, setAttorneySearch] = useState("");
  const [showAttorneyDropdown, setShowAttorneyDropdown] = useState(false);
  const [selectedMatter, setSelectedMatter] = useState("");
  const [matterSearch, setMatterSearch] = useState("");
  const [showMatterDropdown, setShowMatterDropdown] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchWalls();
  }, []);

  async function fetchWalls() {
    const res = await fetch("/api/ethical-walls");
    const data = await res.json();
    setWalls(data.walls ?? []);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAttorney || !selectedMatter) return;
    setLoading(true);
    await fetch("/api/ethical-walls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        screenedAttorney: selectedAttorney.name,
        screenedAttorneyUpn: selectedAttorney.upn,
        matterId: selectedMatter,
      }),
    });
    setShowForm(false);
    setSelectedAttorney(null);
    setAttorneySearch("");
    setSelectedMatter("");
    setMatterSearch("");
    setReason("");
    await fetchWalls();
    setLoading(false);
  }

  async function handleRemove(wallId: string) {
    if (!confirm("Are you sure you want to remove this ethical wall?")) return;
    await fetch(`/api/ethical-walls?id=${wallId}`, { method: "DELETE" });
    await fetchWalls();
  }

  const filteredAttorneys = DEMO_ATTORNEYS.filter(
    (a) => a.name.toLowerCase().includes(attorneySearch.toLowerCase()) ||
           a.upn.toLowerCase().includes(attorneySearch.toLowerCase())
  );

  const filteredMatters = DEMO_MATTERS.filter(
    (m) => m.name.toLowerCase().includes(matterSearch.toLowerCase())
  );

  const selectedMatterName = DEMO_MATTERS.find((m) => m.id === selectedMatter)?.name ?? "";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ethical Walls</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage attorney screening with database-enforced access restrictions.
            <HelpTooltip text="An ethical wall (screen) is a set of access restrictions that prevent a specific attorney from viewing or participating in a specific matter. Used when one attorney's prior knowledge creates a conflict." />
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700"
        >
          Create Ethical Wall
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white p-6 rounded-lg shadow-sm border mb-6 space-y-4">
          {/* Attorney search */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Attorney to Screen
            </label>
            <input
              type="text"
              value={selectedAttorney ? `${selectedAttorney.name} (${selectedAttorney.upn})` : attorneySearch}
              onChange={(e) => {
                setAttorneySearch(e.target.value);
                setSelectedAttorney(null);
                setShowAttorneyDropdown(true);
              }}
              onFocus={() => setShowAttorneyDropdown(true)}
              placeholder="Search by name or email..."
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              required
            />
            {showAttorneyDropdown && !selectedAttorney && filteredAttorneys.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border rounded shadow-lg max-h-40 overflow-y-auto">
                {filteredAttorneys.map((a) => (
                  <button
                    key={a.upn}
                    type="button"
                    onClick={() => { setSelectedAttorney(a); setAttorneySearch(""); setShowAttorneyDropdown(false); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    {a.name} <span className="text-gray-400">({a.upn})</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Matter search */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Restricted Matter
            </label>
            <input
              type="text"
              value={selectedMatter ? selectedMatterName : matterSearch}
              onChange={(e) => {
                setMatterSearch(e.target.value);
                setSelectedMatter("");
                setShowMatterDropdown(true);
              }}
              onFocus={() => setShowMatterDropdown(true)}
              placeholder="Search by matter name or number..."
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              required
            />
            {showMatterDropdown && !selectedMatter && filteredMatters.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border rounded shadow-lg max-h-40 overflow-y-auto">
                {filteredMatters.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => { setSelectedMatter(m.id); setMatterSearch(""); setShowMatterDropdown(false); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason for Screen
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Lateral hire — prior representation of Widget at former firm"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>

          {/* What Will Happen */}
          {selectedAttorney && selectedMatter && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">What Will Happen</h3>
              <p className="text-sm text-gray-500 mb-2">When you create this wall, the system will:</p>
              <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                <li>Block {selectedAttorney.name} from viewing any records associated with this matter in the conflict checking system</li>
                <li>Revoke {selectedAttorney.name}&apos;s access to this matter in Clio (notes, documents, billing, calendar)</li>
                <li>Generate a formal screening memorandum (PDF)</li>
                <li>File the memo to the matter in Clio</li>
                <li>Notify the conflicts chair that the wall is in place</li>
              </ol>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !selectedAttorney || !selectedMatter}
            className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Ethical Wall"}
          </button>
        </form>
      )}

      <div className="space-y-3">
        {walls.length === 0 ? (
          <p className="text-gray-500 text-center py-12">No active ethical walls.</p>
        ) : (
          walls.map((wall) => (
            <div key={wall.id} className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{wall.screened_attorney}</h3>
                  <p className="text-sm text-gray-500">{wall.screened_attorney_upn}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-700">{wall.matter_name}</p>
                    <p className="text-xs text-gray-400">Created {new Date(wall.created_at).toLocaleDateString()} by {wall.created_by}</p>
                  </div>
                  {wall.memo_url && (
                    <a href={wall.memo_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline">View Memo</a>
                  )}
                  <button onClick={() => handleRemove(wall.id)} className="text-xs text-red-600 hover:text-red-700">Remove</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
