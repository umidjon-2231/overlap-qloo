"use client";

import type { RunEvent } from "@overlap/shared";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, type RunPayload } from "@/lib/api";
import { deriveProgress } from "@/lib/progress";
import { PitchPackPanel } from "./PitchPackPanel";
import { ProvenanceProvider } from "./Provenance";
import { CityDetail, CityGrid, Shortlist } from "./Results";
import { TourStack } from "./TourStack";
import { AgentLabel, buttonClass } from "./ui";

const EVENT_TYPES = ["status", "agent_text", "tool_start", "tool_end", "needs_input", "result", "error"] as const;

const TABS = [
  { id: "shortlist", label: "Shortlist" },
  { id: "grid", label: "Brand × City" },
  { id: "cities", label: "Cities" },
  { id: "pitch", label: "Pitch pack" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export function RunView({ runId }: { runId: string }) {
  const [data, setData] = useState<RunPayload | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("shortlist");
  const [city, setCity] = useState<string | null>(null);
  const [pitchBrand, setPitchBrand] = useState<string | null>(null);
  const seen = useRef(new Set<number>());

  const refresh = useCallback(() => {
    api
      .run(runId)
      .then((d) => {
        setData(d);
        setPitchBrand((cur) => cur ?? d.brands[0]?.brandEntityId ?? null);
        setCity((cur) => cur ?? d.run.cities[0] ?? null);
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

  const progress = useMemo(
    () => (data ? deriveProgress(events, data.run.cities, data.run.status) : null),
    [events, data],
  );

  if (loadError) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <h1 className="display text-5xl">Run not found</h1>
        <p className="mt-3 text-ink-soft">{loadError}. It may have been removed, or the link is incomplete.</p>
        <Link href="/" className={buttonClass("secondary", "mt-6")}>
          Start a new run
        </Link>
      </main>
    );
  }
  if (!data || !progress) {
    return (
      <main className="flex flex-1 flex-col lg:flex-row">
        <div className="bg-ink lg:w-[21rem]" />
        <p className="px-6 py-10 text-ink-soft">Loading the tour…</p>
      </main>
    );
  }

  const { run } = data;
  const live = run.status === "running";
  const hasResults = data.brands.length > 0;
  const latest = progress.lines.at(-1);

  const openPitch = (id: string) => {
    setPitchBrand(id);
    setTab("pitch");
  };
  const openCity = (c: string) => {
    setCity(c);
    setTab("cities");
  };

  return (
    <ProvenanceProvider>
      <main className="flex flex-1 flex-col lg:flex-row">
        <TourStack data={data} progress={progress} selectedCity={tab === "cities" ? city : null} onSelectCity={openCity} />

        <div className="min-w-0 flex-1 px-4 pb-16 pt-6 sm:px-8 lg:pt-8">
          <header className="max-w-[72rem]">
            <h1 className="display-wide text-[2rem] leading-tight sm:text-[2.4rem]">{run.propertyName}</h1>
            <p className="mt-1 text-sm text-ink-soft">
              {run.cities.length} {run.cities.length === 1 ? "city" : "cities"} · {run.artists.map((a) => a.name ?? a.query).join(", ")}
              {run.grounding && (
                <>
                  {" · "}
                  <span className="text-evidence">
                    {run.grounding.checked - run.grounding.violations.length} of {run.grounding.checked} figures traced to Qloo lookups
                  </span>
                </>
              )}
            </p>
            {live && latest && (
              <p className="mt-3 flex items-center gap-2 text-sm lg:hidden" aria-live="polite">
                <span className="live-dot size-1.5 rounded-full bg-coral" aria-hidden="true" />
                {latest.text}
              </p>
            )}
          </header>

          {run.status === "needs_input" && run.pendingInput && <EntityPicker runId={run.id} input={run.pendingInput} onDone={refresh} />}

          {run.status === "error" && (
            <div className="mt-6 max-w-2xl border-t-2 border-coral pt-3">
              <p className="font-semibold">The run stopped before it finished.</p>
              <p className="mt-1 text-sm text-ink-soft">{run.error}</p>
              <Link href="/" className={buttonClass("secondary", "mt-4")}>
                Start again
              </Link>
            </div>
          )}

          {live && !hasResults && <Working text={latest?.text} />}

          {run.summary && <Summary text={run.summary} />}

          {hasResults && (
            <>
              <div role="tablist" aria-label="Results" className="mt-8 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-rule">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    role="tab"
                    id={`tab-${t.id}`}
                    aria-selected={tab === t.id}
                    aria-controls={`panel-${t.id}`}
                    onClick={() => setTab(t.id)}
                    className="-mb-px shrink-0 border-b-2 border-transparent px-3 py-2.5 text-sm font-semibold text-ink-soft transition-colors hover:text-ink aria-selected:border-ink aria-selected:text-ink"
                  >
                    {t.label}
                    {t.id === "pitch" && data.pitches.some((p) => p.approved) && <span className="ml-1.5 text-ok">· approved</span>}
                  </button>
                ))}
              </div>
              <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="pt-6">
                {tab === "shortlist" && <Shortlist data={data} onPitch={openPitch} onCity={openCity} />}
                {tab === "grid" && <CityGrid data={data} onCity={openCity} />}
                {tab === "cities" && city && <CityDetail data={data} city={city} onCity={setCity} />}
                {tab === "pitch" && <PitchPackPanel data={data} brandId={pitchBrand} onBrandChange={setPitchBrand} onChanged={refresh} />}
              </div>
            </>
          )}
        </div>
      </main>
    </ProvenanceProvider>
  );
}

function Summary({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="mt-5 max-w-[62ch]">
      <p className={`leading-relaxed ${open ? "" : "line-clamp-3"}`}>
        <span className="mr-1.5">
          <AgentLabel />
        </span>
        {text}
      </p>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="mt-1 text-sm font-semibold text-ink-soft underline-offset-4 hover:text-ink hover:underline">
        {open ? "Show less" : "Read the full summary"}
      </button>
    </section>
  );
}

function Working({ text }: { text?: string }) {
  return (
    <section className="mt-10 max-w-2xl">
      <p className="display text-[3.2rem] sm:text-[4rem]">Printing the tour</p>
      <p className="mt-3 text-lg leading-relaxed text-ink-soft">
        Overlap is reading Qloo&apos;s taste data city by city. The shortlist appears once every number has been checked, usually in one to two
        minutes.
      </p>
      {text && (
        <p className="mt-6 flex items-center gap-2 font-medium">
          <span className="live-dot size-2 rounded-full bg-coral" aria-hidden="true" />
          {text}
        </p>
      )}
    </section>
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
    <section className="mt-8 max-w-2xl">
      <h2 className="display text-[2.4rem]">Did you mean…</h2>
      <p className="mt-2 text-ink-soft">{input.question}</p>
      <ul className="mt-4 divide-y divide-rule border-y border-ink">
        {input.candidates.map((c) => (
          <li key={c.entity_id}>
            <button
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
              className="group flex w-full items-center justify-between gap-4 px-2 py-3 text-left transition-colors hover:bg-ink hover:text-on-ink disabled:opacity-40"
            >
              <span>
                <span className="block font-semibold">{c.name}</span>
                {c.description && <span className="block text-sm text-ink-soft group-hover:text-on-ink-soft">{c.description}</span>}
              </span>
              <span className="text-sm font-semibold text-coral-ink group-hover:text-coral">Use this</span>
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="mt-3 text-sm text-coral-ink">{error}</p>}
      <Link href="/" className={buttonClass("ghost", "mt-3 px-0")}>
        None of these: start over
      </Link>
    </section>
  );
}
