# Samadhan · समाधान

**Fix your street.** Samadhan is a civic issue reporting and resolution tracker for Indian wards. A resident reports a pothole, a garbage pile, a dead streetlight or a water leak. Neighbours confirm it. The ward officer assigns it and closes it with a photo. The resident confirms the fix — or reopens it. Everyone can see what was actually resolved.

It is one website with one ward map. A pinned, scroll-driven story (six states) walks a visitor through the problem, and the working app begins directly below it.

> Built for **Build for Bharat · Track 5 · Smarter Cities and Civic Infrastructure**.

## The problem

Citizens report civic faults, but the municipal response is opaque and slow:

- **Reports go in and never come out.** A complaint is submitted and then nothing is visible: no status, no owner, no deadline.
- **Duplicates pile up.** Five neighbours report the same hole as five separate tickets, so the ward sees five small problems instead of one large one.
- **Fixes are never verified.** A ticket is closed from inside the system. Nobody on the street confirms the work actually happened, so closed ≠ fixed.
- **Nobody can see what was resolved.** There is no shared record of resolutions, fix times or missed deadlines for a ward.
- **Priority is guesswork.** A water leak by a hospital sits in the same queue as a pothole on an empty road.

## Who is affected

- **Residents** of dense urban wards: two-wheeler riders, delivery workers, vendors near markets, parents near schools, older people on broken footpaths.
- **Ward officers and junior engineers**, who triage duplicates by hand and must prove work was done.
- **Schoolchildren and patients**, for whom a dead light or a water leak near a school or hospital is a safety issue, not an inconvenience.
- **Hindi-first residents and people on low-end Android phones with patchy networks**, who are least served by English-only portals.

## Why existing channels fall short

| Channel | What goes wrong |
| --- | --- |
| Phone helplines and paper registers | No citizen-visible status, no duplicate detection, no SLA clock. |
| WhatsApp groups | Good for shouting, poor for records. Duplicates multiply, nothing is assigned, history is lost in chat. |
| Generic grievance / 311-style portals | Often English-first and web-only. Tickets close without neighbour verification and without a per-stage timeline the resident can see. |
| Ward-level dashboards | Summarised after the fact. They do not show the citizen the same pin the officer is working on. |

Samadhan answers each gap: duplicate merging at the point of reporting, neighbour verification that raises priority, an after-photo requirement before an issue can be closed, citizen confirmation or reopen, a visible escalation ladder when SLAs slip, and a ward dashboard anyone can open.

## What is built

### The scroll story (six states, one map)

| State | Headline | What happens |
| --- | --- | --- |
| 01 | *Fix your street.* / अपनी गली सुधारिए। | Quiet full ward map, one pin drops in. |
| 02 | *Reported. Then silence.* / शिकायत हुई। फिर चुप्पी। | Camera pushes into the market-gate pin; the complaint card unfolds with photo, geotag, category and "Submitted 6 days ago, no update". |
| 03 | *Many reports, one issue.* / कई शिकायतें, एक समस्या। | Camera retracts; four duplicate pins glide in and merge; callouts draw in: DUPLICATES MERGED, GEOTAG, NEAR SCHOOL. |
| 04 | *Neighbours confirm.* / पड़ोसी पुष्टि करते हैं। | Votes rise, the pin grows and shifts amber to red, the score counts up, a "Why this priority" breakdown appears, and at 3 votes the status becomes Verified. |
| 05 | *Assigned. Tracked. Fixed.* / सौंपी गई। ट्रैक हुई। हल हुई। | Officer view. The timeline advances, the SLA ring fills, an overdue pulse plays and the issue escalates one rung, the after photo slides in, the citizen confirms, the pin turns green, the stats tick and an SMS arrives. |
| 06 | *A ward that answers.* / जवाब देने वाला वार्ड। | The map calms to mostly green; summary stats and closing CTAs. The live app begins directly below. |

One 700vh pinned stage is driven by native scroll. Scroll position becomes progress `p` (0→1), and a single `requestAnimationFrame` loop writes only `transform` and `opacity` (plus one SVG group transform) to the DOM. React re-renders only on discrete beats. Scroll is never hijacked.

### The working app

Four tabs over one shared store.

- **Live map** — every report as a pin on the same Ward 14 plate, each carrying its priority letter (H/M/L) and score. Filter open or resolved; open a report to see its timeline, priority breakdown, SLA, escalation level, before/after photos, and its full event log.
- **Report issue** — choose a category, tap the map (or use arrow keys) to drop a pin, add an optional description and photo, or speak the complaint. A live priority preview shows the score before submitting.
- **Dashboard** — total, open, resolved, average fix time, past-deadline, escalated, reopened, open issues by category, plus the officer's triage list.
- **SMS updates** — every status change as a text message in the resident's own language.

