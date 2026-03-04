"use client";

import { useState, useEffect } from "react";

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

export default function EthicalWallsPage() {
  const [walls, setWalls] = useState<EthicalWall[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    screenedAttorney: "",
    screenedAttorneyUpn: "",
    matterId: "",
  });
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
    setLoading(true);
    await fetch("/api/ethical-walls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    setShowForm(false);
    setFormData({ screenedAttorney: "", screenedAttorneyUpn: "", matterId: "" });
    await fetchWalls();
    setLoading(false);
  }

  async function handleRemove(wallId: string) {
    if (!confirm("Are you sure you want to remove this ethical wall?")) return;
    await fetch(`/api/ethical-walls?id=${wallId}`, { method: "DELETE" });
    await fetchWalls();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Ethical Walls</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700"
        >
          Create Ethical Wall
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white p-6 rounded-lg shadow-sm border mb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Screened Attorney Name
            </label>
            <input
              type="text"
              value={formData.screenedAttorney}
              onChange={(e) => setFormData({ ...formData, screenedAttorney: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Attorney Email (UPN)
            </label>
            <input
              type="email"
              value={formData.screenedAttorneyUpn}
              onChange={(e) => setFormData({ ...formData, screenedAttorneyUpn: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Matter ID
            </label>
            <input
              type="text"
              value={formData.matterId}
              onChange={(e) => setFormData({ ...formData, matterId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Wall"}
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
                  <h3 className="font-semibold text-gray-900">
                    {wall.screened_attorney}
                  </h3>
                  <p className="text-sm text-gray-500">{wall.screened_attorney_upn}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-700">
                      {wall.matter_name}
                    </p>
                    <p className="text-xs text-gray-400">
                      Created {new Date(wall.created_at).toLocaleDateString()} by{" "}
                      {wall.created_by}
                    </p>
                  </div>
                  {wall.memo_url && (
                    <a
                      href={wall.memo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary-600 hover:underline"
                    >
                      View Memo
                    </a>
                  )}
                  <button
                    onClick={() => handleRemove(wall.id)}
                    className="text-xs text-red-600 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
