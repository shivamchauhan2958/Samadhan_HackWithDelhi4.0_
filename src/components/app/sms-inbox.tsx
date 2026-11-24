"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useLang } from "@/components/lang-provider";
import { eventLabel, formatDate, readLocalSms, smsText, type LocalSms } from "@/lib/sms";
import { CATEGORY_META, type ReportEvent, type ReportView } from "@/lib/ward";

// The SMS inbox: every status change as a text message in the resident's own language,
// plus the simulated OTP.
export function SmsInbox({ reports, events }: { reports: ReportView[]; events: ReportEvent[] }): ReactNode {
  const { t, lang } = useLang();
  const [local, setLocal] = useState<LocalSms[]>([]);

  useEffect(() => {
    const id = window.setTimeout(() => setLocal(readLocalSms()), 0);
    return () => window.clearTimeout(id);
  }, []);

  const byId = new Map(reports.map((r) => [r.id, r]));
  const fromEvents = events
    .map((ev) => ({ ev, report: byId.get(ev.reportId) }))
    .filter((x): x is { ev: ReportEvent; report: ReportView } => Boolean(x.report))
    .map(({ ev, report }) => ({
      id: `ev-${ev.id}`,
      at: ev.at,
      text: smsText(ev, report, lang),
      category: CATEGORY_META[report.category][lang],
    }));

  const items = [
    ...local.map((m) => ({ id: m.id, at: m.at, text: m.text, category: undefined as string | undefined })),
    ...fromEvents,
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  return (
    <div className="mx-auto max-w-2xl">
      <h3 className="text-lg font-bold text-[var(--ink)]">{t("sms.title")}</h3>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--ink-soft)]">{t("sms.lead")}</p>

      {items.length === 0 ? (
        <p className="mt-8 border-2 border-dashed border-[var(--rule)] p-6 text-sm text-[var(--ink-soft)]">{t("sms.empty")}</p>
      ) : (
        <ol className="mt-8 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col items-start gap-1">
              <div className="sms-bubble">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.1em] opacity-80">
                  {t("sms.from")}
                  {item.category ? ` · ${item.category}` : ""}
                </span>
                {item.text}
              </div>
              <span className="num pl-1 text-[11px] text-[var(--ink-mute)]">{formatDate(item.at, lang)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
