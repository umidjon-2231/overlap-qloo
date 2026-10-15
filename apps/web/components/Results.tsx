"use client";

import { BRAND_CATEGORIES, isSensitiveTag, type BrandCategory } from "@overlap/shared";
import { useState } from "react";
import type { BrandMatch, CityCell, CityProfile, HeatCell, Partner, RunPayload } from "@/lib/api";
import { CallLink } from "./Provenance";
import { AgentLabel, Button, Card, CoverageBadge, QlooLabel, SectionTitle, fmt } from "./ui";

const categoryLabel = (c: string | null) => (c && c in BRAND_CATEGORIES ? BRAND_CATEGORIES[c as BrandCategory].label : c === "any" ? "Any" : c ?? "");

/* ---------------- Shortlist ---------------- */

export function Shortlist({ data, onPitch }: { data: RunPayload; onPitch: (brandId: string) => void }) {
  return (
    <section>
      <SectionTitle step={2} title="Brand shortlist" hint="Ranked by Qloo audience affinity with the artist's fans" />
      <div className="grid gap-3 md:grid-cols-2">
        {data.brands.map((b, i) => (
          <BrandCard key={b.brandEntityId} brand={b} top={i === 0} cells={data.cells.filter((c) => c.brandEntityId === b.brandEntityId)} onPitch={onPitch} />
        ))}
      </div>
      {data.brands.length === 0 && <p className="text-sm text-muted">No brands yet.</p>}
    </section>
  );
}

