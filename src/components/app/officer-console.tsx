"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { notify } from "@/components/app/toaster";
import { slaLine } from "@/components/app/live-map";
import { useLang } from "@/components/lang-provider";
import { IDENTITY_CAM, toScreen } from "@/components/ward/camera";
import { CategoryGlyph, Pin, PinTag, PriorityChips, TONE_VAR, toneLabelKey } from "@/components/ward/pin";
import { WardSvg } from "@/components/ward/ward-map";
import { TEAM_FOR_CATEGORY, type Team } from "@/lib/auth";
import { compressPhoto } from "@/lib/photo";
import type { Key } from "@/lib/i18n";
import {
  CATEGORIES,
  CATEGORY_META,
  ESCALATION_RANK,
  derive,
  findHotspots,
  summarize,
  type Category,
  type EscalationLevel,
  type ReportView,
} from "@/lib/ward";

const TEAM_KEY: Record<Team, Key> = {
  roads: "off.teamRoads",
  sanitation: "off.teamSanitation",
  electrical: "off.teamElectrical",
  water: "off.teamWater",
};

const LADDER: { level: EscalationLevel; key: Key }[] = [
  { level: "ward", key: "off.ladderWard" },
  { level: "zonal", key: "off.ladderZonal" },
  { level: "commissioner", key: "off.ladderCommissioner" },
];

type Filters = { category: Category | "all"; status: "all" | "open" | "overdue"; escalation: EscalationLevel | "all" };

