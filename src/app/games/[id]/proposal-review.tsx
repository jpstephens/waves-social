"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, ChevronDown, ChevronUp } from "lucide-react";
import type { Highlight } from "@/lib/db/schema";

type Proposal = {
  highlight: Highlight;
  playerName: string;
  jerseyNumber: number | null;
};

const KIND_LABEL: Record<string, string> = {
  extra_base_hit: "Extra-base hit",
  rbi: "RBI",
  at_bat: "At bat",
  pitching: "Pitching",
  stolen_base: "Steal",
  effort: "Effort",
  milestone: "Milestone",
  teamwork: "Teamwork",
};

export function ProposalReview({
  gameId,
  initialProposals,
}: {
  gameId: string;
  initialProposals: Proposal[];
}) {
  const router = useRouter();
  const [proposals, setProposals] = useState(initialProposals);

  const selectedCount = proposals.filter(
    (p) => p.highlight.status === "selected"
  ).length;

  const setStatus = async (
    id: string,
    status: "proposed" | "selected" | "rejected"
  ) => {
    setProposals((ps) =>
      ps.map((p) =>
        p.highlight.id === id
          ? { ...p, highlight: { ...p.highlight, status } }
          : p
      )
    );
    await fetch(`/api/highlights/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
  };

  const editField = async (
    id: string,
    field: "headline" | "caption" | "statLine",
    value: string
  ) => {
    setProposals((ps) =>
      ps.map((p) =>
        p.highlight.id === id
          ? { ...p, highlight: { ...p.highlight, [field]: value } }
          : p
      )
    );
    await fetch(`/api/highlights/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
  };

  if (proposals.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-navy-800 bg-navy-900/50 p-12 text-center">
        <p className="text-navy-400 uppercase tracking-wider text-sm">
          No proposals yet — the box score read may have failed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="font-heading text-2xl text-white tracking-tight">
            Proposed posts
          </h2>
          <p className="text-navy-400 text-sm mt-1">
            {proposals.length} suggested · {selectedCount} selected
          </p>
        </div>
        <button
          disabled={selectedCount === 0}
          onClick={() => router.push(`/games/${gameId}/media`)}
          className="bg-cyan-400 text-navy-950 px-5 py-3 rounded-lg font-heading text-sm uppercase tracking-wider hover:bg-cyan-300 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          Continue with {selectedCount}
        </button>
      </div>

      <ul className="space-y-3">
        {proposals.map((p) => (
          <ProposalCard
            key={p.highlight.id}
            proposal={p}
            onSelect={() => setStatus(p.highlight.id, "selected")}
            onReject={() => setStatus(p.highlight.id, "rejected")}
            onUndo={() => setStatus(p.highlight.id, "proposed")}
            onEdit={(field, value) => editField(p.highlight.id, field, value)}
          />
        ))}
      </ul>
    </div>
  );
}

function ProposalCard({
  proposal,
  onSelect,
  onReject,
  onUndo,
  onEdit,
}: {
  proposal: Proposal;
  onSelect: () => void;
  onReject: () => void;
  onUndo: () => void;
  onEdit: (field: "headline" | "caption" | "statLine", value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const { highlight: h, playerName, jerseyNumber } = proposal;

  const borderColor =
    h.status === "selected"
      ? "border-cyan-400"
      : h.status === "rejected"
        ? "border-red-400/40 opacity-50"
        : "border-navy-800";

  return (
    <li
      className={`rounded-xl border-2 ${borderColor} bg-navy-900 transition-all`}
    >
      <div className="p-4 flex items-start gap-4">
        <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-navy-700 to-navy-900 border-2 border-navy-700 flex items-center justify-center flex-shrink-0">
          <span
            className="text-white font-black text-base italic"
            style={{ fontFamily: "Georgia, serif" }}
          >
            {jerseyNumber ?? "—"}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-white font-bold text-base">{playerName}</span>
            <span className="text-cyan-400 text-[10px] uppercase tracking-[0.2em] font-bold bg-cyan-400/10 px-2 py-0.5 rounded">
              {KIND_LABEL[h.kind] ?? h.kind}
            </span>
          </div>
          <div className="text-navy-300 font-mono text-sm mb-2">
            {h.statLine}
          </div>
          <div className="font-heading text-lg text-white tracking-tight">
            {h.headline}
          </div>
        </div>

        <div className="flex flex-col gap-2 flex-shrink-0">
          {h.status === "proposed" && (
            <>
              <button
                onClick={onSelect}
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-cyan-400 text-navy-950 hover:bg-cyan-300"
                title="Keep this post"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={onReject}
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-navy-700 text-navy-400 hover:border-red-400 hover:text-red-400"
                title="Skip this post"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          )}
          {h.status !== "proposed" && (
            <button
              onClick={onUndo}
              className="text-navy-400 text-[10px] uppercase tracking-wider font-bold hover:text-cyan-400"
            >
              Undo
            </button>
          )}
        </div>
      </div>

      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full px-4 py-2 border-t border-navy-800 text-navy-400 text-[10px] uppercase tracking-[0.2em] font-bold flex items-center justify-center gap-1 hover:text-cyan-400 transition-colors"
      >
        {expanded ? "Hide" : "Show"} caption
        {expanded ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {editing ? (
            <>
              <EditField
                label="Headline"
                value={h.headline}
                onSave={(v) => onEdit("headline", v)}
              />
              <EditField
                label="Stat line"
                value={h.statLine ?? ""}
                onSave={(v) => onEdit("statLine", v)}
              />
              <EditField
                label="Caption"
                value={h.caption}
                multiline
                onSave={(v) => onEdit("caption", v)}
              />
            </>
          ) : (
            <div className="text-navy-300 text-sm whitespace-pre-wrap leading-relaxed">
              {h.caption}
            </div>
          )}

          <button
            onClick={() => setEditing((e) => !e)}
            className="text-cyan-400 text-[10px] uppercase tracking-wider font-bold hover:text-white"
          >
            {editing ? "Done editing" : "Edit copy"}
          </button>
        </div>
      )}
    </li>
  );
}

function EditField({
  label,
  value,
  multiline,
  onSave,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  onSave: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const dirty = draft !== value;
  return (
    <div>
      <div className="text-cyan-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">
        {label}
      </div>
      {multiline ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => dirty && onSave(draft)}
          rows={4}
          className="w-full bg-navy-950 border border-navy-800 text-white text-sm rounded-lg p-2 focus:border-cyan-400 focus:outline-none"
        />
      ) : (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => dirty && onSave(draft)}
          className="w-full bg-navy-950 border border-navy-800 text-white text-sm rounded-lg px-2 py-1.5 focus:border-cyan-400 focus:outline-none"
        />
      )}
    </div>
  );
}
