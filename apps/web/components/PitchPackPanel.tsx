"use client";

import { marked } from "marked";
import { useEffect, useMemo, useState } from "react";
import { api, type RunPayload } from "@/lib/api";
import { PressLoop } from "./PressLoop";
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
      <SectionTitle title={brand ? `Pitch for ${brand.brandName}` : "Pitch"} hint="Overlap writes it. You check it, then send it yourself." />
      <Steps step={!saved ? 1 : approved ? 3 : 2} />
      <label className="mb-6 grid max-w-sm gap-1.5 text-sm lg:hidden">
        <span className="font-semibold">Brand</span>
        <select
          value={brandId ?? ""}
          onChange={(e) => onBrandChange(e.target.value)}
          className="rounded-[2px] border border-ink bg-sheet px-3 py-2 text-base"
        >
          {data.brands.map((b) => (
            <option key={b.brandEntityId} value={b.brandEntityId}>
              {b.brandName}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-8 lg:grid-cols-[15rem_1fr]">
        <nav aria-label="Brands" className="hidden lg:block">
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

          {brand && busy === "draft" && (
            <div className="max-w-xl" aria-live="polite">
              <PressLoop className="max-w-[26rem]" />
              <p className="mt-3 flex items-center gap-2.5 text-lg font-semibold">
                <span className="live-dot size-2 rounded-full bg-coral" aria-hidden="true" />
                Printing the {brand.brandName} pitch pack
              </p>
              <p className="mt-1 text-sm text-ink-soft">Written from this run&apos;s Qloo evidence. Usually about 30 seconds.</p>
            </div>
          )}

          {brand && !saved && busy !== "draft" && (
            <div className="max-w-xl border-t-2 border-ink pt-5">
              <h3 className="display-wide text-[1.6rem]">{brand.brandName}</h3>
              <p className="mt-2 leading-relaxed text-ink-soft">
                You get the pitch, a plan for each city, event ideas, how to measure results, and a ready-to-send email. Takes about 30 seconds.
              </p>
              <Button className="mt-5 px-5 py-2.5 text-base" disabled={busy !== null} onClick={() => act("draft", () => api.draftPitch(data.run.id, brand.brandEntityId))}>
                Write the pitch
              </Button>
            </div>
          )}

          {brand && saved && busy !== "draft" && (
            <>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-ink pb-3">
                {approved ? (
                  <span className="text-sm font-semibold text-ok">✓ Approved. Ready to send.</span>
                ) : (
                  <>
                    <span className="text-sm font-semibold text-warn">{dirty ? "You have unsaved edits" : "Read it, edit anything, then approve. Approving unlocks the email and PDF; nothing is sent."}</span>
                    {!dirty && (
                      <Button disabled={busy !== null} onClick={() => act("approve", () => api.approvePitch(data.run.id, brand.brandEntityId))}>
                        {busy === "approve" ? "Approving…" : "Approve"}
                      </Button>
                    )}
                  </>
                )}
                {/* Example pitches are shared by every visitor, so they can't be edited or rewritten. */}
                {data.run.presetId ? (
                  <span className="ml-auto text-sm text-ink-soft">Example pitch: try your own tour to edit one.</span>
                ) : (
                  <div className="ml-auto flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setEditing(!editing)}
                      className="text-sm font-semibold text-ink-soft underline-offset-4 hover:text-ink hover:underline"
                    >
                      {editing ? "Done editing" : "Edit text"}
                    </button>
                    <button
                      type="button"
                      className="text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline disabled:opacity-40"
                      disabled={busy !== null}
                      onClick={() => act("draft", () => api.draftPitch(data.run.id, brand.brandEntityId, true))}
                    >
                      Write it again
                    </button>
                  </div>
                )}
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
                {!approved && !dirty && (
                  <Button disabled={busy !== null} onClick={() => act("approve", () => api.approvePitch(data.run.id, brand.brandEntityId))}>
                    {busy === "approve" ? "Approving…" : "Approve"}
                  </Button>
                )}
                {approved && (
                  <>
                    <a href={mailto} className={buttonClass("primary")}>
                      Open as email
                    </a>
                    <a href={api.pdfUrl(data.run.id, brand.brandEntityId)} className={buttonClass("secondary")}>
                      Download PDF
                    </a>
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        await navigator.clipboard.writeText(draft);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      }}
                    >
                      {copied ? "Copied" : "Copy text"}
                    </Button>
                  </>
                )}
              </div>
              <p className="mt-2 text-xs text-ink-soft">
                {approved ? "The PDF and email leave out your internal seller notes." : "Sending unlocks after you approve."}
              </p>
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

function Steps({ step }: { step: 1 | 2 | 3 }) {
  const steps = ["Write", "Check & approve", "Send"];
  return (
    <ol className="mb-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
      {steps.map((label, i) => {
        const n = i + 1;
        const state = n < step ? "done" : n === step ? "now" : "next";
        return (
          <li key={label} className={`flex items-center gap-2 ${state === "next" ? "text-ink-soft" : "font-semibold"}`} aria-current={state === "now" ? "step" : undefined}>
            <span
              className={`grid size-6 place-items-center rounded-full text-xs font-bold ${
                state === "done" ? "bg-ok text-on-ink" : state === "now" ? "bg-coral text-ink" : "border border-rule"
              }`}
            >
              {state === "done" ? "✓" : n}
            </span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}
