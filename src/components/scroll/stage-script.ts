import type { Cam } from "@/components/ward/camera";

// Pure choreography: scroll progress p (0 -> 1) in, visual values out. No DOM, no React.
// Roughly 0-10% State 01, 10-28% 02, 28-46% 03, 46-64% 04, 64-82% 05, 82-100% 06.

export const STATE_STARTS = [0, 0.1, 0.28, 0.46, 0.64, 0.82] as const;
export const REDUCED_POSES = [0.06, 0.24, 0.44, 0.62, 0.79, 0.95] as const;

export const HERO_AT = { x: 1040, y: 430 };
// Four duplicate reports from neighbouring streets that glide in and merge.
export const DUP_FROM = [
  { x: 880, y: 318 },
  { x: 1206, y: 352 },
  { x: 1178, y: 546 },
  { x: 884, y: 546 },
] as const;

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const ramp = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
export const ease = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function stateIndex(p: number) {
  let idx = 0;
  for (let i = 1; i < STATE_STARTS.length; i++) if (p >= STATE_STARTS[i]) idx = i;
  return idx;
}

// Camera keyframes. Desktop frames the pin beside the copy; mobile frames it above the card.
type CamKey = { p: number; s: number; cx: number; cy: number; fd: [number, number]; fm: [number, number] };
const CAM_KEYS: CamKey[] = [
  { p: 0.0, s: 1.0, cx: 800, cy: 450, fd: [0.5, 0.5], fm: [0.5, 0.5] },
  { p: 0.08, s: 1.0, cx: 800, cy: 450, fd: [0.5, 0.5], fm: [0.5, 0.5] },
  { p: 0.2, s: 3.0, cx: HERO_AT.x, cy: HERO_AT.y, fd: [0.4, 0.46], fm: [0.5, 0.62] },
  { p: 0.27, s: 3.0, cx: HERO_AT.x, cy: HERO_AT.y, fd: [0.4, 0.46], fm: [0.5, 0.62] },
  { p: 0.33, s: 2.1, cx: HERO_AT.x, cy: HERO_AT.y, fd: [0.42, 0.46], fm: [0.5, 0.62] },
  { p: 0.46, s: 2.1, cx: HERO_AT.x, cy: HERO_AT.y, fd: [0.42, 0.46], fm: [0.5, 0.62] },
  { p: 0.52, s: 2.25, cx: HERO_AT.x, cy: HERO_AT.y, fd: [0.44, 0.46], fm: [0.5, 0.62] },
  { p: 0.64, s: 2.25, cx: HERO_AT.x, cy: HERO_AT.y, fd: [0.44, 0.46], fm: [0.5, 0.62] },
  { p: 0.71, s: 1.7, cx: HERO_AT.x, cy: HERO_AT.y, fd: [0.5, 0.5], fm: [0.5, 0.5] },
  { p: 0.82, s: 1.7, cx: HERO_AT.x, cy: HERO_AT.y, fd: [0.5, 0.5], fm: [0.5, 0.5] },
  { p: 0.94, s: 1.0, cx: 800, cy: 450, fd: [0.5, 0.5], fm: [0.5, 0.5] },
  { p: 1.0, s: 1.0, cx: 800, cy: 450, fd: [0.5, 0.5], fm: [0.5, 0.5] },
];

export function camAt(p: number, mobile: boolean): Cam {
  let i = 0;
  while (i < CAM_KEYS.length - 2 && p > CAM_KEYS[i + 1].p) i++;
  const a = CAM_KEYS[i];
  const b = CAM_KEYS[i + 1];
  const t = ease(ramp(p, a.p, b.p));
  const fa = mobile ? a.fm : a.fd;
  const fb = mobile ? b.fm : b.fd;
  return {
    s: lerp(a.s, b.s, t),
    cx: lerp(a.cx, b.cx, t),
    cy: lerp(a.cy, b.cy, t),
    fx: lerp(fa[0], fb[0], t),
    fy: lerp(fa[1], fb[1], t),
  };
}

export type Frame = {
  cam: Cam;
  heroOpacity: number;
  heroDrop: number;
  heroGrowth: number;
  ambientOpacity: number;
  ambientBlur: number;
  dups: { x: number; y: number; opacity: number; scale: number }[];
  card: number;
  callouts: number[];
  calloutVis: number;
  chip: number;
  verified: number;
  score: number;
  breakdown: number;
  ring: number;
  pulse: number;
  timeline: number;
  officer: number;
  esc: number;
  after: number;
  confirm: number;
  sms: number;
  zone1: number;
  zone6: number;
  stats: number;
  veil: number;
  cue: number;
  headings: { op: number; ty: number }[];
};

