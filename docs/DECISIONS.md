# Decision log

Newest last. Each entry: what we chose, why, and what we rejected.

### D1. Prototype first: thin slice of all five screens (2026-10-15)
Business logic end to end with simple styling, then design polish.
*Rejected:* core 3 screens only (the city story would wait); engine-only CLI (nothing to show).

### D2. Separate web and API from day one (2026-10-15)
Next.js web + Hono API + Postgres. The agent loop and SSE need a long-running process.
*Rejected:* single Next.js app.

### D3. Qloo via direct REST, not the qloo-harness MCP (2026-10-15)
A typed client with our own status mapping, cache and provenance log. No extra process, and it doesn't look like a wrapper around Qloo's own MCP.

### D4. Claude tool-calling loop from the start (2026-10-15)
One loop per run that pauses with `ask_user` on ambiguous artists; the pitch pack is a separate on-demand call per brand.
*Rejected:* a deterministic pipeline with an LLM writer only; staged sub-loops.

### D5. Overlap score = Qloo brand affinity × 100 (2026-10-15)
`/v2/analysis/compare` returns no score, and artist and brand tags don't share a vocabulary. Affinity is a raw Qloo value; city fit comes from localised rankings.
*Rejected:* our own composite formula.

### D6. Brand categories: the seller picks, the agent may add one wildcard (2026-10-15)
Unfiltered brand results are mostly apparel. Wildcards are labelled `agent_wildcard`.

### D7. Tour and festival both supported from the start (2026-10-15)
A festival blends several headliners as a multi-entity signal.

### D8. City fit = per city × category local top-30 ranking (2026-10-15)
`signal.location.query` gives a distinct local picture; `POINT` localisation barely changes scores; pinning brands while localising returns almost nothing. Shortlisted brands get a local rank or "national fit", plus local standouts.

### D9. Absence from a local ranking is not evidence of weak fit (2026-10-15)
Qloo's localised rankings omit national leaders. Shown as "national fit" in the UI, tool output and prompts; never used to drop a city.

### D10. Numbers come from logged calls, not from the model (2026-10-15)
The agent cites call IDs; the server looks up every value and runs a grounding check. The pitch writer gets an evidence pack rebuilt from logged calls (one call ID per figure), not the agent's notes.

### D11. Agent model: Haiku 5.5, effort high, business tools (2026-10-15)
The bake-off (`docs/BAKEOFF.md`) showed 0 grounding violations and full completeness at about $0.01 per run, versus about $0.17 for Sonnet. Haiku at low effort invents IDs; raw endpoint tools cause invalid calls for both models.

### D12. Pitch model: Sonnet 5.5, effort high (2026-10-15)
The pitch is the deliverable a seller reads and sends; it runs only on demand (about $0.03).

### D13. Pitch structure built around the seller's goal (2026-10-15)
One-line pitch, three reasons, every city with an activation, sendable email (plain language, no scores, no caveats), internal seller notes (the only place for caveats), evidence with one call per figure, rights note.

### D14. Export: copy + PDF + email draft, only after approval (2026-10-15)
Any edit withdraws approval, so the exported text is exactly what was approved.

### D15. LLM-only comparison toggle deferred to the polish phase (2026-10-15)

### D16. Hosting: everything on the user's server with Docker Compose (2026-10-15)
Postgres + API + web + Caddy (HTTPS, `/api/*` → API). Dev uses an existing local Postgres container.
*Rejected:* Vercel + Railway.

### D17. Repository private for now; `RESEARCH.md` never committed (2026-10-15)
The research notes include judge analysis; the repo goes public only after a history check for keys and Qloo data.
