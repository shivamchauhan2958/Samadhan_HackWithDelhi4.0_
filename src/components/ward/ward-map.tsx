"use client";

import type { Ref } from "react";
import { useLang } from "@/components/lang-provider";
import { DEAD_LIGHT_RADIUS, POIS, STREETLIGHTS, distance, type Poi } from "@/lib/ward";

// IDENTITY MASTER. The stylised Ward 14 plate: roads, City Park, Govt. School, Main Market,
// Bus Stop, Metro Station, Hospital, the canal and its bridge, and the streetlight poles.
// It is never redrawn, restyled or relocated between states or themes. Landmarks come from
// POIS in lib/ward, so the map and the priority engine share one source of truth.

const BOUNDARY: [number, number][] = [
  [150, 130], [520, 92], [900, 120], [1260, 88], [1468, 210], [1446, 470], [1496, 700],
  [1372, 826], [980, 800], [640, 838], [250, 806], [120, 600], [164, 380],
];
const BOUNDARY_D = `M${BOUNDARY.map(([x, y]) => `${x} ${y}`).join(" L")} Z`;

const ROADS: { d: string; w: number }[] = [
  { d: "M140 250H1450", w: 16 }, // north lane
  { d: "M140 640H1440", w: 16 }, // south lane
  { d: "M420 100V820", w: 16 },
  { d: "M700 100V820", w: 16 },
  { d: "M1300 110V790", w: 20 }, // east road, crosses the canal at the bridge
  { d: "M260 810L560 560L830 430", w: 24 }, // trunk road joining the arterial
  { d: "M140 430H1470", w: 34 }, // main arterial and school road
];

const METRO_D = "M1432 250L1420 420L1412 560L1400 780";
const CANAL_D = "M1060 758L1345 772L1345 800L1060 786Z";
const CANAL_BOX = { x: 1050, y: 750, w: 305, h: 58 };
const BRIDGE = { x: 1284, y: 760, w: 32, h: 46 };

