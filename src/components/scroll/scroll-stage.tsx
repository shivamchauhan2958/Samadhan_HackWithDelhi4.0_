"use client";

import { useEffect, useRef, useState } from "react";
import { useLang } from "@/components/lang-provider";
import { camTransform, toScreen } from "@/components/ward/camera";
import { Pin, PinTag, PriorityChips, pinTag } from "@/components/ward/pin";
import { WardSvg } from "@/components/ward/ward-map";
import type { Key } from "@/lib/i18n";
import { smsText } from "@/lib/sms";
import { AFTER_PHOTO, BEFORE_PHOTO, HERO_ID, SETTLE_IDS, buildSeed } from "@/lib/seed";
import {
  CATEGORY_META,
  derive,
  geotag,
  levelFor,
  priorityParts,
  summarize,
  type Category,
  type PriorityParts,
  type ReportView,
  type Tone,
} from "@/lib/ward";
import {
  HERO_AT,
  REDUCED_POSES,
  clamp01,
  escAt,
  frameAt,
  resolvedAt,
  settledAt,
  slaPhaseAt,
  stageAt,
  stateIndex,
  votesAt,
  type EscPhase,
  type SlaPhase,
} from "./stage-script";

type Ambient = { id: string; category: Category; x: number; y: number; tone: Tone; score: number; settle: boolean };
type Summary = ReturnType<typeof summarize>;
type Story = {
  ambient: Ambient[];
  deadLights: { x: number; y: number }[];
  scores: number[];
  scoreStart: number;
  scoreEnd: number;
  partsAt: (votes: number) => PriorityParts;
  before: Summary;
  after: Summary;
  geotagLabel: string;
  hero: ReportView;
};

const HEADS: { h: Key; p: Key }[] = [
  { h: "hero.h", p: "hero.p" },
  { h: "gap.h", p: "gap.p" },
  { h: "system.h", p: "system.p" },
  { h: "function.h", p: "function.p" },
  { h: "peak.h", p: "peak.p" },
  { h: "resolution.h", p: "resolution.p" },
];
const STAGE_KEYS: Key[] = ["stage.reported", "stage.verified", "stage.assigned", "stage.resolved"];
const STAT_KEYS: Key[] = ["stats.resolved", "stats.fix", "stats.past", "stats.open", "stats.escalated"];
const CIRC = 2 * Math.PI * 26;

