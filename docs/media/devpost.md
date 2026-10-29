# Devpost entry (as entered, 2026-10-29)

Submission: https://devpost.com/software/overlap-wl250d (Qloo Agentic Hackathon). Draft complete; the final "Submit project" step is left to the owner.

## Project overview
- **Name:** Overlap
- **Elevator pitch:** Tell us your tour. Overlap tells you which brands to pitch, in which cities, and why: a Claude agent on Qloo's taste graph, with every number traceable to a Qloo call.
- **Thumbnail:** `thumbnail.png`

## Project details
- **Built with:** claude, anthropic, qloo, typescript, node.js, hono, postgresql, drizzle, next.js, react, tailwindcss, three.js, react-three-fiber, blender, pdfkit, docker, github-actions, playwright
- **Try it out:** https://overlap.u.co.uz · https://github.com/umidjon-2231/overlap-qloo
- **Video:** https://youtu.be/3R5Q4iu-UtA
- **Gallery** (`gallery/`, in order):
  1. Home: enter a tour, or open an example (no login).
  2. The agent at work: the tour bus drives your route; brands that rank in each city pop up.
  3. The short answer first, then brands ranked by Qloo fan fit with each city's local rank.
  4. Every number opens the exact Qloo request and result behind it.
  5. With Qloo vs without: a plain AI's picks, scored in Qloo against the same fans.
  6. One city in detail: the crowd's taste, where fans gather, and venues paired with brands.
  7. The pitch: why this brand, city by city, a measurement plan and an email. Approve to send.

## Additional info (judges only)
- **Began:** October 15, 2026
- **Public URL:** https://overlap.u.co.uz
- **Public code repo:** https://github.com/umidjon-2231/overlap-qloo
- **Existing project?** Not an existing project: Overlap was built from scratch for this hackathon, starting October 15, 2026 (the repository history starts that day).

## About the project (story)

**Try it:** open https://overlap.u.co.uz and click any example (no login). The replay shows the agent's route, then the results. "Or try your own tour" runs live in about a minute.

## Inspiration
Sponsorship is one of the highest-margin revenue lines in live music, yet the person selling it still works from gut feel and the same three categories for every tour. Audience tools describe age and gender, not taste, and a tour that plays ten cities gets judged once, nationally. Ask a language model and you get confident, generic picks with nothing behind them.

## What it does
Overlap is a sponsorship agent for the seller: the partnerships lead at a promoter, festival or artist team. Enter a tour (an artist or festival headliners, and cities) and a Claude agent works through Qloo's taste graph:

- finds the brands whose audiences overlap most with the artist's fans, and leads with a short answer: the fans' #1 brand, then the ones that rank in the top 3 for their type in most of the tour's cities,
- checks each city's own ranking, so the seller sees where a brand has local proof,
- maps where fans gather in each city and reads the crowd: the music, books, film and places they love,
- finds partner venues near the fans, each paired with a brand and an event idea,
- and writes a pitch for any brand: why this brand, city by city, activations, a measurement plan and a sendable email.

The seller edits and approves; only then can the pitch be opened as an email, downloaded as a PDF or copied as text. Nothing is ever sent by the app.

**With Qloo vs without.** Ask the same model the same question with no Qloo data, and Overlap then looks each of its picks up in Qloo and scores it against the same fans. On the Phoebe Bridgers example the model's picks average a fan fit of 80 against 87 for Overlap's list, with Modelo (65) and Amtrak (69) near the bottom. On Bad Bunny it is 80 against 90, and half the model's picks score below every brand on Overlap's list. The model's answer varies between runs, so the live page always shows the current numbers.

While the agent works you watch your own tour: the Overlap tour bus drives your route city by city, each city prints in as its evidence is read, and the brands that rank there pop up.

## How we built it
- **Agent loop:** Claude Haiku 5.5 runs server-side. It plans, then calls seven business tools over the Qloo hackathon API (search, brand/place/tag insights, city-localised rankings, heatmaps, demographics, compare), running independent calls in parallel within call and token budgets. When an artist name is ambiguous it pauses and asks the seller to pick. It finishes by submitting a structured report, and the server then runs a grounding check on it.
- **Grounding:** the report holds IDs, call references and interpretation only. The server checks every brand and partner venue against the logged result of the Qloo call the agent cited, drops anything it cannot find, and takes every number from the logs, never from the model. The agent's prose never restates a rank or score. Every brand opens the exact Qloo request and result behind it.
- **Model choice by measurement:** a bake-off across Sonnet and Haiku, three effort levels and two tool designs scored groundedness, tool use, cost and latency. At low effort Haiku cited IDs that were not in the results it pointed to, including a literal `904FAA0A-PLACEHOLDER`; the grounding check caught and dropped every one. At high effort with business-level tools Haiku had zero violations, matched Sonnet on completeness and cost about a cent per run. Pitches use Sonnet 5.5.
- **Stack:** TypeScript monorepo: a Hono API with PostgreSQL (Drizzle) that caches Qloo responses and logs every call, and a Next.js web app. The live tour stage is three.js with a tour bus modelled in Blender. Pitches render to a branded PDF.
- **Design:** a "tour shirt" visual system in Ink, Paper and Coral: the tour's cities print in like the back of a tour T-shirt as the agent finishes each one.

## Challenges we ran into
- Qloo's city-localised rankings drop national leaders, so "not in the local top 30" is not weak fit. Overlap presents local ranks as extra proof and labels the rest "a national fit" everywhere, including in the agent's instructions.
- Invalid parameters return empty 200s; every empty result is treated as a status, never as an answer.
- Unfiltered taste tags are dominated by places and dishes; asking for music, media and place tags separately gives a crowd read a sponsor can use.
- Keeping the model honest: numbers never come from the model, and the pitch writer only sees an evidence pack rebuilt from logged calls.

## Accomplishments that we're proud of
- Every brand, venue and number on screen traces back to a logged Qloo call, one click away.
- The "with Qloo vs without" comparison scores a plain AI's picks with the same data, so the difference is measured, not claimed.
- A full seller workflow, from tour to approved pitch, in about a minute and about a cent of model cost.

## What we learned
The taste graph changes the answer, not just the confidence. And a grounding check is cheap insurance: it caught every invented ID the model produced.

## What's next for Overlap
Talk to sponsorship sellers about the pitch format; check rankings against publicly announced tour sponsorships; a brand-side mode that runs the same flow in reverse.
