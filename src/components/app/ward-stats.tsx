"use client";

import { useMemo, type ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";
import { useLang } from "@/components/lang-provider";
import { CategoryGlyph, TONE_VAR, toneLabelKey } from "@/components/ward/pin";
import type { Key } from "@/lib/i18n";
import { CATEGORIES, CATEGORY_META, derive, findHotspots, summarize, type ReportView } from "@/lib/ward";
import { slaLine } from "@/components/app/live-map";

// Ward stats: the public, read-only view of the ward. Anyone can read it.
export function WardStats({
  reports,
  now,
  onOpen,
  onReset,
  notifyReset,
}: {
  reports: ReportView[];
  now: number;
  onOpen: (id: string) => void;
  onReset: () => Promise<boolean>;
  notifyReset: () => void;
}): ReactNode {
  const { t, lang } = useLang();
  const { isCitizen, isOfficer, openLogin } = useAuth();
  const s = summarize(reports, now);
  const hotspots = useMemo(() => findHotspots(reports), [reports]);
  const queue = useMemo(
    () =>
      reports
        .filter((r) => r.status !== "resolved")
        .map((r) => ({ r, d: derive(r, now) }))
        .sort((a, b) => Number(b.d.overdue) - Number(a.d.overdue) || b.d.score - a.d.score),
    [reports, now],
  );
  const maxCat = Math.max(1, ...CATEGORIES.map((c) => s.byCategory[c]));

  const tiles: { label: string; value: string }[] = [
    { label: t("stats.total"), value: String(s.total) },
    { label: t("stats.open"), value: String(s.open) },
    { label: t("stats.resolved"), value: String(s.resolved) },
    { label: t("stats.fix"), value: `${s.avgFixDays.toFixed(1)} ${t("unit.days")}` },
    { label: t("stats.past"), value: String(s.pastDeadline) },
    { label: t("stats.escalated"), value: String(s.escalated) },
    { label: t("stats.reopened"), value: String(s.reopened) },
  ];

  return (
    <div className="space-y-12">
      <p className="max-w-2xl text-[var(--ink-soft)]">{t("stats.lead")}</p>

      {reports.length === 0 ? (
        <div className="border-2 border-dashed border-[var(--rule)] p-8 text-center">
          <p className="font-bold text-[var(--ink)]">{t("stats.noReports")}</p>
          <button type="button" className="btn btn-primary mt-4" onClick={() => openLogin({ kind: "report" })}>
            {t("hero.cta.report")}
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4 lg:grid-cols-7">
            {tiles.map((tile) => (
              <div key={tile.label} className="border-t-2 border-[var(--ink)] pt-3">
                <p className="kicker">{tile.label}</p>
                <p className="num mt-2 text-3xl font-bold text-[var(--ink)]">{tile.value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-12 lg:grid-cols-2">
            <section aria-labelledby="stats-category">
              <h3 id="stats-category" className="text-lg font-bold text-[var(--ink)]">
                {t("stats.byCategory")}
              </h3>
              <ul className="mt-6 space-y-5">
                {CATEGORIES.map((c) => {
                  const n = s.byCategory[c];
                  return (
                    <li key={c} className="grid grid-cols-[minmax(0,10rem)_1fr_2.5rem] items-center gap-4">
                      <span className="flex items-center gap-2 text-sm font-bold text-[var(--ink)]">
                        <svg viewBox="4 2.5 24 24" width="20" height="20" aria-hidden="true">
                          <CategoryGlyph category={c} />
                        </svg>
                        {CATEGORY_META[c][lang]}
                      </span>
                      <span className="h-4 bg-[var(--rule)]" aria-hidden="true">
                        <span className="block h-full bg-[var(--ink)]" style={{ width: `${(n / maxCat) * 100}%` }} />
                      </span>
                      <span className="num text-right text-sm font-bold text-[var(--ink)]">{n}</span>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section aria-labelledby="stats-hotspots">
              <h3 id="stats-hotspots" className="text-lg font-bold text-[var(--ink)]">
                {t("stats.hotspots")}
              </h3>
              <p className="mt-1 text-sm text-[var(--ink-mute)]">{t("stats.hotspotsLead")}</p>
              {hotspots.length === 0 ? (
                <p className="mt-4 text-sm text-[var(--ink-soft)]">{t("dash.none")}</p>
              ) : (
                <ul className="mt-4 divide-y divide-[var(--rule)] border-y border-[var(--rule)]">
                  {hotspots.map((h) => (
                    <li key={`${h.category}-${h.x}-${h.y}`} className="flex items-center gap-3 py-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center border-2 border-[var(--ink)] bg-[var(--surface)]">
                        <svg viewBox="4 2.5 24 24" width="20" height="20" aria-hidden="true">
                          <CategoryGlyph category={h.category} />
                        </svg>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-[var(--ink)]">{CATEGORY_META[h.category][lang]}</span>
                        <span className="num block text-xs text-[var(--ink-mute)]">
                          {h.count} {t("stats.reports")}
                        </span>
                      </span>
                      <span className="num text-sm font-bold text-[var(--ink)]">
                        {h.x}, {h.y}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section aria-labelledby="stats-queue">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h3 id="stats-queue" className="text-lg font-bold text-[var(--ink)]">
                {t("stats.queue")}
              </h3>
              <p className="text-sm text-[var(--ink-mute)]">{t("stats.queueLead")}</p>
            </div>
            <ul className="mt-5 divide-y divide-[var(--rule)] border-y border-[var(--rule)]">
              {queue.map(({ r, d }) => (
                <li key={r.id}>
                  <button type="button" onClick={() => onOpen(r.id)} className="flex min-h-14 w-full items-center gap-3 py-3 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-[var(--ink)]">
                        {CATEGORY_META[r.category][lang]} · <span className="num">{r.id}</span>
                      </span>
                      <span className="block text-xs text-[var(--ink-mute)]">
                        {t(`stage.${r.status}` as Key)} · {slaLine(r, now, t)}
                      </span>
                    </span>
                    <span className="inline-flex shrink-0 flex-wrap items-center gap-2">
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
                </li>
              ))}
            </ul>
          </section>

          {!isCitizen && !isOfficer && (
            <div className="flex flex-wrap items-center justify-between gap-4 border-2 border-[var(--ink)] bg-[var(--surface)] p-5">
              <p className="font-bold text-[var(--ink)]">{t("stats.loginToAct")}</p>
              <button type="button" className="btn btn-primary" onClick={() => openLogin({ kind: "report" })}>
                {t("login.logIn")}
              </button>
            </div>
          )}

          <div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={async () => {
                await onReset();
                notifyReset();
              }}
            >
              {t("dash.reset")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