// Officer console: the ward's triage desk. Officer-only controls live here.
export function OfficerConsole({
  reports,
  now,
  onAssign,
  onResolve,
  onOpen,
}: {
  reports: ReportView[];
  now: number;
  onAssign: (id: string, team: Team) => void;
  onResolve: (id: string, afterPhoto: string) => void;
  onOpen: (id: string) => void;
}): ReactNode {
  const { t, lang } = useLang();
  const [filters, setFilters] = useState<Filters>({ category: "all", status: "all", escalation: "all" });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [expanded, setExpanded] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const resolveTarget = useRef<string | null>(null);

  const s = summarize(reports, now);
  const hotspots = useMemo(() => findHotspots(reports), [reports]);

  const queue = useMemo(
    () =>
      reports
        .map((r) => ({ r, d: derive(r, now) }))
        .filter(({ r, d }) => {
          if (filters.category !== "all" && r.category !== filters.category) return false;
          if (filters.status === "open" && r.status === "resolved") return false;
          if (filters.status === "overdue" && !d.overdue) return false;
          if (filters.escalation !== "all" && d.escalation !== filters.escalation) return false;
          return true;
        })
        .sort(
          (a, b) =>
            Number(a.r.status === "resolved") - Number(b.r.status === "resolved") ||
            Number(b.d.overdue) - Number(a.d.overdue) ||
            b.d.score - a.d.score,
        ),
    [reports, now, filters],
  );

  const workload = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of reports) if (r.status !== "resolved") counts[r.category] = (counts[r.category] ?? 0) + 1;
    return CATEGORIES.map((c) => ({ category: c, count: counts[c] ?? 0 }));
  }, [reports]);
  const maxWorkload = Math.max(1, ...workload.map((w) => w.count));

  const tiles: { label: string; value: string }[] = [
    { label: t("off.open"), value: String(s.open) },
    { label: t("off.dueToday"), value: String(s.dueToday) },
    { label: t("off.overdue"), value: String(s.pastDeadline) },
    { label: t("off.escalated"), value: String(s.escalated) },
    { label: t("off.avgFix"), value: `${s.avgFixDays.toFixed(1)} ${t("unit.days")}` },
    { label: t("off.reopenRate"), value: `${s.reopenRate}%` },
  ];

  const exportCsv = () => {
    const open = reports.filter((r) => r.status !== "resolved");
    const header = ["id", "category", "status", "score", "level", "votes", "days_open", "sla_days", "escalation", "team", "x", "y"];
    const rows = open.map((r) => {
      const d = derive(r, now);
      return [
        r.id,
        r.category,
        r.status,
        d.score,
        d.level,
        r.votes,
        d.daysOpen,
        d.slaDays,
        d.escalation,
        r.team ?? "",
        Math.round(r.x),
        Math.round(r.y),
      ].join(",");
    });
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "samadhan-ward14-open-issues.csv";
    a.click();
    URL.revokeObjectURL(url);
    notify(t("off.exportNote", { n: open.length }));
  };

  const pickAfter = async (file: File | undefined) => {
    const id = resolveTarget.current;
    resolveTarget.current = null;
    if (!file || !id) return;
    const data = await compressPhoto(file);
    if (!data) {
      notify(t("report.tooLarge"));
      return;
    }
    onResolve(id, data);
  };

  const measure = (el: HTMLDivElement | null) => {
    if (!el) return;
    setSize({ w: el.clientWidth, h: el.clientHeight });
  };

  return (
    <div className="space-y-10">
      {/* Ward header */}
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-[var(--rule)] pb-6">
        <div>
          <p className="kicker">{t("off.title")}</p>
          <h3 className="display-sm mt-2">{t("off.ward")}</h3>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">{t("off.post")}</p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={exportCsv}>
          {t("off.export")}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-3 lg:grid-cols-6">
        {tiles.map((tile) => (
          <div key={tile.label} className="border-t-2 border-[var(--ink)] pt-3">
            <p className="kicker">{tile.label}</p>
            <p className="num mt-2 text-3xl font-bold text-[var(--ink)]">{tile.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-10 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {/* Priority queue */}
        <section aria-labelledby="off-queue">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h4 id="off-queue" className="text-lg font-bold text-[var(--ink)]">
              {t("off.queue")}
            </h4>
            <span className="num text-sm text-[var(--ink-mute)]">{queue.length}</span>
          </div>

          {/* Filters */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="kicker mr-1">{t("off.filters")}</span>
            <select
              aria-label={t("off.filterCategory")}
              value={filters.category}
              onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value as Filters["category"] }))}
              className="min-h-11 border-2 border-[var(--ink)] bg-[var(--surface)] px-2 text-sm text-[var(--ink)]"
            >
              <option value="all">{t("off.all")}</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_META[c][lang]}
                </option>
              ))}
            </select>
            <select
              aria-label={t("stage.reported")}
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as Filters["status"] }))}
              className="min-h-11 border-2 border-[var(--ink)] bg-[var(--surface)] px-2 text-sm text-[var(--ink)]"
            >
              <option value="all">{t("off.all")}</option>
              <option value="open">{t("off.open")}</option>
              <option value="overdue">{t("off.overdueOnly")}</option>
            </select>
            <select
              aria-label={t("off.ladder")}
              value={filters.escalation}
              onChange={(e) => setFilters((f) => ({ ...f, escalation: e.target.value as Filters["escalation"] }))}
              className="min-h-11 border-2 border-[var(--ink)] bg-[var(--surface)] px-2 text-sm text-[var(--ink)]"
            >
              <option value="all">{t("off.all")}</option>
              <option value="none">{t("off.ladderNone")}</option>
              <option value="ward">{t("off.ladderWard")}</option>
              <option value="zonal">{t("off.ladderZonal")}</option>
              <option value="commissioner">{t("off.ladderCommissioner")}</option>
            </select>
          </div>

          <ul className="mt-5 divide-y divide-[var(--rule)] border-y border-[var(--rule)]">
            {queue.length === 0 && <li className="py-4 text-sm text-[var(--ink-soft)]">{t("off.empty")}</li>}
            {queue.map(({ r, d }) => {
              const suggested = (r.team as Team | null) ?? TEAM_FOR_CATEGORY[r.category];
              const open = expanded === r.id;
              return (
                <li key={r.id} className="py-3">
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : r.id)}
                    aria-expanded={open}
                    className="flex min-h-14 w-full items-center gap-3 text-left"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-[var(--ink)] bg-[var(--surface)]">
                      <svg viewBox="4 2.5 24 24" width="22" height="22" aria-hidden="true">
                        <CategoryGlyph category={r.category} />
                      </svg>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-[var(--ink)]">
                        {CATEGORY_META[r.category][lang]} · <span className="num">{r.id}</span>
                      </span>
                      <span className="block truncate text-xs text-[var(--ink-mute)]">
                        {t(`stage.${r.status}` as Key)} · {slaLine(r, now, t)}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-wrap items-center gap-2">
                      {d.escalation !== "none" && (
                        <span className="badge-esc" data-level="high">
                          {t(d.escalation === "commissioner" ? "esc.commissioner" : d.escalation === "zonal" ? "esc.zonal" : "esc.ward")}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--ink)]">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: TONE_VAR[d.tone] }} aria-hidden="true" />
                        {t(toneLabelKey(d.tone))} <span className="num">{d.score}</span>
                      </span>
                    </span>
                  </button>

                  {open && (
                    <div className="mt-3 space-y-4 border-l-2 border-[var(--rule)] pl-4">
                      <PriorityChips parts={d.parts} score={d.score} lang={lang} compact />

                      {/* Escalation ladder */}
                      <div>
                        <p className="kicker mb-2">{t("off.ladder")}</p>
                        <ol className="flex flex-wrap items-center gap-2">
                          {LADDER.map((rung, i) => {
                            const reached = ESCALATION_RANK[d.escalation] >= ESCALATION_RANK[rung.level];
                            return (
                              <li key={rung.level} className="flex items-center gap-2">
                                <span
                                  className={`badge-esc ${reached ? "" : "opacity-45"}`}
                                  data-level={reached ? "high" : "none"}
                                >
                                  {t(rung.key)}
                                </span>
                                {i < LADDER.length - 1 && <span aria-hidden="true" className="text-[var(--rule)]">→</span>}
                              </li>
                            );
                          })}
                        </ol>
                      </div>

                      <p className="text-sm text-[var(--ink-soft)]">{r.description}</p>

                      {/* Officer actions */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="kicker">{t("off.assignTeam")}</span>
                        {(Object.keys(TEAM_KEY) as Team[]).map((team) => (
                          <button
                            key={team}
                            type="button"
                            onClick={() => onAssign(r.id, team)}
                            className={`btn btn-sm ${r.team === team ? "btn-primary" : "btn-ghost"}`}
                          >
                            {t(TEAM_KEY[team])}
                            {team === suggested && <span className="ml-1 opacity-70">· {t("off.suggested")}</span>}
                          </button>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {r.status !== "resolved" && (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onAssign(r.id, suggested)}>
                            {t("off.advance")}
                          </button>
                        )}
                        {r.status === "assigned" && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                              resolveTarget.current = r.id;
                              fileRef.current?.click();
                            }}
                          >
                            {t("off.attachAfter")}
                          </button>
                        )}
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onOpen(r.id)}>
                          {t("map.select")}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <div className="space-y-10">
          {/* Map beside the queue */}
          <section aria-labelledby="off-map">
            <h4 id="off-map" className="text-lg font-bold text-[var(--ink)]">
              {t("off.map")}
            </h4>
            <div
              ref={(el) => {
                mapRef.current = el;
                measure(el);
              }}
              className="relative mt-4 aspect-[4/3] w-full overflow-hidden border-2 border-[var(--ink)] bg-[var(--paper)]"
            >
              <WardSvg deadLights={reports.filter((r) => r.category === "streetlight" && r.status !== "resolved").map((r) => ({ x: r.x, y: r.y }))} />
              {size.w > 0 &&
                reports.map((r) => {
                  const d = derive(r, now);
                  const p = toScreen(size.w, size.h, IDENTITY_CAM, r.x, r.y);
                  return (
                    <span key={r.id} className="pin-btn pointer-events-none" style={{ left: p.x, top: p.y }}>
                      <PinTag tone={d.tone} score={d.score} />
                      <Pin category={r.category} tone={d.tone} size={20} />
                    </span>
                  );
                })}
            </div>
          </section>

          {/* Workload */}
          <section aria-labelledby="off-workload">
            <h4 id="off-workload" className="text-lg font-bold text-[var(--ink)]">
              {t("off.workload")}
            </h4>
            <ul className="mt-5 space-y-4">
              {workload.map((w) => (
                <li key={w.category} className="grid grid-cols-[minmax(0,9rem)_1fr_2rem] items-center gap-3">
                  <span className="flex items-center gap-2 text-sm font-bold text-[var(--ink)]">
                    <svg viewBox="4 2.5 24 24" width="18" height="18" aria-hidden="true">
                      <CategoryGlyph category={w.category} />
                    </svg>
                    {CATEGORY_META[w.category][lang]}
                  </span>
                  <span className="h-4 bg-[var(--rule)]" aria-hidden="true">
                    <span className="block h-full bg-[var(--ink)]" style={{ width: `${(w.count / maxWorkload) * 100}%` }} />
                  </span>
                  <span className="num text-right text-sm font-bold text-[var(--ink)]">{w.count}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Hotspots */}
          <section aria-labelledby="off-hotspots">
            <h4 id="off-hotspots" className="text-lg font-bold text-[var(--ink)]">
              {t("off.hotspots")}
            </h4>
            {hotspots.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--ink-soft)]">{t("dash.none")}</p>
            ) : (
              <ul className="mt-4 divide-y divide-[var(--rule)] border-y border-[var(--rule)]">
                {hotspots.map((h) => (
                  <li key={`${h.category}-${h.x}-${h.y}`} className="flex items-center gap-3 py-3">
                    <span className="min-w-0 flex-1 text-sm font-bold text-[var(--ink)]">{CATEGORY_META[h.category][lang]}</span>
                    <span className="num text-sm text-[var(--ink-soft)]">
                      {h.count} {t("stats.reports")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          void pickAfter(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
