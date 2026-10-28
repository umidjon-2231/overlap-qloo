---
name: Overlap
description: Sponsorship agent for tours and festivals. Every run is the back of the tour shirt.
colors:
  paper: "#f3f3f1"
  paper-2: "#e9e9e5"
  sheet: "#fbfbf9"
  ink: "#111216"
  ink-2: "#2a2c33"
  ink-soft: "#5d5f66"
  rule: "#cfcfc9"
  coral: "#ff5a36"
  coral-ink: "#c4381a"
  evidence: "#2d4fd6"
  evidence-soft: "#e2e7fb"
  ok: "#1f7a4d"
  warn: "#9a6400"
  on-ink: "#f3f3f1"
  on-ink-soft: "#9c9ea5"
  on-ink-rule: "#2e3038"
typography:
  display-hero:
    fontFamily: "Bricolage Grotesque, sans-serif"
    fontSize: "6rem"
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 75, 'opsz' 96"
  display-city:
    fontFamily: "Bricolage Grotesque, sans-serif"
    fontSize: "4.5rem"
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 75, 'opsz' 96"
  display-stack:
    fontFamily: "Bricolage Grotesque, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 75, 'opsz' 96"
  headline:
    fontFamily: "Bricolage Grotesque, sans-serif"
    fontSize: "1.9rem"
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 75, 'opsz' 96"
  title:
    fontFamily: "Bricolage Grotesque, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 85, 'opsz' 48"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.625
    fontFeature: "'cv11', 'ss01'"
  body-sm:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.625
    fontFeature: "'cv11', 'ss01'"
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.06em"
  data:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: "'tnum'"
rounded:
  none: "0px"
  sm: "2px"
  dot: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.coral}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
  button-primary-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
  button-secondary-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    typography: "{typography.body-sm}"
  button-on-ink:
    backgroundColor: "transparent"
    textColor: "{colors.on-ink}"
    rounded: "{rounded.sm}"
    padding: "6px 12px"
  button-on-ink-hover:
    backgroundColor: "{colors.on-ink}"
    textColor: "{colors.ink}"
  input-text:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
  chip-toggle:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "4px 10px"
  chip-toggle-pressed:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
  chip-evidence:
    backgroundColor: "{colors.evidence-soft}"
    textColor: "{colors.evidence}"
    typography: "{typography.data}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
  chip-evidence-hover:
    backgroundColor: "{colors.evidence}"
    textColor: "{colors.on-ink}"
  tab:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    typography: "{typography.body-sm}"
    padding: "10px 12px"
  tab-selected:
    textColor: "{colors.ink}"
  rail:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    width: "336px"
  header:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    height: "56px"
  stack-row-selected:
    backgroundColor: "{colors.on-ink}"
    textColor: "{colors.ink}"
  brand-row-top-pick:
    backgroundColor: "{colors.coral}"
    textColor: "{colors.ink}"
    padding: "20px 16px"
  city-panel:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    padding: "24px 28px"
  pitch-sheet:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    padding: "24px 32px"
---

# Design System: Overlap

## Overview

**Creative North Star: "The Tour Shirt"**

Overlap is printed, not rendered. The system is spot-ink screenprint on natural cotton: a warm Paper ground for the work, an Ink header and rail for the shell, and a small set of flat spot colours that each carry one meaning. The tour's cities stack on the Ink rail in heavy condensed caps, the way they run down the back of a merch shirt, and each line prints from outline to solid ink as the agent finishes that city. That printing is the only way the agent's work is shown; there is no chat log and no visible reasoning.

Density is real working density. Sellers read ranked brands, affinity numbers and call references at the size they would in a spreadsheet, so evidence sits in tabular mono and structure comes from 1px and 2px ink rules rather than boxes. Selection is shown by reversal (Paper on Ink, Ink on Coral), status by weight and ink, never by elevation. The result must not read as generic SaaS (sidebar plus KPI cards plus chat log), dark neon AI, playful, or dry corporate.