const clampPx = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// One pinned stage driven by native scroll. One ward map, six states, no scroll-jacking.
export function ScrollStage({ onStateChange }: { onStateChange?: (idx: number) => void }) {
  const { lang, t } = useLang();
  const sectionRef = useRef<HTMLElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const camRef = useRef<SVGGElement>(null);
  const ambLayerRef = useRef<HTMLDivElement>(null);
  const ambRefs = useRef<(HTMLDivElement | null)[]>([]);
  const heroRef = useRef<HTMLDivElement>(null);
  const heroTagRef = useRef<HTMLSpanElement>(null);
  const dupRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pulseRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const cardLineRef = useRef<SVGLineElement>(null);
  const calloutRefs = useRef<(HTMLDivElement | null)[]>([]);
  const calloutLineRefs = useRef<(SVGLineElement | null)[]>([]);
  const chipRef = useRef<HTMLDivElement>(null);
  const verifiedRef = useRef<HTMLSpanElement>(null);
  const scoreRef = useRef<HTMLSpanElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const cueRef = useRef<HTMLDivElement>(null);
  const headRefs = useRef<(HTMLDivElement | null)[]>([]);
  const zone1Ref = useRef<HTMLDivElement>(null);
  const zone5Ref = useRef<HTMLDivElement>(null);
  const zone6Ref = useRef<HTMLDivElement>(null);
  const timelineFillRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const statRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const smsRef = useRef<HTMLDivElement>(null);
  const afterRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);

  const [story, setStory] = useState<Story | null>(null);
  const [reduced, setReduced] = useState(false);
  const [idx, setIdx] = useState(0);
  const [votes, setVotes] = useState(0);
  const [resolved, setResolved] = useState(false);
  const [settled, setSettled] = useState(false);
  const [stage, setStage] = useState(1);
  const [sla, setSla] = useState<SlaPhase>("running");
  const [esc, setEsc] = useState<EscPhase>(0);
  const last = useRef({ idx: 0, votes: 0, resolved: false, settled: false, stage: 1, sla: "running" as SlaPhase, esc: 0 as EscPhase });
  // Read inside the frame loop, which must not re-subscribe when this flips.
  const resolvedRef = useRef(false);

  useEffect(() => {
    onStateChange?.(idx);
  }, [idx, onStateChange]);

  // Story data is built once on the client, keeping server markup stable.
  useEffect(() => {
    const now = Date.now();
    const { reports, events } = buildSeed(now);
    const hero = reports.find((r) => r.id === HERO_ID);
    if (!hero) return;
    const heroDerived = derive(hero, now);
    const scores = [0, 1, 2, 3].map((v) => priorityParts({ ...hero, votes: v }, heroDerived.daysOpen).total);
    const partsAt = (v: number) => priorityParts({ ...hero, votes: v }, heroDerived.daysOpen);
    const ambient: Ambient[] = reports
      .filter((r) => r.id !== HERO_ID)
      .map((r) => {
        const d = derive(r, now);
        return { id: r.id, category: r.category, x: r.x, y: r.y, tone: d.tone, score: d.score, settle: SETTLE_IDS.includes(r.id) };
      });
    const deadLights = reports
      .filter((r) => r.category === "streetlight" && r.status !== "resolved")
      .map((r) => ({ x: r.x, y: r.y }));
    const afterSeed: ReportView[] = reports.map((r) =>
      r.id === HERO_ID
        ? { ...r, status: "resolved" as const, resolution: "confirmed" as const, resolvedAt: new Date(now).toISOString(), afterPhoto: AFTER_PHOTO }
        : r,
    );
    const next = {
      ambient,
      deadLights,
      scores,
      scoreStart: scores[0],
      scoreEnd: scores[3],
      partsAt,
      before: summarize(reports, now),
      after: summarize(afterSeed, now),
      geotagLabel: geotag(HERO_AT.x, HERO_AT.y).label,
      hero,
    };
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Deferred by a tick so the effect does not set state synchronously.
    const build = window.setTimeout(() => {
      setStory(next);
      setReduced(reducedMotion);
    }, 0);
    void events;
    return () => window.clearTimeout(build);
  }, []);

  // Scroll-linked frame loop: writes transforms and opacity straight to the DOM.
  useEffect(() => {
    if (!story) return;
    const section = sectionRef.current;
    const box = boxRef.current;
    if (!section || !box) return;
    const isReduced = reduced;
    let raf = 0;

    const progress = () => {
      const total = section.offsetHeight - window.innerHeight;
      if (total <= 0) return 0;
      return clamp01(-section.getBoundingClientRect().top / total);
    };

    const render = (rawP: number) => {
      const cw = box.clientWidth;
      const ch = box.clientHeight;
      if (!cw || !ch) return;
      const p = isReduced ? REDUCED_POSES[stateIndex(rawP)] : rawP;
      const mobile = cw < 700;
      const f = frameAt(p, { mobile, scoreStart: story.scoreStart, scoreEnd: story.scoreEnd });

      camRef.current?.setAttribute("transform", camTransform(cw, ch, f.cam));

      const amb = ambLayerRef.current;
      if (amb) {
        amb.style.opacity = f.ambientOpacity.toFixed(3);
        amb.style.filter = f.ambientBlur > 0.05 ? `blur(${f.ambientBlur.toFixed(2)}px)` : "none";
      }
      story.ambient.forEach((a, i) => {
        const el = ambRefs.current[i];
        if (!el) return;
        const s = toScreen(cw, ch, f.cam, a.x, a.y);
        el.style.transform = `translate3d(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px, 0) translate(-50%, -100%) scale(${mobile ? 0.8 : 0.9})`;
      });

      const hs = toScreen(cw, ch, f.cam, HERO_AT.x, HERO_AT.y);
      const hy = hs.y + f.heroDrop;
      const hero = heroRef.current;
      if (hero) {
        hero.style.opacity = f.heroOpacity.toFixed(3);
        hero.style.transform = `translate3d(${hs.x.toFixed(1)}px, ${hy.toFixed(1)}px, 0) translate(-50%, -100%) scale(${f.heroGrowth.toFixed(3)})`;
      }
      if (heroTagRef.current) heroTagRef.current.textContent = pinTag(resolvedRef.current ? "resolved" : levelFor(f.score), Math.round(f.score));

      f.dups.forEach((d, i) => {
        const el = dupRefs.current[i];
        if (!el) return;
        const s = toScreen(cw, ch, f.cam, d.x, d.y);
        el.style.opacity = d.opacity.toFixed(3);
        el.style.transform = `translate3d(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px, 0) translate(-50%, -100%) scale(${d.scale.toFixed(3)})`;
      });

      const pr = pulseRef.current;
      if (pr) {
        pr.style.opacity = (f.pulse * 0.9).toFixed(3);
        pr.style.transform = `translate3d(${hs.x.toFixed(1)}px, ${(hy - 22).toFixed(1)}px, 0) translate(-50%, -50%) scale(${(1 + 0.7 * f.pulse).toFixed(3)})`;
      }

      // Complaint card unfolds from the pin: beside it on desktop, above it on mobile.
      const cardW = Math.min(300, cw - 16);
      const cardH = cardRef.current?.offsetHeight || 176;
      const cx0 = mobile ? clampPx(hs.x - cardW / 2, 8, cw - cardW - 8) : clampPx(hs.x + 40, 8, cw - cardW - 8);
      const cy0 = mobile ? clampPx(hy - cardH - 36, 8, ch - cardH - 8) : clampPx(hy - cardH * 0.55, 8, ch - cardH - 8);
      const card = cardRef.current;
      if (card) {
        card.style.width = `${cardW}px`;
        card.style.opacity = f.card.toFixed(3);
        card.style.visibility = f.card > 0.01 ? "visible" : "hidden";
        card.style.transform = `translate3d(${cx0.toFixed(1)}px, ${cy0.toFixed(1)}px, 0) scale(${(0.92 + 0.08 * f.card).toFixed(3)}, ${(0.12 + 0.88 * f.card).toFixed(3)})`;
      }
      const cl = cardLineRef.current;
      if (cl) {
        const x2 = mobile ? cx0 + cardW / 2 : cx0;
        const y2 = mobile ? cy0 + cardH : cy0 + cardH * 0.5;
        const L = Math.hypot(x2 - hs.x, y2 - (hy - 16));
        cl.setAttribute("x1", hs.x.toFixed(1));
        cl.setAttribute("y1", (hy - 16).toFixed(1));
        cl.setAttribute("x2", x2.toFixed(1));
        cl.setAttribute("y2", y2.toFixed(1));
        cl.style.strokeDasharray = `${L.toFixed(1)}`;
        cl.style.strokeDashoffset = `${(L * (1 - f.card)).toFixed(1)}`;
        cl.style.opacity = f.card > 0.01 ? "1" : "0";
      }

      // Callouts draw in with stroke-dashoffset, then clear before the vote panel arrives.
      const offs = mobile ? [[36, -128], [48, 76], [-118, 76]] : [[146, -150], [166, 84], [-236, 84]];
      for (let i = 0; i < 3; i++) {
        const ax = clampPx(hs.x + offs[i][0], 84, cw - 84);
        const ay = clampPx(hy + offs[i][1], 24, ch - 24);
        const ln = calloutLineRefs.current[i];
        const L = Math.hypot(ax - hs.x, ay - (hy - 14));
        if (ln) {
          ln.setAttribute("x1", hs.x.toFixed(1));
          ln.setAttribute("y1", (hy - 14).toFixed(1));
          ln.setAttribute("x2", ax.toFixed(1));
          ln.setAttribute("y2", ay.toFixed(1));
          ln.style.strokeDasharray = `${L.toFixed(1)}`;
          ln.style.strokeDashoffset = `${(L * (1 - f.callouts[i])).toFixed(1)}`;
          ln.style.opacity = f.calloutVis.toFixed(3);
        }
        const el = calloutRefs.current[i];
        if (el) {
          el.style.transform = `translate3d(${ax.toFixed(1)}px, ${ay.toFixed(1)}px, 0) translate(-50%, -50%)`;
          el.style.opacity = (f.callouts[i] * f.calloutVis).toFixed(3);
        }
      }

      // Vote panel beside the merged pin.
      const chip = chipRef.current;
      if (chip) {
        const chipW = mobile ? Math.min(268, cw - 16) : 268;
        chip.style.width = `${chipW}px`;
        const chX = mobile ? clampPx(hs.x - chipW / 2, 8, cw - chipW - 8) : clampPx(hs.x + 44, 8, cw - chipW - 8);
        const chY = mobile ? clampPx(hy + 28, 8, ch - 190) : clampPx(hy - 92, 8, ch - 200);
        chip.style.transform = `translate3d(${chX.toFixed(1)}px, ${chY.toFixed(1)}px, 0) scale(${(0.96 + 0.04 * f.chip).toFixed(3)})`;
        chip.style.opacity = f.chip.toFixed(3);
        chip.style.visibility = f.chip > 0.01 ? "visible" : "hidden";
      }
      if (verifiedRef.current) verifiedRef.current.style.opacity = f.verified.toFixed(3);
      if (scoreRef.current) scoreRef.current.textContent = String(Math.round(f.score));

      if (veilRef.current) veilRef.current.style.opacity = f.veil.toFixed(3);
      if (cueRef.current) cueRef.current.style.opacity = f.cue.toFixed(3);
      if (smsRef.current) {
        smsRef.current.style.opacity = f.sms.toFixed(3);
        smsRef.current.style.transform = `translate3d(0, ${((1 - f.sms) * 14).toFixed(1)}px, 0)`;
        smsRef.current.style.visibility = f.sms > 0.01 ? "visible" : "hidden";
      }
      if (afterRef.current) {
        afterRef.current.style.opacity = f.after.toFixed(3);
        afterRef.current.style.transform = `translate3d(${((1 - f.after) * 26).toFixed(1)}px, 0, 0)`;
      }
      if (confirmRef.current) confirmRef.current.style.opacity = f.confirm.toFixed(3);

      const activeIdx = stateIndex(rawP);
      f.headings.forEach((h, i) => {
        const el = headRefs.current[i];
        if (!el) return;
        el.style.opacity = (isReduced ? (i === activeIdx ? 1 : 0) : h.op).toFixed(3);
        el.style.transform = `translate3d(0, ${(isReduced ? 0 : h.ty).toFixed(1)}px, 0)`;
      });

      const setZone = (el: HTMLDivElement | null, v: number) => {
        if (!el) return;
        el.style.opacity = v.toFixed(3);
        el.style.visibility = v > 0.02 ? "visible" : "hidden";
      };
      setZone(zone1Ref.current, f.zone1);
      setZone(zone5Ref.current, f.officer);
      setZone(zone6Ref.current, f.zone6);

      if (timelineFillRef.current) timelineFillRef.current.style.width = `${(f.timeline * 100).toFixed(1)}%`;
      if (ringRef.current) ringRef.current.style.strokeDashoffset = (CIRC * (1 - f.ring)).toFixed(2);

      const sb = story.before;
      const sa = story.after;
      const put = (k: number, text: string) => {
        const el = statRefs.current[k];
        if (el) el.textContent = text;
      };
      put(0, String(Math.round(lerp(sb.resolved, sa.resolved, f.stats))));
      put(1, lerp(sb.avgFixDays, sa.avgFixDays, f.stats).toFixed(1));
      put(2, String(Math.round(lerp(sb.pastDeadline, sa.pastDeadline, f.stats))));
      put(3, String(Math.round(lerp(sb.open, sa.open, f.stats))));
      put(4, String(Math.round(lerp(sb.escalated, sa.escalated, f.stats))));

      // Discrete beats.
      const beats: [keyof typeof last.current, unknown, (v: unknown) => void][] = [
        ["idx", stateIndex(rawP), (v) => setIdx(v as number)],
        ["votes", votesAt(p), (v) => setVotes(v as number)],
        ["resolved", resolvedAt(p), (v) => {
          resolvedRef.current = v as boolean;
          setResolved(v as boolean);
        }],
        ["settled", settledAt(p), (v) => setSettled(v as boolean)],
        ["stage", stageAt(p), (v) => setStage(v as number)],
        ["sla", slaPhaseAt(p), (v) => setSla(v as SlaPhase)],
        ["esc", escAt(p), (v) => setEsc(v as EscPhase)],
      ];
      for (const [key, value, apply] of beats) {
        if (value !== last.current[key]) {
          (last.current as Record<string, unknown>)[key] = value;
          apply(value);
        }
      }
    };

    const frame = () => {
      raf = 0;
      render(progress());
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const ro = new ResizeObserver(schedule);
    ro.observe(box);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [story, reduced]);

  const heroTone: Tone = resolved ? "resolved" : story ? levelFor(story.scores[votes]) : "medium";
  const catName = CATEGORY_META.pothole[lang];
  const parts = story ? story.partsAt(votes) : null;
  const statValue = (k: number): string => {
    if (!story) return "–";
    const b = story.before;
    return [String(b.resolved), b.avgFixDays.toFixed(1), String(b.pastDeadline), String(b.open), String(b.escalated)][k];
  };
  const slaText = sla === "running" ? t("sla.onTrack") : sla === "overdue" ? t("sla.overdueBy", { n: 2 }) : t("sla.resolvedOnTime");
  const slaColor = sla === "resolved" ? "var(--resolved)" : sla === "overdue" ? "var(--high)" : "var(--ink)";
  const escKey: Key = esc === 2 ? "esc.zonal" : esc === 1 ? "esc.ward" : "esc.none";
  const smsMessage = story ? smsText({ id: -1, reportId: HERO_ID, kind: "resolved", level: null, at: new Date().toISOString() }, { ...story.hero, status: "resolved", resolution: "confirmed" }, lang) : "";

  return (
    <section ref={sectionRef} id="intro" className="relative" style={{ height: "700vh" }} aria-label={t("brand")}>
      <div className="sticky top-0 h-[100svh] w-full overflow-hidden">
        {/* Ward map canvas */}
        <div
          ref={boxRef}
          className="absolute left-0 right-0 top-[var(--hdr)] h-[38svh] overflow-hidden bg-[var(--paper)] md:bottom-0 md:left-[38%] md:h-auto md:[mask-image:linear-gradient(to_right,transparent,black_12%)]"
        >
          <WardSvg groupRef={camRef} deadLights={story?.deadLights ?? []} />
          <div ref={veilRef} className="pointer-events-none absolute inset-0 bg-[var(--paper)]" style={{ opacity: 0 }} />

          <div ref={ambLayerRef} className="pointer-events-none absolute inset-0">
            {story?.ambient.map((a, i) => (
              <div
                key={a.id}
                ref={(el) => {
                  ambRefs.current[i] = el;
                }}
                className="pin-btn pointer-events-none"
              >
                <PinTag tone={settled && a.settle ? "resolved" : a.tone} score={a.score} />
                <Pin category={a.category} tone={settled && a.settle ? "resolved" : a.tone} size={22} />
              </div>
            ))}
          </div>

          <div className="pointer-events-none absolute inset-0">
            <div ref={pulseRef} className="pin-ring" style={{ opacity: 0 }} />
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                ref={(el) => {
                  dupRefs.current[i] = el;
                }}
                className="pin-btn pointer-events-none"
                style={{ opacity: 0 }}
              >
                <PinTag tone="medium" score={68} />
                <Pin category="pothole" tone="medium" size={28} />
              </div>
            ))}
            <div ref={heroRef} className="pin-btn pointer-events-none" style={{ opacity: 0 }}>
              <span ref={heroTagRef} className="pin-tag">
                M 68
              </span>
              <Pin category="pothole" tone={heroTone} size={34} />
            </div>
          </div>

          <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
            <line ref={cardLineRef} className="leader" style={{ opacity: 0 }} />
            {[0, 1, 2].map((i) => (
              <line
                key={i}
                ref={(el) => {
                  calloutLineRefs.current[i] = el;
                }}
                className="leader"
                style={{ opacity: 0 }}
              />
            ))}
          </svg>

          {/* State 02: the complaint card */}
          <div ref={cardRef} className="complaint-card pointer-events-none absolute left-0 top-0" style={{ opacity: 0, visibility: "hidden" }}>
            <div className="flex items-center justify-between border-b border-[var(--rule)] px-3 py-2">
              <span className="flex items-center gap-2 text-sm font-bold">
                <svg width="16" height="16" viewBox="4 2.5 24 24" aria-hidden="true">
                  <ellipse cx="16" cy="14" rx="7" ry="4" fill="var(--ink)" />
                </svg>
                {catName}
              </span>
              <span className="num text-xs text-[var(--ink-mute)]">{HERO_ID}</span>
            </div>
            <img src={BEFORE_PHOTO} alt={t("gap.photo")} width={320} height={132} className="block h-[118px] w-full object-cover" />
            <div className="space-y-2 px-3 py-3 text-sm">
              <p className="font-bold text-[var(--ink)]">{t("gap.status")}</p>
              <div className="flex justify-between gap-3 text-xs text-[var(--ink-soft)]">
                <span className="kicker">{t("gap.geotag")}</span>
                <span className="num text-right">{story?.geotagLabel ?? ""}</span>
              </div>
              <div className="flex justify-between gap-3 text-xs text-[var(--ink-soft)]">
                <span className="kicker">{t("gap.category")}</span>
                <span>{catName}</span>
              </div>
              <ol className="mt-2 grid grid-cols-4 gap-1 pt-1 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--ink-mute)]">
                {(["gap.step.reported", "gap.step.verified", "gap.step.assigned", "gap.step.resolved"] as Key[]).map((k, i) => (
                  <li key={k} className={`border-t-2 pt-1 ${i === 0 ? "border-[var(--ink)] text-[var(--ink)]" : "border-[var(--rule)]"}`}>
                    {t(k)}
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* State 03: callouts */}
          {[
            [t("system.merged"), t("system.count", { n: 5 })],
            [t("system.geotag"), story?.geotagLabel ?? ""],
            [t("system.nearSchool"), CATEGORY_META.pothole[lang]],
          ].map(([title, value], i) => (
            <div
              key={title}
              ref={(el) => {
                calloutRefs.current[i] = el;
              }}
              className="callout pointer-events-none absolute left-0 top-0"
              style={{ opacity: 0 }}
            >
              <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink)]">{title}</span>
              <span className="num block text-[12px] text-[var(--ink-soft)]">{value}</span>
            </div>
          ))}

          {/* State 04: votes, score and the priority breakdown */}
          <div ref={chipRef} className="vote-chip pointer-events-none absolute left-0 top-0" style={{ opacity: 0, visibility: "hidden" }}>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="kicker">{t("function.votes")}</p>
                <p className="num text-2xl font-bold">
                  {votes} / 3
                </p>
              </div>
              <div className="text-right">
                <p className="kicker">{t("function.score")}</p>
                <p className="num text-2xl font-bold">
                  <span ref={scoreRef}>{story ? Math.round(story.scoreStart) : "–"}</span>
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span key={votes} className="btn btn-primary tap-pop min-h-10 px-3 text-sm" aria-hidden="true">
                {t("function.see")}
              </span>
              <span ref={verifiedRef} className="badge-verified" style={{ opacity: 0 }}>
                ✓ {t("function.verified")}
              </span>
            </div>
            {parts && (
              <div className="mt-3 border-t border-[var(--rule)] pt-3">
                <p className="kicker mb-2">{t("function.why")}</p>
                <PriorityChips parts={parts} score={parts.total} lang={lang} compact />
              </div>
            )}
          </div>

          {/* State 05: the SMS arrives */}
          <div ref={smsRef} className="pointer-events-none absolute bottom-3 left-3 right-3 md:right-auto md:max-w-sm" style={{ opacity: 0, visibility: "hidden" }}>
            <div className="sms-bubble">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.1em] opacity-80">{t("sms.from")}</span>
              {smsMessage}
            </div>
          </div>
        </div>

        {/* Copy column */}
        <div className="absolute inset-x-0 bottom-0 top-[calc(var(--hdr)_+_38svh)] z-10 flex flex-col overflow-y-auto px-5 pb-2 md:bottom-0 md:left-0 md:right-auto md:top-[var(--hdr)] md:w-[38%] md:overflow-visible md:pb-0 md:pl-[6vw] md:pr-[4vw] md:pt-[8svh]">
          <div className="relative h-[148px] shrink-0 md:h-[248px]">
            {HEADS.map((hd, i) => (
              <div
                key={hd.h}
                ref={(el) => {
                  headRefs.current[i] = el;
                }}
                className="heading-item absolute inset-x-0 top-0"
                style={{ opacity: i === 0 ? 1 : 0 }}
                aria-hidden={i !== idx ? true : undefined}
              >
                {i === 0 ? <h1 className="display">{t(hd.h)}</h1> : <h2 className="display">{t(hd.h)}</h2>}
                <p className="support">{t(hd.p)}</p>
              </div>
            ))}
          </div>

          <div className="relative min-h-0 flex-1">
            {/* State 01 actions */}
            <div ref={zone1Ref} className="absolute inset-x-0 top-0 flex flex-wrap gap-3" style={{ opacity: 1 }}>
              <a href="#report" className="btn btn-primary">
                {t("hero.cta.report")}
              </a>
              <a href="#live-map" className="btn btn-ghost">
                {t("hero.cta.map")}
              </a>
            </div>

            {/* State 05: officer view, escalation, timeline, SLA, after photo, confirmation */}
            <div ref={zone5Ref} className="absolute inset-x-0 top-0 space-y-2.5" style={{ opacity: 0, visibility: "hidden" }} aria-hidden={true}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="seg" role="presentation">
                  <span className="seg-item">{t("peak.citizen")}</span>
                  <span className="seg-item seg-on">{t("peak.officer")}</span>
                </div>
                <span className="badge-esc" data-level={esc === 0 ? "none" : "high"}>
                  {t("peak.escalation")}: {t(escKey)}
                </span>
              </div>

              <div className="relative">
                <div className="absolute left-[12.5%] right-[12.5%] top-[6px] h-[2px] bg-[var(--rule)]">
                  <div ref={timelineFillRef} className="h-full bg-[var(--ink)]" style={{ width: "0%" }} />
                </div>
                <ol className="relative grid grid-cols-4">
                  {STAGE_KEYS.map((k, i) => (
                    <li key={k} className="flex flex-col items-center text-center">
                      <span className={`node ${i <= stage ? "node-done" : ""} ${i === stage ? "node-current" : ""}`} />
                      <span className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.05em] text-[var(--ink)]">{t(k)}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="flex items-center gap-3">
                <svg width="56" height="56" viewBox="0 0 64 64" className="hidden shrink-0 -rotate-90 md:block" aria-hidden="true">
                  <circle cx="32" cy="32" r="26" fill="none" stroke="var(--rule)" strokeWidth="6" />
                  <circle ref={ringRef} cx="32" cy="32" r="26" fill="none" stroke={slaColor} strokeWidth="6" strokeDasharray={CIRC} strokeDashoffset={CIRC} />
                </svg>
                <div className="min-w-0">
                  <p className="kicker">{t("sla.label")}</p>
                  <p className="text-sm font-bold text-[var(--ink)]">{slaText}</p>
                  <p className="num text-xs text-[var(--ink-soft)]">{t("sla.days", { n: 5 })}</p>
                </div>
              </div>

              <div ref={afterRef} className="panel hidden p-2.5 md:block" style={{ opacity: 0 }}>
                <div className="flex items-center justify-between gap-2">
                  <p className="kicker">{t("peak.after")}</p>
                  <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--ink-mute)]">{t("peak.before")} → {t("peak.after")}</p>
                </div>
                <div className="mt-2 flex gap-1.5">
                  <img src={BEFORE_PHOTO} alt={t("peak.before")} className="h-[74px] w-1/2 object-cover" />
                  <img src={AFTER_PHOTO} alt={t("peak.after")} className="h-[74px] w-1/2 object-cover" />
                </div>
              </div>

              <div ref={confirmRef} className="panel p-2.5" style={{ opacity: 0 }}>
                <p className="text-sm font-bold text-[var(--ink)]">{t("peak.question")}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {resolved ? (
                    <span className="badge-verified">✓ {t("detail.confirm")}</span>
                  ) : (
                    <>
                      <span className="btn btn-primary btn-sm">{t("peak.confirm")}</span>
                      <span className="btn btn-ghost btn-sm">{t("peak.reopen")}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* State 06: summary stats and closing actions */}
            <div ref={zone6Ref} className="absolute inset-x-0 top-0" style={{ opacity: 0, visibility: "hidden" }}>
              <div className="grid grid-cols-2 gap-x-5 gap-y-3 md:grid-cols-3">
                {STAT_KEYS.map((k, i) => (
                  <div key={k}>
                    <p className="kicker">{t(k)}</p>
                    <p className="num text-2xl font-bold text-[var(--ink)] md:text-3xl">
                      <span
                        ref={(el) => {
                          statRefs.current[i] = el;
                        }}
                      >
                        {statValue(i)}
                      </span>
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <a href="#report" className="btn btn-primary">
                  {t("resolution.cta.report")}
                </a>
                <a href="#ward-stats" className="btn btn-ghost">
                  {t("resolution.cta.dashboard")}
                </a>
              </div>
            </div>
          </div>

          <div ref={cueRef} className="mt-2 flex items-center gap-3 pb-1 text-sm text-[var(--ink-soft)] max-md:justify-center" style={{ opacity: 1 }}>
            <span className="cue-line" aria-hidden="true" />
            {t("scroll.cue")}
          </div>
        </div>
      </div>
    </section>
  );
}
