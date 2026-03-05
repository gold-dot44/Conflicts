"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { SearchResult, EntityMatterRole, MatterStatus } from "@/types";

export default function NewMatterPage() {
  const router = useRouter();
  const [entities, setEntities] = useState<SearchResult[]>([]);
  const [form, setForm] = useState({
    entityId: "",
    matterName: "",
    matterNumber: "",
    status: "open" as MatterStatus,
    role: "client" as EntityMatterRole,
    responsibleAttorney: "",
    practiceArea: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetch("/api/entities")
      .then((r) => r.json())
      .then((data) => setEntities(data.entities ?? []))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const res = await fetch("/api/matters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create matter");
        return;
      }
      const entityName = entities.find((e) => e.entityId === form.entityId)?.fullLegalName;
      setSuccess(`Created matter "${form.matterName}" linked to ${entityName}`);
      setForm({
        entityId: "",
        matterName: "",
        matterNumber: "",
        status: "open",
        role: "client",
        responsibleAttorney: "",
        practiceArea: "",
      });
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Add New Matter</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Entity *
          </label>
          <select
            required
            value={form.entityId}
            onChange={(e) => setForm({ ...form, entityId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
          >
            <option value="">Select an entity...</option>
            {entities.map((entity) => (
              <option key={entity.entityId} value={entity.entityId}>
                {entity.fullLegalName} ({entity.entityType})
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Don&apos;t see the entity?{" "}
            <button
              type="button"
              onClick={() => router.push("/entities/new")}
              className="text-primary-600 underline"
            >
              Create one first
            </button>
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Matter Name *
          </label>
          <input
            type="text"
            required
            value={form.matterName}
            onChange={(e) => setForm({ ...form, matterName: e.target.value })}
            placeholder="Smith v. Jones Corp"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Matter Number
            </label>
            <input
              type="text"
              value={form.matterNumber}
              onChange={(e) => setForm({ ...form, matterNumber: e.target.value })}
              placeholder="2024-001"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as MatterStatus })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
            >
              <option value="open">Open</option>
              <option value="pending">Pending</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Role *
          </label>
          <select
            required
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as EntityMatterRole })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
          >
            <option value="client">Client</option>
            <option value="adverse_party">Adverse Party</option>
            <option value="co_party">Co-Party</option>
            <option value="witness">Witness</option>
            <option value="expert">Expert</option>
            <option value="insurer">Insurer</option>
            <option value="opposing_counsel">Opposing Counsel</option>
            <option value="judge">Judge</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Responsible Attorney
            </label>
            <input
              type="text"
              value={form.responsibleAttorney}
              onChange={(e) => setForm({ ...form, responsibleAttorney: e.target.value })}
              placeholder="Jane Smith"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Practice Area
            </label>
            <input
              type="text"
              value={form.practiceArea}
              onChange={(e) => setForm({ ...form, practiceArea: e.target.value })}
              placeholder="Litigation"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
        )}
        {success && (
          <div className="p-3 bg-green-50 text-green-700 rounded-md text-sm">
            {success}{" "}
            <button
              type="button"
              onClick={() => router.push("/search")}
              className="underline"
            >
              Search for it
            </button>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create Matter"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