### Feature 1 — Close the loop

An issue cannot be marked Resolved until the officer attaches an **after photo**. The resident then sees *Is it really fixed?* with **Confirm** and **Reopen** beside a before/after comparison slider. Confirm closes the issue. Reopen returns it to Assigned, adds **+10 priority**, shows a **Reopened** badge and logs the event.

### Feature 2 — Smarter priority

The score is transparent, and every pin shows its letter and score:

```
category weight × 10  +  verifications × 3  +  days open × 3 (capped at 10 days)
+  context boost  +  reopen boost (10)
```

- Category weights: pothole 3, water leak 3, garbage 2, streetlight 2 → 30 / 30 / 20 / 20 points.
- Context boost: **+10 for each nearby public facility** (school, bus stop, metro station, hospital) within about 100 m, capped at +20. A pothole at a market gate beside a bus stop and 60 m from a school scores higher than the same pothole on an empty road.
- Bands: **High 70+, Medium 45–69, Low below 45**. Auto-**Verified** at 3 verifications.
- Every report shows a "Why this priority" breakdown as short chips, e.g. `Category 30 · Neighbours 6 · Days open 18 · Near school 10 · Near bus stop 10`, so the chips always add up to the displayed score.

### Feature 3 — Auto-escalation

When an open issue passes its SLA it climbs a visible ladder:

| Days past deadline | Level |
| --- | --- |
| 0–2 | Ward officer |
| 3–5 | Zonal officer |
| 6+ | Commissioner's office |

The current level is a badge on the report and in the dashboard, and each rung is logged in the timeline with its date, e.g. *Escalated to Zonal officer on 22 Nov*. Escalations are materialised on read, dated at the moment the rung was crossed.

### Feature 4 — Voice reporting and SMS updates

- A microphone button on the Report tab uses the **Web Speech API** with the language matching the app (`hi-IN` or `en-IN`). Support is detected first; if unavailable the app says so plainly and typing stays available.
- The transcript fills the description and matches keywords to pre-select the category: गड्ढा / pothole, कूड़ा / garbage, बत्ती / light, पानी / leak / pipe.
- The SMS inbox shows phone-style messages for every status change, in the active language, e.g. *Samadhan: Your report #1042 (Pothole) is now Assigned. Due in 3 days.*

### Light and dark themes

Three choices — **System, Light, Dark** — cycled by a compact sun/moon toggle in the nav.

- The choice persists in `localStorage` (inside `try/catch`) and is applied by a tiny inline script before first paint, so there is no flash of the wrong theme.
- Explicit choices set `data-theme` on `<html>`; System clears it so `prefers-color-scheme` drives the tokens, and a `matchMedia` listener follows device changes live.
- All colour comes from CSS variables on `:root`, redefined under `@media (prefers-color-scheme: dark)` guarded as `:root:not([data-theme="light"])`, and again under `:root[data-theme="dark"]`. No component or SVG hard-codes a colour.
- `color-scheme` and the `meta theme-color` update with the theme.
- Colours cross-fade over about 200 ms when switching — never on first load, and never under `prefers-reduced-motion`.
- In the dark theme the map reads as **the ward at night**: working streetlight poles glow and poles reported dead stay dark, so a dead-light problem is visible at a glance. In the light theme it is the ward by day.

### Bharat constraints

- **Bilingual end to end**: every headline, button, label, toast, SMS text and theme label exists in English and Hindi; the choice persists.
- **Priority is never colour alone**: every pin and badge carries a text label or letter (H, M, L) and its score.
- **Low-end phones**: no video, no autoplay audio, no animation or map libraries, no horizontal scroll, images compressed client-side before display, 44 px tap targets, visible keyboard focus, a "Skip intro" link, and `prefers-reduced-motion` switches the stage to static states with simple fades.
- **Patchy networks**: every change applies immediately, caches on the device, queues while offline and syncs on reconnect with timeouts; the sync state is always visible.

## Measured payload (production build)

| Asset | Gzipped |
| --- | --- |
| Client JavaScript (React and Next.js runtime included) | ~209 KB |
| Stylesheet | ~9 KB |
| Images (before + after photos, 480×360 JPEG) | ~43 KB |

The first page load still needs a connection; a service worker for fully offline page loads is on the roadmap.

## Architecture

