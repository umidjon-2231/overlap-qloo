"use client";

import { marked } from "marked";
import { useEffect, useMemo, useState } from "react";
import { api, type RunPayload } from "@/lib/api";
import { Button, Card, SectionTitle } from "./ui";

// Raw HTML in model output or seller edits is dropped, never rendered.
marked.use({ renderer: { html: () => "" } });

function outreachEmail(md: string): string {
  const m = md.match(/##\s*Outreach email[^\n]*\n([\s\S]*?)(?=\n##\s|$)/i);
  return (m?.[1] ?? "").trim();
}

export function PitchPackPanel({
  data,
  brandId,
  onBrandChange,
  onChanged,
}: {
  data: RunPayload;
  brandId: string | null;
  onBrandChange: (id: string) => void;
  onChanged: () => void;
}) {
  const brand = data.brands.find((b) => b.brandEntityId === brandId) ?? null;
  const saved = data.pitches.find((p) => p.brandEntityId === brandId) ?? null;
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setDraft(saved?.bodyMd ?? "");
    setEditing(false);
    setError(null);
  }, [brandId, saved?.bodyMd]);

  const html = useMemo(() => marked.parse(draft || "", { async: false }) as string, [draft]);
  const dirty = saved != null && draft !== saved.bodyMd;
  const approved = saved?.approved === true && !dirty;

  async function act(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const subject = brand ? `${data.run.propertyName} × ${brand.brandName}: partnership idea` : "";
  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(outreachEmail(draft))}`;

  return (
    <section>
      <SectionTitle step={5} title="Pitch pack" hint="Agent drafts, you edit and approve. Nothing is sent." />
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={brandId ?? ""}
            onChange={(e) => onBrandChange(e.target.value)}
            className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
          >
            <option value="" disabled>
              Choose a brand…
            </option>
            {data.brands.map((b) => (
              <option key={b.brandEntityId} value={b.brandEntityId}>
                {b.brandName}
                {data.pitches.some((p) => p.brandEntityId === b.brandEntityId && p.approved) ? " ✓ approved" : ""}
              </option>
            ))}
          </select>
          {brand && (
            <Button
              variant={saved ? "secondary" : "primary"}
              disabled={busy !== null}
              onClick={() => act("draft", () => api.draftPitch(data.run.id, brand.brandEntityId))}
            >
              {busy === "draft" ? "Drafting… (~20s)" : saved ? "Redraft" : "Draft pitch pack"}
            </Button>
          )}
          {saved && (
            <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${approved ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"}`}>
              {approved ? "Approved" : dirty ? "Unsaved edits" : "Draft · needs approval"}
            </span>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-decision">{error}</p>}
        {!brand && <p className="mt-4 text-sm text-muted">Pick a brand from the shortlist to draft its pitch pack.</p>}

        {saved && (
          <>
            <div className="mt-4 flex gap-2 border-b border-line text-sm">
              <button className={`-mb-px border-b-2 px-2 py-1 ${!editing ? "border-foreground" : "border-transparent text-muted"}`} onClick={() => setEditing(false)}>
                Preview
              </button>
              <button className={`-mb-px border-b-2 px-2 py-1 ${editing ? "border-foreground" : "border-transparent text-muted"}`} onClick={() => setEditing(true)}>
                Edit
              </button>
            </div>
            {editing ? (
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="mt-3 h-[28rem] w-full rounded-md border border-line p-3 font-mono text-xs leading-relaxed"
              />
            ) : (
              <div className="markdown mt-3 max-h-[36rem] overflow-y-auto text-sm" dangerouslySetInnerHTML={{ __html: html }} />
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
              {dirty && (
                <Button variant="secondary" disabled={busy !== null} onClick={() => act("save", () => api.savePitch(data.run.id, brand!.brandEntityId, draft))}>
                  {busy === "save" ? "Saving…" : "Save edits"}
                </Button>
              )}
              <Button disabled={busy !== null || dirty || approved} onClick={() => act("approve", () => api.approvePitch(data.run.id, brand!.brandEntityId))}>
                {approved ? "Approved ✓" : busy === "approve" ? "Approving…" : "Approve"}
              </Button>
              <span className="mx-1 h-5 w-px bg-line" />
              <Button
                variant="secondary"
                disabled={!approved}
                onClick={async () => {
                  await navigator.clipboard.writeText(draft);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? "Copied" : "Copy Markdown"}
              </Button>
              <a
                href={approved ? api.pdfUrl(data.run.id, brand!.brandEntityId) : undefined}
                aria-disabled={!approved}
                className={`rounded-md border border-line px-3 py-1.5 text-sm font-medium ${approved ? "hover:bg-zinc-50" : "pointer-events-none opacity-50"}`}
              >
                Download PDF
              </a>
              <a
                href={approved ? mailto : undefined}
                aria-disabled={!approved}
                className={`rounded-md border border-line px-3 py-1.5 text-sm font-medium ${approved ? "hover:bg-zinc-50" : "pointer-events-none opacity-50"}`}
              >
                Open email draft
              </a>
              {!approved && <span className="text-xs text-muted">Export unlocks after approval.</span>}
            </div>
          </>
        )}
        <p className="mt-4 rounded-md bg-zinc-50 p-2 text-[11px] text-muted">
          Rights note: artist and brand names identify; they do not imply endorsement. Real deals need talent approval and rights clearance.
          Overlap never contacts brands. You send the pitch yourself.
        </p>
      </Card>
    </section>
  );
}
