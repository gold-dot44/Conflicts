"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import type {
  DataShape, HistoricalImportDefaults, HistoricalColumnMapping,
  HistoricalImportPreview, HistoricalImportResult,
  MissingStatusDefault, EntityTypeDetection, MultiValueHandling,
  DateErrorHandling, EntityMatterRole,
} from "@/types";

type Step = "upload" | "shape" | "mapping" | "defaults" | "preview" | "done";

interface ParseResult {
  headers: string[];
  suggestedMappings: HistoricalColumnMapping[];
  rowCount: number;
  preview: Record<string, string>[];
  detectedShape: DataShape;
}

const STEP_LABELS = ["Upload", "Data Shape", "Map Columns", "Missing Data", "Preview", "Done"];
const STEP_KEYS: Step[] = ["upload", "shape", "mapping", "defaults", "preview", "done"];

// --- Mapping targets ---

const MATTER_TARGETS = [
  { field: "matterName", label: "Matter Name" },
  { field: "matterNumber", label: "Matter Number" },
  { field: "status", label: "Matter Status" },
  { field: "responsibleAttorney", label: "Responsible Attorney" },
  { field: "practiceArea", label: "Practice Area" },
  { field: "openDate", label: "Open Date" },
  { field: "closeDate", label: "Close Date" },
];

const PARTY_TARGETS = [
  { field: "clientName", label: "Client Name" },
  { field: "adversePartyName", label: "Adverse Party Name" },
  { field: "coPartyName", label: "Co-Party Name" },
  { field: "witnessName", label: "Witness Name" },
  { field: "expertName", label: "Expert Name" },
  { field: "insurerName", label: "Insurer Name" },
  { field: "opposingCounselName", label: "Opposing Counsel Name" },
  { field: "otherPartyName", label: "Other Party Name" },
];

const ALL_TARGETS = [
  { group: "Matter", items: MATTER_TARGETS },
  { group: "Parties", items: PARTY_TARGETS },
  { group: "Entity", items: [{ field: "entityType", label: "Entity Type (person/company)" }] },
];

