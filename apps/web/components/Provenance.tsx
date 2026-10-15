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

export function CallLink({ callId, label }: { callId: number; label?: string }) {
  const open = useContext(Ctx);
  return (
    <button
      type="button"
      onClick={() => open(callId)}
      className="rounded bg-evidence-soft px-1.5 py-0.5 font-mono text-[11px] text-evidence hover:underline"
      title="Show the Qloo request and result behind this number"
    >
      {label ?? `call #${callId}`}
    </button>
  );
}

function ProvenanceDrawer({ callId, onClose }: { callId: number; onClose: () => void }) {
  const [call, setCall] = useState<ToolCallRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.call(callId).then(setCall).catch((e: Error) => setError(e.message));
  }, [callId]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <aside className="h-full w-full max-w-xl overflow-y-auto bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">Provenance · call #{callId}</h3>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        {error && <p className="text-sm text-decision">{error}</p>}
        {!call && !error && <p className="text-sm text-muted">Loading…</p>}
        {call && (
          <div className="grid gap-4 text-sm">
            <dl className="grid grid-cols-[8rem_1fr] gap-y-1">
              <dt className="text-muted">Workflow</dt>
              <dd className="font-mono">{call.tool}</dd>
              <dt className="text-muted">Status</dt>
              <dd className="font-mono">{call.status}{call.cached ? " (cached)" : ""}</dd>
              <dt className="text-muted">Endpoint</dt>
              <dd className="font-mono">{call.requestRedacted.path}</dd>
              <dt className="text-muted">Logged</dt>
              <dd>{new Date(call.createdAt).toLocaleString()}</dd>
            </dl>
            <div>
              <div className="mb-1 font-medium">Request parameters (no key, no personal data)</div>
              <pre className="overflow-x-auto rounded-md bg-zinc-50 p-3 font-mono text-xs">{JSON.stringify(call.requestRedacted.params, null, 2)}</pre>
            </div>
            <div>
              <div className="mb-1 font-medium">Normalised result</div>
              <pre className="max-h-[50vh] overflow-auto rounded-md bg-zinc-50 p-3 font-mono text-xs">{JSON.stringify(call.resultSummary, null, 2)}</pre>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
