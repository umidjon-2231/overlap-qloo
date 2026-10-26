"use client";

import { marked } from "marked";
import { useEffect, useMemo, useState } from "react";
import { api, type RunPayload } from "@/lib/api";
import { Button, buttonClass, SectionTitle } from "./ui";

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
      <SectionTitle title="Pitch pack" hint="Overlap drafts, you edit and approve. Nothing is sent." />
      <div className="grid gap-8 lg:grid-cols-[15rem_1fr]">
        <nav aria-label="Brands">
          <ul className="border-b border-ink">
            {data.brands.map((b) => {
              const p = data.pitches.find((x) => x.brandEntityId === b.brandEntityId);
              const current = b.brandEntityId === brandId;
              return (
                <li key={b.brandEntityId}>
                  <button
                    type="button"
                    aria-current={current}
                    onClick={() => onBrandChange(b.brandEntityId)}
                    className="flex w-full items-baseline justify-between gap-3 border-t border-ink px-2 py-2.5 text-left transition-colors hover:bg-paper-2 aria-[current=true]:bg-ink aria-[current=true]:text-on-ink"
                  >
                    <span className="font-semibold">{b.brandName}</span>
                    <span className={`text-xs ${p?.approved ? "text-ok" : "opacity-60"} ${current && p?.approved ? "text-on-ink" : ""}`}>
                      {p ? (p.approved ? "Approved" : "Draft") : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0">
          {!brand && <p className="text-ink-soft">Pick a brand to draft its pitch pack.</p>}

          {brand && !saved && (
            <div className="max-w-xl border-t-2 border-ink pt-5">
              <h3 className="display-wide text-[1.6rem]">{brand.brandName}</h3>
              <p className="mt-2 leading-relaxed text-ink-soft">
                Overlap writes the pitch, city by city plan, activations, measurement plan and outreach email from this run&apos;s Qloo evidence. You
                review and edit it, then approve before anything can be exported.
              </p>
              <Button className="mt-5" disabled={busy !== null} onClick={() => act("draft", () => api.draftPitch(data.run.id, brand.brandEntityId))}>
                {busy === "draft" ? "Writing the pitch… about 20 s" : "Draft pitch pack"}
              </Button>
            </div>
          )}

          {brand && saved && (
            <>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-ink pb-3">
                <div role="tablist" aria-label="Pitch pack view" className="flex gap-1">
                  {[
                    { id: false, label: "Preview" },
                    { id: true, label: "Edit" },
                  ].map((t) => (
                    <button
                      key={t.label}
                      role="tab"
                      aria-selected={editing === t.id}
                      onClick={() => setEditing(t.id)}
                      className="rounded-[2px] px-3 py-1.5 text-sm font-semibold text-ink-soft hover:text-ink aria-selected:bg-ink aria-selected:text-on-ink"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <span className={`text-sm font-semibold ${approved ? "text-ok" : "text-warn"}`}>
                  {approved ? "Approved" : dirty ? "Unsaved edits" : "Draft: needs your approval"}
                </span>
                <button
                  type="button"
                  className="ml-auto text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline disabled:opacity-40"
                  disabled={busy !== null}
                  onClick={() => act("draft", () => api.draftPitch(data.run.id, brand.brandEntityId))}
                >
                  {busy === "draft" ? "Rewriting… about 20 s" : "Rewrite draft"}
                </button>
              </div>

              <div className="bg-sheet px-5 py-6 sm:px-8">
                {editing ? (
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    aria-label="Pitch pack Markdown"
                    className="h-[32rem] w-full resize-y border border-rule bg-transparent p-3 font-mono text-xs leading-relaxed focus:border-ink focus:outline-none"
                  />
                ) : (
                  <div className="markdown text-[0.95rem]" dangerouslySetInnerHTML={{ __html: html }} />
                )}
              </div>

              {error && <p className="mt-3 text-sm text-coral-ink">{error}</p>}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {dirty && (
                  <Button variant="secondary" disabled={busy !== null} onClick={() => act("save", () => api.savePitch(data.run.id, brand.brandEntityId, draft))}>
                    {busy === "save" ? "Saving…" : "Save edits"}
                  </Button>
                )}
                <Button disabled={busy !== null || dirty || approved} onClick={() => act("approve", () => api.approvePitch(data.run.id, brand.brandEntityId))}>
                  {approved ? "Approved" : busy === "approve" ? "Approving…" : "Approve pitch pack"}
                </Button>
                <span className="mx-2 hidden h-6 w-px bg-rule sm:block" aria-hidden="true" />
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
                <a href={approved ? api.pdfUrl(data.run.id, brand.brandEntityId) : undefined} aria-disabled={!approved} className={buttonClass("secondary")}>
                  Download PDF
                </a>
                <a href={approved ? mailto : undefined} aria-disabled={!approved} className={buttonClass("secondary")}>
                  Open email draft
                </a>
              </div>
              {!approved && <p className="mt-2 text-xs text-ink-soft">Export unlocks after you approve.</p>}
            </>
          )}

          <p className="mt-8 max-w-[72ch] border-t border-rule pt-3 text-xs leading-relaxed text-ink-soft">
            Rights note: artist and brand names identify; they do not imply endorsement. Real deals need talent approval and rights clearance.
            Overlap never contacts brands. You send the pitch yourself.
          </p>
        </div>
      </div>
    </section>
  );
}
