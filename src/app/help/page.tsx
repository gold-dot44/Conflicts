"use client";

import { useState } from "react";

interface GlossaryEntry {
  term: string;
  definition: string;
}

const GLOSSARY: GlossaryEntry[] = [
  {
    term: "Conflict of Interest",
    definition: "A situation where your firm's obligation to one client could be compromised by your obligations to another client, a former client, or someone else connected to a matter. The rules governing conflicts are primarily ABA Model Rules 1.7 (current clients), 1.9 (former clients), and 1.10 (imputed conflicts across the firm).",
  },
  {
    term: "Ethical Wall (Screen)",
    definition: "A set of access restrictions that prevent a specific attorney from viewing or participating in a specific matter. Used when one attorney's prior knowledge creates a conflict, but the rest of the firm can still represent the client if the conflicted attorney is completely isolated from the matter.",
  },
  {
    term: "Disposition",
    definition: 'The analyst\'s or reviewer\'s recorded decision about whether a search result represents an actual conflict. The four possible dispositions are No Conflict, Potential Conflict, Conflict Confirmed, and Waiver Obtained.',
  },
  {
    term: "Lateral Hire",
    definition: "An attorney who joins the firm from another law firm. They bring knowledge of their prior clients, which may create conflicts with the new firm's existing clients.",
  },
  {
    term: "Fuzzy Matching",
    definition: "The system's ability to find names that are similar but not identical. Unlike a simple database search that only finds exact matches, fuzzy matching catches typos, phonetic variations, abbreviations, and corporate name variations. The system uses four different methods simultaneously to cast the widest possible net.",
  },
  {
    term: "Corporate Family Tree",
    definition: "The parent-subsidiary-affiliate relationships between companies. If your firm represents a parent company, it may be conflicted from taking an adverse position against that company's subsidiaries, even if the subsidiary is a separate legal entity.",
  },
  {
    term: "Audit Trail",
    definition: "The permanent, tamper-proof record of every conflict search performed, every result reviewed, and every decision made. This record cannot be edited or deleted after the fact. It serves as the firm's documentation that proper conflict checks were performed, and is the firm's primary defense in any malpractice or disqualification proceeding.",
  },
  {
    term: "Conflict Check Request",
    definition: "A bundle of related name searches tied to a single prospective matter. Captures why the check is being run, who asked for it, what names need to be searched, and the outcome. This is the primary unit of work in the system.",
  },
  {
    term: "Prospective Client",
    definition: "A person or company that the firm is considering representing. Conflict checks must be run before any representation begins to ensure no existing obligations prevent the engagement.",
  },
  {
    term: "Adverse Party",
    definition: "A person or company whose interests are opposed to those of the firm's client. Representing a new client whose interests are adverse to an existing client is generally prohibited without informed consent from both parties.",
  },
  {
    term: "Waiver",
    definition: "Informed written consent from all affected parties allowing the firm to proceed with representation despite a conflict of interest. Waivers must be specific about the nature of the conflict and the potential consequences.",
  },
  {
    term: "Imputed Conflict",
    definition: "A conflict that is attributed to the entire firm because one attorney in the firm has a personal conflict. Under ABA Model Rule 1.10, when one lawyer in a firm has a conflict, no lawyer in that firm may handle the matter unless the conflict can be screened (using an ethical wall).",
  },
  {
    term: "No Conflict (Disposition)",
    definition: "The analyst or reviewer has determined that the search result does not present an ethical conflict. The entity is either a different person/company, or the prior representation is unrelated to the prospective matter.",
  },
  {
    term: "Potential Conflict (Disposition)",
    definition: "The analyst believes the match may be a conflict but is not authorized to make the final determination, or needs more information. This escalates the check to the conflicts chair for review.",
  },
  {
    term: "Conflict Confirmed (Disposition)",
    definition: "A conflict of interest exists. The prospective matter cannot proceed without a waiver from all affected parties or an ethical wall screening the conflicted attorney.",
  },
  {
    term: "Waiver Obtained (Disposition)",
    definition: "A conflict exists, but all affected parties have provided informed written consent to the concurrent representation.",
  },
];

