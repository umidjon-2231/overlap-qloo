"use client";

import { useEffect, useRef } from "react";
import type { Progress } from "@/lib/progress";

/** The screen-print pull loop (rendered in Blender: brand/blender/screenprint_loop.py). Paused under reduced motion. */
function PressLoop() {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) v.pause();
    else void v.play().catch(() => {});
  }, []);
  return (
    <video
      ref={ref}
      className="aspect-[8/5] w-full max-w-[24rem] justify-self-center mix-blend-darken md:justify-self-end"
      muted
      loop
      playsInline
      preload="auto"
      poster="/motion/screenprint-poster.webp"
      aria-hidden="true"
    >
      <source src="/motion/screenprint-loop.webm" type="video/webm" />
      <source src="/motion/screenprint-loop.mp4" type="video/mp4" />
    </video>
  );
}

/* While the agent works, the main area fills with early findings straight from Qloo results:
   brands surfacing by affinity, and short notes from each city as they land. */

export function Discoveries({ progress, total, replaying, onSkip }: { progress: Progress; total: number; replaying: boolean; onSkip?: () => void }) {
  const printed = Object.values(progress.cities).filter((s) => s === "printed").length;
  const latest = progress.lines.at(-1);
  const brands = progress.brands.slice(0, 8);
  const top = brands[0]?.affinity ?? 1;
  const notes = [...progress.notes].reverse().slice(0, 8);

  return (
    <section className="mt-8" aria-live="polite">
      <div className="grid items-center gap-x-10 gap-y-4 md:grid-cols-[minmax(0,1fr)_minmax(14rem,24rem)]">
        <div>
          <p className="display text-[3rem] sm:text-[3.6rem]">Printing the tour</p>
          <p className="mt-2 flex items-center gap-2 font-medium">
            <span className="live-dot size-2 rounded-full bg-coral" aria-hidden="true" />
            {latest?.text ?? "Getting started"}
          </p>
          <p className="mt-4 font-mono text-sm text-ink-soft tnum">
            {progress.brandsScanned} brands scanned · {progress.lookups} Qloo lookups · {printed} of {total} cities printed
          </p>
          {replaying && onSkip && (
            <button type="button" onClick={onSkip} className="mt-4 text-sm font-semibold text-ink-soft underline-offset-4 hover:text-ink hover:underline">
              Skip to results
            </button>
          )}
        </div>
        <PressLoop />
      </div>

      <div className="mt-8 grid gap-x-12 gap-y-10 xl:grid-cols-2">
        <div>
          <h2 className="display border-b-2 border-ink pb-2 text-[1.6rem]">Brands fans already love</h2>
          {brands.length === 0 ? (
            <p className="py-4 text-sm text-ink-soft">Brands appear here as Qloo returns them.</p>
          ) : (
            <ol>
              {brands.map((b) => (
                <li key={b.id} className="log-enter grid grid-cols-[1fr_auto] items-baseline gap-x-4 border-b border-rule py-2.5">
                  <span className="min-w-0">
                    <span className="font-semibold">{b.name}</span>
                    <span className="ml-2 text-xs text-ink-soft">{b.category}</span>
                  </span>
                  <span className="font-mono text-sm text-evidence tnum">{b.affinity.toFixed(3)}</span>
                  <span className="col-span-2 mt-1.5 block h-1 bg-paper-2" aria-hidden="true">
                    <span
                      className="block h-full bg-evidence transition-[width] duration-700 ease-out"
                      style={{ width: `${Math.max(4, ((b.affinity - 0.6) / (top - 0.6)) * 100)}%` }}
                    />
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div>
          <h2 className="display border-b-2 border-ink pb-2 text-[1.6rem]">From the road</h2>
          {notes.length === 0 ? (
            <p className="py-4 text-sm text-ink-soft">Notes from each city appear here as Overlap reads them.</p>
          ) : (
            <ul>
              {notes.map((n) => (
                <li key={n.key} className="log-enter border-b border-rule py-3">
                  <span className="display mr-2 text-[1.15rem]">{n.city}</span>
                  <span className="text-sm">{n.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <p className="mt-6 max-w-[72ch] text-xs leading-relaxed text-ink-soft">
        Early findings straight from Qloo. Overlap checks every number before the final shortlist appears.
      </p>
    </section>
  );
}
