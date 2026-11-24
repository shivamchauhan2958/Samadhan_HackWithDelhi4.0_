import { DAY_MS, type EventKind, type ReportEvent, type ReportView } from "@/lib/ward";

// The hero complaint: pothole at the Main Market gate, on the school road, beside the bus stop.
export const HERO_ID = "WR14-1042";
export const HERO_AT = { x: 1040, y: 430 };
// Ambient pins that settle to green in the closing scroll state.
export const SETTLE_IDS = ["WR14-1043", "WR14-1045", "WR14-1049", "WR14-1051"];

export const BEFORE_PHOTO = "/images/pothole.jpg";
export const AFTER_PHOTO = "/images/pothole-after.jpg";

type Row = {
  id: string;
  category: ReportView["category"];
  x: number;
  y: number;
  daysAgo: number;
  status: ReportView["status"];
  votes: number;
  reportCount?: number;
  resolution?: ReportView["resolution"];
  reopenCount?: number;
  fixDays?: number;
  description: string;
  photo?: string;
  afterPhoto?: string;
  reporterName: string;
  reporterPhone: string;
  team?: string;
};

// Meera Gupta owns four reports across different statuses, so the demo citizen dashboard
// has something real to show the moment it opens.
export const MEERA_PHONE = "9876543210";
export const MEERA_NAME = "Meera Gupta";

// Ten realistic Ward 14 reports covering every feature: duplicates, verification,
// escalation at three levels, resolution awaiting confirmation, a reopen, and a full close.
const ROWS: Row[] = [
  {
    id: HERO_ID,
    category: "pothole",
    x: HERO_AT.x,
    y: HERO_AT.y,
    daysAgo: 6,
    status: "reported",
    votes: 2,
    reportCount: 5,
    description: "Deep pothole at the Main Market gate, right where buses turn in. Two-wheelers swerve into traffic to avoid it.",
    photo: BEFORE_PHOTO,
    reporterName: MEERA_NAME,
    reporterPhone: MEERA_PHONE,
    team: "roads",
  },
  {
    id: "WR14-1043",
    category: "streetlight",
    x: 880,
    y: 415,
    daysAgo: 4,
    status: "verified",
    votes: 3,
    description: "Streetlight out on the school road, directly in front of the school gate. Children cross here after tuition.",
    reporterName: "Ravi Kumar",
    reporterPhone: "9812345678",
    team: "electrical",
  },
  {
    id: "WR14-1044",
    category: "garbage",
    x: 1050,
    y: 415,
    daysAgo: 2,
    status: "verified",
    votes: 4,
    description: "Overflowing bin next to the bus stop shelter. Spills onto the footpath every morning before the market opens.",
    reporterName: "Sunita Devi",
    reporterPhone: "9722345678",
    team: "sanitation",
  },
  {
    id: "WR14-1045",
    category: "water",
    x: 1150,
    y: 280,
    daysAgo: 5,
    status: "assigned",
    votes: 1,
    description: "Clean water leaking from a pipe joint near the hospital gate. Steady flow across the footpath for five days now.",
    reporterName: "Anil Verma",
    reporterPhone: "9632345678",
    team: "water",
  },
  {
    id: "WR14-1046",
    category: "pothole",
    x: 1270,
    y: 745,
    daysAgo: 11,
    status: "verified",
    votes: 5,
    description: "Wide crater where the bridge approach meets the road. Buses drop into it at speed and the filler keeps washing out.",
    reporterName: "Deepak Yadav",
    reporterPhone: "9542345678",
    team: "roads",
  },
  {
    id: "WR14-1047",
    category: "garbage",
    x: 1380,
    y: 590,
    daysAgo: 1,
    status: "reported",
    votes: 1,
    description: "Bags dumped beside the metro station pillar every night. Only cleared when someone complains.",
    reporterName: "Kavita Sharma",
    reporterPhone: "9452345678",
    team: "sanitation",
  },
  {
    id: "WR14-1048",
    category: "pothole",
    x: 350,
    y: 440,
    daysAgo: 3,
    status: "resolved",
    votes: 3,
    resolution: "pending",
    fixDays: 2,
    description: "Pothole at the park gate where the school van parks. Crew filled it within two days.",
    photo: BEFORE_PHOTO,
    afterPhoto: AFTER_PHOTO,
    reporterName: MEERA_NAME,
    reporterPhone: MEERA_PHONE,
    team: "roads",
  },
  {
    id: "WR14-1049",
    category: "garbage",
    x: 620,
    y: 655,
    daysAgo: 5,
    status: "assigned",
    votes: 2,
    resolution: "reopened",
    reopenCount: 1,
    fixDays: 3,
    description: "Garbage not lifted from this corner for days. It was cleared once, then the pile came back within a week.",
    afterPhoto: AFTER_PHOTO,
    reporterName: MEERA_NAME,
    reporterPhone: MEERA_PHONE,
    team: "sanitation",
  },
  {
    id: "WR14-1050",
    category: "water",
    x: 740,
    y: 620,
    daysAgo: 6,
    status: "resolved",
    votes: 3,
    resolution: "confirmed",
    fixDays: 1,
    description: "Pipe joint sealed the same evening it was reported. Water supply restored before nightfall.",
    photo: BEFORE_PHOTO,
    afterPhoto: AFTER_PHOTO,
    reporterName: MEERA_NAME,
    reporterPhone: MEERA_PHONE,
    team: "water",
  },
  {
    id: "WR14-1051",
    category: "pothole",
    x: 560,
    y: 250,
    daysAgo: 1,
    status: "reported",
    votes: 0,
    description: "Small pothole opening up on the north lane near the park boundary. Still shallow, but growing.",
    reporterName: "Imran Ali",
    reporterPhone: "9362345678",
    team: "roads",
  },
];

