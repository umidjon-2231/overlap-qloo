# Rules

Rules the product, the agent and contributors must follow. Prompts in `apps/api/src/agent/prompts.ts` implement the agent and pitch rules; keep them in sync with this file.

## Product principles

1. **Qloo is the evidence, the agent is the analyst.** Every figure traces to a logged Qloo call; interpretation is visibly labelled ("Qloo says" vs "Overlap suggests"). The UI shows the agent as a black box: short plain lines of what it is doing, never its reasoning text or tool names (those stay in the provenance drawer and the database).
2. **Human approves, agent drafts.** Nothing is sent, booked or committed by the app. Export unlocks only after approval.
3. **Honest about coverage.** Empty or thin data is shown as a badge, never filled by the model.
4. **Aggregate taste only.** No personal data is collected or sent to Qloo.
5. **Deliverable over dashboard.** The output is a pitch pack a seller can use.

## Data and safety (Qloo safe use)

- Send Qloo only entity IDs, tags, city names and coordinates. Never names, emails, device IDs or location histories.
- Affinity is an aggregate taste signal: never present it as a probability, forecast, causal effect or a claim about an individual.
- Never describe audiences by sensitive traits (orientation, religion, politics, health, ethnicity). `isSensitiveTag` filters tags in agent output, pitch evidence and the UI.
- Never store Qloo data in the repository. It is cached in Postgres at runtime only.
- Keys live only in `.env` / the server environment. Never in the browser, the repo, logs or prompts.
- Keep Qloo requests small; bounded retries; no bulk scraping.

## Agent rules

- Facts only from tool results; never invent brands, places, numbers or IDs. Cite call IDs in the report.
- On `needs_input`, ask the seller with `ask_user`; never auto-pick an ambiguous entity.
- Empty or thin results are reported as such.
- A brand missing from a city's local ranking is **not** evidence of weak fit. Present local ranks as upside; never exclude a city for that reason.
- Compare local ranks across cities, never local scores (they are rescaled per city). Heatmap cell counts measure data coverage, not audience size.
- Partner ideas name only the brand they are for, or a brand category.
- Brand notes: lead with national standing, local ranks as extra proof; no placeholder text (rejected by the report schema).
- Run independent tool calls in parallel; respect the tool and token budgets; finish with `submit_report` exactly once.

## Pitch pack rules

- Use only the evidence pack; never invent venues, dates, prices, audience sizes, attendance, ROI or deal values.
- Sections, in order: The pitch · Why {Brand} · City by city · Suggested activations · Measurement plan · Outreach email · Seller notes (internal) · Evidence · Rights note.
- Every city gets an activation; cities without a local rank are "national fit", never a gap.
- Outreach email: 120–170 words, plain language, leads with the upside, no raw scores, call IDs, caveats or other brands; one short clause on approvals; clear ask.
- Caveats live only in "Seller notes (internal, do not send)".
- Evidence: one bullet per figure, exactly one call ID each.
- Name no other brand; never imply the artist is involved or endorses anything.
- No city-boundary caveats unless Qloo resolved the city to a clearly different place.

## Demo rules

- Avoid in demos: Tashkent as the hero city, football clubs, pricing/fees/fan data, invented percentages, real brand logos implying endorsement.
- Festival presets use fictional festival names with real headliners.
- Public demo limits: at most 3 concurrent runs, 8 runs per IP per hour; presets load cached results (24 h) unless re-run.

## Repository rules

- `RESEARCH.md` stays local (gitignored). Zip archives are ignored; unpacked assets live in `brand/`.
- `.env` is never committed; `.env.example` lists every variable.
- Before making the repo public: check the history for keys and Qloo data.
- Next.js 16 has breaking changes: read `apps/web/node_modules/next/dist/docs/` before changing web code.
- Python tooling, if ever needed: use `uv`.