export default function HelpPage() {
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = GLOSSARY.filter(
    (entry) =>
      entry.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.definition.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Help & Glossary</h1>
      <p className="text-sm text-gray-500 mb-6">
        Plain-English explanations of legal and technical terms used throughout the system.
      </p>

      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search glossary..."
        className="w-full px-4 py-2 border border-gray-300 rounded-md text-sm mb-6 focus:ring-2 focus:ring-primary-500"
      />

      {/* Quick reference: How to use the system */}
      <section className="bg-blue-50 border border-blue-200 rounded-lg p-5 mb-8">
        <h2 className="text-lg font-semibold text-blue-900 mb-3">Quick Start Guide</h2>
        <div className="text-sm text-blue-800 space-y-3">
          <div>
            <h3 className="font-medium">For Analysts (Running Conflict Checks)</h3>
            <ol className="list-decimal list-inside mt-1 space-y-1 text-blue-700">
              <li>Start from the home page, which is the new conflict check form</li>
              <li>Select the check type, enter the matter name, requesting attorney, and all names to search</li>
              <li>Click &quot;Run All Searches&quot; to search all names at once</li>
              <li>Review results grouped by subject — pay attention to cross-reference warnings</li>
              <li>Record a disposition for each subject (or batch-clear low-risk results)</li>
              <li>Escalate to reviewer if any potential conflicts are found</li>
            </ol>
          </div>
          <div>
            <h3 className="font-medium">For Reviewers (Making Decisions)</h3>
            <ol className="list-decimal list-inside mt-1 space-y-1 text-blue-700">
              <li>Your home page shows pending items that need your review</li>
              <li>Click a pending item to see the analyst&apos;s assessment</li>
              <li>Make your decision: clear, confirm conflict, or clear with ethical wall</li>
              <li>If creating a wall, select the attorney to screen and confirm</li>
            </ol>
          </div>
        </div>
      </section>

      {/* Confidence levels */}
      <section className="bg-white rounded-lg border p-5 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Understanding Confidence Levels</h2>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-3 h-3 rounded-full bg-red-500 mt-1 shrink-0" />
            <div>
              <span className="font-medium text-gray-900">High (70%+)</span>
              <p className="text-sm text-gray-600">Strong similarities across multiple matching methods. Carefully review this result.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-3 h-3 rounded-full bg-yellow-500 mt-1 shrink-0" />
            <div>
              <span className="font-medium text-gray-900">Moderate (40&ndash;70%)</span>
              <p className="text-sm text-gray-600">Some matching signals found. May be the same entity with name variations, or a different entity with a similar name.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-3 h-3 rounded-full bg-gray-300 mt-1 shrink-0" />
            <div>
              <span className="font-medium text-gray-900">Low (below 40%)</span>
              <p className="text-sm text-gray-600">Weak similarities detected. Likely a different entity, but included for completeness.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Match types */}
      <section className="bg-white rounded-lg border p-5 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Match Types Explained</h2>
        <div className="space-y-3 text-sm">
          <div>
            <span className="font-medium text-gray-900">Exact name</span>
            <p className="text-gray-600">The search term and entity name are identical or nearly identical.</p>
          </div>
          <div>
            <span className="font-medium text-gray-900">Similar spelling</span>
            <p className="text-gray-600">The names differ by only a few characters. Catches typos, transpositions, and minor data entry errors.</p>
          </div>
          <div>
            <span className="font-medium text-gray-900">Sounds similar</span>
            <p className="text-gray-600">The names are spelled differently but pronounced similarly. Catches phonetic variations, especially common with names heard over the phone.</p>
          </div>
          <div>
            <span className="font-medium text-gray-900">Partial match</span>
            <p className="text-gray-600">The names share significant portions of text but differ in abbreviations, word order, or missing elements. Catches corporate name variations like &quot;Inc.&quot; vs. &quot;Incorporated.&quot;</p>
          </div>
          <div>
            <span className="font-medium text-gray-900">Corporate family</span>
            <p className="text-gray-600">This entity was not found by searching its name directly, but it is a parent, subsidiary, or affiliate of an entity that was found. Under conflict rules, representing a parent may preclude adverse action against subsidiaries.</p>
          </div>
        </div>
      </section>

      {/* Glossary */}
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Glossary</h2>
      <div className="space-y-4">
        {filtered.map((entry) => (
          <div key={entry.term} className="bg-white rounded-lg border p-4">
            <h3 className="font-semibold text-gray-900 mb-1">{entry.term}</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{entry.definition}</p>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-gray-500 text-center py-8">No glossary entries match your search.</p>
        )}
      </div>
    </div>
  );
}