function BrandCard({ brand, top, cells, onPitch }: { brand: BrandMatch; top: boolean; cells: CityCell[]; onPitch: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const q = brand.evidence.qloo;
  const localCities = cells.filter((c) => c.coverage !== "none").length;
  return (
    <Card className={`p-4 ${top ? "border-decision/50" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold">{brand.brandName}</h3>
            {top && <span className="rounded bg-decision px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">Top pick</span>}
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
            <span className="rounded bg-zinc-100 px-1.5 py-0.5">{categoryLabel(brand.category)}</span>
            {brand.source === "agent_wildcard" && <span className="rounded bg-decision-soft px-1.5 py-0.5 text-decision">Agent wildcard</span>}
            {localCities > 0 && <CoverageBadge coverage="strong" label={`in local top 30: ${localCities}/${cells.length} cities`} />}
          </div>
        </div>
        <div className="text-right" title="Overlap score = Qloo audience affinity × 100">
          <div className="font-mono text-3xl font-semibold leading-none text-evidence">{brand.overlapScore ?? "–"}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted">overlap</div>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-sm">
        <div className="rounded-md bg-evidence-soft/60 p-2">
          <QlooLabel />
          <div className="mt-1 text-xs">
            Affinity <b>{fmt(brand.affinity, 3)}</b> with the artist&apos;s audience · popularity {fmt(brand.popularity, 2)}{" "}
            <CallLink callId={brand.evidence.callId} />
          </div>
          {q.customerSegments?.length > 0 && <div className="mt-1 text-xs text-muted">Segments: {q.customerSegments.join(", ")}</div>}
        </div>
        {brand.agentNote && (
          <div className="rounded-md bg-decision-soft/50 p-2">
            <AgentLabel />
            <p className="mt-1 text-xs leading-relaxed">{brand.agentNote}</p>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <Button variant="ghost" className="px-0 text-xs" onClick={() => setOpen(!open)}>
          {open ? "Hide" : "Show"} provenance
        </Button>
        <Button variant="secondary" onClick={() => onPitch(brand.brandEntityId)}>
          Pitch pack →
        </Button>
      </div>
      {open && (
        <dl className="mt-2 grid grid-cols-[7rem_1fr] gap-y-1 border-t border-line pt-2 font-mono text-[11px] text-muted">
          <dt>entity_id</dt>
          <dd className="break-all">{brand.brandEntityId}</dd>
          <dt>tags</dt>
          <dd className="break-all">{q.categories?.join(", ")}</dd>
          <dt>industries</dt>
          <dd>{q.industries?.join(", ") || "–"}</dd>
          <dt>partnerships</dt>
          <dd>{q.knownPartnerships?.join(", ") || "–"}</dd>
        </dl>
      )}
    </Card>
  );
}

/* ---------------- Brand × city grid ---------------- */

export function CityGrid({ data }: { data: RunPayload }) {
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
      <SectionTitle step={3} title="Brand × city" hint="Local rank within each city's Qloo ranking for that category" />
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="p-3 font-medium">Brand</th>
              {cities.map((city) => {
                const p = profiles.find((x) => x.city === city);
                return (
                  <th key={city} className="p-3 align-top font-medium">
                    <div>{city}</div>
                    <div className="mt-1">
                      {p ? <CoverageBadge coverage={p.coverage} label={p.cellCount != null ? `${p.cellCount.toLocaleString()} fan cells` : undefined} /> : <CoverageBadge coverage="none" />}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {brands.map((b) => (
              <tr key={b.brandEntityId} className="border-b border-line last:border-0">
                <td className="p-3">
                  <div className="font-medium">{b.brandName}</div>
                  <div className="text-xs text-muted">{categoryLabel(b.category)}</div>
                </td>
                {cities.map((city) => {
                  const c = cell(b.brandEntityId, city);
                  const best = bestInCity.get(city) === b.brandEntityId;
                  if (!c || c.coverage === "none")
                    return (
                      <td
                        key={city}
                        className="p-3 text-xs text-muted"
                        title="Not in this city's local top-30 ranking. Qloo's localised rankings favour brands with local signal and often omit national leaders, so this is not evidence of weak fit."
                      >
                        national fit
                      </td>
                    );
                  const shade = c.rankInCity! <= 1 ? "bg-evidence/15" : c.rankInCity! <= 3 ? "bg-evidence/10" : "bg-evidence/5";
                  return (
                    <td key={city} className={`p-3 ${shade} ${best ? "ring-2 ring-inset ring-decision/60" : ""}`}>
                      <div className="font-mono font-semibold">#{c.rankInCity}</div>
                      <div className="font-mono text-[11px] text-muted">{fmt(c.affinity, 3)}</div>
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="bg-zinc-50 align-top">
              <td className="p-3 text-xs font-medium text-muted">Local standouts not on the shortlist</td>
              {cities.map((city) => (
                <td key={city} className="p-3 text-xs">
                  {(standouts[city] ?? []).slice(0, 4).map((s) => (
                    <div key={s.brandId} className="truncate" title={`local affinity ${fmt(s.localAffinity, 3)} (call #${s.callId})`}>
                      {s.name}
                    </div>
                  ))}
                  {(standouts[city] ?? []).length === 0 && <span className="text-muted">–</span>}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </Card>
      <p className="mt-2 text-xs text-muted">
        #rank = position in that city&apos;s local top-30 Qloo ranking for the brand&apos;s category (extra local proof). &quot;National fit&quot; = not
        in the local top 30, which is not evidence of weak fit. Ringed cell = the shortlisted brand ranking best locally. Local scores are
        rescaled per city, so compare ranks, not scores.
      </p>
    </section>
  );
}

/* ---------------- City activation ---------------- */

const osm = (c: { lat: number; lon: number }) => `https://www.openstreetmap.org/?mlat=${c.lat}&mlon=${c.lon}#map=16/${c.lat}/${c.lon}`;

export function CityActivation({ data }: { data: RunPayload }) {
  return (
    <section>
      <SectionTitle step={4} title="City activation" hint="Where fans concentrate, who they are, and local partners near them" />
      <div className="grid gap-4 lg:grid-cols-2">
        {data.run.cities.map((city) => (
          <CityCard
            key={city}
            city={city}
            profile={data.profiles.find((p) => p.city === city)}
            partners={data.partners.filter((p) => p.city === city)}
          />
        ))}
      </div>
    </section>
  );
}

