"use client";

import { BRAND_CATEGORIES, type BrandCategory, type PropertyType } from "@overlap/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { api, type Preset, type RunSummary } from "@/lib/api";
import { Button, Card, SectionTitle, StatusPill } from "./ui";

const DEFAULT_CATEGORIES: BrandCategory[] = ["drinks", "electronics", "fashion", "travel"];

export function Home() {
  const router = useRouter();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [recent, setRecent] = useState<RunSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api.presets().then(setPresets).catch((e: Error) => setError(e.message));
    api.runs().then(setRecent).catch(() => {});
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
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10">
      <section className="mb-10 max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Tell us your tour. We tell you which brands to pitch, in which cities, and why.
        </h1>
        <p className="mt-3 text-muted">
          Overlap is a sponsorship agent for sellers at promoters, festivals and artist teams. It reads Qloo&apos;s taste graph to
          find brands your fans already love, checks how each city changes the picture, finds local partners, and drafts a pitch
          pack you approve before anything leaves the app.
        </p>
      </section>

      {error && <p className="mb-6 rounded-md border border-decision/30 bg-decision-soft px-3 py-2 text-sm text-decision">{error}</p>}

      <SectionTitle title="Try a demo" hint="Loads a recent result instantly; re-run to watch the agent live" />
      <div className="mb-12 grid gap-4 md:grid-cols-3">
        {presets.map((p) => (
          <Card key={p.id} className="flex flex-col p-4">
            <div className="text-xs uppercase tracking-wide text-muted">{p.propertyType === "festival" ? "Festival" : "Artist tour"}</div>
            <div className="mt-1 font-semibold">{p.propertyName}</div>
            <div className="mt-1 text-sm text-muted">{p.blurb}</div>
            <div className="mt-3 text-xs text-muted">
              {p.artists.map((a) => a.query).join(" · ")}
              <br />
              {p.cities.join(" · ")}
            </div>
            <div className="mt-4 flex gap-2 pt-1">
              <Button onClick={() => launch(p.id, { ...p, presetId: p.id })} disabled={busy !== null}>
                {busy === p.id ? "Opening…" : "Open"}
              </Button>
              <Button variant="secondary" onClick={() => launch(`${p.id}-fresh`, { ...p, presetId: p.id, fresh: true })} disabled={busy !== null}>
                {busy === `${p.id}-fresh` ? "Starting…" : "Re-run live"}
              </Button>
            </div>
          </Card>
        ))}
        {presets.length === 0 && !error && <p className="text-sm text-muted">Loading presets…</p>}
      </div>

      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div>
          <SectionTitle step={1} title="Your inventory" hint="Property, artists, cities" />
          <InventoryForm busy={busy === "custom"} onSubmit={(input) => launch("custom", input)} />
        </div>
        <div>
          <SectionTitle title="Recent runs" />
          <Card className="divide-y divide-line">
            {recent.length === 0 && <p className="p-4 text-sm text-muted">No runs yet.</p>}
            {recent.slice(0, 8).map((r) => (
              <Link key={r.id} href={`/run/${r.id}`} className="flex items-center justify-between gap-3 p-3 text-sm hover:bg-zinc-50">
                <span className="truncate">{r.propertyName}</span>
                <StatusPill status={r.status} />
              </Link>
            ))}
          </Card>
        </div>
      </div>
    </main>
  );
}

const splitList = (s: string) =>
  s
    .split(/[,\n;]/)
    .map((x) => x.trim())
    .filter(Boolean);

function InventoryForm({ busy, onSubmit }: { busy: boolean; onSubmit: (input: Parameters<typeof api.createRun>[0]) => void }) {
  const [type, setType] = useState<PropertyType>("artist_tour");
  const [name, setName] = useState("");
  const [artists, setArtists] = useState("");
  const [cities, setCities] = useState("");
  const [categories, setCategories] = useState<BrandCategory[]>(DEFAULT_CATEGORIES);

  const artistList = splitList(artists);
  const cityList = splitList(cities);
  const valid = artistList.length > 0 && cityList.length > 0 && categories.length > 0 && artistList.length <= 5 && cityList.length <= 8;

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
    <Card className="p-5">
      <form onSubmit={submit} className="grid gap-4">
        <div className="flex gap-2">
          {(["artist_tour", "festival"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`rounded-md border px-3 py-1.5 text-sm ${type === t ? "border-foreground bg-foreground text-white" : "border-line"}`}
            >
              {t === "artist_tour" ? "Artist tour" : "Festival"}
            </button>
          ))}
        </div>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Property name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fall arena tour 2027" className="rounded-md border border-line px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">{type === "festival" ? "Headliners" : "Artist"}</span>
          <input
            value={artists}
            onChange={(e) => setArtists(e.target.value)}
            placeholder={type === "festival" ? "Comma-separated, up to 5" : "e.g. Phoebe Bridgers"}
            className="rounded-md border border-line px-3 py-2"
          />
          <span className="text-xs text-muted">Ambiguous names open a &quot;Did you mean…&quot; picker.</span>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Cities</span>
          <input value={cities} onChange={(e) => setCities(e.target.value)} placeholder="e.g. Chicago, Austin, New York City" className="rounded-md border border-line px-3 py-2" />
          <span className="text-xs text-muted">Up to 8. Major US/EU cities have the strongest data.</span>
        </label>
        <div className="grid gap-2 text-sm">
          <span className="font-medium">Brand categories to pitch</span>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(BRAND_CATEGORIES) as BrandCategory[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => toggle(c)}
                className={`rounded-full border px-3 py-1 text-xs ${categories.includes(c) ? "border-evidence bg-evidence-soft text-evidence" : "border-line text-muted"}`}
              >
                {BRAND_CATEGORIES[c].label}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted">The agent may add one wildcard category, labelled as its suggestion.</span>
        </div>
        <div>
          <Button type="submit" disabled={!valid || busy}>
            {busy ? "Starting…" : "Find sponsors"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