function insidePolygon(px: number, py: number) {
  let inside = false;
  for (let i = 0, j = BOUNDARY.length - 1; i < BOUNDARY.length; j = i++) {
    const [xi, yi] = BOUNDARY[i];
    const [xj, yj] = BOUNDARY[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function clashes(x: number, y: number, w: number, h: number, r: { x: number; y: number; w: number; h: number }, margin = 12) {
  return x < r.x + r.w + margin && x + w > r.x - margin && y < r.y + r.h + margin && y + h > r.y - margin;
}

// Deterministic block grid, so the map is identical in every state.
const BLOCKS_D = (() => {
  const parts: string[] = [];
  for (let gy = 0; gy < 9; gy++) {
    for (let gx = 0; gx < 16; gx++) {
      const x = 133 + gx * 90;
      const y = 103 + gy * 86;
      const w = 64;
      const h = 60;
      if (!insidePolygon(x + w / 2, y + h / 2)) continue;
      if (POIS.some((p) => clashes(x, y, w, h, p))) continue;
      if (clashes(x, y, w, h, CANAL_BOX, 6)) continue;
      parts.push(`M${x} ${y}h${w}v${h}h-${w}z`);
    }
  }
  return parts.join("");
})();

const GLOW_ID = "samadhan-light-glow";

function Landmark({ poi, label }: { poi: Poi; label: string }) {
  const cx = poi.x + poi.w / 2;
  const cy = poi.y + poi.h / 2;
  switch (poi.kind) {
    case "park":
      return (
        <>
          <rect x={poi.x} y={poi.y} width={poi.w} height={poi.h} rx={16} className="map-park" />
          <path d={`M${poi.x + 24} ${cy}H${poi.x + poi.w - 24}`} className="map-path" />
          {[
            [poi.x + 42, poi.y + 34],
            [poi.x + poi.w - 42, poi.y + 34],
            [poi.x + 42, poi.y + poi.h - 30],
            [poi.x + poi.w - 42, poi.y + poi.h - 30],
          ].map(([tx, ty]) => (
            <circle key={`${tx}-${ty}`} cx={tx} cy={ty} r={11} className="map-tree" />
          ))}
          <text x={cx} y={cy + 8} textAnchor="middle" className="map-label" fontSize={24}>
            {label}
          </text>
        </>
      );
    case "school":
      return (
        <>
          <rect x={poi.x} y={poi.y} width={poi.w} height={poi.h} rx={8} className="map-building" />
          <path d={`M${cx} ${poi.y}V${poi.y - 34}`} className="map-poi-line" />
          <path d={`M${cx} ${poi.y - 34}l26 9-26 9z`} className="map-poi-fill" />
          <text x={cx} y={cy + 8} textAnchor="middle" className="map-label" fontSize={21}>
            {label}
          </text>
        </>
      );
    case "market":
      return (
        <>
          <rect x={poi.x} y={poi.y} width={poi.w} height={poi.h} rx={10} className="map-building" />
          <path
            d={`M${poi.x + 22} ${poi.y + 46}H${poi.x + poi.w - 22}M${poi.x + 22} ${poi.y + 70}H${poi.x + poi.w - 22}M${poi.x + 22} ${poi.y + 94}H${poi.x + poi.w - 22}`}
            className="map-stall"
          />
          <text x={cx} y={poi.y + 30} textAnchor="middle" className="map-label" fontSize={23}>
            {label}
          </text>
          {/* Market gate on the arterial side: the hero pothole sits here. */}
          <path d={`M${poi.x + 22} ${poi.y + poi.h}V${poi.y + poi.h - 16}Q${poi.x + 40} ${poi.y + poi.h - 34}${poi.x + 58} ${poi.y + poi.h - 16}V${poi.y + poi.h}`} className="map-gate" />
        </>
      );
    case "bus":
      return (
        <>
          <rect x={poi.x} y={poi.y} width={poi.w} height={poi.h} rx={5} className="map-poi-fill" />
          <rect x={poi.x + 6} y={poi.y + 5} width={poi.w - 12} height={7} rx={2} className="map-window" />
          <text x={cx} y={poi.y - 10} textAnchor="middle" className="map-label" fontSize={21}>
            {label}
          </text>
        </>
      );
    case "hospital":
      return (
        <>
          <rect x={poi.x} y={poi.y} width={poi.w} height={poi.h} rx={8} className="map-building" />
          <path
            d={`M${cx - 6} ${cy - 20}h12v8h8v12h-8v8h-12v-8h-8v-12h8z`}
            className="map-poi-fill"
          />
          <text x={cx} y={poi.y + 26} textAnchor="middle" className="map-label" fontSize={21}>
            {label}
          </text>
        </>
      );
    case "metro":
      return (
        <>
          <circle cx={cx} cy={cy} r={20} className="map-poi-fill" />
          <text x={cx} y={cy + 8} textAnchor="middle" className="map-metro-m" fontSize={24}>
            M
          </text>
          <text x={cx - 30} y={cy + 8} textAnchor="end" className="map-label" fontSize={21}>
            {label}
          </text>
        </>
      );
    default:
      return null;
  }
}

function WardFeatures({ deadLights, intro = false }: { deadLights: { x: number; y: number }[]; intro?: boolean }) {
  const { lang } = useLang();
  return (
    <>
      <path d={BOUNDARY_D} className="map-ground" />
      <path d={BLOCKS_D} className="map-block" />
      <path d={CANAL_D} className="map-water" />
      {ROADS.map((r, i) => (
        <path
          key={r.d}
          d={r.d}
          className="map-road"
          strokeWidth={r.w}
          pathLength={1000}
          style={intro ? { animationDelay: `${180 + i * 110}ms` } : undefined}
        />
      ))}
      {/* Bridge where the east road crosses the canal. */}
      <rect x={BRIDGE.x} y={BRIDGE.y} width={BRIDGE.w} height={BRIDGE.h} rx={3} className="map-bridge" />
      <text x={BRIDGE.x - 12} y={BRIDGE.y + 30} textAnchor="end" className="map-label" fontSize={19}>
        {lang === "hi" ? "पुल" : "Bridge"}
      </text>
      <path d={METRO_D} className="map-metro" pathLength={1000} style={intro ? { animationDelay: "1080ms" } : undefined} />
      <g className={intro ? "intro-landmarks" : undefined}>
        {POIS.map((poi) => (
          <Landmark key={poi.kind} poi={poi} label={lang === "hi" ? poi.hi : poi.en} />
        ))}
      </g>

      {/* Streetlight poles: working ones glow at night, reported dead ones stay dark. */}
      {STREETLIGHTS.map(([lx, ly]) => {
        const dead = deadLights.some((d) => distance(d.x, d.y, lx, ly) <= DEAD_LIGHT_RADIUS);
        return (
          <g key={`light-${lx}-${ly}`}>
            <circle cx={lx} cy={ly} r={26} fill={`url(#${GLOW_ID})`} className="map-glow" />
            <line x1={lx} y1={ly + 8} x2={lx} y2={ly} className="map-light-pole" />
            <circle cx={lx} cy={ly} r={3.4} className={dead ? "map-light-off" : "map-light-on"} />
          </g>
        );
      })}

      <path d={BOUNDARY_D} className="map-boundary" />
    </>
  );
}

// The shared canvas. `groupRef` lets a scroll controller drive the camera transform.
// `deadLights` marks poles reported dead so the night map shows the problem.
export function WardSvg({
  groupRef,
  className = "",
  deadLights = [],
  intro = false,
}: {
  groupRef?: Ref<SVGGElement>;
  className?: string;
  deadLights?: { x: number; y: number }[];
  intro?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      className={`absolute inset-0 h-full w-full ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={GLOW_ID}>
          <stop offset="0" className="map-glow-stop-a" />
          <stop offset="1" className="map-glow-stop-b" />
        </radialGradient>
      </defs>
      <g ref={groupRef}>
        <WardFeatures deadLights={deadLights} intro={intro} />
      </g>
    </svg>
  );
}
