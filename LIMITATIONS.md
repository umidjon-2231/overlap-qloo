# Limitations

What Overlap does not do, and where its evidence is thin. Shown here so nobody has to find out in a meeting.

## Data

- **Affinity is an aggregate taste signal**, not a forecast of sales, attendance or campaign results, and never a statement about an individual fan.
- **Local rankings omit national leaders.** Qloo's city-localised brand rankings favour brands with strong local signal; a brand missing from a city's top 30 is shown as "national fit", not as a weak fit. Local scores are rescaled per city, so Overlap compares ranks, not scores, across cities.
- **Coverage varies.** Major US and European cities return rich data; smaller or non-Western cities can come back thin or empty, and the app says so rather than filling gaps.
- **Demographics are global and coarse**: relative age bands and gender skew for the whole audience, not per city.
- **Heatmap cell counts measure data coverage**, not audience size.
- **Hackathon API constraints:** no event, tour or team entity types (Overlap is artist-first); trending returned no data in testing; invalid parameters are silently ignored, so every empty result is treated as a status, not as an answer.

## Product

- **Overlap drafts, the seller decides.** Activation ideas, crowd reads and brand notes are labelled suggestions. Venue ideas have not been checked with the venues.
- **No deal values, prices, ROI or audience sizes** are generated, by design.
- **Nothing is sent.** Overlap never contacts brands or venues; the seller exports and sends.
- **Rights and endorsement:** artist and brand names identify; they do not imply endorsement. Any partnership needs approval from the artist's team, the brand and the venue.
- **The LLM-only comparison** matches brands by name and asks the model once; it illustrates the difference Qloo makes on this tour, it is not a benchmark.
- **The tour route** on the run screen is a stylised route in the seller's city order, not a geographic map.

## Demo

- One server, demo limits: at most 3 runs at once and 8 new runs per visitor per hour. Demo tours open a recent stored result (refreshed on deploy); "Re-run live" starts a new run.
- No accounts: runs are visible to anyone with the link.
- The run stage needs WebGL; without it a simpler animation plays and everything else works.
