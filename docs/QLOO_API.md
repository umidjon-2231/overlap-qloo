# Qloo API notes (hackathon environment)

Verified against `https://hackathon.api.qloo.com` on 2026-10-15. Re-check if behaviour changes.

## Access

- Header `X-Api-Key`; all parameters in the query string.
- Limits: `X-Second-RateLimit-Limit: 5`, `X-Month-RateLimit-Limit: 10000`. Calls take 0.6–2.3 s (heatmaps and POINT queries up to ~10 s).
- Invalid or irrelevant parameters are **silently ignored**, often returning an empty 200. Treat empty as a status, never as "no fit".

## Endpoints we use

| Need | Request |
|---|---|
| Resolve an artist | `/search?query=<name>&types=urn:entity:artist&take=8` (exact match first; collabs and similar names follow) |
| Brands for the audience | `/v2/insights?filter.type=urn:entity:brand&signal.interests.entities=<ids>&filter.tags=<category tag>&take=N` |
| Localised brand ranking | same + `signal.location.query=<city>` |
| Score specific brands | `filter.results.entities=<ids>` (combined with a city query it returns almost nothing; see below) |
| Fan heatmap | `/v2/insights?filter.type=urn:heatmap&signal.interests.entities=<ids>&filter.location.query=<city>` |
| Places near a point | `/v2/insights?filter.type=urn:entity:place&signal.interests.entities=<ids>&filter.location=POINT(<lon> <lat>)&filter.location.radius=<m>&filter.tags=<place tags>&operator.filter.tags=union` |
| Taste tags | `/v2/insights?filter.type=urn:tag&signal.interests.entities=<ids>[&signal.location.query=<city>]` |
| Demographics | `/v2/insights?filter.type=urn:demographics&signal.interests.entities=<ids>` (relative age bands and gender skew, global) |
| Compare | `/v2/analysis/compare?a.signal.interests.entities=…&b.signal.interests.entities=…` |
| Tag lookup | `/v2/tags?filter.query=<word>&filter.tag.types=urn:tag:genre:brand` (no query → empty) |

Verified tag IDs: `packages/shared/src/index.ts` (`BRAND_CATEGORIES`, `PLACE_KINDS`).

## Behaviour that shaped the design

- **Brand results without a category filter** are dominated by apparel and music gear.
- `drinks` (`food_and_beverage:drinks`) returns the same list as `food_and_beverage`: don't pick both.
- **`filter.location` is ignored for brands**: same results, still a 200.
- **`signal.location.query` re-ranks brands to a city but drops national leaders** (Dr. Martens and Vans vanish from Chicago's fashion top 30 while being #1 nationally). Pinning brands with `filter.results.entities` plus a city query returns few or none.
- **`signal.location=POINT(...)` barely localises** (Chicago ≈ London scores).
- **Heatmaps ignore `take`**: responses of 200 KB–1.6 MB, every cell in the city. Affinity is rescaled 0–1 within each city, so never compare it across cities. Geohash precision 7 (US/Mexico), 6 (London).
- **Places need a tag filter**; unfiltered results are noisy (TV studios, salons). Tag filters match secondary tags too (a museum with a bar can appear).
- **Compare** works across types but returns no score, and artist and brand tag vocabularies don't overlap (0 shared tags artist vs brand).
- **`/v2/trending`** returned empty 200s for every entity tried: treat as unavailable.
- **Locality resolution:** "New York" → New York State; use "New York City". Always show `query.localities…disambiguation`.
- **Taste tags can include sensitive traits** (e.g. "Queer", "LGBT"): filter before showing or prompting.
- Brand entities carry rich properties: `customer_segments`, `target_age_group`, `known_partnerships`, `industries`, `competitor_brands`.

## Coverage seen (heatmap cells)

| | Chicago | Austin | Mexico City | London |
|---|---|---|---|---|
| Bad Bunny | 3059 | 1474 | 6436 | 1319 |
| Phoebe Bridgers | 2514 | 1441 | 831 | 1347 |
| Khruangbin | 1075 | 732 | 695 | 784 |