```
src/
  app/
    layout.tsx                        Font, theme boot script, providers, meta theme-color
    page.tsx, globals.css             Entry point, design tokens, all component CSS
    api/reports/route.ts              GET list (reports + events), POST create (duplicate guard)
    api/reports/[id]/route.ts         GET detail, PATCH vote | assign | resolve | confirm | reopen
    api/seed/route.ts                 POST reset to Ward 14 demo data
    api/health/route.ts               Liveness and database check
  components/
    home.tsx                          Header + scroll story + app
    site-header.tsx                   Nav, 01 / 06 progress, skip link, EN|हिं, theme toggle
    theme-provider.tsx                System / Light / Dark, live device following, transitions
    lang-provider.tsx                 EN / HI context, persisted choice
    scroll/scroll-stage.tsx           Pinned stage: camera, pins, cards, callouts, overlays
    scroll/stage-script.ts            Pure choreography (scroll progress → visual values)
    ward/ward-map.tsx                 Identity master: Ward 14 plate, night streetlights
    ward/pin.tsx                      Pin shape, category glyphs, H/M/L tag, priority chips
    ward/camera.ts                    Shared projection maths
    app/app-shell.tsx                 Tabs, hash routing, officer mode, sync state
    app/live-map.tsx                  Map + report detail, before/after slider, confirm/reopen
    app/report-form.tsx               Category, pin, photo, voice input, duplicate guard
    app/dashboard.tsx                 Ward metrics, category breakdown, officer triage
    app/sms-inbox.tsx                 SMS thread in the active language
    app/use-reports.ts                Offline-first store: cache, queue, optimistic updates
    app/toaster.tsx                   Toasts
  db/
    index.ts                          Drizzle client over node-postgres
    schema.ts                         reports, report_votes, report_events
  lib/
    ward.ts                           POIs, priority, SLA, escalation, summaries, duplicates
    seed.ts                           Ten Ward 14 demo reports and their event history
    sms.ts                            SMS templates, event labels, voice keyword matching
    i18n.ts                           All copy, EN and HI
    photo.ts                          Client-side image compression
    storage.ts                        Defensive localStorage helpers
    server/reports.ts                 Drizzle queries, transactions, escalation sync
docs/
  PROBLEM_BRIEF.md                    One-page problem brief
  DEMO_SCRIPT.md                      60-second demo script
```

**Stack:** Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS 4, Drizzle ORM, PostgreSQL, one font family (Yantramanav, Latin + Devanagari). No animation, map, chart or UI libraries.

## The identity master

The stylised Ward 14 plate is the product's identity. Roads, City Park, Govt. School, Main Market, Bus Stop, Metro Station, Hospital, the canal and bridge, the streetlight poles, the pin shape and the four category icons are drawn once and never redrawn, restyled or relocated between states or themes. The map may zoom, pan and recolour.

Landmarks live in `POIS` in `src/lib/ward.ts`, and the map draws from that list while the priority engine reads from it — so the map and the "near school" boost can never disagree.

## API

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| GET | `/api/health` | — | Liveness + `select 1` |
| GET | `/api/reports` | — | All reports and events; seeds on first call; materialises escalations |
| POST | `/api/reports` | `{id, category, x, y, description?, photo?}` | `409` with `similar` when a duplicate is within 125 m |
| GET | `/api/reports/:id` | — | One report, with photos |
| PATCH | `/api/reports/:id` | `{action:"vote", voterId}` | One vote per voter; 3 votes auto-verify |
| PATCH | `/api/reports/:id` | `{action:"assign"}` | Requires the issue to be verified |
| PATCH | `/api/reports/:id` | `{action:"resolve", afterPhoto}` | `400` without an after photo |
| PATCH | `/api/reports/:id` | `{action:"confirm"}` | Closes the loop |
| PATCH | `/api/reports/:id` | `{action:"reopen"}` | Back to Assigned, +10 priority, logged |
| POST | `/api/seed` | — | Restore the Ward 14 demo data |

## Data model

- **reports** — id, category, map position (x/y in metres on the Ward 14 plate), description, status, votes, report count, before photo, after photo, resolution state, reopen count, and timestamps for created / verified / assigned / resolved / confirmed / reopened.
- **report_votes** — report id + voter id, one row per voter per report (composite primary key).
- **report_events** — the status-change history that drives the timeline and the SMS inbox, including each escalation rung.

## Run it locally

Prerequisites: Node.js 22+ and PostgreSQL.

```bash
# 1. Install
npm install

# 2. Configure the database
echo 'DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db' > .env

# 3. Create the tables
npx drizzle-kit push --config=drizzle.config.json

# 4. Develop
npm run dev            # http://localhost:3000

# 5. Or run the production build
npm run build && npm start
```