The fixed brand kit (Knockout Venn logo, Ink, Paper, Coral) is the base of every surface; the logo sits on the Ink header as the paper-artwork ("dark") variant.

**Key Characteristics:**
- Paper work area, Ink shell (56px header, and a 336px rail while the agent works or replays), flat fields only.
- One condensed display voice in caps for the stack and headings; a neutral UI sans; tabular mono for every number with provenance.
- Each spot colour has one job: Coral acts and decides, Evidence blue cites Qloo, green and amber mark coverage and approval state.
- 1px ink rules for lists and tables, 2px ink rules under section titles; square or 2px corners.
- The signature move: outline-to-solid printing on the city stack, and reversal for the current item.

## Colors

Three fixed brand inks plus one evidence blue and two small state inks, printed flat on off-white cotton.

### Primary
- **Signal Coral** (coral): the seller's next move and Overlap's decisions. Primary buttons (Find sponsors, Write the pitch, Approve), "Open example →" on the example cards, the field behind the #1 brand card, the outline marking the best local brand in the grid, the city line currently printing, and the live dot beside the agent's current line. Text on Coral is always Ink.
- **Fired Coral** (coral-ink): Coral dark enough to read as text on Paper. Inline validation and error messages, "Use this" on the entity picker, list markers in the pitch, hover on city headers in the Brand by city grid.

### Secondary
- **Screenprint Blue** (evidence): anything that comes from Qloo. Fan fit scores, local rank cells, coordinates, call chips, the "Qloo says" label, the grounding line under the run title ("✓ every brand and venue checked against Qloo"), and the focus ring on Paper.
- **Evidence Wash** (evidence-soft): the flat field behind call chips, taste tags and ranked city chips; blue text sits on it.

### Tertiary
- **Field Green** (ok): strong coverage marks, Done, Approved.
- **Mustard Amber** (warn): thin coverage marks and "Draft: needs your approval".

### Neutral
- **Ink** (ink): text on Paper, the shell (header, rail, city panel, example cards), every structural rule, and the reversed state of selected items.
- **Ink Two** (ink-2): hover field on rail rows.
- **Faded Ink** (ink-soft): secondary text, hints, unselected tabs, ghost buttons.
- **Cotton Paper** (paper): the page ground.
- **Washed Paper** (paper-2): hover field on Paper controls and the pitch blockquote.
- **Sheet** (sheet): the brightest paper, for things the seller writes into or reads at length: inputs, the pitch sheet, JSON in the provenance drawer.
- **Hairline** (rule): light dividers between rows inside an ink-ruled block, tab baseline, footers, scrollbars.
- **Paper on Ink** (on-ink), **Faded Paper** (on-ink-soft), **Rail Rule** (on-ink-rule): text, secondary text and rules on Ink surfaces. Faded Paper is also the outline stroke of a city that has not printed yet.

### Named Rules
**The Coral Means Go Rule.** Coral appears only where the seller can act, where Overlap made a decision, or where the agent is working right now. It is never decoration, never a category colour, never a chart fill.

**The Qloo Is Blue Rule.** Every figure that traces to a Qloo lookup is Screenprint Blue or sits on Evidence Wash, and model interpretation never is. A seller can tell fact from suggestion by ink alone.

**The Three Inks Rule.** Any one region prints in at most Ink, Paper and one spot colour. The #1 brand card is Ink on Coral, so its evidence chips and rank chips reverse to Ink instead of turning blue.

## Typography

**Display Font:** Bricolage Grotesque, variable, at width 75 and weight 800, uppercase (with sans-serif)
**Display Wide:** Bricolage Grotesque at width 85, weight 700, sentence case
**Body Font:** Inter with cv11 and ss01 (with system-ui, sans-serif)
**Label/Mono Font:** JetBrains Mono with tabular numerals

**Character:** a merch-table display voice, tall and tight, over a quiet workhorse sans that never competes with it. Mono is reserved for numbers and identifiers a seller might need to check.

