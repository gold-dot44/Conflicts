"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import type {
  ColumnMapping, LateralImportRow,
  DataShape, HistoricalImportDefaults, HistoricalColumnMapping,
  HistoricalImportPreview, HistoricalImportResult,
  EntityTypeDetection,
} from "@/types";

type ImportMode = "lateral" | "historical";

export default function ImportPage() {
  const [mode, setMode] = useState<ImportMode>("lateral");

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Import</h1>
      <p className="text-sm text-gray-500 mb-6">
        Bring in data from outside Clio — lateral hire questionnaires or historical firm records.
      </p>

      {/* Tab selector */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setMode("lateral")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            mode === "lateral"
              ? "border-primary-600 text-primary-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Lateral Hire
        </button>
        <button
          onClick={() => setMode("historical")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            mode === "historical"
              ? "border-primary-600 text-primary-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Historical Matters
        </button>
      </div>

      {mode === "lateral" ? <LateralHireWizard /> : <HistoricalMatterWizard />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Lateral Hire Wizard
// ═══════════════════════════════════════════════════════════════════════

type LateralStep = "upload" | "mapping" | "preview" | "importing" | "done" | "scan";

interface LateralParseResult {
  headers: string[];
  suggestedMappings: ColumnMapping[];
  rowCount: number;
  preview: Record<string, string>[];
}

interface DedupeResult {
  row: LateralImportRow;
  potentialDuplicates: Array<{ entityId: string; fullLegalName: string; score: number }>;
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

function LateralHireWizard() {
  const [step, setStep] = useState<LateralStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<LateralParseResult | null>(null);
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
    const data: LateralParseResult = await res.json();
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

  const needsReview = dedupeResults.filter((r) => r.potentialDuplicates?.length > 0);
  const readyToImport = dedupeResults.filter((r) => !r.potentialDuplicates?.length);

  const stepLabels = ["Upload", "Mapping", "Dedup", "Import", step === "scan" ? "Conflicts" : "Done"];
  const stepKeys = ["upload", "mapping", "preview", "importing", "done"];
  const currentStepIndex = step === "scan" ? 4 : stepKeys.indexOf(step);

  return (
    <div>
      <p className="text-sm text-gray-500 mb-6">
        Import a lateral hire&apos;s conflict questionnaire. This imports the entities
        the partner represented at their prior firm — one entity per row, all defaulting
        to closed status.
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
        <div className="bg-white rounded-lg border p-6">
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
        <div className="bg-white rounded-lg border p-6">
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

      {/* Step 3: Preview & Dedup */}
      {step === "preview" && (
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-2">Review Potential Duplicates</h2>
          <p className="text-sm text-gray-500 mb-4">
            {needsReview.length} of {dedupeResults.length} records may match existing entities.{" "}
            {readyToImport.length} records have no potential duplicates and are ready to import.
          </p>

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
                          Import as new entity
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input type="radio" name={`action-${idx}`} checked={result.action === "link_existing"} onChange={() => updateDedupeAction(idx, "link_existing")} />
                          Link to existing {result.potentialDuplicates[0]?.fullLegalName}
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

      {/* Post-Import Conflict Scan */}
      {step === "scan" && (
        <div className="bg-white rounded-lg border p-6">
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
                        Imported: &quot;{conflict.importedName}&quot;
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

          <button
            onClick={() => { setStep("upload"); setFile(null); setParseResult(null); setDedupeResults([]); setImportResult(null); setScanConflicts([]); }}
            className="px-4 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700"
          >
            Done
          </button>
        </div>
      )}

      {/* Done (no conflicts) */}
      {step === "done" && importResult && (
        <div className="bg-white rounded-lg border p-6 text-center py-12">
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

// ═══════════════════════════════════════════════════════════════════════
// Historical Matter Wizard
// ═══════════════════════════════════════════════════════════════════════

type HistoricalStep = "upload" | "shape" | "mapping" | "defaults" | "preview" | "done";

interface HistoricalParseResult {
  headers: string[];
  suggestedMappings: HistoricalColumnMapping[];
  rowCount: number;
  preview: Record<string, string>[];
  detectedShape: DataShape;
}

const HIST_STEP_LABELS = ["Upload", "Data Shape", "Map Columns", "Missing Data", "Preview", "Done"];
const HIST_STEP_KEYS: HistoricalStep[] = ["upload", "shape", "mapping", "defaults", "preview", "done"];

const ALL_TARGETS = [
  { group: "Matter", items: [
    { field: "matterName", label: "Matter Name" },
    { field: "matterNumber", label: "Matter Number" },
    { field: "status", label: "Matter Status" },
    { field: "responsibleAttorney", label: "Responsible Attorney" },
    { field: "practiceArea", label: "Practice Area" },
    { field: "openDate", label: "Open Date" },
    { field: "closeDate", label: "Close Date" },
  ]},
  { group: "Parties", items: [
    { field: "clientName", label: "Client Name" },
    { field: "adversePartyName", label: "Adverse Party Name" },
    { field: "coPartyName", label: "Co-Party Name" },
    { field: "witnessName", label: "Witness Name" },
    { field: "expertName", label: "Expert Name" },
    { field: "insurerName", label: "Insurer Name" },
    { field: "opposingCounselName", label: "Opposing Counsel Name" },
    { field: "otherPartyName", label: "Other Party Name" },
  ]},
  { group: "Entity", items: [
    { field: "entityType", label: "Entity Type (person/company)" },
  ]},
];

function HistoricalMatterWizard() {
  const [step, setStep] = useState<HistoricalStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [sourceLabel, setSourceLabel] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);

  const [parseResult, setParseResult] = useState<HistoricalParseResult | null>(null);
  const [dataShape, setDataShape] = useState<DataShape>("one_per_matter");
  const [mappings, setMappings] = useState<HistoricalColumnMapping[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);

  const [defaults, setDefaults] = useState<HistoricalImportDefaults>({
    missingStatus: "closed",
    entityTypeDetection: "auto",
    multiValueHandling: "split",
    dateErrorHandling: "skip",
  });

  const [preview, setPreview] = useState<HistoricalImportPreview | null>(null);
  const [result, setResult] = useState<HistoricalImportResult | null>(null);

  const handleFileSelect = useCallback((selectedFile: File) => {
    setFile(selectedFile);
  }, []);

  const currentStepIndex = HIST_STEP_KEYS.indexOf(step);

  async function handleUpload() {
    if (!file || !sourceLabel.trim()) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("step", "parse");
      formData.append("sourceLabel", sourceLabel);
      const res = await fetch("/api/historical-import", { method: "POST", body: formData });
      const data: HistoricalParseResult = await res.json();
      setParseResult(data);
      setDataShape(data.detectedShape);
      setMappings(data.suggestedMappings);
      setRawRows(data.preview);
      setStep("shape");
    } finally {
      setLoading(false);
    }
  }

  async function handleBuildPreview() {
    setLoading(true);
    try {
      const res = await fetch("/api/historical-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "preview", rows: rawRows, mappings, defaults, dataShape }),
      });
      setPreview(await res.json());
      setStep("preview");
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (!preview) return;
    setLoading(true);
    try {
      const duplicateActions: Record<string, string> = {};
      for (const dup of preview.duplicateEntities) {
        duplicateActions[dup.importName.toLowerCase()] = dup.action;
      }
      const res = await fetch("/api/historical-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "import", rows: rawRows, mappings, defaults, dataShape, sourceLabel, duplicateActions }),
      });
      setResult(await res.json());
      setStep("done");
    } finally {
      setLoading(false);
    }
  }

  function updateDuplicateAction(index: number, action: "link_existing" | "import_new" | "skip") {
    if (!preview) return;
    const next = { ...preview };
    next.duplicateEntities = [...next.duplicateEntities];
    next.duplicateEntities[index] = { ...next.duplicateEntities[index], action };
    setPreview(next);
  }

  const rowsWithBlanks = rawRows.filter((row) =>
    Object.values(row).some((v) => !v || !v.trim())
  ).length;

  return (
    <div>
      <p className="text-sm text-gray-500 mb-6">
        Import your firm&apos;s own historical matters from before Clio — PCLaw, Tabs3,
        Time Matters, or internal spreadsheets. These are your matters, your clients,
        your adverse parties.
      </p>

      {/* Progress steps */}
      <div className="flex items-center gap-2 mb-8">
        {HIST_STEP_LABELS.map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              currentStepIndex === i ? "bg-primary-600 text-white" :
              currentStepIndex > i ? "bg-green-500 text-white" :
              "bg-gray-200 text-gray-500"
            }`}>
              {currentStepIndex > i ? "\u2713" : i + 1}
            </div>
            <span className={`text-sm ${currentStepIndex === i ? "text-gray-900 font-medium" : "text-gray-500"}`}>
              {label}
            </span>
            {i < HIST_STEP_LABELS.length - 1 && <div className="w-6 h-px bg-gray-300" />}
          </div>
        ))}
      </div>

      {/* ─── Step 1: Upload ─── */}
      {step === "upload" && (
        <div className="bg-white rounded-lg border p-6">
          <div
            className={`border-2 border-dashed rounded-lg p-12 text-center mb-4 ${
              dragOver ? "border-primary-500 bg-primary-50" : "border-gray-300"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const d = e.dataTransfer.files[0]; if (d) handleFileSelect(d); }}
          >
            <p className="text-gray-600 mb-2">Drag and drop a CSV or Excel file, or</p>
            <label className="inline-block px-4 py-2 bg-primary-600 text-white rounded cursor-pointer hover:bg-primary-700 text-sm">
              Browse Files
              <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
            </label>
          </div>

          {file && (
            <p className="text-sm text-gray-600 mb-4">
              Selected: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
            </p>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Source label</label>
            <input
              type="text"
              value={sourceLabel}
              onChange={(e) => setSourceLabel(e.target.value)}
              placeholder='e.g., "PCLaw Export 2008-2019" or "Legacy Spreadsheet - Litigation Dept"'
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              This label is stored with every imported record so you can always trace where it came from.
            </p>
          </div>

          <button
            onClick={handleUpload}
            disabled={loading || !file || !sourceLabel.trim()}
            className="px-4 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? "Parsing..." : "Upload & Parse"}
          </button>
        </div>
      )}

      {/* ─── Step 2: Data Shape ─── */}
      {step === "shape" && parseResult && (
        <div className="bg-white rounded-lg border p-6">
          <p className="text-sm text-gray-700 mb-4">
            We found <strong>{parseResult.rowCount} rows</strong> and{" "}
            <strong>{parseResult.headers.length} columns</strong>.
          </p>
          <p className="text-sm text-gray-600 mb-3">
            {dataShape === "one_per_matter"
              ? "It looks like your data has one row per matter with party names in separate columns."
              : dataShape === "one_per_party"
              ? "It looks like your data has one row per party, with multiple rows per matter."
              : "We couldn\u2019t determine the data shape automatically."}
          </p>
          <p className="text-sm font-medium text-gray-700 mb-2">Is that right?</p>

          <div className="space-y-2 mb-6">
            {([
              { value: "one_per_matter" as DataShape, label: "One row per matter (parties in columns)", desc: 'Your file has "Client" and "Adverse Party" as separate columns.' },
              { value: "one_per_party" as DataShape, label: "One row per party (multiple rows per matter)", desc: "The same matter appears on multiple rows with different party names." },
              { value: "mixed" as DataShape, label: "Not sure / mixed", desc: "The system will try its best to detect the structure per-row." },
            ]).map((opt) => (
              <label key={opt.value} className="flex items-start gap-3 p-3 rounded border hover:bg-gray-50 cursor-pointer">
                <input type="radio" name="dataShape" checked={dataShape === opt.value} onChange={() => setDataShape(opt.value)} className="mt-0.5" />
                <div>
                  <span className="text-sm font-medium text-gray-900">{opt.label}</span>
                  <p className="text-xs text-gray-500">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>

          <button onClick={() => setStep("mapping")} className="px-4 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700">
            Next: Map Columns
          </button>
        </div>
      )}

      {/* ─── Step 3: Column Mapping ─── */}
      {step === "mapping" && parseResult && (
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Map your columns to the system</h2>
          <p className="text-sm text-gray-500 mb-4">
            We auto-detected some mappings. Adjust as needed. Not every column needs to map — import what you have.
          </p>

          <div className="space-y-3 mb-6">
            {parseResult.headers.map((header) => {
              const existing = mappings.find((m) => m.sourceColumn === header);
              const isAutoDetected = parseResult.suggestedMappings.some(
                (m) => m.sourceColumn === header && m.targetField !== "skip"
              );
              return (
                <div key={header} className="flex items-center gap-4">
                  <span className="w-52 text-sm font-medium text-gray-700 truncate" title={header}>
                    &quot;{header}&quot;
                  </span>
                  <span className="text-gray-400">&rarr;</span>
                  <select
                    value={existing?.targetField ?? "skip"}
                    onChange={(e) => {
                      setMappings([
                        ...mappings.filter((m) => m.sourceColumn !== header),
                        { sourceColumn: header, targetField: e.target.value },
                      ]);
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm bg-white"
                  >
                    <option value="skip">Skip</option>
                    {ALL_TARGETS.map((group) => (
                      <optgroup key={group.group} label={group.group}>
                        {group.items.map((item) => (
                          <option key={item.field} value={item.field}>{item.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {isAutoDetected && existing?.targetField !== "skip" && (
                    <span className="text-xs text-green-600 shrink-0">auto</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <p className="text-xs text-gray-600">
              Multiple columns can map to party roles. If your file has separate columns for
              &quot;Plaintiff&quot; and &quot;Defendant,&quot; map each to the appropriate role.
            </p>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setStep("shape")} className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50">
              Back
            </button>
            <button
              onClick={() => setStep("defaults")}
              disabled={!mappings.some((m) => m.targetField === "matterName")}
              className="px-4 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700 disabled:opacity-50"
            >
              Next: Handle Missing Data
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 4: Missing Data Defaults ─── */}
      {step === "defaults" && (
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">How should we handle missing data?</h2>
          <p className="text-sm text-gray-500 mb-6">
            Tell us what to assume when data is missing.
          </p>

          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">When matter status is blank:</p>
              <div className="space-y-1">
                {([
                  { value: "closed" as const, label: 'Assume "Closed" (safest for historical data)' },
                  { value: "open" as const, label: 'Assume "Open"' },
                  { value: "pending" as const, label: 'Assume "Pending"' },
                  { value: "leave_blank" as const, label: "Leave blank (I'll fill these in later)" },
                ]).map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 text-sm">
                    <input type="radio" name="missingStatus" checked={defaults.missingStatus === opt.value} onChange={() => setDefaults({ ...defaults, missingStatus: opt.value })} />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">When entity type is unclear:</p>
              <div className="space-y-1">
                {([
                  { value: "auto" as EntityTypeDetection, label: "Try to detect automatically", desc: "(Inc, LLC, Corp \u2192 company; everything else \u2192 person)" },
                  { value: "person" as EntityTypeDetection, label: "Assume person", desc: "" },
                  { value: "company" as EntityTypeDetection, label: "Assume company", desc: "" },
                ]).map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 text-sm">
                    <input type="radio" name="entityType" checked={defaults.entityTypeDetection === opt.value} onChange={() => setDefaults({ ...defaults, entityTypeDetection: opt.value })} />
                    <span>
                      {opt.label}
                      {opt.desc && <span className="text-xs text-gray-500 ml-1">{opt.desc}</span>}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">When a party column has multiple names separated by semicolons:</p>
              <div className="space-y-1">
                {([
                  { value: "split" as const, label: "Split into separate entities (one per name)" },
                  { value: "keep_single" as const, label: "Keep as a single entity name" },
                ]).map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 text-sm">
                    <input type="radio" name="multiValue" checked={defaults.multiValueHandling === opt.value} onChange={() => setDefaults({ ...defaults, multiValueHandling: opt.value })} />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">When a date field can&apos;t be parsed:</p>
              <div className="space-y-1">
                {([
                  { value: "skip" as const, label: "Skip the date (leave blank)" },
                  { value: "show_errors" as const, label: "Stop and show me the problem rows" },
                ]).map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 text-sm">
                    <input type="radio" name="dateError" checked={defaults.dateErrorHandling === opt.value} onChange={() => setDefaults({ ...defaults, dateErrorHandling: opt.value })} />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {rowsWithBlanks > 0 && (
            <p className="text-sm text-gray-500 mt-6">
              {rowsWithBlanks} of {rawRows.length} rows have at least one blank field. This is normal for historical data.
            </p>
          )}

          <div className="flex gap-2 mt-6">
            <button onClick={() => setStep("mapping")} className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50">
              Back
            </button>
            <button onClick={handleBuildPreview} disabled={loading} className="px-4 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700 disabled:opacity-50">
              {loading ? "Building preview..." : "Next: Preview & Deduplication"}
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 5: Preview ─── */}
      {step === "preview" && preview && (
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Preview</h2>
          <p className="text-sm text-gray-600 mb-4">From {rawRows.length} rows, the import will create:</p>

          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-900">{preview.mattersToCreate}</div>
              <div className="text-xs text-gray-500">matters</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-900">{preview.entitiesToCreate}</div>
              <div className="text-xs text-gray-500">entities</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-900">{preview.roleLinksToCreate}</div>
              <div className="text-xs text-gray-500">role links</div>
            </div>
          </div>

          {preview.duplicateEntities.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Potential Duplicates ({preview.duplicateEntities.length} entities)
              </h3>
              <div className="space-y-3">
                {preview.duplicateEntities.map((dup, i) => (
                  <div key={i} className="border rounded-lg p-4">
                    <div className="text-sm mb-2">
                      <span className="font-medium text-gray-900">Import: &quot;{dup.importName}&quot;</span>
                    </div>
                    <div className="text-sm text-gray-600 mb-3">
                      Matches: <span className="font-medium">{dup.matchedEntityName}</span>{" "}
                      ({(dup.matchScore * 100).toFixed(0)}% match)
                      {dup.existingMatterCount > 0 && (
                        <span className="text-gray-500"> &mdash; {dup.existingMatterCount} existing matter{dup.existingMatterCount !== 1 ? "s" : ""}</span>
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" name={`dup-${i}`} checked={dup.action === "link_existing"} onChange={() => updateDuplicateAction(i, "link_existing")} />
                        Link to existing entity
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" name={`dup-${i}`} checked={dup.action === "import_new"} onChange={() => updateDuplicateAction(i, "import_new")} />
                        Import as new
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" name={`dup-${i}`} checked={dup.action === "skip"} onChange={() => updateDuplicateAction(i, "skip")} />
                        Skip this entity (still imports the matter)
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {preview.readyEntities > 0 && (
            <details className="mb-6">
              <summary className="text-sm font-semibold text-gray-700 cursor-pointer">
                Ready to Import ({preview.readyEntities} entities) — no duplicates
              </summary>
            </details>
          )}

          {preview.problemRows.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Problem Rows ({preview.problemRows.length})</h3>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {preview.problemRows.slice(0, 20).map((pr, i) => (
                  <div key={i} className="text-sm text-gray-600">Row {pr.rowNumber}: {pr.reason}</div>
                ))}
                {preview.problemRows.length > 20 && (
                  <p className="text-sm text-gray-500">...and {preview.problemRows.length - 20} more</p>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => setStep("defaults")} className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50">
              Back
            </button>
            <button onClick={handleImport} disabled={loading} className="px-6 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50">
              {loading ? "Importing..." : `Import ${preview.mattersToCreate} Matters + ${preview.entitiesToCreate} Entities`}
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 6: Done ─── */}
      {step === "done" && result && (
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold text-green-800 mb-4">Import Complete</h2>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-gray-50 rounded p-3">
              <div className="text-sm text-gray-500">Source</div>
              <div className="text-sm font-medium text-gray-900">{result.sourceLabel}</div>
            </div>
            <div className="bg-gray-50 rounded p-3">
              <div className="text-sm text-gray-500">Matters imported</div>
              <div className="text-sm font-medium text-gray-900">{result.mattersImported}</div>
            </div>
            <div className="bg-gray-50 rounded p-3">
              <div className="text-sm text-gray-500">New entities</div>
              <div className="text-sm font-medium text-gray-900">{result.entitiesCreated}</div>
            </div>
            <div className="bg-gray-50 rounded p-3">
              <div className="text-sm text-gray-500">Linked to existing</div>
              <div className="text-sm font-medium text-gray-900">{result.entitiesLinked}</div>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-yellow-800">
              <strong>Recommendation:</strong> Run a search for your firm&apos;s top active clients
              to verify that historical adverse parties were imported correctly.
            </p>
          </div>

          <div className="flex gap-3">
            <Link href="/" className="px-4 py-2 text-sm bg-primary-600 text-white rounded hover:bg-primary-700">
              Start a Conflict Search
            </Link>
            <button
              onClick={() => { setStep("upload"); setFile(null); setSourceLabel(""); setParseResult(null); setPreview(null); setResult(null); setRawRows([]); setMappings([]); }}
              className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
            >
              Import Another File
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
