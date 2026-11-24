# Samadhan · Problem Brief

**Build for Bharat · Track 5 · Smarter Cities and Civic Infrastructure**

## The one-line problem

A citizen can report a civic fault, but cannot see what happened to it — and the ward cannot tell whether what it closed was actually fixed.

## Who feels it

Meera runs a tiffin stall at the Main Market gate in Ward 14. A pothole opened where the buses turn in. She reported it six days ago. She has no status, no owner, no deadline. Four of her neighbours reported the same hole. The ward received five tickets and read them as five small problems, so none of them crossed the threshold for repair. A streetlight on the school road has been out for four days; children cross there after tuition. Nobody can see any of it, so nobody can be held to it.

Multiply Meera by every ward in every Indian city.

## Why the current system produces this outcome

| Gap in the current process | Consequence |
| --- | --- |
| Intake is invisible after submission | Citizens stop reporting because reporting feels pointless. |
| No duplicate detection | Five neighbours become five tickets. The ward under-reads severity and over-works its queue. |
| Priority is a queue position, not a score | A water leak by a hospital and a pothole on an empty road sit together. |
| No clock on the work | Nothing is overdue, because nothing has a deadline. |
| Tickets close from inside the system | "Closed" does not mean "fixed". Nobody on the street confirms it. |
| No public record of outcomes | A ward cannot show what it resolved, or how fast, or what it missed. |

## The four failures Samadhan attacks

1. **Silence after submission.** Every report has a public status timeline: Reported → Verified → Assigned → Resolved, each stage timestamped.
2. **Duplicates.** A same-category open report within 125 m is offered as *Similar report nearby* with **Add my voice** instead of a new ticket. Five reports become one issue with one location and one priority.
3. **Unverified fixes.** An issue cannot be marked Resolved without an **after photo**. The resident then confirms it, or reopens it — which returns it to the officer with +10 priority and a Reopened badge. Closing a ticket now requires proof.
4. **No accountability clock.** Each category has an SLA (pothole 5 days, garbage 2, streetlight 3, water leak 1). Past deadline, the issue climbs a visible ladder: Ward officer (0–2 days) → Zonal officer (3–5) → Commissioner's office (6+), with each rung logged and dated.

## How priority is decided, in the open

```
category weight × 10 + verifications × 3 + days open × 3 (capped at 10)
+ context boost + reopen boost (10)
```

Context matters: +10 for each nearby school, bus stop, metro station or hospital, capped at +20. The market-gate pothole sits beside a bus stop and 60 m from a school, so it outranks the same pothole on an empty lane.

The score is never a black box. Every pin carries its letter and score, and every report shows the breakdown as chips — `Category 30 · Neighbours 6 · Days open 18 · Near school 10 · Near bus stop 10` — so a resident can check the ward's arithmetic.

## Why now, and why this shape

- **Smartphones are common; trust is not.** The reporting device is already in every pocket. What is missing is the feedback loop.
- **Duplicate reports are signal, not noise.** Five reports of one hole mean five people affected. Merging them converts noise into priority.
- **Neighbours are free verification.** Three confirmations from three households are stronger evidence than one complaint, and they cost the ward nothing.
- **Deadlines already exist on paper.** Municipal SLAs exist; they are simply not visible to anyone. Making them public is the cheapest accountability available.
- **Closure needs proof.** An after photo plus a resident's confirmation is the difference between a closed ticket and a fixed street.

## Constraints the solution must respect

Urban residents and ward officers, on low-end Android phones, with patchy networks, in Hindi and English. So: no video, no heavy libraries, compressed images, native scrolling only, full bilingual coverage, offline tolerance, 44 px tap targets, and reduced-motion support. A civic tool that only works on a flagship phone and a fast connection is not a civic tool.

## What changes if it works

- A resident reports in under a minute and can see the issue move.
- A ward officer sees one merged, scored, prioritised queue instead of a pile of duplicates.
- Missed SLAs escalate automatically instead of disappearing.
- A closed issue has a photo and a resident's confirmation behind it.
- The ward can publish its own numbers: open, resolved, average fix time, past deadline, escalated, reopened.

That is the shift: from *complaints submitted* to *streets fixed, and provably so*.
