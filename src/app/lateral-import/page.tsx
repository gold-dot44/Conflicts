"use client";

import { useState, useCallback } from "react";
import type { ColumnMapping, LateralImportRow } from "@/types";

type Step = "upload" | "mapping" | "preview" | "importing" | "done";

interface ParseResult {
  headers: string[];
  suggestedMappings: ColumnMapping[];
  rowCount: number;
  preview: Record<string, string>[];
}

interface DedupeResult {
  row: LateralImportRow;
  potentialDuplicates: Array<{
    entityId: string;
    fullLegalName: string;
    score: number;
  }>;
}

export default function LateralImportPage() {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [dedupeResults, setDedupeResults] = useState<DedupeResult[]>([]);
  const [lateralHireName, setLateralHireName] = useState("");
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFileSelect = useCallback((selectedFile: File) => {
    setFile(selectedFile);
  }, []);

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("step", "parse");

    const res = await fetch("/api/lateral-import", { method: "POST", body: formData });
    const data: ParseResult = await res.json();

    setParseResult(data);
    setMappings(data.suggestedMappings);
    setRawRows(data.preview);
    setStep("mapping");
    setLoading(false);
  }

  async function handleCheckDuplicates() {
    setLoading(true);
    const formData = new FormData();
    formData.append("step", "deduplicate");
    formData.append("mappings", JSON.stringify(mappings));
    formData.append("rows", JSON.stringify(rawRows));

    const res = await fetch("/api/lateral-import", { method: "POST", body: formData });
    const data = await res.json();

    setDedupeResults(data.results);
    setStep("preview");
    setLoading(false);
  }

  async function handleImport() {
    if (!lateralHireName.trim()) return;
    setStep("importing");
    setLoading(true);

    const formData = new FormData();
    formData.append("step", "import");
    formData.append("rows", JSON.stringify(dedupeResults.map((r) => r.row)));
    formData.append("lateralHireName", lateralHireName);

    const res = await fetch("/api/lateral-import", { method: "POST", body: formData });
    const data = await res.json();

    setImportResult(data);
    setStep("done");
    setLoading(false);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Lateral Hire Import</h1>
      <p className="text-sm text-gray-500 mb-6">
        Import conflicts data from lateral partner questionnaires and prior-firm exports.
      </p>

      {/* Progress steps */}
      <div className="flex items-center gap-2 mb-8">
        {(["upload", "mapping", "preview", "done"] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === s
                  ? "bg-primary-600 text-white"
                  : ["upload", "mapping", "preview", "done"].indexOf(step) > i
                  ? "bg-green-500 text-white"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {i + 1}
            </div>
            <span className="text-sm text-gray-600 capitalize">{s}</span>
            {i < 3 && <div className="w-8 h-px bg-gray-300" />}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div>
          <div
            className={`border-2 border-dashed rounded-lg p-12 text-center ${
              dragOver ? "border-primary-500 bg-primary-50" : "border-gray-300"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const dropped = e.dataTransfer.files[0];
              if (dropped) handleFileSelect(dropped);
            }}
          >
            <p className="text-gray-600 mb-2">
              Drag and drop a CSV or Excel file, or
            </p>
            <label className="inline-block px-4 py-2 bg-primary-600 text-white rounded cursor-pointer hover:bg-primary-700 text-sm">
              Browse Files
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelect(f);
                }}
              />
            </label>
          </div>
          {file && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-gray-600">
                Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </span>
              <button
                onClick={handleUpload}
                disabled={loading}
                className="px-4 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700 disabled:opacity-50"
              >
                {loading ? "Parsing..." : "Upload & Parse"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Column Mapping */}
      {step === "mapping" && parseResult && (
        <div>
          <h2 className="text-lg font-semibold mb-4">
            Column Mapping ({parseResult.rowCount} rows detected)
          </h2>
          <div className="space-y-3">
            {parseResult.headers.map((header) => {
              const existing = mappings.find((m) => m.sourceColumn === header);
              return (
                <div key={header} className="flex items-center gap-4">
                  <span className="w-48 text-sm font-medium text-gray-700">
                    {header}
                  </span>
                  <span className="text-gray-400">&rarr;</span>
                  <select
                    value={existing?.targetField ?? ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value) {
                        setMappings([
                          ...mappings.filter((m) => m.sourceColumn !== header),
                          { sourceColumn: header, targetField: value as keyof LateralImportRow },
                        ]);
                      } else {
                        setMappings(mappings.filter((m) => m.sourceColumn !== header));
                      }
                    }}
                    className="px-3 py-2 border border-gray-300 rounded text-sm bg-white"
                  >
                    <option value="">Skip column</option>
                    <option value="fullLegalName">Full Legal Name</option>
                    <option value="firstName">First Name</option>
                    <option value="lastName">Last Name</option>
                    <option value="entityType">Entity Type</option>
                    <option value="matterName">Matter Name</option>
                    <option value="role">Role</option>
                    <option value="notes">Notes</option>
                  </select>
                </div>
              );
            })}
          </div>
          <div className="mt-6">
            <button
              onClick={handleCheckDuplicates}
              disabled={loading || mappings.length === 0}
              className="px-4 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? "Checking duplicates..." : "Check for Duplicates"}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Preview & Deduplication */}
      {step === "preview" && (
        <div>
          <h2 className="text-lg font-semibold mb-4">
            Preview & Deduplication
          </h2>
          <div className="space-y-3 mb-6">
            {dedupeResults.map((result, i) => (
              <div key={i} className="bg-white border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{result.row.fullLegalName}</span>
                  {result.potentialDuplicates.length > 0 ? (
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                      {result.potentialDuplicates.length} potential duplicate(s)
                    </span>
                  ) : (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                      No duplicates
                    </span>
                  )}
                </div>
                {result.potentialDuplicates.length > 0 && (
                  <div className="mt-2 text-sm text-gray-600">
                    {result.potentialDuplicates.map((dup) => (
                      <div key={dup.entityId} className="flex items-center gap-2">
                        <span>Matches: {dup.fullLegalName}</span>
                        <span className="text-xs text-gray-400">
                          ({(dup.score * 100).toFixed(0)}% match)
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              value={lateralHireName}
              onChange={(e) => setLateralHireName(e.target.value)}
              placeholder="Lateral hire name (e.g., John Smith)"
              className="px-3 py-2 border border-gray-300 rounded text-sm flex-1"
            />
            <button
              onClick={handleImport}
              disabled={loading || !lateralHireName.trim()}
              className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
            >
              Confirm & Import
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Done */}
      {step === "done" && importResult && (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">Done</div>
          <p className="text-lg text-gray-700">
            Imported <strong>{importResult.imported}</strong> records
            {importResult.skipped > 0 && (
              <span className="text-yellow-600">
                {" "}({importResult.skipped} skipped)
              </span>
            )}
          </p>
          <button
            onClick={() => {
              setStep("upload");
              setFile(null);
              setParseResult(null);
              setDedupeResults([]);
              setImportResult(null);
            }}
            className="mt-4 px-4 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700"
          >
            Import Another File
          </button>
        </div>
      )}
    </div>
  );
}
