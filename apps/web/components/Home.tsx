"use client";

import { BRAND_CATEGORIES, type BrandCategory, type PropertyType } from "@overlap/shared";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { api, type Preset } from "@/lib/api";
import { Button } from "./ui";

const DEFAULT_CATEGORIES: BrandCategory[] = ["drinks", "electronics", "fashion", "travel"];

export function Home() {
  const router = useRouter();
  const [presets, setPresets] = useState<Preset[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api.presets().then(setPresets).catch((e: Error) => setError(`Could not reach the Overlap API: ${e.message}`));
  }, []);

  async function launch(key: string, input: Parameters<typeof api.createRun>[0]) {
    setBusy(key);
    setError(null);
    try {
      const { runId, cached } = await api.createRun(input);
      // A ready-made demo result opens with the ride replayed first, so visitors see Overlap at work.
      router.push(cached ? `/run/${runId}?watch=1` : `/run/${runId}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  return (
    <main className="flex-1">
      <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-12 sm:px-8 lg:pt-16">
        <h1 className="display text-[3.4rem] sm:text-[5rem]">Find sponsors for your tour.</h1>
        <p className="mt-4 max-w-[52ch] text-lg leading-relaxed text-ink-soft">
          Name the artist and the cities. Overlap shows which brands the fans already love, where they fit best, and writes the pitch for you.
        </p>

        <ol className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            ["1", "Enter your tour", "Artist and cities."],
            ["2", "Get a brand list", "Ranked by how much the fans love each brand."],
            ["3", "Send a pitch", "Overlap drafts it, you edit and approve."],
          ].map(([n, title, text]) => (
            <li key={n} className="flex gap-3 border-t-2 border-ink pt-3">
              <span className="display text-[1.9rem] leading-none">{n}</span>
              <span>
                <span className="block font-semibold">{title}</span>
                <span className="block text-sm text-ink-soft">{text}</span>
              </span>
            </li>
          ))}
        </ol>

        {error && <p className="mt-8 max-w-2xl border-t-2 border-warn pt-2 text-sm">{error}</p>}

        <section aria-labelledby="examples" className="mt-14">
          <h2 id="examples" className="display text-[1.9rem]">
            See an example
          </h2>
          <p className="mt-1 text-sm text-ink-soft">Ready-made results. One click, no waiting.</p>
          <ul className="mt-4 grid gap-3 md:grid-cols-3">
            {presets === null && [0, 1, 2].map((i) => <li key={i} className="h-40 bg-paper-2" aria-hidden="true" />)}
            {presets?.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => launch(p.id, { ...p, presetId: p.id })}
                  disabled={busy !== null}
                  className="on-ink group flex h-full w-full flex-col items-start bg-ink p-5 text-left text-on-ink transition-colors hover:bg-ink-2 disabled:opacity-60"
                >
                  <span className="display text-[1.9rem] leading-[0.95]">{p.artists.map((a) => a.query).join(" · ")}</span>
                  <span className="mt-2 text-sm text-on-ink-soft">
                    {p.propertyType === "festival" ? "Festival" : "Tour"} · {p.cities.join(", ")}
                  </span>
                  <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-semibold text-coral">
                    {busy === p.id ? "Opening…" : "Open example"}
                    <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
                      →
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="your-tour" className="mt-14">
          <h2 id="your-tour" className="display text-[1.9rem]">
            Or try your own tour
          </h2>
          <p className="mt-1 text-sm text-ink-soft">Takes about a minute.</p>
          <div className="mt-4">
            <TourForm busy={busy === "custom"} onSubmit={(input) => launch("custom", input)} />
          </div>
        </section>
      </div>

      <footer className="border-t border-rule px-4 py-5 text-xs text-ink-soft sm:px-8">
        Fan data comes from Qloo&apos;s taste graph: aggregate signals, not forecasts. Names identify; they do not imply endorsement.
      </footer>
    </main>
  );
}

const splitList = (s: string) =>
  s
    .split(/[,\n;]/)
    .map((x) => x.trim())
    .filter(Boolean);

const inputClass =
  "w-full rounded-[2px] border border-ink bg-sheet px-3 py-2.5 text-base placeholder:text-ink-soft focus:outline-2 focus:outline-offset-0 focus:outline-evidence";

function TourForm({ busy, onSubmit }: { busy: boolean; onSubmit: (input: Parameters<typeof api.createRun>[0]) => void }) {
  const [artists, setArtists] = useState("");
  const [cities, setCities] = useState("");
  const [more, setMore] = useState(false);
  const [type, setType] = useState<PropertyType>("artist_tour");
  const [name, setName] = useState("");
  const [categories, setCategories] = useState<BrandCategory[]>(DEFAULT_CATEGORIES);

  const artistList = splitList(artists);
  const cityList = splitList(cities);
  // Several artists means a festival bill.
  const kind: PropertyType = artistList.length > 1 ? "festival" : type;
  const tooMany = artistList.length > 5 ? "Up to 5 artists." : cityList.length > 8 ? "Up to 8 cities." : null;
  const valid = artistList.length > 0 && cityList.length > 0 && categories.length > 0 && !tooMany;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    onSubmit({
      propertyType: kind,
      propertyName: name.trim() || `${artistList.join(" + ")}: ${kind === "festival" ? "festival" : "tour"}`,
      artists: artistList.map((query) => ({ query })),
      cities: cityList,
      categories,
    });
  }

  const toggle = (c: BrandCategory) =>
    setCategories((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : cur.length >= 6 ? cur : [...cur, c]));

  return (
    <form onSubmit={submit} className="grid max-w-2xl gap-5">
      <label className="grid gap-1.5 text-sm">
        <span className="font-semibold">{kind === "festival" ? "Headliners" : "Artist"}</span>
        <input value={artists} onChange={(e) => setArtists(e.target.value)} placeholder="e.g. Phoebe Bridgers" className={inputClass} />
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="font-semibold">Cities</span>
        <input value={cities} onChange={(e) => setCities(e.target.value)} placeholder="e.g. Chicago, Austin, New York City" className={inputClass} />
        <span className="text-xs text-ink-soft">Separate with commas. Up to 8.</span>
      </label>

      <div>
        <button
          type="button"
          onClick={() => setMore(!more)}
          aria-expanded={more}
          className="text-sm font-semibold text-ink-soft underline-offset-4 hover:text-ink hover:underline"
        >
          {more ? "Hide options" : "More options"}
        </button>
        {more && (
          <div className="mt-4 grid gap-5 border-l-2 border-rule pl-4">
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">Brand types</legend>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(BRAND_CATEGORIES) as BrandCategory[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={categories.includes(c)}
                    onClick={() => toggle(c)}
                    className="rounded-[2px] border border-ink px-2.5 py-1 text-sm transition-colors hover:bg-paper-2 aria-pressed:bg-ink aria-pressed:text-on-ink"
                  >
                    {BRAND_CATEGORIES[c].label}
                  </button>
                ))}
              </div>
              <span className="mt-2 block text-xs text-ink-soft">Up to 6.</span>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">This is a</legend>
              <div className="inline-flex border border-ink">
                {(["artist_tour", "festival"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={kind === t}
                    onClick={() => setType(t)}
                    className="px-4 py-2 text-sm font-semibold transition-colors hover:bg-paper-2 aria-pressed:bg-ink aria-pressed:text-on-ink"
                  >
                    {t === "artist_tour" ? "Tour" : "Festival"}
                  </button>
                ))}
              </div>
              <span className="mt-2 block text-xs text-ink-soft">For a festival, list up to 5 headliners, separated by commas.</span>
            </fieldset>
            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold">Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fall arena tour 2027" className={inputClass} />
            </label>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={!valid || busy} className="px-5 py-2.5 text-base">
          {busy ? "Starting…" : "Find sponsors"}
        </Button>
        {tooMany && <span className="text-sm text-coral-ink">{tooMany}</span>}
      </div>
    </form>
  );
}
