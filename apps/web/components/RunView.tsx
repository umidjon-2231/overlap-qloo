"use client";

import type { RunEvent } from "@overlap/shared";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, type RunPayload } from "@/lib/api";
import { deriveProgress } from "@/lib/progress";
import { PitchPackPanel } from "./PitchPackPanel";
import { ProvenanceProvider } from "./Provenance";
import { BestBets, CityDetail, CityGrid, LlmOnlyView, Shortlist } from "./Results";
import { TourStack } from "./TourStack";
import { Discoveries } from "./Discoveries";
import { AgentLabel, Button, SectionTitle, buttonClass } from "./ui";

const EVENT_TYPES = ["status", "agent_text", "tool_start", "tool_end", "needs_input", "result", "error"] as const;

const TABS = [
  { id: "shortlist", label: "Brands" },
  { id: "cities", label: "Cities" },
  { id: "compare", label: "Compare" },
] as const;
// The pitch is a focused view opened from a brand, not a tab.
type Tab = (typeof TABS)[number]["id"] | "pitch";

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

  // Replay a finished run: its recorded events, compressed to about 25 seconds.
  const [replayCount, setReplayCount] = useState<number | null>(null);
  const timers = useRef<number[]>([]);
  const stopReplay = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setReplayCount(null);
  }, []);
  useEffect(() => stopReplay, [stopReplay]);
  // Where the tour bus is and has been: the stage's clock. A city prints only once the bus has
  // been there and the agent has finished it, so the stage, the rail and the counter never run ahead.
  const [busAt, setBusAt] = useState<string | null>(null);
  const [busVisited, setBusVisited] = useState<string[]>([]);
  const onArrive = useCallback((c: string) => {
    setBusAt(c);
    setBusVisited((v) => (v.includes(c) ? v : [...v, c]));
  }, []);
  const onLeave = useCallback(() => setBusAt(null), []);

  const startReplay = useCallback(() => {
    if (events.length === 0) return;
    stopReplay();
    setBusAt(null);
    setBusVisited([]);
    const t0 = Date.parse(events[0]!.at);
    const total = Date.parse(events.at(-1)!.at) - t0;
    const scale = total > 0 ? Math.min(1, 24_000 / total) : 0;
    setReplayCount(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
    events.forEach((e, i) => timers.current.push(window.setTimeout(() => setReplayCount(i + 1), 700 + (Date.parse(e.at) - t0) * scale)));
    // The stage ends the replay once the bus has finished the route; this is only a safety net.
    timers.current.push(window.setTimeout(stopReplay, 700 + total * scale + 45_000));
  }, [events, stopReplay]);
  const replaying = replayCount !== null;

  // Opened from a demo with ?watch=1: play the ride first, once the recorded events have arrived.
  const [pendingWatch, setPendingWatch] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("watch") === "1") {
      setPendingWatch(true);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);
  useEffect(() => {
    if (!pendingWatch || !data) return;
    if (data.run.status !== "done") return setPendingWatch(false);
    if (events.length === 0) return;
    // Events stream in as a burst; start once it settles.
    const t = window.setTimeout(() => {
      setPendingWatch(false);
      startReplay();
    }, 450);
    return () => window.clearTimeout(t);
  }, [pendingWatch, data, events.length, startReplay]);

  // A run watched live keeps its stage until the bus finishes the route, then the results open.
  const [watching, setWatching] = useState(false);
  const status = data?.run.status;
  useEffect(() => {
    if (status === "running") setWatching(true);
    if (status === "error" || status === "needs_input") setWatching(false);
  }, [status]);
  const finishStage = useCallback(() => {
    setWatching(false);
    setPendingWatch(false);
    stopReplay();
  }, [stopReplay]);

  const progress = useMemo(() => {
    if (!data) return null;
    return replaying
      ? deriveProgress(events.slice(0, replayCount), data.run.cities, "running")
      : deriveProgress(events, data.run.cities, data.run.status);
  }, [events, data, replaying, replayCount]);

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

  const staging = replaying || pendingWatch || (watching && (data.run.status === "running" || data.run.status === "done"));
  const run = replaying ? { ...data.run, status: "running" as const } : data.run;
  const view = replaying ? { ...data, run } : data;
  const hasResults = data.brands.length > 0 && !staging;
  const stageDone = data.run.status === "done" && (!replaying || (replayCount ?? 0) >= events.length);
  const stageStates = Object.fromEntries(
    run.cities.map((c) => [
      c,
      c === busAt ? "working" : busVisited.includes(c) ? (progress.cities[c] === "printed" ? "printed" : "working") : "queued",
    ]),
  ) as typeof progress.cities;
  const shown = staging ? { ...progress, cities: stageStates } : progress;

  const openPitch = (id: string) => {
    setPitchBrand(id);
    setTab("pitch");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openCity = (c: string) => {
    setCity(c);
    setTab("cities");
  };

  return (
    <ProvenanceProvider>
      <main className="flex flex-1 flex-col lg:flex-row">
        {/* While the agent works, the ink rail shows the tour; finished results get the full width. */}
        {(staging || run.status === "running" || run.status === "needs_input") && (
          <div className="bg-ink lg:shrink-0">
            <TourStack data={view} progress={shown} quiet={staging} selectedCity={tab === "cities" ? city : null} onSelectCity={openCity} />
          </div>
        )}

        <div className="mx-auto w-full min-w-0 max-w-[76rem] flex-1 px-4 pb-16 pt-6 sm:px-8 lg:pt-8">
          <header className="max-w-[72rem]">
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
              <h1 className="display-wide text-[2rem] leading-tight sm:text-[2.4rem]">{run.propertyName}</h1>
              {data.run.status === "done" && !staging && events.length > 0 && (
                <Button variant="ghost" onClick={startReplay}>
                  ▶ Replay how Overlap did it
                </Button>
              )}
            </div>
            <p className="mt-1 text-sm text-ink-soft">
              {run.cities.length} {run.cities.length === 1 ? "city" : "cities"} · {run.artists.map((a) => a.name ?? a.query).join(", ")}
              {run.grounding && (
                <>
                  {" · "}
                  <span className="text-evidence">
                    {run.grounding.violations.length === 0
                      ? "✓ every brand and venue checked against Qloo"
                      : `${run.grounding.checked - run.grounding.violations.length} of ${run.grounding.checked} brands and venues checked against Qloo`}
                  </span>
                </>
              )}
            </p>
          </header>

          {run.status === "needs_input" && run.pendingInput && <EntityPicker runId={run.id} input={run.pendingInput} onDone={refresh} />}

          {run.status === "error" && (
            <div className="mt-6 max-w-2xl border-t-2 border-warn pt-3">
              <p className="font-semibold">The run stopped before it finished.</p>
              <p className="mt-1 text-sm text-ink-soft">{run.error}</p>
              <Link href="/" className={buttonClass("secondary", "mt-4")}>
                Start again
              </Link>
            </div>
          )}

          {staging && (
            <Discoveries
              progress={progress}
              states={stageStates}
              cities={run.cities}
              done={stageDone}
              replaying={replaying}
              onFinished={finishStage}
              here={busAt}
              visited={busVisited}
              onArrive={onArrive}
              onLeave={onLeave}
            />
          )}

          {hasResults && tab !== "pitch" && <BestBets data={data} />}
          {run.summary && !staging && tab !== "pitch" && <Summary text={run.summary} />}

          {hasResults && tab === "pitch" && (
            <div className="pt-6">
              <button
                type="button"
                onClick={() => setTab("shortlist")}
                className="mb-4 text-sm font-semibold text-ink-soft underline-offset-4 hover:text-ink hover:underline"
              >
                ← Back to all brands
              </button>
              <PitchPackPanel data={data} brandId={pitchBrand} onBrandChange={setPitchBrand} onChanged={refresh} />
            </div>
          )}

          {hasResults && tab !== "pitch" && (
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
                  </button>
                ))}
              </div>
              <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="pt-6">
                {tab === "shortlist" && <Shortlist data={data} onPitch={openPitch} onCity={openCity} />}
                {tab === "cities" && city && <CityDetail data={data} city={city} onCity={setCity} />}
                {tab === "compare" && (
                  <div className="grid gap-14">
                    <CityGrid data={data} onCity={openCity} />
                    <section>
                      <SectionTitle title="With Qloo vs without" hint="What the same AI picks with no Qloo fan data" />
                      <LlmOnlyView data={data} onChanged={refresh} />
                    </section>
                  </div>
                )}
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
    <section className="mt-3 max-w-[62ch]">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="text-sm font-semibold text-ink-soft underline-offset-4 hover:text-ink hover:underline">
        {open ? "Hide Overlap's notes" : "Read Overlap's notes"}
      </button>
      {open && (
        <p className="mt-2 leading-relaxed">
          <span className="mr-1.5">
            <AgentLabel />
          </span>
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
              <span className="shrink-0 whitespace-nowrap text-sm font-semibold text-coral-ink group-hover:text-coral">Use this</span>
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