export function frameAt(p: number, env: { mobile: boolean; scoreStart: number; scoreEnd: number }): Frame {
  // Headings overlap at each boundary: the outgoing one lifts and fades, the next rises from below.
  const W = 0.035;
  const headings = STATE_STARTS.map((start, i) => {
    const end = i < STATE_STARTS.length - 1 ? STATE_STARTS[i + 1] : 1;
    const up = i === 0 ? 1 : ramp(p, start - W, start + W);
    const down = i === STATE_STARTS.length - 1 ? 1 : 1 - ramp(p, end - W, end + W);
    return { op: up * down, ty: (1 - up) * 22 - (1 - down) * 14 };
  });

  const officer = ease(ramp(p, 0.645, 0.67)) * (1 - ease(ramp(p, 0.8, 0.83)));
  const votesCont = ramp(p, 0.49, 0.575);
  const mergePulse = Math.sin(Math.PI * ramp(p, 0.385, 0.43));

  return {
    cam: camAt(p, env.mobile),
    heroOpacity: ramp(p, 0.012, 0.03),
    heroDrop: -(1 - ease(ramp(p, 0.012, 0.06))) * 90,
    heroGrowth: 1 + 0.2 * mergePulse + 0.06 * votesCont * 3,
    ambientOpacity: 0.6 + (0.16 - 0.6) * ramp(p, 0.08, 0.2) + (0.9 - 0.16) * ramp(p, 0.27, 0.34),
    ambientBlur: Math.max(0, 1.8 * (ramp(p, 0.08, 0.2) - ramp(p, 0.27, 0.34))),
    dups: DUP_FROM.map((from, i) => {
      const glide = ease(ramp(p, 0.33 + i * 0.008, 0.4));
      const appear = ramp(p, 0.28 + i * 0.01, 0.33 + i * 0.01);
      const fade = 1 - ramp(p, 0.392 + i * 0.002, 0.4);
      return { x: lerp(from.x, HERO_AT.x, glide), y: lerp(from.y, HERO_AT.y, glide), opacity: appear * fade, scale: 1 - 0.25 * glide };
    }),
    card: ease(ramp(p, 0.13, 0.21)) * (1 - ease(ramp(p, 0.265, 0.3))),
    callouts: [0, 1, 2].map((i) => ease(ramp(p, 0.37 + 0.025 * i, 0.42 + 0.025 * i))),
    calloutVis: 1 - ramp(p, 0.455, 0.478),
    chip: ease(ramp(p, 0.455, 0.48)) * (1 - ease(ramp(p, 0.625, 0.655))),
    verified: ease(ramp(p, 0.575, 0.6)),
    score: lerp(env.scoreStart, env.scoreEnd, ease(ramp(p, 0.48, 0.6))),
    breakdown: ease(ramp(p, 0.5, 0.545)) * (1 - ease(ramp(p, 0.625, 0.655))),
    ring: ease(ramp(p, 0.66, 0.73)),
    pulse: Math.sin(Math.PI * ramp(p, 0.7, 0.735)),
    timeline: ease(ramp(p, 0.655, 0.72)),
    officer,
    // Escalation badge steps up the ladder as the issue runs past its deadline.
    esc: p >= 0.7 ? 2 : p >= 0.645 ? 1 : 0,
    after: ease(ramp(p, 0.72, 0.755)),
    confirm: ease(ramp(p, 0.755, 0.788)),
    sms: ease(ramp(p, 0.788, 0.815)) * (1 - ramp(p, 0.838, 0.862)),
    zone1: 1 - ramp(p, 0.07, 0.12),
    zone6: ease(ramp(p, 0.8, 0.84)),
    stats: ease(ramp(p, 0.79, 0.86)),
    veil: 0.2 * ease(ramp(p, 0.82, 0.92)),
    cue: 1 - ramp(p, 0.01, 0.05),
    headings,
  };
}

// Discrete beats: these flip once, so React state changes only a handful of times per state.
export const votesAt = (p: number) => (p < 0.49 ? 0 : p < 0.53 ? 1 : p < 0.57 ? 2 : 3);
export const resolvedAt = (p: number) => p >= 0.788;
export const settledAt = (p: number) => p >= 0.87;
export const stageAt = (p: number) => (p >= 0.72 ? 3 : p >= 0.695 ? 2 : 1);
export type SlaPhase = "running" | "overdue" | "resolved";
export const slaPhaseAt = (p: number): SlaPhase => (p >= 0.788 ? "resolved" : p >= 0.7 ? "overdue" : "running");
export type EscPhase = 0 | 1 | 2;
export const escAt = (p: number): EscPhase => (p >= 0.7 ? 2 : p >= 0.645 ? 1 : 0);
