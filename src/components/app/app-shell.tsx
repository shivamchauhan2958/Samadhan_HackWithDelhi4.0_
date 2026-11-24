"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { CitizenDashboard } from "@/components/app/citizen-dashboard";
import { LiveMap } from "@/components/app/live-map";
import { OfficerConsole } from "@/components/app/officer-console";
import { ReportForm } from "@/components/app/report-form";
import { SmsInbox } from "@/components/app/sms-inbox";
import { notify } from "@/components/app/toaster";
import { useReports } from "@/components/app/use-reports";
import { WardStats } from "@/components/app/ward-stats";
import { useAuth, type PendingAction } from "@/components/auth-provider";
import { useLang } from "@/components/lang-provider";
import type { Key } from "@/lib/i18n";

type Tab = "live" | "report" | "stats" | "sms" | "me" | "console";
const BASE_TABS: { id: Tab; label: Key; hash: string }[] = [
  { id: "live", label: "nav.live", hash: "#live-map" },
  { id: "report", label: "nav.report", hash: "#report" },
  { id: "stats", label: "nav.stats", hash: "#ward-stats" },
  { id: "sms", label: "nav.sms", hash: "#sms" },
];

// The working app below State 06. Role decides which dashboards are reachable.
export function AppShell(): ReactNode {
  const { t } = useLang();
  const { session, isCitizen, isOfficer, openLogin, setResumeHandler } = useAuth();
  const data = useReports(session?.phone ?? null);
  const [tab, setTab] = useState<Tab>("live");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);

  useEffect(() => {
    const start = window.setTimeout(() => setNow(Date.now()), 0);
    const tick = window.setInterval(() => setNow(Date.now()), 60_000);
    const openFromHash = () => {
      const hash = window.location.hash;
      if (hash === "#my-dashboard" && isCitizen) setTab("me");
      else if (hash === "#officer-console" && isOfficer) setTab("console");
      else {
        const match = BASE_TABS.find((x) => x.hash === hash);
        if (match) setTab(match.id);
      }
      window.requestAnimationFrame(() => document.getElementById("app")?.scrollIntoView({ block: "start" }));
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(tick);
      window.removeEventListener("hashchange", openFromHash);
    };
  }, [isCitizen, isOfficer]);

  const selectTab = useCallback((next: Tab) => {
    setTab(next);
    const hash =
      next === "me"
        ? "#my-dashboard"
        : next === "console"
          ? "#officer-console"
          : (BASE_TABS.find((x) => x.id === next)?.hash ?? "");
    window.history.replaceState(null, "", hash);
  }, []);

  // A guest who tried to act is asked to sign in; the action resumes afterwards.
  const requireLogin = useCallback(
    (action: PendingAction) => {
      setPending(action);
      openLogin(action);
    },
    [openLogin],
  );

  useEffect(() => {
    setResumeHandler(null);
    return () => setResumeHandler(null);
  }, [setResumeHandler]);

  // The interrupted action runs once the store is ready.
  useEffect(() => {
    if (!pending || !data.ready) return;
    const action = pending;
    const id = window.setTimeout(() => {
      setPending(null);
      if (action.kind === "report") {
        selectTab("report");
      } else if (action.kind === "vote") {
        setSelectedId(action.id);
        selectTab("live");
        const result = data.vote(action.id);
        notify(result === "counted" ? t("vote.counted") : result === "already" ? t("vote.already") : t("error.generic"));
      } else if (action.kind === "confirm") {
        data.confirm(action.id);
        notify(t("toast.confirmed"));
        setSelectedId(action.id);
        selectTab("me");
      } else if (action.kind === "reopen") {
        data.reopen(action.id);
        notify(t("toast.reopened"));
        setSelectedId(action.id);
        selectTab("me");
      } else if (action.kind === "my-dashboard") {
        selectTab("me");
      } else if (action.kind === "officer-console") {
        selectTab("console");
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, [pending, data, t, selectTab]);

  const openReport = (id: string) => {
    setSelectedId(id);
    selectTab("live");
  };

  const ready = data.ready && now !== null;
  const statusLine = data.sync === "offline" ? t("app.offline") : data.sync === "live" ? t("app.synced") : t("app.loading");
  const pendingLine = data.pendingCount > 0 ? ` · ${t("app.pending", { n: data.pendingCount })}` : "";

  const tabs: { id: Tab; label: Key; hash: string }[] = [
    ...BASE_TABS,
    ...(isCitizen ? [{ id: "me" as Tab, label: "menu.dashboard" as Key, hash: "#my-dashboard" }] : []),
    ...(isOfficer ? [{ id: "console" as Tab, label: "menu.console" as Key, hash: "#officer-console" }] : []),
  ];

  return (
    <section id="app" className="border-t-2 border-[var(--ink)] px-4 pb-20 pt-12 md:px-8 md:pt-16">
      <div className="mx-auto max-w-[1280px]">
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-[var(--rule)] pb-6">
          <div>
            <p className="kicker">{t("app.eyebrow")}</p>
            <h2 className="display-sm mt-2">{t("app.title")}</h2>
            <p className="num mt-2 text-sm text-[var(--ink-soft)]" role="status">
              {statusLine}
              {pendingLine}
            </p>
          </div>
          <div role="tablist" aria-label={t("app.tabs")} className="flex flex-wrap gap-2">
            {tabs.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  id={`tab-${item.id}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls="app-panel"
                  onClick={() => selectTab(item.id)}
                  className={`btn btn-sm md:min-h-12 ${active ? "btn-primary" : "btn-ghost"}`}
                >
                  {t(item.label)}
                </button>
              );
            })}
          </div>
        </div>

        <div id="app-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="mt-8">
          {!ready ? (
            <p className="text-[var(--ink-soft)]">{t("app.loading")}</p>
          ) : tab === "live" ? (
            <LiveMap
              reports={data.reports}
              events={data.events}
              now={now ?? 0}
              isCitizen={isCitizen}
              isOfficer={isOfficer}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onVote={(id) => {
                if (!isCitizen) {
                  requireLogin({ kind: "vote", id });
                  return "closed" as const;
                }
                const result = data.vote(id);
                notify(result === "counted" ? t("vote.counted") : result === "already" ? t("vote.already") : t("error.generic"));
                return result;
              }}
              onConfirm={(id) => {
                if (!isCitizen) {
                  requireLogin({ kind: "confirm", id });
                  return;
                }
                data.confirm(id);
                notify(t("toast.confirmed"));
              }}
              onReopen={(id) => {
                if (!isCitizen) {
                  requireLogin({ kind: "reopen", id });
                  return;
                }
                data.reopen(id);
                notify(t("toast.reopened"));
              }}
              onAdvance={(id, team) => {
                if (!isOfficer) return;
                const result = data.assign(id, team);
                notify(result === "rejected" ? t("toast.needVerify") : t("toast.assigned"));
              }}
              onResolve={(id, photo) => {
                if (!isOfficer) return;
                const result = data.resolve(id, photo);
                notify(result === "rejected" ? t("toast.needAfterPhoto") : t("toast.resolved"));
              }}
            />
          ) : tab === "report" ? (
            isCitizen ? (
              <ReportForm reports={data.reports} onCreate={data.create} onVote={data.vote} onDone={openReport} />
            ) : (
              <div className="border-2 border-dashed border-[var(--rule)] p-8 text-center">
                <p className="font-bold text-[var(--ink)]">{t("auth.required")}</p>
                <button type="button" className="btn btn-primary mt-4" onClick={() => requireLogin({ kind: "report" })}>
                  {t("login.logIn")}
                </button>
              </div>
            )
          ) : tab === "stats" ? (
            <WardStats
              reports={data.reports}
              now={now ?? 0}
              onOpen={openReport}
              onReset={data.reset}
              notifyReset={() => notify(t("dash.resetDone"))}
            />
          ) : tab === "sms" ? (
            <SmsInbox reports={data.reports} events={data.events} />
          ) : tab === "me" && isCitizen ? (
            <CitizenDashboard
              reports={data.reports}
              now={now ?? 0}
              onOpen={openReport}
              onReport={() => selectTab("report")}
              onConfirm={(id) => {
                data.confirm(id);
                notify(t("toast.confirmed"));
              }}
              onReopen={(id) => {
                data.reopen(id);
                notify(t("toast.reopened"));
              }}
            />
          ) : tab === "console" && isOfficer ? (
            <OfficerConsole
              reports={data.reports}
              now={now ?? 0}
              onAssign={(id, team) => {
                const result = data.assign(id, team);
                notify(result === "rejected" ? t("toast.needVerify") : t("toast.assigned"));
              }}
              onResolve={(id, photo) => {
                const result = data.resolve(id, photo);
                notify(result === "rejected" ? t("toast.needAfterPhoto") : t("toast.resolved"));
              }}
              onOpen={openReport}
            />
          ) : (
            <p className="text-[var(--ink-soft)]">{t("auth.required")}</p>
          )}
        </div>
      </div>
    </section>
  );
}
