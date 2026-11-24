# Samadhan · 60-second demo script

**Goal:** in one minute a judge understands the problem, meets the person it affects, sees the product working end to end, and believes the value for a ward.

**Format:** screen recording of the live site at 1440×810, then a phone at 390×844 for the last twelve seconds. Native scrolling only. Voiceover in English; press EN | हिं once at 0:50 to show Hindi.

| Time | On screen | Voiceover |
| --- | --- | --- |
| 0:00–0:07 | **01 / 06 · Hero.** Quiet Ward 14 map. One pin drops in at the market gate. Headline *Fix your street.* | "Every ward has potholes, dead streetlights, garbage and leaks. Samadhan is how a ward answers them." |
| 0:07–0:15 | **02 / 06 · The gap.** Camera pushes into the pin. The complaint card unfolds: photo, geotag, category, *Submitted 6 days ago, no update*. Headline *Reported. Then silence.* | "Meera runs a tiffin stall at this gate. She reported this pothole six days ago. Nothing has happened, and nothing shows her why." |
| 0:15–0:24 | **03 / 06 · The system.** Camera pulls back. Four duplicates glide in and merge into one pin. Callouts draw in: DUPLICATES MERGED, GEOTAG, NEAR SCHOOL. Headline *Many reports, one issue.* | "Four neighbours reported the same hole. Samadhan merges reports within 125 metres, so the ward sees one issue, not five tickets — and it notes there's a school nearby." |
| 0:24–0:34 | **04 / 06 · The function.** *I see this too* taps. Votes tick to three, the pin grows and turns from amber to red, the score counts up, the *Why this priority* chips appear, and *Verified* settles in. Headline *Neighbours confirm.* | "Neighbours confirm with one tap. Three confirmations verify it automatically. And the priority is never a black box: category, neighbours, days open, near school — the chips add up to the score on the pin." |
| 0:34–0:47 | **05 / 06 · The peak.** Officer view. The timeline advances Reported, Verified, Assigned. The SLA ring fills, an overdue pulse plays and the escalation badge steps up to Zonal officer. The after photo slides in. The citizen taps Confirm. The pin turns green, the stats tick, and an SMS arrives. Headline *Assigned. Tracked. Fixed.* | "The officer assigns it. Every stage runs against a deadline, and when work runs late it escalates up the ladder automatically. To close it, the officer must attach an after photo. Then the resident confirms — or reopens it, which sends it straight back with higher priority. That's accountability, not a spectacle." |
| 0:47–0:53 | **06 / 06 · The resolution.** The map settles mostly green. Stats: resolved, average fix time, past deadline, escalated. Headline *A ward that answers.* | "Now every resident can see what's open, what was fixed, how fast, and what slipped." |
| 0:53–1:00 | **The live app.** Tap *Report issue*, tap the map next to the market-gate pin → *Similar report nearby* → **Add my voice**. Press the mic and say "Yahan bada gaddha hai" → the category pre-selects and the description fills. Open *SMS updates* to show the messages. Toggle the theme to Dark to show the ward at night with the dead pole unlit. | "Report in under a minute, in Hindi or English, by voice or by tap. Duplicates become voices, not tickets. Every status change reaches the resident as a text message. Samadhan: a ward that answers." |

## Shot list and cues

1. **Open on the hero** and let the pin finish dropping before speaking.
2. **Scroll slowly through 02** and pause one beat with the card fully open. Do not read the card aloud.
3. **In 03,** keep the cursor off the map so the three callouts read cleanly.
4. **In 04,** let the three taps land on the beat, then hold one second on the *Why this priority* chips. That is the credibility moment.
5. **In 05,** pause on the overdue pulse and the escalation badge, then on the after photo. Those two beats carry the whole argument.
6. **In the app,** drop a pin within 125 m of the market-gate pothole so *Similar report nearby* appears reliably — tap just east of the gate on the main road.
7. **For voice,** use Chrome on Android or desktop where the Web Speech API is available. If it is not available, the app says so plainly and typing still works — worth showing, not hiding.
8. **For the night map,** switch the theme to Dark. Working streetlights glow; the reported dead pole on the school road stays dark.
9. **Hindi beat:** press EN | हिं at 0:50. The headline becomes *जवाब देने वाला वार्ड।* and the SMS messages switch to Hindi in the inbox.

## Proof points to name if asked

- Duplicate radius: 125 m, same category, open reports only.
- Priority: category weight × 10 + verifications × 3 + days open × 3 (days capped at 10) + context boost + reopen boost 10.
- Context boost: +10 per nearby school, bus stop, metro station or hospital within about 100 m, capped at +20.
- Bands: High 70+, Medium 45+, Low below 45. Auto-Verified at 3 verifications.
- SLA: pothole 5 days, garbage 2, streetlight 3, water leak 1.
- Escalation: Ward officer 0–2 days overdue, Zonal officer 3–5, Commissioner's office 6+.
- Resolving requires an after photo. Confirm closes; Reopen returns to Assigned with +10 priority and a logged event.
- Payload: no video, no animation or map libraries, ~209 KB of gzipped JavaScript, images compressed client-side. Works offline after the first visit for data changes; the first load needs a connection.

## One-line close

"Samadhan turns complaints into a ward's public record of what it fixed — and what it didn't."
