"use client";

import { BRAND_CATEGORIES, isSensitiveTag, type BrandCategory } from "@overlap/shared";
import { useState } from "react";
import { api, type BrandMatch, type CityCell, type CityProfile, type HeatCell, type Partner, type RunPayload } from "@/lib/api";
import { CallLink } from "./Provenance";
import { AgentLabel, Button, CoverageBadge, CoverageMark, QlooLabel, SectionTitle, fmt } from "./ui";

const categoryLabel = (c: string | null) => (c && c in BRAND_CATEGORIES ? BRAND_CATEGORIES[c as BrandCategory].label : c === "any" ? "Any" : c ?? "");

/* ---------------- Shortlist: a ranked bill, top pick on a coral field ---------------- */

export function Shortlist({
  data,
  onPitch,
  onCity,
  onChanged,
}: {
  data: RunPayload;
  onPitch: (brandId: string) => void;
  onCity: (city: string) => void;
  onChanged: () => void;
}) {
  const [mode, setMode] = useState<"qloo" | "llm">("qloo");
  const toggle = (
    <div role="radiogroup" aria-label="Source" className="inline-flex border border-ink">
      {(
        [
          ["qloo", "Qloo-grounded"],
          ["llm", "LLM only"],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={mode === id}
          onClick={() => setMode(id)}
          className="px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-paper-2 aria-checked:bg-ink aria-checked:text-on-ink"
        >
          {label}
        </button>
      ))}
    </div>
  );
  if (mode === "llm")
    return (
      <section>
        <SectionTitle title="Brands to pitch" hint="The same model, asked without any Qloo data" action={toggle} />
        <LlmOnlyView data={data} onChanged={onChanged} />
      </section>
    );
  return (
    <section>
      <SectionTitle title="Brands to pitch" hint="Ranked by Qloo audience affinity with the artist's fans" action={toggle} />
      <ol className="border-b border-ink">
        {data.brands.map((b, i) => (
          <BrandRow
            key={b.brandEntityId}
            rank={i + 1}
            brand={b}
            cells={data.run.cities.map((city) => data.cells.find((c) => c.brandEntityId === b.brandEntityId && c.city === city) ?? null)}
            cities={data.run.cities}
            onPitch={onPitch}
            onCity={onCity}
          />
        ))}
      </ol>
      {data.brands.length === 0 && <p className="text-sm text-ink-soft">No brands in this run.</p>}
    </section>
  );
}

