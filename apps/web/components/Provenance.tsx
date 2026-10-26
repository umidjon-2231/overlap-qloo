"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type ToolCallRecord } from "@/lib/api";
import { Button } from "./ui";

const Ctx = createContext<(callId: number) => void>(() => {});

/** Lets any evidence chip open the provenance drawer for a logged Qloo call. */
export function ProvenanceProvider({ children }: { children: ReactNode }) {
  const [callId, setCallId] = useState<number | null>(null);
  return (
    <Ctx.Provider value={setCallId}>
      {children}
      {callId != null && <ProvenanceDrawer callId={callId} onClose={() => setCallId(null)} />}
    </Ctx.Provider>
  );
}

/** A Qloo lookup reference. `onField` renders it for a coloured field (the top pick's coral row). */
export function CallLink({ callId, label, onField = false }: { callId: number; label?: string; onField?: boolean }) {
  const open = useContext(Ctx);
  return (
    <button
      type="button"
      onClick={() => open(callId)}
      className={`rounded-[2px] px-1.5 py-0.5 align-baseline font-mono text-[11px] tnum transition-colors ${
        onField ? "bg-ink text-on-ink hover:bg-sheet hover:text-ink" : "bg-evidence-soft text-evidence hover:bg-evidence hover:text-on-ink"
      }`}
      title="Show the Qloo request and result behind this number"
    >
      {label ?? `Qloo #${callId}`}
    </button>
  );
}

function ProvenanceDrawer({ callId, onClose }: { callId: number; onClose: () => void }) {
  const [call, setCall] = useState<ToolCallRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.call(callId).then(setCall).catch((e: Error) => setError(e.message));
  }, [callId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Qloo lookup ${callId}`}
        className="h-full w-full max-w-xl overflow-y-auto border-l border-ink bg-paper p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-ink pb-3">
          <div>
            <h3 className="display text-[2rem]">Qloo lookup #{callId}</h3>
            <p className="text-sm text-ink-soft">The exact request and result behind this number.</p>
          </div>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
        {error && <p className="text-sm text-coral-ink">{error}</p>}
        {!call && !error && <p className="text-sm text-ink-soft">Loading…</p>}
        {call && (
          <div className="grid gap-5 text-sm">
            <dl className="grid grid-cols-[7rem_1fr] gap-y-1.5">
              <dt className="text-ink-soft">Workflow</dt>
              <dd className="font-mono">{call.tool}</dd>
              <dt className="text-ink-soft">Status</dt>
              <dd className="font-mono">
                {call.status}
                {call.cached ? " (cached)" : ""}
              </dd>
              <dt className="text-ink-soft">Endpoint</dt>
              <dd className="font-mono">{call.requestRedacted.path}</dd>
              <dt className="text-ink-soft">Logged</dt>
              <dd>{new Date(call.createdAt).toLocaleString()}</dd>
            </dl>
            <div>
              <div className="mb-1.5 font-semibold">Request parameters (no key, no personal data)</div>
              <pre className="overflow-x-auto bg-sheet p-3 font-mono text-xs leading-relaxed">{JSON.stringify(call.requestRedacted.params, null, 2)}</pre>
            </div>
            <div>
              <div className="mb-1.5 font-semibold">Result</div>
              <pre className="max-h-[50vh] overflow-auto bg-sheet p-3 font-mono text-xs leading-relaxed">{JSON.stringify(call.resultSummary, null, 2)}</pre>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
