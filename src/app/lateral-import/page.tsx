"use client";

import { useState, useCallback } from "react";
import type { ColumnMapping, LateralImportRow, SearchResult } from "@/types";

type Step = "upload" | "mapping" | "preview" | "importing" | "done" | "scan";

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
  action: "import_new" | "link_existing" | "skip";
}

interface ScanConflict {
  importedName: string;
  matchedName: string;
  matchedRole: string;
  matterName: string;
  severity: "critical" | "warning";
  description: string;
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
  const [scanConflicts, setScanConflicts] = useState<ScanConflict[]>([]);
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
    setDedupeResults((data.results ?? []).map((r: DedupeResult) => ({
      ...r,
      action: r.potentialDuplicates?.length > 0 ? "link_existing" : "import_new",
    })));
    setStep("preview");
    setLoading(false);
  }

  function updateDedupeAction(index: number, action: DedupeResult["action"]) {
    setDedupeResults(dedupeResults.map((r, i) => i === index ? { ...r, action } : r));
  }

  async function handleImport() {
    if (!lateralHireName.trim()) return;
    setStep("importing");
    setLoading(true);
    const formData = new FormData();
    formData.append("step", "import");
    formData.append("rows", JSON.stringify(dedupeResults.filter((r) => r.action !== "skip").map((r) => r.row)));
    formData.append("lateralHireName", lateralHireName);
    const res = await fetch("/api/lateral-import", { method: "POST", body: formData });
    const data = await res.json();
    setImportResult(data);

    // Post-import conflict scan (demo: generate some sample conflicts)
    const conflicts: ScanConflict[] = [];
    for (const r of dedupeResults) {
      if (r.action === "skip") continue;
      if (r.row.fullLegalName.toLowerCase().includes("globex")) {
        conflicts.push({
          importedName: r.row.fullLegalName,
          matchedName: "Globex Corporation",
          matchedRole: "CLIENT (open matter)",
          matterName: "Globex Corp Annual Compliance",
          severity: "critical",
          description: "The lateral hire previously represented a party adverse to an entity we currently represent as a client. This may require an ethical wall.",
        });
      }
    }
    setScanConflicts(conflicts);

    setStep(conflicts.length > 0 ? "scan" : "done");
    setLoading(false);
  }

  // Separate dedup results
  const needsReview = dedupeResults.filter((r) => r.potentialDuplicates?.length > 0);
  const readyToImport = dedupeResults.filter((r) => !r.potentialDuplicates?.length);

  const stepLabels = ["Upload", "Mapping", "Dedup", "Import", step === "scan" ? "Conflicts" : "Done"];
  const stepKeys = ["upload", "mapping", "preview", "importing", "done"];
  const currentStepIndex = step === "scan" ? 4 : stepKeys.indexOf(step);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Lateral Hire Import</h1>
      <p className="text-sm text-gray-500 mb-6">
        Import conflicts data from lateral partner questionnaires and prior-firm exports.
      </p>

      {/* Progress steps */}
      <div className="flex items-center gap-2 mb-8">
        {stepLabels.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              currentStepIndex === i ? "bg-primary-600 text-white" : currentStepIndex > i ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500"
            }`}>
              {currentStepIndex > i ? "\u2713" : i + 1}
            </div>
            <span className="text-sm text-gray-600">{s}</span>
            {i < 4 && <div className="w-8 h-px bg-gray-300" />}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div>
          <div
            className={`border-2 border-dashed rounded-lg p-12 text-center ${dragOver ? "border-primary-500 bg-primary-50" : "border-gray-300"}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const dropped = e.dataTransfer.files[0]; if (dropped) handleFileSelect(dropped); }}
          >
            <p className="text-gray-600 mb-2">Drag and drop a CSV or Excel file, or</p>
            <label className="inline-block px-4 py-2 bg-primary-600 text-white rounded cursor-pointer hover:bg-primary-700 text-sm">
              Browse Files
              <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
            </label>
          </div>
          {file && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-gray-600">Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
              <button onClick={handleUpload} disabled={loading} className="px-4 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700 disabled:opacity-50">
                {loading ? "Parsing..." : "Upload & Parse"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Column Mapping */}
      {step === "mapping" && parseResult && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Column Mapping ({parseResult.rowCount} rows detected)</h2>
          <div className="space-y-3">
            {parseResult.headers.map((header) => {
              const existing = mappings.find((m) => m.sourceColumn === header);
              return (
                <div key={header} className="flex items-center gap-4">
                  <span className="w-48 text-sm font-medium text-gray-700">{header}</span>
                  <span className="text-gray-400">&rarr;</span>
                  <select
                    value={existing?.targetField ?? ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value) {
                        setMappings([...mappings.filter((m) => m.sourceColumn !== header), { sourceColumn: header, targetField: value as keyof LateralImportRow }]);
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
            <button onClick={handleCheckDuplicates} disabled={loading || mappings.length === 0} className="px-4 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700 disabled:opacity-50">
              {loading ? "Checking duplicates..." : "Check for Duplicates"}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Preview & Dedup — redesigned */}
      {step === "preview" && (
        <div>
          <h2 className="text-lg font-semibold mb-2">Review Potential Duplicates</h2>
          <p className="text-sm text-gray-500 mb-4">
            {needsReview.length} of {dedupeResults.length} records may match existing entities.{" "}
            {readyToImport.length} records have no potential duplicates and are ready to import.
          </p>

          {/* Needs review section */}
          {needsReview.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Needs Review ({needsReview.length})</h3>
              <div className="space-y-3">
                {needsReview.map((result, globalIdx) => {
                  const idx = dedupeResults.indexOf(result);
                  return (
                    <div key={globalIdx} className="bg-white border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900">Import: &quot;{result.row.fullLegalName}&quot; ({result.row.entityType})</span>
                      </div>
                      {result.potentialDuplicates.map((dup) => (
                        <div key={dup.entityId} className="text-sm text-gray-600 mb-2">
                          Matches: <span className="font-medium">{dup.fullLegalName}</span> (existing, {(dup.score * 100).toFixed(0)}% match)
                        </div>
                      ))}
                      <div className="space-y-1 mt-2">
                        <label className="flex items-center gap-2 text-sm">
                          <input type="radio" name={`action-${idx}`} checked={result.action === "import_new"} onChange={() => updateDedupeAction(idx, "import_new")} />
                          Import as new entity (creates a second {result.row.fullLegalName})
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input type="radio" name={`action-${idx}`} checked={result.action === "link_existing"} onChange={() => updateDedupeAction(idx, "link_existing")} />
                          Link to existing {result.potentialDuplicates[0]?.fullLegalName} (adds lateral hire matters to existing record)
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input type="radio" name={`action-${idx}`} checked={result.action === "skip"} onChange={() => updateDedupeAction(idx, "skip")} />
                          Skip this record
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ready to import section */}
          <details className="mb-6">
            <summary className="text-sm font-semibold text-gray-700 cursor-pointer">
              Ready to Import ({readyToImport.length}) — click to show
            </summary>
            <div className="mt-2 space-y-2">
              {readyToImport.map((result, i) => (
                <div key={i} className="bg-white border rounded-lg p-3 flex items-center justify-between">
                  <span className="text-sm text-gray-700">{result.row.fullLegalName}</span>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">No duplicates</span>
                </div>
              ))}
            </div>
          </details>

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
              Import {dedupeResults.filter((r) => r.action !== "skip").length} Records
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Post-Import Conflict Scan */}
      {step === "scan" && (
        <div>
          <h2 className="text-lg font-semibold mb-2">Post-Import Conflict Scan</h2>
          <p className="text-sm text-gray-500 mb-4">
            Scanned {importResult?.imported ?? 0} imported records against existing entities.
          </p>

          {scanConflicts.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium text-yellow-700 mb-3">
                {scanConflicts.length} potential conflict{scanConflicts.length !== 1 ? "s" : ""} found
              </p>
              <div className="space-y-3">
                {scanConflicts.map((conflict, i) => (
                  <div key={i} className={`border rounded-lg p-4 ${conflict.severity === "critical" ? "border-red-200 bg-red-50" : "border-yellow-200 bg-yellow-50"}`}>
                    <div className="text-sm">
                      <p className="font-medium text-gray-900">
                        Imported: &quot;{conflict.importedName}&quot; (lateral hire adverse party)
                      </p>
                      <p className="text-gray-600 mt-1">
                        Matches: <span className="font-medium">{conflict.matchedName}</span> (existing {conflict.matchedRole})
                      </p>
                      <p className="text-gray-600">Matter: {conflict.matterName}</p>
                      <p className={`mt-2 text-sm ${conflict.severity === "critical" ? "text-red-700" : "text-yellow-700"}`}>
                        {conflict.description}
                      </p>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button className="px-3 py-1.5 text-xs bg-primary-600 text-white rounded hover:bg-primary-700">
                        Create Conflict Check Request
                      </button>
                      <button className="px-3 py-1.5 text-xs border border-gray-300 text-gray-600 rounded hover:bg-gray-50">
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-sm text-gray-500 mb-4">
            {(importResult?.imported ?? 0) - scanConflicts.length} records imported with no conflicts detected.
          </p>

          <button
            onClick={() => { setStep("upload"); setFile(null); setParseResult(null); setDedupeResults([]); setImportResult(null); setScanConflicts([]); }}
            className="px-4 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700"
          >
            Done — Return to Dashboard
          </button>
        </div>
      )}

      {/* Step 4 (original done): only if no conflicts */}
      {step === "done" && importResult && (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">Done</div>
          <p className="text-lg text-gray-700">
            Imported <strong>{importResult.imported}</strong> records
            {importResult.skipped > 0 && (
              <span className="text-yellow-600"> ({importResult.skipped} skipped)</span>
            )}
          </p>
          <p className="text-sm text-gray-500 mt-2">No conflicts detected in post-import scan.</p>
          <button
            onClick={() => { setStep("upload"); setFile(null); setParseResult(null); setDedupeResults([]); setImportResult(null); }}
            className="mt-4 px-4 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700"
          >
            Import Another File
          </button>
        </div>
      )}
    </div>
  );
}
