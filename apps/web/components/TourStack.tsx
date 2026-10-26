"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { CityCell, RunPayload } from "@/lib/api";
import type { CityState, Progress } from "@/lib/progress";
import { StatusPill } from "./ui";

/* The back of the tour shirt: the tour's cities stacked in one size of condensed caps on the Ink rail.
   Each line prints from outline to solid ink as the agent finishes that city. */

const STAGGER_MS = 140;

export function TourStack({
  data,
  progress,
  selectedCity,
  onSelectCity,
}: {
  data: RunPayload;
  progress: Progress;
  selectedCity: string | null;
  onSelectCity: (city: string) => void;
}) {
  const { run } = data;
  const live = run.status === "running" || run.status === "needs_input";
  // Paint everything as outline first, then let the real states print in, staggered down the stack.
  const [painted, setPainted] = useState(false);
  const [intro, setIntro] = useState(true);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setPainted(true));
    const t = setTimeout(() => setIntro(false), run.cities.length * STAGGER_MS + 1000);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [run.cities.length]);

  const artists = run.artists.map((a) => a.name ?? a.query);
  const printedCount = run.cities.filter((c) => progress.cities[c] === "printed").length;

  return (
    <aside className="on-ink flex flex-col bg-ink text-on-ink lg:sticky lg:top-0 lg:h-[calc(100vh-3.5rem)] lg:w-[21rem] lg:shrink-0">
      <div className="border-b border-on-ink-rule px-5 pb-4 pt-5">
        <p className="display text-[2.1rem] text-on-ink">{artists.join(" · ")}</p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-sm text-on-ink-soft">
            {run.propertyType === "festival" ? "Festival" : "Artist tour"} · {run.cities.length} {run.cities.length === 1 ? "city" : "cities"}
          </span>
          <StatusPill status={run.status} onInk />
        </div>
      </div>

      <nav aria-label="Tour cities" className="no-scrollbar flex-1 overflow-x-auto lg:overflow-y-auto">
        <ol className="flex gap-1 px-3 py-3 lg:flex-col lg:gap-0 lg:px-0 lg:py-2">
          {run.cities.map((city, i) => {
            const state: CityState = painted ? progress.cities[city] ?? "queued" : "queued";
            const current = city === selectedCity;
            const marks = topLocal(data.cells, data.brands, city);
            return (
              <li key={city} className="shrink-0">
                <button
                  type="button"
                  className="stack-row group block w-full px-3 py-1.5 text-left transition-colors duration-150 hover:bg-ink-2 aria-[current=true]:bg-on-ink lg:px-5"
                  aria-current={current}
                  onClick={() => onSelectCity(city)}
                  style={{ "--print-delay": intro ? `${i * STAGGER_MS}ms` : "0ms" } as CSSProperties}
                >
                  <span className="display print-line text-[1.75rem] whitespace-nowrap lg:text-[2.25rem]" data-state={state}>
                    {city}
                    <span className="ink" aria-hidden="true">
                      {city}
                    </span>
                  </span>
                  <span className="sr-only">{state === "printed" ? " (done)" : state === "working" ? " (in progress)" : " (waiting)"}</span>
                  <span className={`block min-h-[1rem] truncate text-xs ${current ? "text-ink-soft" : "text-on-ink-soft"}`}>
                    {marks.length > 0
                      ? marks.map((m, j) => (
                          <span key={m.name}>
                            {j > 0 && "  ·  "}
                            {m.name} <span className="font-mono tnum">#{m.rank}</span>
                          </span>
                        ))
                      : run.status === "done"
                        ? "national fit"
                        : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <RunLog
        progress={progress}
        live={live}
        printed={printedCount}
        total={run.cities.length}
        seconds={run.usage ? run.usage.elapsedMs / 1000 : null}
        lookups={Math.max(progress.lookups, run.usage ? run.usage.qloo.calls + run.usage.qloo.cached : 0)}
      />
    </aside>
  );
}

function topLocal(cells: CityCell[], brands: RunPayload["brands"], city: string) {
  return cells
    .filter((c) => c.city === city && c.rankInCity != null)
    .sort((a, b) => a.rankInCity! - b.rankInCity!)
    .slice(0, 2)
    .map((c) => ({ name: brands.find((b) => b.brandEntityId === c.brandEntityId)?.brandName ?? "", rank: c.rankInCity! }));
}

function RunLog({
  progress,
  live,
  printed,
  total,
  seconds,
  lookups,
}: {
  progress: Progress;
  live: boolean;
  printed: number;
  total: number;
  seconds: number | null;
  lookups: number;
}) {
  const recent = progress.lines.slice(-4);
  return (
    <div className="hidden border-t border-on-ink-rule px-5 py-4 lg:block" aria-live="polite">
      <ol className="grid gap-1.5 text-sm">
        {recent.length === 0 &&
          (live ? (
            <li className="flex items-start gap-2 text-on-ink">
              <span className="live-dot mt-[7px] size-1.5 shrink-0 rounded-full bg-coral" aria-hidden="true" />
              Getting started
            </li>
          ) : (
            <li className="flex items-start gap-2 text-on-ink-soft">
              <Check />
              Every city read and every number checked against Qloo
            </li>
          ))}
        {recent.map((l, i) => {
          const latest = i === recent.length - 1;
          return (
            <li key={l.key} className={`log-enter flex items-start gap-2 ${latest && live ? "text-on-ink" : "text-on-ink-soft"}`}>
              {l.done ? <Check /> : <span className="live-dot mt-[7px] size-1.5 shrink-0 rounded-full bg-coral" aria-hidden="true" />}
              <span>{l.text}</span>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 font-mono text-[11px] text-on-ink-soft tnum">
        {printed}/{total} cities · {lookups} Qloo lookups{seconds != null && !live ? ` · ${Math.round(seconds)} s` : ""}
      </p>
    </div>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 12 12" className="mt-[3px] size-3 shrink-0 text-on-ink-soft" aria-hidden="true">
      <path d="M2 6.5 4.8 9 10 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
    </svg>
  );
}
