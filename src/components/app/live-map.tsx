"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { notify } from "@/components/app/toaster";
import { useLang } from "@/components/lang-provider";
import { IDENTITY_CAM, toScreen } from "@/components/ward/camera";
import { CategoryGlyph, Pin, PinTag, PriorityChips, TONE_VAR, toneLabelKey } from "@/components/ward/pin";
import { WardSvg } from "@/components/ward/ward-map";
import { compressPhoto } from "@/lib/photo";
import { eventLabel, formatDate } from "@/lib/sms";
import type { Key, Lang } from "@/lib/i18n";
import { TEAM_FOR_CATEGORY, type Team } from "@/lib/auth";
import { DAY_MS, CATEGORY_META, VERIFY_AT, derive, geotag, shortId, stageIndex, type EscalationLevel, type ReportEvent, type ReportView } from "@/lib/ward";

export type TFn = (key: Key, vars?: Record<string, string | number>) => string;

// Plain-language SLA line: on track, due in N days, overdue by N days, or how the fix landed.
export function slaLine(r: ReportView, now: number, t: TFn) {
  const d = derive(r, now);
  if (r.status === "resolved") return d.resolvedLate ? t("sla.resolvedLate") : t("sla.resolvedOnTime");
  if (d.overdue) return t("sla.overdueBy", { n: Math.max(1, Math.ceil((now - d.deadline) / DAY_MS)) });
  const left = Math.ceil((d.deadline - now) / DAY_MS);
  return left <= 0 ? t("sla.dueToday") : t("sla.dueIn", { n: left });
}

export function escKey(level: EscalationLevel): Key {
  return level === "commissioner" ? "esc.commissioner" : level === "zonal" ? "esc.zonal" : level === "ward" ? "esc.ward" : "esc.none";
}

const TEAM_KEY: Record<Team, Key> = {
  roads: "off.teamRoads",
  sanitation: "off.teamSanitation",
  electrical: "off.teamElectrical",
  water: "off.teamWater",
};

function fmtDate(iso: string | null, lang: Lang) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short" });
}

export function StatusTimeline({ r, lang, t }: { r: ReportView; lang: Lang; t: TFn }) {
  const current = stageIndex(r.status);
  const steps: { key: Key; date: string | null }[] = [
    { key: "stage.reported", date: r.createdAt },
    { key: "stage.verified", date: r.verifiedAt },
    { key: "stage.assigned", date: r.assignedAt },
    { key: "stage.resolved", date: r.resolvedAt },
  ];
  return (
    <ol className="grid grid-cols-4 gap-2">
      {steps.map((s, i) => {
        const done = i <= current;
        return (
          <li key={s.key} className="flex min-w-0 flex-col items-start gap-1.5">
            <span className="flex w-full items-center">
              <span className={`node shrink-0 ${done ? "node-done" : ""} ${i === current ? "node-current" : ""}`} />
              {i < steps.length - 1 && <span className={`h-[2px] flex-1 ${i < current ? "bg-[var(--ink)]" : "bg-[var(--rule)]"}`} />}
            </span>
            <span className={`text-[11px] font-bold uppercase tracking-[0.04em] ${done ? "text-[var(--ink)]" : "text-[var(--ink-mute)]"}`}>
              {t(s.key)}
            </span>
            <span className="num text-[11px] text-[var(--ink-mute)]">{done ? fmtDate(s.date, lang) : ""}</span>
          </li>
        );
      })}
    </ol>
  );
}

// Before / after comparison with a drag slider.
function BeforeAfter({ before, after, t }: { before: string; after: string; t: TFn }) {
  const [pos, setPos] = useState(50);
  return (
    <div>
      <div className="ba-compare h-44 w-full">
        <img src={before} alt={t("peak.before")} />
        <img src={after} alt={t("peak.after")} className="ba-after" style={{ clipPath: `inset(0 0 0 ${pos}%)` }} />
        <span className="ba-handle" style={{ left: `${pos}%` }} aria-hidden="true" />
        <input
          type="range"
          min={0}
          max={100}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          className="ba-range"
          aria-label={t("detail.compareHint")}
        />
      </div>
      <p className="num mt-1.5 flex justify-between text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--ink-mute)]">
        <span>{t("peak.before")}</span>
        <span>{t("peak.after")}</span>
      </p>
    </div>
  );
}

