"use client";

import type { RunEvent } from "@overlap/shared";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, type RunPayload } from "@/lib/api";
import { AgentTrace } from "./AgentTrace";
import { PitchPackPanel } from "./PitchPackPanel";
import { ProvenanceProvider } from "./Provenance";
import { CityActivation, CityGrid, Shortlist } from "./Results";
import { AgentLabel, Button, Card, StatusPill } from "./ui";

const EVENT_TYPES = ["status", "agent_text", "tool_start", "tool_end", "needs_input", "result", "error"] as const;

export function RunView({ runId }: { runId: string }) {
  const [data, setData] = useState<RunPayload | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pitchBrand, setPitchBrand] = useState<string | null>(null);
  const seen = useRef(new Set<number>());
  const pitchRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(() => {
    api
      .run(runId)
      .then((d) => {
        setData(d);
        setPitchBrand((cur) => cur ?? d.brands[0]?.brandEntityId ?? null);
      })
      .catch((e: Error) => setLoadError(e.message));
  }, [runId]);

  useEffect(refresh, [refresh]);

  useEffect(() => {
    const source = new EventSource(api.streamUrl(runId));
    const onEvent = (msg: MessageEvent) => {
      const e = JSON.parse(msg.data) as RunEvent;
      if (seen.current.has(e.seq)) return;
      seen.current.add(e.seq);
      setEvents((cur) => [...cur, e].sort((a, b) => a.seq - b.seq));
      if (e.type === "status" || e.type === "needs_input" || e.type === "result") refresh();
    };
    for (const t of EVENT_TYPES) source.addEventListener(t, onEvent);
    return () => source.close();
  }, [runId, refresh]);

  if (loadError) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <p className="text-decision">{loadError}</p>
        <Link href="/" className="text-sm underline">
          Back
        </Link>
      </main>
    );
  }
  if (!data) return <main className="mx-auto max-w-7xl px-4 py-10 text-muted">Loading run…</main>;

  const { run } = data;
  const live = run.status === "running";
  const hasResults = data.brands.length > 0;

  return (
    <ProvenanceProvider>
      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-6 lg:grid-cols-[1fr_22rem]">
        <div className="grid min-w-0 content-start gap-8">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{run.propertyName}</h1>
              <StatusPill status={run.status} />
            </div>
            <div className="mt-1 text-sm text-muted">
              {run.propertyType === "festival" ? "Festival" : "Artist tour"} · {run.artists.map((a) => a.query).join(", ")} · {run.cities.join(", ")}
            </div>
            <div className="mt-1 font-mono text-[11px] text-muted">
              {run.model} · effort {run.effort} · {run.toolset} tools
              {run.grounding && ` · grounding: ${run.grounding.checked - run.grounding.violations.length}/${run.grounding.checked} items matched to Qloo calls`}
            </div>
          </div>

          {run.status === "needs_input" && run.pendingInput && <EntityPicker runId={run.id} input={run.pendingInput} onDone={refresh} />}
          {run.status === "error" && (
            <Card className="border-decision/40 p-4 text-sm">
              <div className="font-medium text-decision">The run stopped</div>
              <div className="mt-1 text-muted">{run.error}</div>
            </Card>
          )}
          {live && !hasResults && (
            <Card className="p-6 text-sm text-muted">
              The agent is resolving artists and querying Qloo. Results appear here when it submits its report (usually 1–2 minutes). Watch
              the trace on the right.
            </Card>
          )}

          {run.summary && (
            <Card className="p-4">
              <AgentLabel />
              <p className="mt-1 leading-relaxed">{run.summary}</p>
            </Card>
          )}

          {hasResults && (
            <>
              <Shortlist
                data={data}
                onPitch={(id) => {
                  setPitchBrand(id);
                  pitchRef.current?.scrollIntoView({ behavior: "smooth" });
                }}
              />
              <CityGrid data={data} />
              <CityActivation data={data} />
              <div ref={pitchRef}>
                <PitchPackPanel data={data} brandId={pitchBrand} onBrandChange={setPitchBrand} onChanged={refresh} />
              </div>
            </>
          )}
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <AgentTrace events={events} live={live} usage={run.usage} />
        </aside>
      </main>
    </ProvenanceProvider>
  );
}

function EntityPicker({
  runId,
  input,
  onDone,
}: {
  runId: string;
  input: NonNullable<RunPayload["run"]["pendingInput"]>;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Card className="border-warn/50 p-4">
      <div className="text-sm font-semibold">Did you mean…</div>
      <p className="mt-1 text-sm text-muted">{input.question}</p>
      <div className="mt-3 grid gap-2">
        {input.candidates.map((c) => (
          <button
            key={c.entity_id}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api.resolve(runId, c.entity_id, c.name);
                onDone();
              } catch (e) {
                setError((e as Error).message);
                setBusy(false);
              }
            }}
            className="rounded-md border border-line p-3 text-left hover:border-foreground disabled:opacity-50"
          >
            <div className="font-medium">{c.name}</div>
            {c.description && <div className="text-xs text-muted">{c.description}</div>}
            <div className="font-mono text-[10px] text-muted">{c.entity_id}</div>
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-sm text-decision">{error}</p>}
      <div className="mt-3">
        <Link href="/">
          <Button variant="ghost">None of these: start over</Button>
        </Link>
      </div>
    </Card>
  );
}
