"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { SearchResult, EntityMatterRole, MatterStatus } from "@/types";

interface PartyEntry {
  entityId: string;
  entityName: string;
  role: EntityMatterRole;
  isNew: boolean;
  newEntityType?: "person" | "company";
}

const ROLE_LABELS: Record<EntityMatterRole, string> = {
  client: "Client",
  adverse_party: "Adverse Party",
  co_party: "Co-Party",
  witness: "Witness",
  expert: "Expert",
  insurer: "Insurer",
  opposing_counsel: "Opposing Counsel",
  judge: "Judge",
  other: "Other",
};

export default function NewMatterPage() {
  const router = useRouter();
  const [entities, setEntities] = useState<SearchResult[]>([]);
  const [matterName, setMatterName] = useState("");
  const [matterNumber, setMatterNumber] = useState("");
  const [status, setStatus] = useState<MatterStatus>("open");
  const [responsibleAttorney, setResponsibleAttorney] = useState("");
  const [practiceArea, setPracticeArea] = useState("");
  const [parties, setParties] = useState<PartyEntry[]>([
    { entityId: "", entityName: "", role: "client", isNew: false },
  ]);
  const [conflictResults, setConflictResults] = useState<Record<string, SearchResult[]>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetch("/api/entities")
      .then((r) => r.json())
      .then((data) => setEntities(data.entities ?? []))
      .catch(() => {});
  }, []);

  function addParty(role: EntityMatterRole) {
    setParties([...parties, { entityId: "", entityName: "", role, isNew: false }]);
  }

  function removeParty(index: number) {
    setParties(parties.filter((_, i) => i !== index));
  }

  function updateParty(index: number, updates: Partial<PartyEntry>) {
    const updated = [...parties];
    updated[index] = { ...updated[index], ...updates };
    setParties(updated);
  }

  function selectEntity(index: number, entityId: string) {
    const entity = entities.find((e) => e.entityId === entityId);
    updateParty(index, {
      entityId,
      entityName: entity?.fullLegalName ?? "",
      isNew: false,
    });
    // Run conflict check
    if (entity) {
      runConflictCheck(entity.fullLegalName, index);
    }
  }

  function setNewEntity(index: number, name: string, entityType: "person" | "company") {
    updateParty(index, {
      entityId: "",
      entityName: name,
      isNew: true,
      newEntityType: entityType,
    });
    if (name.length >= 2) {
      runConflictCheck(name, index);
    }
  }

  async function runConflictCheck(name: string, partyIndex: number) {
    if (name.length < 2) return;
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: name, searchType: "all" }),
      });
      const data = await res.json();
      setConflictResults((prev) => ({ ...prev, [partyIndex]: data.results ?? [] }));
    } catch {
      // ignore
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validate parties
    const validParties = parties.filter((p) => p.entityId || (p.isNew && p.entityName.trim()));
    if (validParties.length === 0) {
      setError("Add at least one party to this matter");
      return;
    }

    const hasClient = validParties.some((p) => p.role === "client");
    if (!hasClient) {
      setError("At least one party must have the Client role");
      return;
    }

    setSaving(true);

    try {
      // Create any new entities first
      const resolvedParties: Array<{ entityId: string; role: EntityMatterRole }> = [];

      for (const party of validParties) {
        if (party.isNew && party.entityName.trim()) {
          const res = await fetch("/api/entities", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fullLegalName: party.entityName.trim(),
              entityType: party.newEntityType ?? "person",
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            setError(`Failed to create entity "${party.entityName}": ${data.error}`);
            return;
          }
          resolvedParties.push({ entityId: data.entity.entityId, role: party.role });
        } else {
          resolvedParties.push({ entityId: party.entityId, role: party.role });
        }
      }

      // Create the matter
      const res = await fetch("/api/matters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matterName,
          matterNumber: matterNumber || undefined,
          status,
          responsibleAttorney: responsibleAttorney || undefined,
          practiceArea: practiceArea || undefined,
          parties: resolvedParties,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create matter");
        return;
      }

      setSuccess(`Created matter "${matterName}" with ${resolvedParties.length} parties`);
      // Refresh entities list
      fetch("/api/entities")
        .then((r) => r.json())
        .then((data) => setEntities(data.entities ?? []))
        .catch(() => {});
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">New Matter Intake</h1>
      <p className="text-sm text-gray-500 mb-6">
        Enter matter details and all parties. A conflict check runs automatically for each party.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Matter details */}
        <section className="bg-white rounded-lg shadow-sm border p-5 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Matter Details</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Matter Name *
            </label>
            <input
              type="text"
              required
              value={matterName}
              onChange={(e) => setMatterName(e.target.value)}
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
                value={matterNumber}
                onChange={(e) => setMatterNumber(e.target.value)}
                placeholder="2024-001"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as MatterStatus)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
              >
                <option value="open">Open</option>
                <option value="pending">Pending</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Responsible Attorney
              </label>
              <input
                type="text"
                value={responsibleAttorney}
                onChange={(e) => setResponsibleAttorney(e.target.value)}
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
                value={practiceArea}
                onChange={(e) => setPracticeArea(e.target.value)}
                placeholder="Litigation"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>
        </section>

        {/* Parties */}
        <section className="bg-white rounded-lg shadow-sm border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Parties</h2>
          </div>
          <p className="text-xs text-gray-500">
            Add all parties involved. Each party is checked for conflicts automatically.
          </p>

          {parties.map((party, index) => (
            <PartyRow
              key={index}
              index={index}
              party={party}
              entities={entities}
              conflicts={conflictResults[index] ?? []}
              onSelectEntity={(id) => selectEntity(index, id)}
              onSetNewEntity={(name, type) => setNewEntity(index, name, type)}
              onUpdateRole={(role) => updateParty(index, { role })}
              onRemove={parties.length > 1 ? () => removeParty(index) : undefined}
            />
          ))}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => addParty("client")}
              className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
            >
              + Client
            </button>
            <button
              type="button"
              onClick={() => addParty("adverse_party")}
              className="px-3 py-1.5 text-sm bg-red-50 text-red-700 rounded hover:bg-red-100"
            >
              + Adverse Party
            </button>
            <button
              type="button"
              onClick={() => addParty("co_party")}
              className="px-3 py-1.5 text-sm bg-gray-50 text-gray-700 rounded hover:bg-gray-100"
            >
              + Other Party
            </button>
          </div>
        </section>

        {error && (
          <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
        )}
        {success && (
          <div className="p-3 bg-green-50 text-green-700 rounded-md text-sm">
            {success}{" "}
            <button type="button" onClick={() => router.push("/search")} className="underline">
              Run a conflict search
            </button>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create Matter & Parties"}
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

function PartyRow({
  index,
  party,
  entities,
  conflicts,
  onSelectEntity,
  onSetNewEntity,
  onUpdateRole,
  onRemove,
}: {
  index: number;
  party: PartyEntry;
  entities: SearchResult[];
  conflicts: SearchResult[];
  onSelectEntity: (id: string) => void;
  onSetNewEntity: (name: string, type: "person" | "company") => void;
  onUpdateRole: (role: EntityMatterRole) => void;
  onRemove?: () => void;
}) {
  const [mode, setMode] = useState<"select" | "new">(party.isNew ? "new" : "select");
  const [newType, setNewType] = useState<"person" | "company">("person");

  const roleColor = party.role === "client" ? "border-l-blue-500" :
    party.role === "adverse_party" ? "border-l-red-500" : "border-l-gray-400";

  return (
    <div className={`border border-gray-200 rounded-md p-4 border-l-4 ${roleColor} space-y-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <select
            value={party.role}
            onChange={(e) => onUpdateRole(e.target.value as EntityMatterRole)}
            className="px-2 py-1 border border-gray-300 rounded text-sm bg-white font-medium"
          >
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <div className="flex gap-1 text-xs">
            <button
              type="button"
              onClick={() => setMode("select")}
              className={`px-2 py-1 rounded ${mode === "select" ? "bg-gray-200 font-medium" : "text-gray-500 hover:bg-gray-100"}`}
            >
              Existing
            </button>
            <button
              type="button"
              onClick={() => setMode("new")}
              className={`px-2 py-1 rounded ${mode === "new" ? "bg-gray-200 font-medium" : "text-gray-500 hover:bg-gray-100"}`}
            >
              New
            </button>
          </div>
        </div>
        {onRemove && (
          <button type="button" onClick={onRemove} className="text-gray-400 hover:text-red-500 text-sm">
            Remove
          </button>
        )}
      </div>

      {mode === "select" ? (
        <select
          value={party.entityId}
          onChange={(e) => onSelectEntity(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
        >
          <option value="">Select entity...</option>
          {entities.map((entity) => (
            <option key={entity.entityId} value={entity.entityId}>
              {entity.fullLegalName} ({entity.entityType})
            </option>
          ))}
        </select>
      ) : (
        <div className="flex gap-2">
          <select
            value={newType}
            onChange={(e) => {
              setNewType(e.target.value as "person" | "company");
              if (party.entityName) onSetNewEntity(party.entityName, e.target.value as "person" | "company");
            }}
            className="px-2 py-2 border border-gray-300 rounded-md text-sm bg-white"
          >
            <option value="person">Person</option>
            <option value="company">Company</option>
          </select>
          <input
            type="text"
            value={party.entityName}
            onChange={(e) => onSetNewEntity(e.target.value, newType)}
            placeholder="Enter full legal name..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
      )}

      {/* Conflict warnings */}
      {conflicts.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
          <p className="text-xs font-medium text-yellow-800 mb-2">
            Potential conflicts found ({conflicts.length}):
          </p>
          {conflicts.slice(0, 3).map((c) => (
            <div key={c.entityId} className="text-xs text-yellow-700 flex items-center gap-2 mb-1">
              <span className={`w-2 h-2 rounded-full ${
                c.compositeScore >= 0.7 ? "bg-red-500" : c.compositeScore >= 0.4 ? "bg-yellow-500" : "bg-gray-400"
              }`} />
              <span className="font-medium">{c.fullLegalName}</span>
              <span className="text-yellow-600">({(c.compositeScore * 100).toFixed(0)}% match)</span>
              {c.matters.length > 0 && (
                <span className="text-yellow-600">
                  — {c.matters.map((m) => m.matterName).join(", ")}
                </span>
              )}
            </div>
          ))}
          {conflicts.length > 3 && (
            <p className="text-xs text-yellow-600 mt-1">
              +{conflicts.length - 3} more results
            </p>
          )}
        </div>
      )}
    </div>
  );
}