export function LiveMap({
  reports,
  events,
  now,
  isCitizen,
  isOfficer,
  selectedId,
  onSelect,
  onVote,
  onAdvance,
  onResolve,
  onConfirm,
  onReopen,
}: {
  reports: ReportView[];
  events: ReportEvent[];
  now: number;
  isCitizen: boolean;
  isOfficer: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onVote: (id: string) => "counted" | "already" | "closed" | "missing";
  onAdvance: (id: string, team: Team | null) => void;
  onResolve: (id: string, afterPhoto: string) => void;
  onConfirm: (id: string) => void;
  onReopen: (id: string) => void;
}) {
  const { t, lang } = useLang();
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");
  const [size, setSize] = useState({ w: 0, h: 0 });
  const boxRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const deadLights = useMemo(
    () => reports.filter((r) => r.category === "streetlight" && r.status !== "resolved").map((r) => ({ x: r.x, y: r.y })),
    [reports],
  );

  const list = useMemo(
    () =>
      reports
        .filter((r) => filter === "all" || (filter === "open" ? r.status !== "resolved" : r.status === "resolved"))
        .map((r) => ({ r, d: derive(r, now) }))
        .sort(
          (a, b) =>
            Number(a.r.status === "resolved") - Number(b.r.status === "resolved") ||
            Number(b.d.overdue) - Number(a.d.overdue) ||
            b.d.score - a.d.score,
        ),
    [reports, filter, now],
  );

  const selected = reports.find((r) => r.id === selectedId) ?? null;
  const selectedEvents = useMemo(
    () => (selected ? events.filter((e) => e.reportId === selected.id) : []),
    [events, selected],
  );

  const handleVote = (r: ReportView) => {
    const result = onVote(r.id);
    if (result === "counted") notify(r.votes + 1 >= VERIFY_AT && r.status === "reported" ? t("vote.verified") : t("vote.counted"));
    else if (result === "already") notify(t("vote.already"));
    else notify(t("error.generic"));
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-5">
        <div
          ref={boxRef}
          className="relative aspect-[4/3] w-full overflow-hidden border-2 border-[var(--ink)] bg-[var(--paper)] md:aspect-[16/10]"
        >
          <WardSvg deadLights={deadLights} />
          {size.w > 0 &&
            list.map(({ r, d }) => {
              const s = toScreen(size.w, size.h, IDENTITY_CAM, r.x, r.y);
              const active = r.id === selectedId;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onSelect(active ? null : r.id)}
                  aria-pressed={active}
                  aria-label={`${CATEGORY_META[r.category][lang]} ${shortId(r.id)}, ${t(toneLabelKey(d.tone))}`}
                  className={`pin-btn ${active ? "z-10" : ""}`}
                  style={{ left: s.x, top: s.y }}
                >
                  <PinTag tone={d.tone} score={d.score} />
                  <Pin category={r.category} tone={d.tone} size={active ? 32 : 24} />
                </button>
              );
            })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="group" aria-label={t("map.list")} className="flex flex-wrap gap-2">
            {(["all", "open", "resolved"] as const).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={`btn btn-sm ${filter === f ? "btn-primary" : "btn-ghost"}`}
              >
                {t(f === "all" ? "map.all" : f === "open" ? "map.open" : "map.resolved")}
              </button>
            ))}
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-[var(--ink-soft)]">
            {(["high", "medium", "low", "resolved"] as const).map((tone) => (
              <li key={tone} className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-full" style={{ background: TONE_VAR[tone] }} aria-hidden="true" />
                {t(toneLabelKey(tone))}
              </li>
            ))}
          </ul>
        </div>

        <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-[var(--ink-soft)]">{t("map.list")}</h3>
        <ul className="divide-y divide-[var(--rule)] border-y border-[var(--rule)]">
          {list.length === 0 && <li className="py-4 text-sm text-[var(--ink-soft)]">{t("map.empty")}</li>}
          {list.map(({ r, d }) => {
            const active = r.id === selectedId;
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onSelect(r.id)}
                  aria-pressed={active}
                  className={`flex min-h-11 w-full items-center gap-3 py-3 text-left ${active ? "bg-[var(--surface)]" : ""}`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-[var(--ink)] bg-[var(--surface)]">
                    <svg viewBox="4 2.5 24 24" width="24" height="24" aria-hidden="true">
                      <CategoryGlyph category={r.category} />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-[var(--ink)]">{CATEGORY_META[r.category][lang]}</span>
                    <span className="num block truncate text-xs text-[var(--ink-mute)]">
                      {shortId(r.id)} · {t(`stage.${r.status}` as Key)} · {slaLine(r, now, t)}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--ink-mute)]">{t(toneLabelKey(d.tone))}</span>
                    <span className="num block text-sm font-bold text-[var(--ink)]">{d.tone === "resolved" ? "✓" : d.score}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <aside className="lg:sticky lg:top-[calc(var(--hdr)_+_24px)] lg:self-start">
        {selected ? (
          <Detail
            r={selected}
            events={selectedEvents}
            now={now}
            isCitizen={isCitizen}
            isOfficer={isOfficer}
            lang={lang}
            t={t}
            onVote={() => handleVote(selected)}
            onAdvance={(team) => onAdvance(selected.id, team)}
            onResolve={(photo) => onResolve(selected.id, photo)}
            onConfirm={() => onConfirm(selected.id)}
            onReopen={() => onReopen(selected.id)}
            onClose={() => onSelect(null)}
            fileRef={fileRef}
          />
        ) : (
          <p className="border-2 border-dashed border-[var(--rule)] p-6 text-sm leading-relaxed text-[var(--ink-soft)]">{t("map.hint")}</p>
        )}
      </aside>
    </div>
  );
}