function BrandRow({
  rank,
  brand,
  cells,
  cities,
  onPitch,
  onCity,
}: {
  rank: number;
  brand: BrandMatch;
  cells: (CityCell | null)[];
  cities: string[];
  onPitch: (id: string) => void;
  onCity: (city: string) => void;
}) {
  const top = rank === 1;
  const q = brand.evidence.qloo;
  return (
    <li className={`grid grid-cols-[2.25rem_1fr] gap-x-4 border-t border-ink px-3 py-5 sm:grid-cols-[2.75rem_1fr_7rem] sm:px-4 ${top ? "bg-coral" : ""}`}>
      <div className="display pt-1 text-[1.9rem] tnum">{rank}</div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="display-wide text-[1.5rem] leading-tight">{brand.brandName}</h3>
          {top && <span className="text-xs font-bold uppercase tracking-[0.08em]">Top pick</span>}
          <span className={`text-sm ${top ? "text-ink" : "text-ink-soft"}`}>
            {categoryLabel(brand.category)}
            {brand.source === "agent_wildcard" && " · Overlap's wildcard"}
          </span>
        </div>

        <p className="mt-2 max-w-[72ch] text-sm leading-relaxed">
          <QlooLabelOn top={top} /> Affinity <b className="font-mono tnum">{fmt(brand.affinity, 3)}</b> with the artist&apos;s audience, popularity{" "}
          <span className="font-mono tnum">{fmt(brand.popularity, 2)}</span>
          {q.customerSegments?.length > 0 && <> · {q.customerSegments.slice(0, 3).join(", ")}</>} <CallLink callId={brand.evidence.callId} onField={top} />
        </p>

        {brand.agentNote && (
          <p className="mt-2 max-w-[72ch] text-sm leading-relaxed">
            <span className={`mr-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] ${top ? "text-ink" : "text-ink-soft"}`}>Overlap suggests</span>
            {brand.agentNote}
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-x-1 gap-y-1 text-xs">
          {cities.map((city, i) => {
            const c = cells[i];
            const ranked = c && c.rankInCity != null;
            return (
              <button
                key={city}
                type="button"
                onClick={() => onCity(city)}
                title={ranked ? `#${c.rankInCity} in ${city}'s local ranking for this category` : "Not in this city's local top 30: national fit applies"}
                className={`rounded-[2px] px-1.5 py-0.5 transition-colors hover:bg-ink hover:text-on-ink ${
                  ranked ? (top ? "bg-ink text-on-ink" : "bg-evidence-soft text-evidence") : top ? "text-ink" : "text-ink-soft"
                }`}
              >
                {city} <span className="font-mono tnum">{ranked ? `#${c.rankInCity}` : "·"}</span>
              </button>
            );
          })}
        </div>

        {q.knownPartnerships?.length > 0 && (
          <p className={`mt-3 max-w-[72ch] text-sm ${top ? "text-ink" : "text-ink-soft"}`}>Known partners: {q.knownPartnerships.slice(0, 4).join(", ")}</p>
        )}

        <div className="mt-4">
          <Button variant="secondary" onClick={() => onPitch(brand.brandEntityId)}>
            Open pitch pack
          </Button>
        </div>
      </div>

      <div className="col-start-2 mt-3 flex items-baseline gap-2 sm:col-start-3 sm:mt-0 sm:flex-col sm:items-end sm:gap-0 sm:text-right" title="Overlap score = Qloo audience affinity × 100">
        <span className={`display text-[3.25rem] tnum ${top ? "text-ink" : "text-evidence"}`}>{brand.overlapScore ?? "–"}</span>
        <span className={`text-xs ${top ? "text-ink" : "text-ink-soft"}`}>overlap score</span>
      </div>
    </li>
  );
}

/* ---------------- LLM-only comparison ---------------- */

function LlmOnlyView({ data, onChanged }: { data: RunPayload; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const result = data.run.llmOnly;

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
  return (
    <div>
      <p className="max-w-[72ch] text-[1.05rem] leading-relaxed">
        Without Qloo, the model named <b>{result.picks.length} brands</b>.{" "}
        {backed === 0 ? (
          <>None of them is on Overlap&apos;s Qloo-grounded shortlist; none has audience evidence behind it here.</>
        ) : (
          <>
            <b className="text-evidence">{backed}</b> {backed === 1 ? "of them is" : "of them are"} on Overlap&apos;s Qloo-grounded shortlist
            {backed < result.picks.length ? "; the rest have no audience evidence behind them here." : "."}
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
                {p.onShortlist != null ? (
                  <span className="self-start whitespace-nowrap bg-evidence-soft px-1.5 py-0.5 font-mono text-[11px] text-evidence tnum">Qloo #{p.onShortlist}</span>
                ) : (
                  <span className="self-start whitespace-nowrap text-xs text-ink-soft">No Qloo evidence</span>
                )}
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
                  <span className="font-mono text-sm text-evidence tnum">{fmt(m.affinity, 3)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
      <p className="mt-6 text-xs text-ink-soft">
        Model: {result.model}, asked once with the tour, cities and categories only. Matching is by brand name.
      </p>
    </div>
  );
}

function QlooLabelOn({ top }: { top: boolean }) {
  return top ? <span className="mr-1.5 text-[11px] font-semibold uppercase tracking-[0.06em]">Qloo says</span> : <span className="mr-1.5"><QlooLabel /></span>;
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
      <SectionTitle title="Brand × city" hint="Each brand's position in the city's own Qloo ranking for its category" />
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
                      <CoverageBadge coverage={p?.coverage ?? "none"} label={p?.cellCount != null ? `${p.cellCount.toLocaleString()} fan cells` : undefined} />
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
                        <div className="font-mono text-[11px] tnum opacity-80">{fmt(c.affinity, 3)}</div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="border-t border-ink align-top">
              <th scope="row" className="py-3 pr-3 text-left text-xs font-semibold">
                Strong locally, not on the shortlist
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
        #rank is the brand&apos;s position in that city&apos;s top 30 for its category: extra local proof. National fit means it is not in the local top 30,
        which is not evidence of weak fit. The coral outline marks the shortlisted brand that ranks best locally. Local scores are rescaled per
        city, so compare ranks, not scores.
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
      <div className="mb-4 flex flex-wrap gap-1 lg:hidden">
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
              {profile?.cellCount != null ? `${profile.cellCount.toLocaleString()} fan cells` : "no fan data"}
            </span>
          </span>
        </div>
        {profile?.hotspot?.locality?.disambiguation && <p className="mt-1 text-xs text-on-ink-soft">Qloo resolved: {profile.hotspot.locality.disambiguation}</p>}
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {brandsHere.length > 0 ? (
            brandsHere.slice(0, 5).map(({ cell, brand }) => (
              <span key={brand.brandEntityId}>
                {brand.brandName} <span className="font-mono text-on-ink-soft tnum">#{cell.rankInCity}</span>
              </span>
            ))
          ) : (
            <span className="text-on-ink-soft">No shortlisted brand in this city&apos;s local top 30: every pick here is a national fit.</span>
          )}
        </div>
      </div>

      {!profile && <p className="mt-6 text-sm text-ink-soft">Qloo returned no city evidence for {city}.</p>}

      <div className="grid gap-x-10 gap-y-8 pt-8 xl:grid-cols-2">
        <Crowd profile={profile} />
        <FanSpots profile={profile} />
      </div>

      <div className="pt-10">
        <h3 className="display text-[1.6rem]">Local partners</h3>
        <p className="mt-1 text-sm text-ink-soft">Places near the fans&apos; hotspot that the artist&apos;s audience already likes, with an activation idea for each.</p>
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

function Crowd({ profile }: { profile?: CityProfile }) {
  // Crowd evidence holds the logged results of the cited calls: taste tags ({items}) and demographics ({age, gender}).
  const tagEntry = profile?.evidence.crowd.find((c) => c && "items" in c);
  const tags = tagEntry && "items" in tagEntry ? tagEntry.items.filter((t) => !isSensitiveTag(t)) : null;
  const demoEntry = profile?.evidence.crowd.find((c) => c && "age" in c);
  const demo = demoEntry && "age" in demoEntry ? demoEntry : null;
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
      {(tags?.length || demo) && (
        <div className="mt-4 border-t border-rule pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <QlooLabel />
            {profile?.evidence.crowdCallIds.map((id) => <CallLink key={id} callId={id} />)}
          </div>
          {tags && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {tags.slice(0, 12).map((t) => (
                <li key={t.tagId} className="bg-evidence-soft px-1.5 py-0.5 text-xs text-evidence">
                  {t.name}
                </li>
              ))}
            </ul>
          )}
          {demo && (
            <p className="mt-3 text-xs text-ink-soft">
              Audience skew (global, relative to average):{" "}
              <span className="font-mono tnum">
                {Object.entries(demo.age)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 2)
                  .map(([k, v]) => `${k.replaceAll("_", " ")} ${v > 0 ? "+" : ""}${v.toFixed(2)}`)
                  .join(", ")}
                {" · "}
                {Object.entries(demo.gender)
                  .filter(([, v]) => v > 0)
                  .map(([k, v]) => `${k} +${v.toFixed(2)}`)
                  .join(", ")}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function FanSpots({ profile }: { profile?: CityProfile }) {
  const spots: { label: string; hint: string; cell?: HeatCell }[] = [
    { label: "Top fan hotspot", hint: "Where the artist's fans concentrate most", cell: profile?.hotspot?.hotspots[0] },
    { label: "Devoted pocket", hint: "High affinity, low general popularity", cell: profile?.hotspot?.devotedPockets[0] },
  ];
  return (
    <div>
      <h3 className="display text-[1.6rem]">Where fans gather</h3>
      <div className="mt-2 flex items-center gap-2">
        <QlooLabel />
        {profile?.evidence.heatmapCallId != null && <CallLink callId={profile.evidence.heatmapCallId} />}
      </div>
      <ul className="mt-3 border-b border-ink">
        {spots.map((s) => (
          <li key={s.label} className="border-t border-ink py-3">
            {s.cell ? (
              <a href={osm(s.cell)} target="_blank" rel="noreferrer" className="group block">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold group-hover:underline">{s.label}</span>
                  <span className="inline-flex items-center gap-1 text-xs text-ink-soft">
                    Open map
                    <svg viewBox="0 0 10 10" className="size-2.5" aria-hidden="true">
                      <path d="M3 1.5h5.5V7M8.5 1.5 1.5 8.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
                    </svg>
                  </span>
                </span>
                <span className="block text-xs text-ink-soft">{s.hint}</span>
                <span className="mt-1 block font-mono text-[11px] text-evidence tnum">
                  {s.cell.lat.toFixed(4)}, {s.cell.lon.toFixed(4)} · affinity {fmt(s.cell.affinity, 2)} · popularity {fmt(s.cell.popularity, 2)}
                </span>
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
          {[p.evidence.qloo.genre, p.evidence.qloo.neighborhood, p.distanceM != null ? `${Math.round(p.distanceM)} m from hotspot` : null].filter(Boolean).join(" · ")}
        </div>
        <div className="mt-1">
          <CallLink callId={p.evidence.callId} label={`affinity ${fmt(p.evidence.qloo.affinity, 2)}`} />
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
