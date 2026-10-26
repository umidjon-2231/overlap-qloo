"use client";

import { BRAND_CATEGORIES, type BrandCategory, type PropertyType } from "@overlap/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { api, type Preset, type RunSummary } from "@/lib/api";
import { Button, StatusPill } from "./ui";

const DEFAULT_CATEGORIES: BrandCategory[] = ["drinks", "electronics", "fashion", "travel"];

export function Home() {
  const router = useRouter();
  const [presets, setPresets] = useState<Preset[] | null>(null);
  const [recent, setRecent] = useState<RunSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api.presets().then(setPresets).catch((e: Error) => setError(`Could not reach the Overlap API: ${e.message}`));
    api.runs().then(setRecent).catch(() => setRecent([]));
  }, []);

  async function launch(key: string, input: Parameters<typeof api.createRun>[0]) {
    setBusy(key);
    setError(null);
    try {
      const { runId } = await api.createRun(input);
      router.push(`/run/${runId}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  return (
    <main className="flex-1">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)]">
        <div className="px-4 pb-14 pt-12 sm:px-8 lg:pt-16">
          <h1 className="display text-[3.6rem] sm:text-[5.25rem] xl:text-[6rem]">Tell us your tour.</h1>
          <p className="display-wide mt-4 max-w-[28ch] text-[1.5rem] leading-snug sm:text-[1.9rem]">
            We tell you which brands to pitch, in which cities, and why.
          </p>
          <p className="mt-5 max-w-[60ch] leading-relaxed text-ink-soft">
            Overlap reads Qloo&apos;s taste graph to find brands your fans already love, checks how each city changes the picture, finds local
            partners near the fans, and drafts a pitch pack you approve before anything leaves the app.
          </p>

          {error && <p className="mt-6 max-w-2xl border-t-2 border-coral pt-2 text-sm">{error}</p>}

          <section aria-labelledby="your-tour" className="mt-12">
            <div className="mb-5 border-b border-ink pb-2">
              <h2 id="your-tour" className="display text-[1.9rem]">
                Your tour
              </h2>
            </div>
            <InventoryForm busy={busy === "custom"} onSubmit={(input) => launch("custom", input)} />
          </section>
        </div>

        <section aria-labelledby="demos" className="on-ink bg-ink px-4 pb-8 pt-10 text-on-ink sm:px-8 lg:pt-16">
          <h2 id="demos" className="display text-[1.9rem]">
            Demo tours
          </h2>
          <p className="mt-1 text-sm text-on-ink-soft">Opens the latest result instantly. Re-run to watch Overlap work live.</p>
          <ul className="mt-6 border-b border-on-ink-rule">
            {presets === null && [0, 1, 2].map((i) => <li key={i} className="h-44 border-t border-on-ink-rule" aria-hidden="true" />)}
            {presets?.map((p) => (
              <li key={p.id} className="border-t border-on-ink-rule py-6">
                <h3 className="display text-[2.4rem]">{p.artists.map((a) => a.query).join(" · ")}</h3>
                <p className="display mt-1 text-[1.3rem] leading-[1.1] text-on-ink-soft">{p.cities.join(" / ")}</p>
                <p className="mt-2 text-sm text-on-ink-soft">
                  {p.propertyType === "festival" ? "Festival" : "Artist tour"} · {p.blurb}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <Button onClick={() => launch(p.id, { ...p, presetId: p.id })} disabled={busy !== null}>
                    {busy === p.id ? "Opening…" : "Open result"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => launch(`${p.id}-fresh`, { ...p, presetId: p.id, fresh: true })}
                    disabled={busy !== null}
                    className="text-sm text-on-ink-soft underline-offset-4 hover:text-on-ink hover:underline disabled:opacity-40"
                  >
                    {busy === `${p.id}-fresh` ? "Starting…" : "Re-run live"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="px-4 py-14 sm:px-8">
        <section aria-labelledby="recent" className="max-w-3xl">
          <div className="mb-2 border-b border-ink pb-2">
            <h2 id="recent" className="display text-[1.9rem]">
              Recent runs
            </h2>
          </div>
          {recent === null && <p className="py-3 text-sm text-ink-soft">Loading…</p>}
          {recent?.length === 0 && <p className="py-3 text-sm text-ink-soft">No runs yet. Open a demo tour or enter your own.</p>}
          <ul>
            {recent?.slice(0, 8).map((r) => (
              <li key={r.id} className="border-b border-rule">
                <Link href={`/run/${r.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-coral-ink">
                  <span className="truncate font-medium">{r.propertyName}</span>
                  <StatusPill status={r.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <footer className="border-t border-rule px-4 py-5 text-xs text-ink-soft sm:px-8">
        Affinity scores are aggregate taste signals from Qloo, not forecasts. Names identify; they do not imply endorsement.
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

function InventoryForm({ busy, onSubmit }: { busy: boolean; onSubmit: (input: Parameters<typeof api.createRun>[0]) => void }) {
  const [type, setType] = useState<PropertyType>("artist_tour");
  const [name, setName] = useState("");
  const [artists, setArtists] = useState("");
  const [cities, setCities] = useState("");
  const [categories, setCategories] = useState<BrandCategory[]>(DEFAULT_CATEGORIES);

  const artistList = splitList(artists);
  const cityList = splitList(cities);
  const tooMany = artistList.length > 5 ? "Up to 5 artists." : cityList.length > 8 ? "Up to 8 cities." : null;
  const valid = artistList.length > 0 && cityList.length > 0 && categories.length > 0 && !tooMany;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    onSubmit({
      propertyType: type,
      propertyName: name.trim() || `${artistList.join(" + ")}: ${type === "festival" ? "festival" : "tour"}`,
      artists: artistList.map((query) => ({ query })),
      cities: cityList,
      categories,
    });
  }

  const toggle = (c: BrandCategory) =>
    setCategories((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : cur.length >= 6 ? cur : [...cur, c]));

  return (
    <form onSubmit={submit} className="grid max-w-2xl gap-6">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Property</legend>
        <div className="inline-flex border border-ink">
          {(["artist_tour", "festival"] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={type === t}
              onClick={() => setType(t)}
              className="px-4 py-2 text-sm font-semibold transition-colors hover:bg-paper-2 aria-pressed:bg-ink aria-pressed:text-on-ink"
            >
              {t === "artist_tour" ? "Artist tour" : "Festival"}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="grid gap-1.5 text-sm">
        <span className="font-semibold">{type === "festival" ? "Headliners" : "Artist"}</span>
        <input
          value={artists}
          onChange={(e) => setArtists(e.target.value)}
          placeholder={type === "festival" ? "Comma-separated, up to 5" : "e.g. Phoebe Bridgers"}
          className={inputClass}
        />
        <span className="text-xs text-ink-soft">If a name is ambiguous, Overlap asks you to pick the right one.</span>
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="font-semibold">Cities</span>
        <input value={cities} onChange={(e) => setCities(e.target.value)} placeholder="e.g. Chicago, Austin, New York City" className={inputClass} />
        <span className="text-xs text-ink-soft">Up to 8. Major US and European cities have the strongest data.</span>
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="font-semibold">
          Name <span className="font-normal text-ink-soft">(optional)</span>
        </span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fall arena tour 2027" className={inputClass} />
      </label>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Brand categories to pitch</legend>
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
        <span className="mt-2 block text-xs text-ink-soft">Up to 6. Overlap may add one wildcard category, labelled as its suggestion.</span>
      </fieldset>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={!valid || busy}>
          {busy ? "Starting…" : "Find sponsors"}
        </Button>
        {tooMany && <span className="text-sm text-coral-ink">{tooMany}</span>}
      </div>
    </form>
  );
}