function Detail({
  r,
  events,
  now,
  isCitizen,
  isOfficer,
  lang,
  t,
  onVote,
  onAdvance,
  onResolve,
  onConfirm,
  onReopen,
  onClose,
  fileRef,
}: {
  r: ReportView;
  events: ReportEvent[];
  now: number;
  isCitizen: boolean;
  isOfficer: boolean;
  lang: Lang;
  t: TFn;
  onVote: () => void;
  onAdvance: (team: Team | null) => void;
  onResolve: (photo: string) => void;
  onConfirm: () => void;
  onReopen: () => void;
  onClose: () => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
}): ReactNode {
  const d = derive(r, now);
  const g = geotag(r.x, r.y);
  const open = r.status !== "resolved";
  // Only the resident who reported it can confirm or reopen the fix.
  const awaiting = d.awaitingConfirmation && r.mine && isCitizen;
  const [afterDraft, setAfterDraft] = useState<string | null>(null);
  const suggestedTeam = (r.team as Team | null) ?? TEAM_FOR_CATEGORY[r.category];

  const pickAfterPhoto = async (file: File | undefined) => {
    if (!file) return;
    const data = await compressPhoto(file);
    if (!data) {
      notify(t("report.tooLarge"));
      return;
    }
    setAfterDraft(data);
  };

  return (
    <article className="border-2 border-[var(--ink)] bg-[var(--surface)]">
      <header className="flex items-start justify-between gap-3 border-b border-[var(--rule)] p-4">
        <div className="min-w-0">
          <p className="kicker">{CATEGORY_META[r.category][lang]}</p>
          <h3 className="num mt-1 truncate text-xl font-bold text-[var(--ink)]">{r.id}</h3>
          <p className="mt-1.5 inline-flex flex-wrap items-center gap-2 text-sm font-bold text-[var(--ink)]">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: TONE_VAR[d.tone] }} aria-hidden="true" />
              {t(toneLabelKey(d.tone))}
              {d.tone !== "resolved" && <span className="num">· {d.score}</span>}
            </span>
            {d.escalation !== "none" && (
              <span className="badge-esc" data-level="high">
                {t(escKey(d.escalation))}
              </span>
            )}
            {r.reopenCount > 0 && <span className="badge-soft">{t("chip.reopened")} ×{r.reopenCount}</span>}
          </p>
        </div>
        <button type="button" onClick={onClose} className="btn btn-ghost btn-sm shrink-0">
          {t("detail.close")}
        </button>
      </header>

      {r.photo && r.afterPhoto ? (
        <div className="border-b border-[var(--rule)] p-4">
          <BeforeAfter before={r.photo} after={r.afterPhoto} t={t} />
        </div>
      ) : r.photo ? (
        <img src={r.photo} alt={t("gap.photo")} className="h-44 w-full border-b border-[var(--rule)] object-cover" />
      ) : r.afterPhoto ? (
        <img src={r.afterPhoto} alt={t("peak.after")} className="h-44 w-full border-b border-[var(--rule)] object-cover" />
      ) : (
        <p className="border-b border-[var(--rule)] p-4 text-sm text-[var(--ink-soft)]">{t("detail.noPhoto")}</p>
      )}

      <div className="space-y-5 p-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="kicker">{t("function.votes")}</p>
            <p className="num text-lg font-bold text-[var(--ink)]">
              {r.votes} / {VERIFY_AT}
            </p>
          </div>
          <div>
            <p className="kicker">{t("sla.label")}</p>
            <p className={`text-sm font-bold ${d.overdue ? "text-[var(--high)]" : "text-[var(--ink)]"}`}>{slaLine(r, now, t)}</p>
          </div>
          <div className="col-span-2">
            <p className="kicker">{t("detail.geotag")}</p>
            <p className="num text-sm text-[var(--ink)]">{g.label}</p>
          </div>
        </div>

        {r.reportCount > 1 && <p className="num text-xs font-bold text-[var(--ink-mute)]">{t("detail.merged", { n: r.reportCount })}</p>}

        <StatusTimeline r={r} lang={lang} t={t} />

        <div>
          <p className="kicker mb-2">{t("function.why")}</p>
          <PriorityChips parts={d.parts} score={d.score} lang={lang} compact />
        </div>

        {events.length > 0 && (
          <div>
            <p className="kicker mb-2">{t("detail.timeline")}</p>
            <ul className="space-y-1.5 border-l-2 border-[var(--rule)] pl-3">
              {events.slice(0, 8).map((ev) => (
                <li key={ev.id} className="text-xs text-[var(--ink-soft)]">
                  <span className="font-bold text-[var(--ink)]">
                    {ev.kind === "escalated" && ev.level
                      ? t("esc.log", { level: t(escKey(ev.level)), date: formatDate(ev.at, lang) })
                      : `${eventLabel(ev.kind, lang)} · ${formatDate(ev.at, lang)}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <p className="kicker">{t("detail.description")}</p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--ink-soft)]">{r.description || t("detail.noDescription")}</p>
        </div>

        {/* The citizen closes the loop. */}
        {awaiting && (
          <div className="panel p-3">
            <p className="text-sm font-bold text-[var(--ink)]">{t("detail.confirmQuestion")}</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--ink-mute)]">{t("detail.confirmHint")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary btn-sm" onClick={onConfirm}>
                {t("detail.confirm")}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={onReopen}>
                {t("detail.reopen")}
              </button>
            </div>
          </div>
        )}

        {open && (
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn btn-primary" onClick={onVote}>
              {t("vote.see")}
            </button>
            {!isCitizen && <p className="text-xs text-[var(--ink-mute)]">{t("stats.loginToAct")}</p>}
            {isOfficer && r.status !== "assigned" && (
              <button type="button" className="btn btn-ghost" onClick={() => onAdvance(suggestedTeam)}>
                {t("off.assignTeam")}
              </button>
            )}
            {isOfficer && r.status === "reported" && (
              <p className="text-xs text-[var(--ink-mute)]">{t("detail.needVerify", { n: VERIFY_AT })}</p>
            )}
          </div>
        )}

        {/* Officer: assign a team to the work. */}
        {isOfficer && r.status !== "resolved" && (
          <div>
            <p className="kicker mb-2">{t("off.assignTeam")}</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(TEAM_KEY) as Team[]).map((team) => (
                <button
                  key={team}
                  type="button"
                  onClick={() => onAdvance(team)}
                  className={`btn btn-sm ${r.team === team ? "btn-primary" : "btn-ghost"}`}
                >
                  {t(TEAM_KEY[team])}
                  {team === suggestedTeam && <span className="ml-1 opacity-70">· {t("off.suggested")}</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Resolving needs an after photo. */}
        {isOfficer && r.status === "assigned" && (
          <div className="panel p-3">
            <p className="text-sm font-bold text-[var(--ink)]">{t("detail.resolve")}</p>
            <p className="mt-1 text-xs text-[var(--ink-mute)]">{t("detail.resolveHint")}</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                void pickAfterPhoto(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {afterDraft && <img src={afterDraft} alt="" className="h-16 w-16 border-2 border-[var(--ink)] object-cover" />}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
                {t("report.photoAdd")}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!afterDraft}
                onClick={() => afterDraft && onResolve(afterDraft)}
              >
                {t("detail.resolve")}
              </button>
            </div>
          </div>
        )}

        {open && !isOfficer && !isCitizen && <p className="text-xs text-[var(--ink-mute)]">{t("detail.officerOnly")}</p>}
      </div>
    </article>
  );
}