function Spot({ label, cell }: { label: string; cell?: HeatCell }) {
  if (!cell) return null;
  return (
    <a href={osm(cell)} target="_blank" rel="noreferrer" className="block rounded-md border border-line p-2 text-xs hover:bg-zinc-50">
      <div className="font-medium">{label}</div>
      <div className="font-mono text-[11px] text-muted">
        {cell.lat.toFixed(4)}, {cell.lon.toFixed(4)} · affinity {fmt(cell.affinity, 2)} · popularity {fmt(cell.popularity, 2)}
      </div>
    </a>
  );
}

function CityCard({ city, profile, partners }: { city: string; profile?: CityProfile; partners: Partner[] }) {
  // Crowd evidence holds the logged results of the cited calls: taste tags ({items}) and demographics ({age, gender}).
  const tagEntry = profile?.evidence.crowd.find((c) => c && "items" in c);
  const tags = tagEntry && "items" in tagEntry ? tagEntry.items.filter((t) => !isSensitiveTag(t)) : null;
  const demoEntry = profile?.evidence.crowd.find((c) => c && "age" in c);
  const demo = demoEntry && "age" in demoEntry ? demoEntry : null;
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">{city}</h3>
        {profile ? <CoverageBadge coverage={profile.coverage} /> : <CoverageBadge coverage="none" />}
      </div>
      {profile?.hotspot?.locality?.disambiguation && (
        <div className="mt-0.5 text-[11px] text-muted">Qloo resolved: {profile.hotspot.locality.disambiguation}</div>
      )}
      {!profile && <p className="mt-2 text-sm text-muted">No city evidence returned.</p>}

      {profile?.crowdProfile && (
        <div className="mt-3 rounded-md bg-decision-soft/50 p-2">
          <AgentLabel />
          <p className="mt-1 text-sm leading-relaxed">{profile.crowdProfile}</p>
        </div>
      )}

      {(tags?.length || demo) && (
        <div className="mt-3 rounded-md bg-evidence-soft/60 p-2">
          <div className="flex items-center gap-2">
            <QlooLabel />
            {profile?.evidence.crowdCallIds.map((id) => <CallLink key={id} callId={id} />)}
          </div>
          {tags && (
            <div className="mt-1 flex flex-wrap gap-1">
              {tags.slice(0, 10).map((t) => (
                <span key={t.tagId} className="rounded bg-surface px-1.5 py-0.5 text-[11px]">
                  {t.name}
                </span>
              ))}
            </div>
          )}
          {demo && (
            <div className="mt-2 text-[11px] text-muted">
              Audience skew (global, relative to average):{" "}
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
            </div>
          )}
        </div>
      )}

      {profile?.hotspot && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Spot label="Top fan hotspot" cell={profile.hotspot.hotspots[0]} />
          <Spot label="Devoted pocket (high affinity, low popularity)" cell={profile.hotspot.devotedPockets[0]} />
        </div>
      )}

      <div className="mt-3">
        <div className="mb-1 text-sm font-medium">Local partners</div>
        {partners.length === 0 && <p className="text-xs text-muted">No partner places returned for this city.</p>}
        <ul className="grid gap-2">
          {partners.map((p) => (
            <li key={p.id} className="rounded-md border border-line p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{p.placeName}</span>
                <span className="text-[11px] text-muted">
                  {p.evidence.qloo.genre ?? ""}
                  {p.distanceM != null ? ` · ${Math.round(p.distanceM)} m` : ""}
                </span>
              </div>
              {p.evidence.qloo.neighborhood && <div className="text-[11px] text-muted">{p.evidence.qloo.neighborhood}</div>}
              {p.idea && (
                <p className="mt-1 text-xs">
                  <span className="font-semibold text-decision">Idea: </span>
                  {p.idea}
                </p>
              )}
              <div className="mt-1">
                <CallLink callId={p.evidence.callId} label={`affinity ${fmt(p.evidence.qloo.affinity, 2)} · #${p.evidence.callId}`} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
