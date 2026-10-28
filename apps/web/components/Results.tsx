"use client";

import { BRAND_CATEGORIES, isSensitiveTag, type BrandCategory } from "@overlap/shared";
import { useEffect, useState } from "react";
import { api, type BrandMatch, type CityProfile, type HeatCell, type Partner, type RunPayload } from "@/lib/api";
import { CallLink } from "./Provenance";
import { AgentLabel, Button, CoverageBadge, CoverageMark, SectionTitle, fmt } from "./ui";

const categoryLabel = (c: string | null) => (c && c in BRAND_CATEGORIES ? BRAND_CATEGORIES[c as BrandCategory].label : c === "any" ? "Any" : c ?? "");

/* ---------------- Shortlist: a ranked bill, top pick on a coral field ---------------- */

/** Cities where a brand ranks in the local top 3 for its category. */
function strongCities(data: RunPayload, brandId: string) {
  return data.run.cities
    .map((city) => ({ city, rank: data.cells.find((c) => c.brandEntityId === brandId && c.city === city)?.rankInCity ?? null }))
    .filter((x): x is { city: string; rank: number } => x.rank != null);
}

/** The plain-English answer: brands that fans love and that also lead in most of the tour's cities. */
export function BestBets({ data, onCompare }: { data: RunPayload; onCompare: () => void }) {
  const half = Math.ceil(data.run.cities.length / 2);
  const bets = data.brands
    .map((b, i) => ({ b, i, top3: strongCities(data, b.brandEntityId).filter((x) => x.rank <= 3).length }))
    .filter((x) => x.top3 >= half)
    .sort((a, b) => b.top3 - a.top3 || a.i - b.i)
    .slice(0, 3);
  const top = data.brands[0];
  if (!top) return null;
  const link = (b: BrandMatch) => (
    <button
      key={b.brandEntityId}
      type="button"
      onClick={() => document.getElementById(`brand-${b.brandEntityId}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
      className="underline decoration-coral decoration-2 underline-offset-4 hover:text-coral-ink">
      {b.brandName}
    </button>
  );
  // The #1 brand by fan fit always leads, so the answer and the ranked list below never disagree.
  const local = bets.map((x) => x.b).filter((b) => b.brandEntityId !== top.brandEntityId);
  const topIsLocal = local.length < bets.length;
  const names = local.map(link);
  const joined = names.flatMap((n, i) => (i === 0 ? [n] : [i === names.length - 1 ? " and " : ", ", n]));
  const where = data.run.cities.length === 1 ? `in ${data.run.cities[0]}` : "in most of your cities";
  return (
    <section className="mt-6 max-w-[62ch] border-l-4 border-coral pl-4">
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-ink-soft">The short answer</p>
      <p className="display-wide mt-1 text-[1.45rem] leading-snug">
        Lead with {link(top)}{local.length ? <>, then {joined}.</> : "."}
      </p>
      <p className="mt-1 text-ink-soft">
        {top.brandName} is the fans&apos; top match nationally{topIsLocal ? ` and a top-3 brand of its type ${where}` : ""}.{" "}
        {local.length
          ? `${local.length === 1 ? "The other is" : "The others are"} top-3 ${where}, so they travel well across the tour.`
          : bets.length
            ? ""
            : "No brand stands out locally, so pitch on national fan fit."}
      </p>
      <WhyQloo data={data} onCompare={onCompare} />
    </section>
  );
}

export function Shortlist({
  data,
  onPitch,
  onCity,
}: {
  data: RunPayload;
  onPitch: (brandId: string) => void;
  onCity: (city: string) => void;
}) {
  return (
    <section>
      <SectionTitle title="Brands to pitch" hint="Ranked by national fan fit: how much the artist's fans like each brand." />
      <ol className="border-b border-ink">
        {data.brands.map((b, i) => (
          <BrandRow
            key={b.brandEntityId}
            rank={i + 1}
            brand={b}
            strong={strongCities(data, b.brandEntityId)}
            pitch={data.pitches.find((p) => p.brandEntityId === b.brandEntityId)}
            onPitch={onPitch}
            onCity={onCity}
          />
        ))}
      </ol>
      {data.brands.length === 0 && <p className="text-sm text-ink-soft">No brands in this run.</p>}
    </section>
  );
}

const fitLabel = (score: number | null) => (score == null ? "" : score >= 90 ? "Excellent fit" : score >= 80 ? "Strong fit" : "Good fit");

function BrandRow({
  rank,
  brand,
  strong,
  pitch,
  onPitch,
  onCity,
}: {
  rank: number;
  brand: BrandMatch;
  strong: { city: string; rank: number }[];
  pitch?: RunPayload["pitches"][number];
  onPitch: (id: string) => void;
  onCity: (city: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const top = rank === 1;
  const q = brand.evidence.qloo;
  const soft = top ? "text-ink" : "text-ink-soft";
  return (
    <li id={`brand-${brand.brandEntityId}`} className={`grid scroll-mt-24 grid-cols-[2rem_1fr] gap-x-4 border-t border-ink px-3 py-5 sm:grid-cols-[2.5rem_1fr_auto] sm:px-4 ${top ? "bg-coral" : ""}`}>
      <div className="display pt-0.5 text-[1.9rem] tnum">{rank}</div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="display-wide text-[1.5rem] leading-tight">{brand.brandName}</h3>
          <span className={`text-sm ${soft}`}>
            {categoryLabel(brand.category)}
            {brand.source === "agent_wildcard" && " · wildcard idea"}
          </span>
        </div>

        {brand.agentNote && (
          <p className="mt-2 max-w-[68ch] leading-relaxed">
            <span className={`mr-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] ${soft}`}>Overlap suggests</span>
            {brand.agentNote}
          </p>
        )}

        <p className={`mt-3 text-sm ${soft}`}>
          {strong.length > 0 ? (
            <>
              <span className="mr-1">{brand.category && brand.category !== "any" ? `Rank among ${categoryLabel(brand.category)} brands:` : "City ranks:"}</span>
              {strong.map((s, i) => (
                <span key={s.city}>
                  {i > 0 && ", "}
                  <button type="button" onClick={() => onCity(s.city)} className="font-semibold text-ink underline-offset-4 hover:underline">
                    {s.city}
                  </button>{" "}
                  <span className="font-mono tnum">#{s.rank}</span>
                </span>
              ))}
            </>
          ) : (
            "A national fit: not in any city's local top list."
          )}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          <Button variant={top ? "secondary" : "primary"} onClick={() => onPitch(brand.brandEntityId)}>
            {pitch ? (pitch.approved ? "Pitch ready ✓" : "Open pitch draft") : "Write the pitch"}
          </Button>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className={`text-sm font-semibold underline-offset-4 hover:underline ${soft}`}
          >
            {open ? "Hide the data" : "Show the data"}
          </button>
        </div>

        {open && (
          <dl className={`mt-3 grid max-w-[68ch] grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-t pt-3 text-sm ${top ? "border-ink" : "border-rule"}`}>
            <dt className={soft}>Fan fit</dt>
            <dd>
              <span className="font-mono tnum">{brand.overlapScore ?? "–"}</span> = Qloo fan affinity <span className="font-mono tnum">{fmt(brand.affinity, 3)}</span> × 100
            </dd>
            <dt className={soft}>Popularity</dt>
            <dd className="font-mono tnum">{fmt(brand.popularity, 2)}</dd>
            {q.customerSegments?.length > 0 && (
              <>
                <dt className={soft}>Customers</dt>
                <dd>{q.customerSegments.slice(0, 3).join(", ")}</dd>
              </>
            )}
            {q.knownPartnerships?.length > 0 && (
              <>
                <dt className={soft}>Known partners</dt>
                <dd>{q.knownPartnerships.slice(0, 4).join(", ")}</dd>
              </>
            )}
            <dt className={soft}>Source</dt>
            <dd>
              <CallLink callId={brand.evidence.callId} label="See the Qloo lookup" onField={top} />
            </dd>
          </dl>
        )}
      </div>

      <div
        className="col-start-2 mt-3 flex items-baseline gap-2 sm:col-start-3 sm:mt-0 sm:flex-col sm:items-end sm:gap-0 sm:text-right"
        title="Fan fit = how much the artist's fans like this brand, from Qloo (affinity × 100)"
      >
        <span className={`display text-[3rem] tnum ${top ? "text-ink" : "text-evidence"}`}>{brand.overlapScore ?? "–"}</span>
        <span className={`text-xs font-semibold ${soft}`}>{top ? "Top fan fit" : fitLabel(brand.overlapScore)}</span>
      </div>
    </li>
  );
}

/** One line under the short answer that points at the with/without comparison, with its numbers once they exist. */
function WhyQloo({ data, onCompare }: { data: RunPayload; onCompare: () => void }) {
  const s = baselineStats(data);
  return (
    <p className="mt-3 text-sm">
      {s ? (
        <>
          Without Qloo, the same AI&apos;s picks average a fan fit of <b>{score(s.modelAvg)}</b>. This list averages{" "}
          <b className="text-evidence">{score(s.overlapAvg)}</b>.{" "}
        </>
      ) : (
        <>What would an AI pick without Qloo? </>
      )}
      <button type="button" onClick={onCompare} className="font-semibold text-coral-ink underline-offset-4 hover:underline">
        See the comparison →
      </button>
    </p>
  );
}

/* ---------------- LLM-only comparison ---------------- */

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Average Qloo fan affinity of the model's own picks vs Overlap's shortlist; null until the picks are scored. */
export function baselineStats(data: RunPayload) {
  const r = data.run.llmOnly;
  if (!r?.scored) return null;
  const model = r.picks.map((p) => p.qlooAffinity).filter((a): a is number => a != null);
  const overlap = data.brands.map((b) => b.affinity).filter((a): a is number => a != null);
  const modelAvg = mean(model);
  const overlapAvg = mean(overlap);
  if (modelAvg == null || overlapAvg == null) return null;
  const floor = Math.min(...overlap);
  return {
    modelAvg,
    overlapAvg,
    below: model.filter((a) => a < floor).length,
    unknown: r.picks.filter((p) => p.qlooAffinity == null && p.onShortlist == null).length,
  };
}

/** Affinity on the 0–100 "fan fit" scale the brand cards use. */
const score = (a: number) => Math.round(a * 100);

export function LlmOnlyView({ data, onChanged }: { data: RunPayload; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const result = data.run.llmOnly;
  const needsScores = !!result && !result.scored;

  // Comparisons saved before picks were scored in Qloo get their numbers once, on first view.
  useEffect(() => {
    if (!needsScores) return;
    api.llmOnly(data.run.id).then(onChanged, () => {});
  }, [needsScores, data.run.id, onChanged]);

  if (!result)
    return (
      <div className="max-w-[65ch]">
        <p className="leading-relaxed">
          What would a language model pitch on its own? Overlap asks the same model the same question with no Qloo data, so you can see which picks
          the taste graph backs up and what the model misses.
        </p>
        <Button
          className="mt-4"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await api.llmOnly(data.run.id);
              onChanged();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Asking the model… about 10 s" : "Ask the model without Qloo"}
        </Button>
        {error && <p className="mt-3 text-sm text-coral-ink">{error}</p>}
      </div>
    );

  const backed = result.picks.filter((p) => p.onShortlist != null).length;
  const s = baselineStats(data);
  return (
    <div>
      <p className="max-w-[72ch] text-[1.05rem] leading-relaxed">
        Without Qloo, the model named <b>{result.picks.length} brands</b>.{" "}
        {backed === 0 ? (
          <>None of them made Overlap&apos;s Qloo-grounded shortlist.</>
        ) : (
          <>
            <b className="text-evidence">{backed}</b> {backed === 1 ? "of them is" : "of them are"} on Overlap&apos;s Qloo-grounded shortlist.
          </>
        )}
        {s && (
          <>
            {" "}
            Scored against the same fans in Qloo, its picks average a fan fit of <b>{score(s.modelAvg)}</b>; Overlap&apos;s shortlist averages{" "}
            <b className="text-evidence">{score(s.overlapAvg)}</b>.
            {s.below > 0 && (
              <>
                {" "}
                {s.below} of its picks score below every brand on Overlap&apos;s list.
              </>
            )}
            {s.unknown > 0 && (
              <>
                {" "}
                {s.unknown} {s.unknown === 1 ? "pick isn't" : "picks aren't"} matched in Qloo.
              </>
            )}
          </>
        )}
        {result.missed.length > 0 && (
          <>
            {" "}
            It missed <b>{result.missed.length}</b> brands Qloo ranks highly for these fans.
          </>
        )}
      </p>

      <div className="mt-6 grid gap-x-12 gap-y-10 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div>
          <h3 className="display border-b-2 border-ink pb-2 text-[1.5rem]">The model&apos;s picks</h3>
          <ol>
            {result.picks.map((p, i) => (
              <li key={`${p.name}-${i}`} className="grid grid-cols-[1.75rem_1fr_auto] gap-x-3 border-b border-rule py-3">
                <span className="font-mono text-sm text-ink-soft tnum">{i + 1}</span>
                <span className="min-w-0">
                  <span className="font-semibold">{p.name}</span>
                  <span className="ml-2 text-xs text-ink-soft">{p.category}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-ink-soft">{p.why}</span>
                </span>
                <span className="flex flex-col items-end gap-1 self-start whitespace-nowrap">
                  {p.onShortlist != null && (
                    <span className="bg-evidence-soft px-1.5 py-0.5 font-mono text-[11px] text-evidence tnum">Overlap #{p.onShortlist}</span>
                  )}
                  {p.qlooAffinity != null && p.qlooCallId != null ? (
                    <CallLink callId={p.qlooCallId} label={`fan fit ${score(p.qlooAffinity)}`} />
                  ) : result.scored && p.onShortlist == null ? (
                    <span className="text-xs text-ink-soft">No Qloo match</span>
                  ) : p.onShortlist == null ? (
                    <span className="text-xs text-ink-soft">Not on shortlist</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h3 className="display border-b-2 border-ink pb-2 text-[1.5rem]">Qloo found, the model missed</h3>
          {result.missed.length === 0 ? (
            <p className="py-3 text-sm text-ink-soft">The model named every brand on the Qloo shortlist.</p>
          ) : (
            <ol>
              {result.missed.slice(0, 8).map((m) => (
                <li key={m.name} className="flex items-baseline justify-between gap-3 border-b border-rule py-2.5">
                  <span>
                    <span className="mr-2 font-mono text-sm text-ink-soft tnum">#{m.rank}</span>
                    <span className="font-semibold">{m.name}</span>
                  </span>
                  <span className="font-mono text-sm text-evidence tnum">{m.affinity != null ? score(m.affinity) : "–"}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
      <p className="mt-6 text-xs text-ink-soft">
        Model: {result.model}, asked once with the tour, cities and categories only. Each pick is then looked up in Qloo by exact brand name and
        scored against the same artist signal as the shortlist.
      </p>
    </div>
  );
}

/* ---------------- Brand × city grid ---------------- */

export function CityGrid({ data, onCity }: { data: RunPayload; onCity: (city: string) => void }) {
  const { brands, cells, profiles, standouts } = data;
  const cities = data.run.cities;
  const cell = (brandId: string, city: string) => cells.find((c) => c.brandEntityId === brandId && c.city === city);
  // Best shortlisted brand per city (lowest local rank, then highest local affinity).
  const bestInCity = new Map(
    cities.map((city) => {
      const ranked = cells
        .filter((c) => c.city === city && c.rankInCity != null)
        .sort((a, b) => a.rankInCity! - b.rankInCity! || (b.affinity ?? 0) - (a.affinity ?? 0));
      return [city, ranked[0]?.brandEntityId];
    }),
  );

  return (
    <section>
      <SectionTitle title="Brand by city" hint="Where each brand ranks in each city (#1 is best)" />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-sm">
          <thead>
            <tr className="text-left align-bottom">
              <th scope="col" className="w-[13rem] py-2 pr-3 font-semibold">
                Brand
              </th>
              {cities.map((city) => {
                const p = profiles.find((x) => x.city === city);
                return (
                  <th key={city} scope="col" className="px-3 py-2 font-normal">
                    <button type="button" onClick={() => onCity(city)} className="display text-left text-[1.35rem] hover:text-coral-ink">
                      {city}
                    </button>
                    <div className="mt-1">
                      <CoverageBadge coverage={p?.coverage ?? "none"} />
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="border-y border-ink">
            {brands.map((b) => (
              <tr key={b.brandEntityId} className="border-t border-rule first:border-t-0">
                <th scope="row" className="py-3 pr-3 text-left font-normal">
                  <div className="font-semibold">{b.brandName}</div>
                  <div className="text-xs text-ink-soft">{categoryLabel(b.category)}</div>
                </th>
                {cities.map((city) => {
                  const c = cell(b.brandEntityId, city);
                  const best = bestInCity.get(city) === b.brandEntityId;
                  if (!c || c.coverage === "none")
                    return (
                      <td
                        key={city}
                        className="px-3 py-3 text-xs text-ink-soft"
                        title="Not in this city's local top-30 ranking. Qloo's localised rankings favour brands with local signal and often omit national leaders, so this is not evidence of weak fit."
                      >
                        national fit
                      </td>
                    );
                  const strength = c.rankInCity! <= 1 ? "bg-evidence text-on-ink" : c.rankInCity! <= 3 ? "bg-evidence-soft text-evidence" : "text-evidence";
                  return (
                    <td key={city} className="px-1.5 py-1.5">
                      <div className={`px-1.5 py-1.5 ${strength} ${best ? "outline-2 -outline-offset-2 outline-coral" : ""}`}>
                        <div className="font-mono text-base font-semibold tnum">#{c.rankInCity}</div>
                                              </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="border-t border-ink align-top">
              <th scope="row" className="py-3 pr-3 text-left text-xs font-semibold">
                Also popular here (not on your list)
              </th>
              {cities.map((city) => (
                <td key={city} className="px-3 py-3 text-xs">
                  {(standouts[city] ?? []).slice(0, 4).map((s) => (
                    <div key={s.brandId} className="truncate" title={`local affinity ${fmt(s.localAffinity, 3)} (Qloo lookup #${s.callId})`}>
                      {s.name}
                    </div>
                  ))}
                  {(standouts[city] ?? []).length === 0 && <span className="text-ink-soft">–</span>}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 max-w-[80ch] text-xs leading-relaxed text-ink-soft">
        #1 means the brand tops that city&apos;s list for its own type (fashion, travel…), so a city can have several #1s. &quot;National
        fit&quot; means it is not on the city&apos;s list, which does not mean a weak fit. The coral outline marks one standout per city: the
        best rank, with ties going to the higher local score.
      </p>
    </section>
  );
}

