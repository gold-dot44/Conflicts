"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewEntityPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    fullLegalName: "",
    firstName: "",
    lastName: "",
    entityType: "person" as "person" | "company",
    aliases: [""],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function updateAlias(index: number, value: string) {
    const updated = [...form.aliases];
    updated[index] = value;
    setForm({ ...form, aliases: updated });
  }

  function addAlias() {
    setForm({ ...form, aliases: [...form.aliases, ""] });
  }

  function removeAlias(index: number) {
    setForm({ ...form, aliases: form.aliases.filter((_, i) => i !== index) });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const res = await fetch("/api/entities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          aliases: form.aliases.filter((a) => a.trim()),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create entity");
        return;
      }
      setSuccess(`Created "${data.entity.fullLegalName}" (${data.entity.entityId})`);
      setForm({ fullLegalName: "", firstName: "", lastName: "", entityType: "person", aliases: [""] });
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Add New Entity</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Entity Type
          </label>
          <select
            value={form.entityType}
            onChange={(e) =>
              setForm({ ...form, entityType: e.target.value as "person" | "company" })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
          >
            <option value="person">Person</option>
            <option value="company">Company</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Full Legal Name *
          </label>
          <input
            type="text"
            required
            value={form.fullLegalName}
            onChange={(e) => setForm({ ...form, fullLegalName: e.target.value })}
            placeholder={form.entityType === "person" ? "John Smith" : "Acme Corporation"}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>

        {form.entityType === "person" && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name
              </label>
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name
              </label>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Aliases / Also Known As
          </label>
          {form.aliases.map((alias, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input
                type="text"
                value={alias}
                onChange={(e) => updateAlias(i, e.target.value)}
                placeholder="Alternative name..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              {form.aliases.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeAlias(i)}
                  className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-md text-sm"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addAlias}
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            + Add alias
          </button>
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
            {saving ? "Creating..." : "Create Entity"}
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
