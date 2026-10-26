"use client";

import dynamic from "next/dynamic";
import type { Progress } from "@/lib/progress";

/* While the agent works: one stage (the tour route), one line saying what is happening, one counter.
   Lists and detail wait for the results. */

const TourRoute = dynamic(() => import("./TourRoute").then((m) => m.TourRoute), {
  ssr: false,
  loading: () => <div className="h-[19rem] sm:h-[24rem]" aria-hidden="true" />,
});

export function Discoveries({
  progress,
  cities,
  done,
  replaying,
  onFinished,
}: {
  progress: Progress;
  cities: string[];
  done: boolean;
  replaying: boolean;
  onFinished: () => void;
}) {
  const printed = cities.filter((c) => progress.cities[c] === "printed").length;
  const latest = progress.lines.at(-1);
  const top = progress.brands[0];

  return (
    <section className="mt-6" aria-label="Overlap at work">
      <div className="-mx-4 border-y border-ink bg-paper sm:-mx-8">
        <TourRoute
          cities={cities}
          states={progress.cities}
          visitOrder={progress.visitOrder}
          cityBrands={progress.cityBrands}
          done={done}
          onFinished={onFinished}
        />
      </div>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
        <div aria-live="polite">
          <p className="flex items-center gap-2.5 text-lg font-semibold">
            {done ? (
              <span className="size-2 rounded-full bg-ok" aria-hidden="true" />
            ) : (
              <span className="live-dot size-2 rounded-full bg-coral" aria-hidden="true" />
            )}
            {done ? "Every city read. Opening your results…" : (latest?.text ?? "Getting on the road")}
          </p>
          <p className="mt-1.5 font-mono text-sm text-ink-soft tnum">
            {printed} of {cities.length} cities · {progress.brandsScanned} brands checked
            {top ? ` · leading so far: ${top.name}` : ""}
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