/* ---------------- One city at a time: same panels, same order, every city ---------------- */

const osm = (c: { lat: number; lon: number }) => `https://www.openstreetmap.org/?mlat=${c.lat}&mlon=${c.lon}#map=16/${c.lat}/${c.lon}`;

export function CityDetail({ data, city, onCity }: { data: RunPayload; city: string; onCity: (city: string) => void }) {
  const profile = data.profiles.find((p) => p.city === city);
  const partners = data.partners.filter((p) => p.city === city);
  const brandsHere = data.cells
    .filter((c) => c.city === city && c.rankInCity != null)
    .sort((a, b) => a.rankInCity! - b.rankInCity!)
    .map((c) => ({ cell: c, brand: data.brands.find((b) => b.brandEntityId === c.brandEntityId)! }))
    .filter((x) => x.brand);

  return (
    <section>
      <div className="mb-4 flex flex-wrap gap-1">
        {data.run.cities.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onCity(c)}
            aria-pressed={c === city}
            className="rounded-[2px] border border-ink px-2.5 py-1 text-sm aria-pressed:bg-ink aria-pressed:text-on-ink"
          >
            {c}
          </button>
        ))}
      </div>

      <div className="on-ink bg-ink px-5 py-6 text-on-ink sm:px-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="display text-[3.5rem] sm:text-[4.5rem]">{city}</h2>
          <span className={profile?.coverage === "strong" ? "text-on-ink" : "text-on-ink-soft"}>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium">
              <CoverageMark coverage={profile?.coverage ?? "none"} />
              {profile?.coverage === "strong" ? "strong fan data" : profile?.coverage === "thin" ? "thin fan data" : "no fan data"}
            </span>
          </span>
        </div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.06em] text-on-ink-soft">Your brands here (rank among their type)</p>
        <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {brandsHere.length > 0 ? (
            brandsHere.slice(0, 5).map(({ cell, brand }) => (
              <span key={brand.brandEntityId}>
                {brand.brandName} <span className="font-mono text-on-ink-soft tnum">#{cell.rankInCity}</span>
              </span>
            ))
          ) : (
            <span className="text-on-ink-soft">None of your brands is on this city&apos;s list. Pitch them on national fit.</span>
          )}
        </div>
      </div>

      {!profile && <p className="mt-6 text-sm text-ink-soft">Qloo returned no city evidence for {city}.</p>}

      <div className="grid gap-x-10 gap-y-8 pt-8 xl:grid-cols-2">
        <Crowd profile={profile} />
        <FanSpots profile={profile} partners={partners} />
      </div>

      <div className="pt-10">
        <h3 className="display text-[1.6rem]">Local partners</h3>
        <p className="mt-1 text-sm text-ink-soft">Venues near where the fans gather, with an event idea for each.</p>
        {partners.length === 0 ? (
          <p className="mt-4 text-sm text-ink-soft">Qloo returned no partner places for this city.</p>
        ) : (
          <ul className="mt-4 border-b border-ink">
            {partners.map((p) => (
              <PartnerRow key={p.id} p={p} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

const TAG_GROUPS = [
  { subtype: "urn:tag:genre:music", label: "Music they like" },
  { subtype: "urn:tag:genre:media", label: "Books, film & TV" },
  { subtype: "urn:tag:genre:place", label: "Where they go" },
] as const;

function Crowd({ profile }: { profile?: CityProfile }) {
  // Crowd evidence holds the logged results of the cited calls: taste tags ({items}) and demographics ({age, gender}).
  // Tags are grouped by family; dish tags (Hamburger, Fries) say little about a sponsor fit and are left out.
  const city = profile?.city.toLowerCase();
  const all = (profile?.evidence.crowd ?? [])
    .flatMap((c) => (c && "items" in c ? c.items : []))
    .filter((t) => !isSensitiveTag(t) && t.name.trim().toLowerCase() !== city);
  const groups = TAG_GROUPS.map((g) => ({
    label: g.label,
    tags: [...new Map(all.filter((t) => t.subtype === g.subtype || t.tagId?.startsWith(`${g.subtype}:`)).map((t) => [t.name.toLowerCase(), t])).values()].slice(0, 6),
  })).filter((g) => g.tags.length > 0);
  return (
    <div>
      <h3 className="display text-[1.6rem]">The crowd</h3>
      {profile?.crowdProfile ? (
        <p className="mt-2 max-w-[65ch] leading-relaxed">
          <span className="mr-1.5"><AgentLabel /></span>
          {profile.crowdProfile}
        </p>
      ) : (
        <p className="mt-2 text-sm text-ink-soft">No crowd summary for this city.</p>
      )}
      {groups.length > 0 && (
        <dl className="mt-4 grid gap-y-2.5 border-t border-rule pt-3">
          {groups.map((g) => (
            <div key={g.label} className="grid gap-x-3 gap-y-1 sm:grid-cols-[7.5rem_1fr]">
              <dt className="text-xs font-semibold text-ink-soft sm:pt-0.5">{g.label}</dt>
              <dd>
                <ul className="flex flex-wrap gap-1.5">
                  {g.tags.map((t) => (
                    <li key={t.tagId} className="bg-evidence-soft px-1.5 py-0.5 text-xs text-evidence">
                      {t.name.trim()}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/** Metres between two points (equirectangular; fine at city scale). */
function metres(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const k = Math.PI / 180;
  const x = (b.lon - a.lon) * k * Math.cos(((a.lat + b.lat) / 2) * k);
  return Math.hypot(x, (b.lat - a.lat) * k) * 6_371_000;
}

/** Names a fan area after the neighbourhood of the nearest partner venue, when one is within 1.5 km. */
function areaName(cell: HeatCell, partners: Partner[]) {
  const near = partners
    .filter((p) => p.latitude != null && p.longitude != null && p.evidence.qloo.neighborhood)
    .map((p) => ({ name: p.evidence.qloo.neighborhood!, d: metres(cell, { lat: p.latitude!, lon: p.longitude! }) }))
    .sort((a, b) => a.d - b.d)[0];
  return near && near.d <= 1500 ? near.name : null;
}

/** "2.4 km northwest": distance and compass direction from a to b. */
function bearing(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const k = Math.PI / 180;
  const dx = (b.lon - a.lon) * Math.cos(((a.lat + b.lat) / 2) * k);
  const dy = b.lat - a.lat;
  const dirs = ["east", "northeast", "north", "northwest", "west", "southwest", "south", "southeast"];
  const dir = dirs[(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8];
  const km = metres(a, b) / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km ${dir}`;
}

function FanSpots({ profile, partners }: { profile?: CityProfile; partners: Partner[] }) {
  const spots: { label: string; hint: string; cell?: HeatCell }[] = [
    { label: "Biggest fan area", hint: "Where most of the fans are", cell: profile?.hotspot?.hotspots[0] },
    { label: "Hidden fan pocket", hint: "Fewer people, but big fans", cell: profile?.hotspot?.devotedPockets[0] },
  ];
  const main = profile?.hotspot?.hotspots[0];
  return (
    <div>
      <h3 className="display text-[1.6rem]">Where fans gather</h3>
      <ul className="mt-3 border-b border-ink">
        {spots.map((s) => (
          <li key={s.label} className="border-t border-ink py-3">
            {s.cell ? (
              <a href={osm(s.cell)} target="_blank" rel="noreferrer" className="group block">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold group-hover:underline">
                    {s.label}
                    {areaName(s.cell, partners) ? (
                      <span className="font-normal text-ink-soft">: around {areaName(s.cell, partners)}</span>
                    ) : (
                      s.cell !== main && main && <span className="font-normal text-ink-soft">: {bearing(main, s.cell)} of the biggest fan area</span>
                    )}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-ink-soft">
                    Open map
                    <svg viewBox="0 0 10 10" className="size-2.5" aria-hidden="true">
                      <path d="M3 1.5h5.5V7M8.5 1.5 1.5 8.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
                    </svg>
                  </span>
                </span>
                <span className="block text-xs text-ink-soft">{s.hint}</span>
              </a>
            ) : (
              <span className="text-sm text-ink-soft">{s.label}: no data</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PartnerRow({ p }: { p: Partner }) {
  return (
    <li className="grid gap-x-6 gap-y-1 border-t border-ink py-4 md:grid-cols-[minmax(12rem,18rem)_1fr]">
      <div>
        <div className="font-semibold">{p.placeName}</div>
        <div className="text-xs text-ink-soft">
          {[p.evidence.qloo.genre, p.evidence.qloo.neighborhood, p.distanceM != null ? `${Math.round(p.distanceM)} m from the fans` : null].filter(Boolean).join(" · ")}
        </div>
      </div>
      {p.idea ? (
        <p className="max-w-[65ch] text-sm leading-relaxed">
          <span className="mr-1.5"><AgentLabel /></span>
          {p.idea}
        </p>
      ) : (
        <p className="text-sm text-ink-soft">No activation idea for this place.</p>
      )}
    </li>
  );
}
