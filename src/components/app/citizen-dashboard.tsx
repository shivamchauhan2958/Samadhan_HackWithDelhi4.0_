"use client";

import { useMemo, type ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";
import { notify } from "@/components/app/toaster";
import { StatusTimeline } from "@/components/app/live-map";
import { useLang } from "@/components/lang-provider";
import { PriorityChips, TONE_VAR, toneLabelKey } from "@/components/ward/pin";
import type { Key } from "@/lib/i18n";
import { KEYS, readJSON } from "@/lib/storage";
import { CATEGORY_META, derive, type ReportView } from "@/lib/ward";

// Citizen dashboard: the reports this person filed, what needs their confirmation,
// and the thread of SMS messages they received.
export function CitizenDashboard({
  reports,
  now,
  onOpen,
  onReport,
  onConfirm,
  onReopen,
}: {
  reports: ReportView[];
  now: number;
  onOpen: (id: string) => void;
  onReport: () => void;
  onConfirm: (id: string) => void;
  onReopen: (id: string) => void;
}): ReactNode {
  const { t, lang } = useLang();
  const { session } = useAuth();
  const name = session?.displayName || t("login.tabCitizen");

  const mine = useMemo(() => reports.filter((r) => r.mine), [reports]);
  const awaiting = useMemo(() => mine.filter((r) => r.status === "resolved" && r.resolution === "pending"), [mine]);
  const verificationsGiven = readJSON<string[]>(KEYS.voted, []).length;
  const helpedFixed = mine.filter((r) => r.status === "resolved" && r.resolution === "confirmed").length;

  const tiles: { label: string; value: string }[] = [
    { label: t("me.filed"), value: String(mine.length) },
    { label: t("me.verifications"), value: String(verificationsGiven) },
    { label: t("me.resolved"), value: String(mine.filter((r) => r.status === "resolved").length) },
    { label: t("me.awaiting"), value: String(awaiting.length) },
  ];

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-[var(--rule)] pb-6">
        <div>
          <h3 className="display-sm">{t("me.greeting", { name })}</h3>
          <p className="mt-2 text-[var(--ink-soft)]">{t("me.lead")}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={onReport}>
          {t("me.reportBtn")}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="border-t-2 border-[var(--ink)] pt-3">
            <p className="kicker">{tile.label}</p>
            <p className="num mt-2 text-3xl font-bold text-[var(--ink)]">{tile.value}</p>
          </div>
        ))}
      </div>

      {mine.length === 0 ? (
        <div className="border-2 border-dashed border-[var(--rule)] p-8 text-center">
          <p className="font-bold text-[var(--ink)]">{t("me.noReports")}</p>
          <button type="button" className="btn btn-primary mt-4" onClick={onReport}>
            {t("me.reportBtn")}
          </button>
        </div>
      ) : (
        <>
          {/* Awaiting confirmation is pinned to the top: it is the one thing only this person can do. */}
          {awaiting.length > 0 && (
            <section aria-labelledby="me-awaiting" className="border-2 border-[var(--ink)] bg-[var(--surface)] p-5">
              <h4 id="me-awaiting" className="text-lg font-bold text-[var(--ink)]">
                {t("me.awaitingCard")}
              </h4>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">{t("me.awaitingLead")}</p>
              <ul className="mt-5 space-y-4">
                {awaiting.map((r) => (
                  <li key={r.id} className="border-t border-[var(--rule)] pt-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-[var(--ink)]">
                          {CATEGORY_META[r.category][lang]} · <span className="num">{r.id}</span>
                        </p>
                        <p className="mt-1 text-sm text-[var(--ink-soft)]">{r.description}</p>
                      </div>
                      {r.afterPhoto && (
                        <img src={r.afterPhoto} alt={t("peak.after")} className="h-20 w-28 shrink-0 border-2 border-[var(--ink)] object-cover" />
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          onConfirm(r.id);
                          notify(t("toast.confirmed"));
                        }}
                      >
                        {t("detail.confirm")}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          onReopen(r.id);
                          notify(t("toast.reopened"));
                        }}
                      >
                        {t("detail.reopen")}
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onOpen(r.id)}>
                        {t("map.select")}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="me-reports">
            <h4 id="me-reports" className="text-lg font-bold text-[var(--ink)]">
              {t("me.myReports")}
            </h4>
            <ul className="mt-5 space-y-5">
              {mine.map((r) => {
                const d = derive(r, now);
                return (
                  <li key={r.id} className="border-2 border-[var(--rule)] bg-[var(--surface)] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-[var(--ink)]">
                          {CATEGORY_META[r.category][lang]} · <span className="num">{r.id}</span>
                        </p>
                        <p className="mt-1 text-sm text-[var(--ink-soft)]">{r.description}</p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <span className="badge-soft">{t(`stage.${r.status}` as Key)}</span>
                        {d.escalation !== "none" && (
                          <span className="badge-esc" data-level="high">
                            {t(d.escalation === "commissioner" ? "esc.commissioner" : d.escalation === "zonal" ? "esc.zonal" : "esc.ward")}
                          </span>
                        )}
                        {r.reopenCount > 0 && <span className="badge-soft">{t("chip.reopened")} ×{r.reopenCount}</span>}
                      </div>
                    </div>

                    <div className="mt-4">
                      <StatusTimeline r={r} lang={lang} t={t} />
                    </div>

                    <div className="mt-4">
                      <PriorityChips parts={d.parts} score={d.score} lang={lang} compact />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--ink)]">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: TONE_VAR[d.tone] }} aria-hidden="true" />
                        {t(toneLabelKey(d.tone))} <span className="num">{d.score}</span>
                      </span>
                      <span className="text-xs text-[var(--ink-mute)]">
                        {r.mine ? t("me.mine") : t("me.neighbour")}
                        {r.ownerPhoneMasked ? ` · ${t("me.yourPhone")} ${r.ownerPhoneMasked}` : ""}
                      </span>
                      <button type="button" className="btn btn-ghost btn-sm ml-auto" onClick={() => onOpen(r.id)}>
                        {t("map.select")}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <p className="border-t-2 border-[var(--ink)] pt-4 text-lg font-bold text-[var(--ink)]">
            {t("me.helpLine", { n: helpedFixed })}
          </p>
        </>
      )}
    </div>
  );
}
