"use client";

import dynamic from "next/dynamic";
import type { CityState, Progress } from "@/lib/progress";

/* While the agent works: one stage (the tour route), one line saying what is happening, one counter.
   Everything on screen follows the bus, so nothing announces a city the bus has not reached.
   Lists and detail wait for the results. */

const TourRoute = dynamic(() => import("./TourRoute").then((m) => m.TourRoute), {
  ssr: false,
  loading: () => <div className="h-[15rem] sm:h-[24rem]" aria-hidden="true" />,
});

export function Discoveries({
  progress,
  states,
  cities,
  done,
  replaying,
  onFinished,
  here,
  visited,
  onArrive,
  onLeave,
}: {
  progress: Progress;
  states: Record<string, CityState>;
  cities: string[];
  done: boolean;
  replaying: boolean;
  onFinished: () => void;
  here: string | null;
  visited: string[];
  onArrive: (city: string) => void;
  onLeave: () => void;
}) {
  const printed = cities.filter((c) => states[c] === "printed").length;
  const finished = done && printed === cities.length;

  // The caption follows the bus: the newest line about the city it is at (or last left),
  // never a line about a city it has not reached yet.
  const ahead = cities.filter((c) => c !== here && !visited.includes(c));
  const behindBus = progress.lines.filter((l) => !ahead.some((c) => l.text.includes(c)) && !(l.key === "writing" && ahead.length > 0));
  const focus = here ?? visited.at(-1);
  const line =
    (focus ? [...behindBus].reverse().find((l) => l.text.includes(focus)) : undefined) ?? behindBus.at(-1) ?? progress.lines.at(-1);

  return (
    <section className="mt-6" aria-label="Overlap at work">
      <div className="-mx-4 border-y border-ink bg-paper sm:-mx-8">
        <TourRoute
          cities={cities}
          states={states}
          visitOrder={progress.visitOrder}
          cityBrands={progress.cityBrands}
          done={done}
          onFinished={onFinished}
          here={here}
          visited={visited}
          onArrive={onArrive}
          onLeave={onLeave}
        />
      </div>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
        <div aria-live="polite">
          <p className="flex items-center gap-2.5 text-lg font-semibold">
            {finished ? (
              <span className="size-2 rounded-full bg-ok" aria-hidden="true" />
            ) : (
              <span className="live-dot size-2 rounded-full bg-coral" aria-hidden="true" />
            )}
            {finished ? "Every city read. Opening your results…" : (line?.text ?? "Getting on the road")}
          </p>
          <p className="mt-1.5 font-mono text-sm text-ink-soft tnum">
            {printed} of {cities.length} cities · {progress.brandsScanned} brands checked
          </p>
        </div>
        {(replaying || done) && (
          <button type="button" onClick={onFinished} className="text-sm font-semibold text-ink-soft underline-offset-4 hover:text-ink hover:underline">
            {replaying && !done ? "Skip to results" : "See results now"}
          </button>
        )}
      </div>
    </section>
  );
}