export default function HistoricalImportPage() {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [sourceLabel, setSourceLabel] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);

  // Parse results
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [dataShape, setDataShape] = useState<DataShape>("one_per_matter");
  const [mappings, setMappings] = useState<HistoricalColumnMapping[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);

  // Defaults
  const [defaults, setDefaults] = useState<HistoricalImportDefaults>({
    missingStatus: "closed",
    entityTypeDetection: "auto",
    multiValueHandling: "split",
    dateErrorHandling: "skip",
  });

  // Preview
  const [preview, setPreview] = useState<HistoricalImportPreview | null>(null);

  // Result
  const [result, setResult] = useState<HistoricalImportResult | null>(null);

  const handleFileSelect = useCallback((selectedFile: File) => {
    setFile(selectedFile);
  }, []);

  const currentStepIndex = STEP_KEYS.indexOf(step);

  // --- Step 1: Upload & Parse ---

  async function handleUpload() {
    if (!file || !sourceLabel.trim()) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("step", "parse");
      formData.append("sourceLabel", sourceLabel);
      const res = await fetch("/api/historical-import", { method: "POST", body: formData });
      const data: ParseResult = await res.json();
      setParseResult(data);
      setDataShape(data.detectedShape);
      setMappings(data.suggestedMappings);
      setRawRows(data.preview);
      setStep("shape");
    } finally {
      setLoading(false);
    }
  }

  // --- Step 4: Build Preview ---

  async function handleBuildPreview() {
    setLoading(true);
    try {
      const res = await fetch("/api/historical-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "preview",
          rows: rawRows,
          mappings,
          defaults,
          dataShape,
        }),
      });
      const data = await res.json();
      setPreview(data);
      setStep("preview");
    } finally {
      setLoading(false);
    }
  }

  // --- Step 5: Execute Import ---

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
        body: JSON.stringify({
          step: "import",
          rows: rawRows,
          mappings,
          defaults,
          dataShape,
          sourceLabel,
          duplicateActions,
        }),
      });
      const data = await res.json();
      setResult(data);
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

  // Count blank fields for the defaults step
  const blankFieldCount = rawRows.reduce((acc, row) => {
    return acc + Object.values(row).filter((v) => !v || !v.trim()).length;
  }, 0);
  const rowsWithBlanks = rawRows.filter((row) =>
    Object.values(row).some((v) => !v || !v.trim())
  ).length;

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Historical Matter Import</h1>
      <p className="text-sm text-gray-500 mb-6">
        Import matters from before your firm started using Clio. The system will match
        whatever columns you have — you don&apos;t need every field filled in for every record.
      </p>

      {/* Progress steps */}
      <div className="flex items-center gap-2 mb-8">
        {STEP_LABELS.map((label, i) => (
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
            {i < STEP_LABELS.length - 1 && <div className="w-6 h-px bg-gray-300" />}
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
            onDrop={(e) => {
              e.preventDefault(); setDragOver(false);
              const dropped = e.dataTransfer.files[0];
              if (dropped) handleFileSelect(dropped);
            }}
          >
            <p className="text-gray-600 mb-2">Drag and drop a CSV or Excel file, or</p>
            <label className="inline-block px-4 py-2 bg-primary-600 text-white rounded cursor-pointer hover:bg-primary-700 text-sm">
              Browse Files
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
              />
            </label>
          </div>

          {file && (
            <p className="text-sm text-gray-600 mb-4">
              Selected: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
            </p>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Source label
            </label>
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

      {/* ─── Step 2: Data Shape Detection ─── */}
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
              : "We couldn't determine the data shape automatically."}
          </p>

          <p className="text-sm font-medium text-gray-700 mb-2">Is that right?</p>

          <div className="space-y-2 mb-6">
            {([
              { value: "one_per_matter", label: 'One row per matter (parties in columns)', desc: 'Your file has "Client" and "Adverse Party" as separate columns.' },
              { value: "one_per_party", label: "One row per party (multiple rows per matter)", desc: "The same matter appears on multiple rows with different party names." },
              { value: "mixed", label: "Not sure / mixed", desc: "The system will try its best to detect the structure per-row." },
            ] as const).map((opt) => (
              <label key={opt.value} className="flex items-start gap-3 p-3 rounded border hover:bg-gray-50 cursor-pointer">
                <input
                  type="radio"
                  name="dataShape"
                  checked={dataShape === opt.value}
                  onChange={() => setDataShape(opt.value)}
                  className="mt-0.5"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">{opt.label}</span>
                  <p className="text-xs text-gray-500">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>

          <p className="text-xs text-gray-500 mb-4">
            This helps us import parties correctly. If your file has &quot;Client&quot; and
            &quot;Adverse Party&quot; as separate columns, choose the first option. If the same
            matter appears on multiple rows with different party names, choose the second.
          </p>

          <button
            onClick={() => setStep("mapping")}
            className="px-4 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700"
          >
            Next: Map Columns
          </button>
        </div>
      )}

      {/* ─── Step 3: Column Mapping ─── */}
      {step === "mapping" && parseResult && (
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Map your columns to the system</h2>
          <p className="text-sm text-gray-500 mb-4">
            We auto-detected some mappings. Adjust as needed. Columns mapped to &quot;Skip&quot; will be ignored.
            Not every column needs to map — import what you have.
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
                      const value = e.target.value;
                      setMappings([
                        ...mappings.filter((m) => m.sourceColumn !== header),
                        { sourceColumn: header, targetField: value },
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
            <button
              onClick={() => setStep("shape")}
              className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
            >
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
            We noticed some fields are empty in parts of your file. Tell us what to assume when data is missing.
          </p>

          <div className="space-y-6">
            {/* Missing status */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">When matter status is blank:</p>
              <div className="space-y-1">
                {([
                  { value: "closed", label: 'Assume "Closed" (safest for historical data)' },
                  { value: "open", label: 'Assume "Open"' },
                  { value: "pending", label: 'Assume "Pending"' },
                  { value: "leave_blank", label: "Leave blank (I'll fill these in later)" },
                ] as const).map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="missingStatus"
                      checked={defaults.missingStatus === opt.value}
                      onChange={() => setDefaults({ ...defaults, missingStatus: opt.value })}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Entity type detection */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                When entity type is unclear (can&apos;t tell if person or company):
              </p>
              <div className="space-y-1">
                {([
                  { value: "auto" as EntityTypeDetection, label: "Try to detect automatically", desc: "(names with Inc, LLC, Corp, LLP \u2192 company; everything else \u2192 person)" },
                  { value: "person" as EntityTypeDetection, label: "Assume person", desc: "" },
                  { value: "company" as EntityTypeDetection, label: "Assume company", desc: "" },
                ]).map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="entityType"
                      checked={defaults.entityTypeDetection === opt.value}
                      onChange={() => setDefaults({ ...defaults, entityTypeDetection: opt.value })}
                    />
                    <span>
                      {opt.label}
                      {opt.desc && <span className="text-xs text-gray-500 ml-1">{opt.desc}</span>}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Multi-value splitting */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                When a party column has multiple names separated by semicolons
                (e.g., &quot;IRS; David Williams Jr.&quot;):
              </p>
              <div className="space-y-1">
                {([
                  { value: "split", label: "Split into separate entities (one per name)" },
                  { value: "keep_single", label: "Keep as a single entity name" },
                ] as const).map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="multiValue"
                      checked={defaults.multiValueHandling === opt.value}
                      onChange={() => setDefaults({ ...defaults, multiValueHandling: opt.value })}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Date errors */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                When a date field can&apos;t be parsed:
              </p>
              <div className="space-y-1">
                {([
                  { value: "skip", label: "Skip the date (leave blank)" },
                  { value: "show_errors", label: "Stop and show me the problem rows" },
                ] as const).map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="dateError"
                      checked={defaults.dateErrorHandling === opt.value}
                      onChange={() => setDefaults({ ...defaults, dateErrorHandling: opt.value })}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {rowsWithBlanks > 0 && (
            <p className="text-sm text-gray-500 mt-6">
              {rowsWithBlanks} of {rawRows.length} rows have at least one blank field.
              This is normal for historical data.
            </p>
          )}

          <div className="flex gap-2 mt-6">
            <button
              onClick={() => setStep("mapping")}
              className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={handleBuildPreview}
              disabled={loading}
              className="px-4 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? "Building preview..." : "Next: Preview & Deduplication"}
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 5: Preview & Deduplication ─── */}
      {step === "preview" && preview && (
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Preview</h2>
          <p className="text-sm text-gray-600 mb-4">
            From {rawRows.length} rows, the import will create:
          </p>

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

          {/* Potential duplicates */}
          {preview.duplicateEntities.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Potential Duplicates ({preview.duplicateEntities.length} entities)
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                These imported names closely match entities already in your database (from Clio or prior imports).
              </p>
              <div className="space-y-3">
                {preview.duplicateEntities.map((dup, i) => (
                  <div key={i} className="border rounded-lg p-4">
                    <div className="text-sm mb-2">
                      <span className="font-medium text-gray-900">
                        Import: &quot;{dup.importName}&quot;
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mb-3">
                      Matches: <span className="font-medium">{dup.matchedEntityName}</span>{" "}
                      (existing, {(dup.matchScore * 100).toFixed(0)}% match)
                      {dup.existingMatterCount > 0 && (
                        <span className="text-gray-500">
                          {" "}&mdash; linked to {dup.existingMatterCount} existing matter{dup.existingMatterCount !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name={`dup-${i}`}
                          checked={dup.action === "link_existing"}
                          onChange={() => updateDuplicateAction(i, "link_existing")}
                        />
                        Link to existing (adds this matter to the existing {dup.matchedEntityName} entity)
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name={`dup-${i}`}
                          checked={dup.action === "import_new"}
                          onChange={() => updateDuplicateAction(i, "import_new")}
                        />
                        Import as new (creates a second {dup.importName})
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name={`dup-${i}`}
                          checked={dup.action === "skip"}
                          onChange={() => updateDuplicateAction(i, "skip")}
                        />
                        Skip this entity (still imports the matter)
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ready to import */}
          {preview.readyEntities > 0 && (
            <details className="mb-6">
              <summary className="text-sm font-semibold text-gray-700 cursor-pointer">
                Ready to Import ({preview.readyEntities} entities) — no duplicates detected
              </summary>
              <p className="text-sm text-gray-500 mt-2">
                These entities have no close matches in the existing database and will be imported as new records.
              </p>
            </details>
          )}

          {/* Problem rows */}
          {preview.problemRows.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Problem Rows ({preview.problemRows.length})
              </h3>
              <p className="text-xs text-gray-500 mb-2">
                These rows couldn&apos;t be parsed and will be skipped:
              </p>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {preview.problemRows.slice(0, 20).map((pr, i) => (
                  <div key={i} className="text-sm text-gray-600">
                    Row {pr.rowNumber}: {pr.reason}
                  </div>
                ))}
                {preview.problemRows.length > 20 && (
                  <p className="text-sm text-gray-500">
                    ...and {preview.problemRows.length - 20} more
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => setStep("defaults")}
              className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={handleImport}
              disabled={loading}
              className="px-6 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {loading
                ? "Importing..."
                : `Import ${preview.mattersToCreate} Matters + ${preview.entitiesToCreate} Entities`}
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
              <div className="text-sm text-gray-500">New entities created</div>
              <div className="text-sm font-medium text-gray-900">{result.entitiesCreated}</div>
            </div>
            <div className="bg-gray-50 rounded p-3">
              <div className="text-sm text-gray-500">Linked to existing entities</div>
              <div className="text-sm font-medium text-gray-900">{result.entitiesLinked}</div>
            </div>
            <div className="bg-gray-50 rounded p-3">
              <div className="text-sm text-gray-500">Role links created</div>
              <div className="text-sm font-medium text-gray-900">{result.roleLinksCreated}</div>
            </div>
            {result.skippedRows > 0 && (
              <div className="bg-yellow-50 rounded p-3">
                <div className="text-sm text-yellow-600">Skipped (errors)</div>
                <div className="text-sm font-medium text-yellow-800">{result.skippedRows}</div>
              </div>
            )}
          </div>

          <p className="text-sm text-gray-600 mb-2">
            Every record is tagged with source &quot;{result.sourceLabel}&quot; so you can always
            identify them in search results.
          </p>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-yellow-800">
              <strong>Recommendation:</strong> Run a search for your firm&apos;s top active clients
              to verify that historical adverse parties were imported correctly and no new
              conflicts have surfaced.
            </p>
          </div>

          <div className="flex gap-3">
            {result.skippedRows > 0 && (
              <button className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50">
                Download Error Report ({result.skippedRows} rows)
              </button>
            )}
            <Link
              href="/"
              className="px-4 py-2 text-sm bg-primary-600 text-white rounded hover:bg-primary-700"
            >
              Start a Conflict Search
            </Link>
            <button
              onClick={() => {
                setStep("upload");
                setFile(null);
                setSourceLabel("");
                setParseResult(null);
                setPreview(null);
                setResult(null);
                setRawRows([]);
                setMappings([]);
              }}
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