### Hierarchy
- **Display hero** (800, 3.4rem mobile / 5rem sm, 0.92): the home headline only ("Find sponsors for your tour.").
- **Display city** (800, 3.5rem / 4.5rem, 0.92): the selected city's name on its Ink panel; "Printing the tour" (3.2rem / 4rem) while the agent works.
- **Display stack** (800, 1.75rem mobile / 2.25rem desktop, 0.92): every city line on the rail. One size for the whole stack.
- **Headline** (800 display caps, 1.9rem): section titles (See an example, Or try your own tour, Brands to pitch, Brand by city, With Qloo vs without, Pitch for <Brand>); also the step numerals on the home page, the example names on their cards and the rank numeral on brand cards. Display caps at 1.6rem for sub-sections inside a city; 2.4rem for the picker question.
- **Fit score** (800 display, 3rem, tabular): the fan fit number on each brand card, Screenprint Blue (Ink on the coral #1 card), labelled "Top fan fit" on #1, otherwise Excellent fit (90 and up), Strong fit (80 and up) or Good fit.
- **Title** (display wide, 700, 1.5rem to 2.4rem, leading tight): the run title h1 (2rem / 2.4rem), the short answer ("Lead with …", 1.45rem), brand names on the brand cards (1.5rem), the brand heading in the pitch (1.6rem).
- **Body** (Inter 400, 1rem, 1.625): summaries and explanatory copy, held to 60 to 72ch. Pitch prose runs at 0.95rem, line-height 1.6, 72ch.
- **Body small** (Inter, 0.875rem): most UI: buttons and tabs (600), list rows, hints.
- **Label** (Inter 600, 11px, 0.06em, uppercase): run-in provenance labels ("Qloo says", "Overlap suggests") at the start of a sentence, and the status pill.
- **Data** (JetBrains Mono, 11px to 1rem, tabular): affinities, popularity, ranks (#3), call references, coordinates, the progress count.

### Named Rules
**The One Size Stack Rule.** Every city on the rail prints at the same size. State is carried by outline, coral, solid ink and reversal, never by scaling a line up or down.

**The Mono Is Evidence Rule.** Numbers a seller might quote or check are set in tabular mono. Prose numbers (city counts, "about 20 s") stay in the UI sans.

## Layout

A shell-and-work split while the agent works. The Ink header is 56px tall with the logo left and "New run" right. While a run works or replays, a 336px Ink rail sits on the left at the lg breakpoint (1024px), sticky to the viewport below the header and scrolling internally; the Paper work area fills the rest with 16px side padding (32px from sm). Below lg the rail collapses to a horizontally scrolling strip of city lines above the work area. Finished results drop the rail and take the full width.

Finished results read top to bottom: the run name, a one-line subtitle ("5 cities · Phoebe Bridgers · ✓ every brand and venue checked against Qloo", the check in blue), the ghost button "▶ Replay how Overlap did it", the short answer ("Lead with …, then …", with a "See the comparison →" line), "Read Overlap's notes" (the agent's summary, folded), then a single tab row (Brands, Cities, Compare). A pitch opens as its own view from a brand, with "← Back to all brands". Content is capped at 72rem for the header and 62 to 80ch for prose. The home page is one column capped at 64rem: the headline, three numbered steps, "See an example" as three Ink cards in a row from md, then "Or try your own tour" with the form.

Rhythm runs on a 4px base: 4 and 8px inside controls and chip clusters, 16px between related blocks, 24px between a tab row and its panel, 32 to 48px between sections. Lists are full-bleed rows separated by rules, not padded cards.

**The Same Panel Rule.** Every city view shows the same panels in the same order (city field, crowd, where fans gather, local partners), so cities compare by position.

## Elevation & Depth

Flat. There are no shadows, gradients or glows anywhere; depth comes from ink coverage. An Ink field reads as nearer than Paper, a Coral field as the most important thing on the screen, and Sheet as a lighter page laid on the Paper. The one translucency is the provenance drawer's scrim (Ink at 40%), which dims the page behind a full-height Paper drawer with a 1px ink left rule.

Focus is a 2px Screenprint Blue outline offset 2px on Paper, and a 2px Coral outline on Ink surfaces.

### Named Rules
**The Flat Ink Rule.** If a surface needs to stand apart, print it in a different ink or reverse it. Never lift it.

**The No Card In Card Rule.** A selected or important thing owns one flat field (the coral top-pick row, the ink city panel, the sheet). Nothing inside that field gets its own box.

## Shapes

Square by default. Controls and chips take a 2px corner, which reads as a cut edge rather than a rounded one; rows, fields, panels and tables are fully square. The only circles are the 6px status and live dots. Coverage is a small printed square: filled for strong, half-filled for thin, outlined for none. Icons are inline line SVGs with square caps, sized 10 to 12px, and only where they say something (done check, external map link).

Rules carry the structure: a 2px Ink rule under section titles and above error and empty-pitch blocks, 1px Ink rules between brand cards, partner rows and hotspot rows, and 1px Hairline rules between rows inside an already-ruled block.

## Components

### Buttons
Printed tags: compact, flat, semibold.
- **Shape:** cut corners (2px), 8px by 14px padding, 0.875rem semibold Inter.
- **Primary:** Ink text on Coral. Hover reverses to Paper on Ink. Used once per decision point.
- **Secondary:** 1px Ink outline, Ink text, transparent. Hover fills Ink with Paper text. Used for navigation into deeper views and for exports (Open as email, Download PDF, Copy text).
- **Ghost:** Faded Ink text, underline on hover (offset 4px). Used for toggles and secondary moves like "Show the data", "Read Overlap's notes", "▶ Replay how Overlap did it", "Edit text", "Write it again", "More options".
- **On Ink:** 1px Rail Rule outline with Paper text; hover reverses to Ink on Paper (the header's New run).
- **Disabled:** 40% opacity, no pointer events. Exports stay visibly disabled until the pitch is approved.

### Chips
- **Toggle chips** (brand types under "More options", the city switcher): 1px Ink outline, 2px corners; pressed reverses to Paper on Ink; hover on Paper takes Washed Paper.
- **Segmented control** (Tour / Festival, under "More options"): two square buttons in one 1px Ink frame, pressed reverses.
- **Evidence chips** (Qloo call references, crowd tags (grouped: music, books/film/TV, places), ranked cities): Screenprint Blue mono or sans on Evidence Wash, 2px corners; call chips reverse to Paper on Blue on hover and open the provenance drawer. On a Coral field they print as Paper on Ink instead.

### Cards / Containers
There are no cards. Containers are flat fields:
- **Brand card:** a full-width row on a 1px Ink rule: rank, name and category, the "Overlap suggests" note, the brand's rank among its type in each city, the main action (Write the pitch / Open pitch draft / Pitch ready ✓), "Show the data", and the fit score on the right. The #1 card prints on Coral edge to edge, Ink text throughout.
- **Example card:** an Ink field on the home page: "Tour ·" or "Festival ·", the artists in display caps, the cities, and "Open example →" in Coral.
- **City panel:** an Ink field (24px by 28px padding) with the city name in display caps, the strong/thin fan data mark and "Your brands here (rank among their type)".
- **Pitch sheet:** a Sheet field (24px by 32px) holding the rendered pitch or its text editor.

### Inputs / Fields
- **Style:** Sheet ground, 1px Ink border, 2px corners, 10px by 12px padding, 1rem text, Faded Ink placeholder. Labels sit above in 0.875rem semibold, hints below in 0.75rem Faded Ink.
- **Focus:** 2px Screenprint Blue outline, no offset.
- **Error:** a Fired Coral line of text beside the submit button; the field itself does not change colour.
- **Pitch text editor** (Markdown): Hairline border on Sheet, mono 0.75rem; focus darkens the border to Ink.

### Navigation
- **Header:** Ink bar, 56px, logo 28px tall.
- **Tabs:** 0.875rem semibold, Faded Ink at rest, Ink on hover; selected takes Ink text and a 2px Ink underline sitting on a 1px Hairline baseline. - **Pitch stepper:** Write → Check & approve → Send; the current step is Ink on Coral, done steps Paper on Field Green, later steps outlined in Hairline.
- **Pitch brand list:** on desktop, full-width rows on 1px Ink rules beside the pitch; current reverses to Paper on Ink. Phones get a brand dropdown instead.

### Tour Stack (signature)
The rail shows only while the agent works or replays; finished results take the full width. It lists each city as a button in display caps at one size. A queued city is outline only (1px Faded Paper stroke, transparent fill). While the agent works on it, the stroke and a sweeping fill turn Coral, the fill wiping back and forth like a squeegee (1.6s, alternating). When the city is finished the solid Paper ink wipes in left to right (900ms, ease-out-expo), staggered 140ms down the stack on first paint. The selected city reverses: a Paper row with Ink type. Beneath each line, the top two local brand ranks print in small Faded Paper text with mono rank numbers. At the rail's foot, the last four plain-language agent lines enter with a 6px rise (420ms), the current one marked by a blinking Coral dot, above a mono progress count ("4/6 cities · 38 Qloo lookups"). Reduced motion freezes the working city at half printed and removes all animation.

### Tour Route stage (run in progress)
While a run works, the main area holds one stage and nothing else: a full-bleed Paper band between 1px Ink rules (15rem tall on phones, 24rem from `sm`), a single status line below it (1.125rem semibold, Coral live dot), one mono counter line and "Skip to results". Inside, an orthographic three.js scene in unlit flat inks: an Ink road with a dashed Paper centre line through the seller's cities in tour order; each stop is a Paper disc with an Ink ring that turns solid Ink when printed; behind it the city's landmark in low-poly primitives (26 well-known tour cities, `components/landmarks.ts`: Elizabeth Tower and the Eye, Willis Tower, the KIO towers…) with a low back row of blocks, or for any other city 4–6 blocks shaped from its name, outlined in Ink while queued, Coral while the agent is there, solid Ink with Paper edges once printed. The Overlap tour bus (Ink body, Paper window band, Coral stripe, the mark on its sides, Ink edge lines) drives to each city as the agent reaches it, dwells 1.6s with a Coral pulse ring, then moves on; the camera follows and pulls back over the whole route at the end, then the results open. City labels use the Tour Stack print (outline → solid Ink on Paper); up to two brand tags (Sheet chip, 1px Ink border, rank in blue mono) pop in above a visited city. Reduced motion: the bus jumps between stops and nothing pulses. No WebGL: the screen-print loop plays instead. Lists and detail never appear on the stage.

### Status Pill
6px dot plus an 11px uppercase label: Working (blue on Paper, Coral on Ink, blinking dot), Done (green on Paper, Paper on Ink), Needs your pick (Coral).

### Section Title
Display caps at 1.9rem over a 2px Ink rule, with an optional Faded Ink hint on the same baseline and an optional action at the right.

## Do's and Don'ts

### Do:
- **Do** keep work on Paper and the shell on Ink; put a city, an example card or a drawer header on Ink only when it is the thing being looked at.
- **Do** show state by ink and reversal: outline to solid, Faded to full, Paper on Ink for current.
- **Do** set every Qloo-derived number in tabular mono and in Screenprint Blue (or on Evidence Wash), with a call chip that opens its source.
- **Do** label model interpretation with the run-in "Overlap suggests" label and keep it in Ink, never blue.
- **Do** separate rows with 1px Ink rules and section titles with a 2px Ink rule.
- **Do** honour prefers-reduced-motion: printed states stay legible without any animation.

### Don't:
- **Don't** use Coral for decoration, categories, charts or non-actionable emphasis.
- **Don't** add shadows, gradients, glows or blur; the drawer scrim is the only translucency.
- **Don't** round corners beyond 2px; circles are only for the status and live dots.
- **Don't** put cards inside panels or wrap list rows in boxes.
- **Don't** vary the size of city lines on the stack to show importance.
- **Don't** show the agent's tool names, internal notes or reasoning text; the rail shows short plain lines only.
- **Don't** build the sidebar-plus-KPI-cards-plus-chat-log layout, dark neon AI styling, or playful illustration.