// Status-change history, in days-ago, used for the timeline and the SMS inbox.
type EventSeed = { kind: EventKind; level?: ReportEvent["level"]; ago: number };
const EVENTS: Record<string, EventSeed[]> = {
  "WR14-1042": [{ kind: "created", ago: 6 }],
  "WR14-1043": [
    { kind: "created", ago: 4 },
    { kind: "verified", ago: 4 },
    { kind: "escalated", level: "ward", ago: 1 },
  ],
  "WR14-1044": [
    { kind: "created", ago: 2 },
    { kind: "verified", ago: 2 },
  ],
  "WR14-1045": [
    { kind: "created", ago: 5 },
    { kind: "verified", ago: 5 },
    { kind: "assigned", ago: 4 },
    { kind: "escalated", level: "zonal", ago: 2 },
  ],
  "WR14-1046": [
    { kind: "created", ago: 11 },
    { kind: "verified", ago: 11 },
    { kind: "escalated", level: "ward", ago: 7 },
    { kind: "escalated", level: "zonal", ago: 4 },
    { kind: "escalated", level: "commissioner", ago: 1 },
  ],
  "WR14-1047": [{ kind: "created", ago: 1 }],
  "WR14-1048": [
    { kind: "created", ago: 3 },
    { kind: "verified", ago: 3 },
    { kind: "assigned", ago: 2 },
    { kind: "resolved", ago: 1 },
  ],
  "WR14-1049": [
    { kind: "created", ago: 5 },
    { kind: "verified", ago: 5 },
    { kind: "assigned", ago: 4 },
    { kind: "resolved", ago: 3 },
    { kind: "reopened", ago: 2 },
  ],
  "WR14-1050": [
    { kind: "created", ago: 6 },
    { kind: "verified", ago: 6 },
    { kind: "assigned", ago: 6 },
    { kind: "resolved", ago: 5 },
    { kind: "confirmed", ago: 5 },
  ],
  "WR14-1051": [{ kind: "created", ago: 1 }],
};

export type Seed = {
  reports: ReportView[];
  events: ReportEvent[];
  // Raw reporter phones are kept out of ReportView so they never reach a public payload.
  reporters: Record<string, { name: string; phone: string }>;
};

// Built relative to `now` so overdue, escalation and confirmation states stay meaningful.
export function buildSeed(now: number): Seed {
  const iso = (daysAgo: number, offsetDays = 0) => new Date(now - daysAgo * DAY_MS + offsetDays * DAY_MS).toISOString();
  const reports: ReportView[] = ROWS.map((row) => {
    const created = now - row.daysAgo * DAY_MS;
    const verified = row.status !== "reported" ? created + 0.2 * DAY_MS : null;
    const assigned = row.status === "assigned" || row.status === "resolved" ? created + 0.5 * DAY_MS : null;
    const resolved = row.status === "resolved" ? created + (row.fixDays ?? 1) * DAY_MS : null;
    const confirmed = row.resolution === "confirmed" ? (resolved ?? created) + 0.3 * DAY_MS : null;
    const reopened = row.resolution === "reopened" ? created + 3 * DAY_MS : null;
    return {
      id: row.id,
      category: row.category,
      x: row.x,
      y: row.y,
      description: row.description,
      status: row.status,
      votes: row.votes,
      reportCount: row.reportCount ?? 1,
      photo: row.photo ?? null,
      afterPhoto: row.afterPhoto ?? null,
      resolution: row.resolution ?? "none",
      reopenCount: row.reopenCount ?? 0,
      createdAt: new Date(created).toISOString(),
      verifiedAt: verified ? new Date(verified).toISOString() : null,
      assignedAt: assigned ? new Date(assigned).toISOString() : null,
      resolvedAt: resolved ? new Date(resolved).toISOString() : null,
      confirmedAt: confirmed ? new Date(confirmed).toISOString() : null,
      reopenedAt: reopened ? new Date(reopened).toISOString() : null,
      mine: false,
      reporterName: row.reporterName,
      ownerPhoneMasked: null,
      team: row.team ?? null,
      assignedTeam: row.team ?? null,
    };
  });

  const reporters: Record<string, { name: string; phone: string }> = {};
  for (const row of ROWS) reporters[row.id] = { name: row.reporterName, phone: row.reporterPhone };

  let eid = 0;
  const events: ReportEvent[] = [];
  for (const [reportId, list] of Object.entries(EVENTS)) {
    for (const ev of list) {
      events.push({ id: --eid, reportId, kind: ev.kind, level: ev.level ?? null, at: iso(ev.ago) });
    }
  }
  events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return { reports, events, reporters };
}