The first request to `/api/reports` seeds ten realistic Ward 14 reports. Use **Dashboard → Reset demo data** to restore them at any time.

Other scripts: `npm run typecheck`, `npm run lint`.

## The demo data (Ward 14)

| Report | What it shows |
| --- | --- |
| WR14-1042 · pothole at the market gate | 5 reports merged, near school + bus stop (context boost), 2 verifications — one tap from auto-verification |
| WR14-1043 · streetlight out on the school road | A dark pole on the night map; overdue, escalated to the Ward officer |
| WR14-1044 · overflowing bin at the bus stop | Context boost from the bus stop |
| WR14-1045 · leaking pipe near the hospital | Escalated to the Zonal officer |
| WR14-1046 · crater near the bridge | 11 days open, escalated to the Commissioner's office |
| WR14-1047 · garbage by the metro station | Low priority, context boost from the metro |
| WR14-1048 · pothole at the park gate | Resolved with an after photo, **awaiting citizen confirmation** |
| WR14-1049 · garbage corner | **Reopened** once, back to Assigned, +10 priority |
| WR14-1050 · pipe joint sealed | Fully closed, citizen confirmed |
| WR14-1051 · small pothole | Low priority, freshly reported |

Every feature is visible within seconds of opening the app.

## How a municipal ward could adopt Samadhan

1. **Pilot one ward for 60 days.** Pick a ward with an active elected member and a responsive junior engineer. Publish the link on the ward office board, on the ward member's social accounts and in local WhatsApp groups; put a QR code on the board itself.
2. **Connect the officers first.** Give each assigned engineer the Officer view. Their job is to advance each stage and attach an after photo as work finishes, so the SLA clock and the escalation ladder reflect the ground truth.
3. **Bridge the existing grievance system.** Each report carries a stable id, category, geotag and full timestamp history. A small adapter can mirror reports into the municipal grievance register and flow stage updates back, so no one enters anything twice.
4. **Open the intake.** Accept reports from the web app, from QR codes on ward boards, and later from SMS or WhatsApp into the same API.
5. **Publish the dashboard.** Open issues, average fix time, past-deadline and escalated counts are the accountability numbers. Publish them monthly and compare the pilot ward against a control ward.
6. **Govern the data.** Photos and geotags are personal data. Keep only what is needed, delete photos after resolution, and give residents a way to request removal.
7. **Scale by ward.** Each ward needs only its map plate, its category SLAs and its officer roster. The engine is identical.

**Indicative cost:** hosting plus one Postgres instance per city zone, and a few hours of engineering a month for the officer roster and map plates. The core is open to municipal reuse.

## Definition of done — verified

1. ✅ Theme choice survives a reload, shows no flash (inline pre-paint script), and follows the device setting when set to System (live `matchMedia` listener).
2. ✅ All six scroll states and all four app tabs are token-driven and render in both themes, including toasts, form fields, the SMS panel, callout lines and overlays.
3. ✅ Reporting near an existing issue offers "Add my voice" — verified: a POST 125 m from the market-gate pothole returns `409` with `similar: WR14-1042`.
4. ✅ Three verifications auto-verify an issue (verified: 2 votes + 1 → `verified` with a `verified` event), and the breakdown chips sum to the displayed score.
5. ✅ Overdue issues show the correct rung and log it — verified: Ward officer, Zonal officer and Commissioner's office events all materialised.
6. ✅ Resolving requires an after photo (verified: `400` without one), Confirm closes, Reopen returns to Assigned with `reopenCount` 1 and the +10 boost.
7. ✅ Voice input works where the Web Speech API is available and degrades with a plain message otherwise; SMS messages render in the active language on every status change.
8. ✅ Hindi and English are complete, including headlines, buttons, labels, toasts, SMS texts and theme labels.
9. ✅ Works at 360 px: mobile-first layout, stacked map and copy column, 44 px targets, with reduced motion honoured (static states and fades).

Verification commands used: `npx next typegen`, `npm exec tsc -- --noEmit`, `npm run build`, `build_and_start`, plus end-to-end API checks against the running server.

## Roadmap

- Officer sign-in and per-ward roles.
- SMS and WhatsApp intake through the same API, with real message delivery.
- Ward map plates generated from municipal GIS layers.
- A service worker so the app shell itself loads offline.
- Photo verification by a second neighbour before auto-verify.
- Public open-data export (CSV and JSON) per ward.

## Licence

Proposed for open reuse by municipal bodies. Add a licence file before publishing.
