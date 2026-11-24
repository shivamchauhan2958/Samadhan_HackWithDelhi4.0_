"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { notify } from "@/components/app/toaster";
import { useAuth } from "@/components/auth-provider";
import { useLang } from "@/components/lang-provider";
import { IDENTITY_CAM, toMap, toScreen } from "@/components/ward/camera";
import { CategoryGlyph, Pin, PriorityChips } from "@/components/ward/pin";
import { WardSvg } from "@/components/ward/ward-map";
import { compressPhoto } from "@/lib/photo";
import { categoryFromTranscript } from "@/lib/sms";
import type { Key } from "@/lib/i18n";
import { newId } from "@/lib/storage";
import {
  CATEGORIES,
  CATEGORY_META,
  DUPLICATE_RADIUS,
  MAP_H,
  MAP_W,
  findSimilar,
  geotag,
  priorityParts,
  stageIndex,
  type Category,
  type ReportView,
} from "@/lib/ward";

const STATUS_KEYS: Key[] = ["stage.reported", "stage.verified", "stage.assigned", "stage.resolved"];

/* Minimal Web Speech API surface: support is detected before the button is offered. */
type SpeechResult = { results: ArrayLike<ArrayLike<{ transcript: string }>>; resultIndex: number };
interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechResult) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => RecognitionLike;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z" fill="currentColor" />
      <path d="M6 12v0a6 6 0 0 0 12 0M12 18v3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// Report flow: pick a category, drop a pin, add details or speak them.
// A nearby open report of the same category routes to "Add my voice" instead of a duplicate.
export function ReportForm({
  reports,
  onCreate,
  onVote,
  onDone,
}: {
  reports: ReportView[];
  onCreate: (r: ReportView) => Promise<boolean>;
  onVote: (id: string) => "counted" | "already" | "closed" | "missing";
  onDone: (id: string) => void;
}): ReactNode {
  const { t, lang } = useLang();
  const { session } = useAuth();
  const [category, setCategory] = useState<Category | null>(null);
  const [pin, setPin] = useState<{ x: number; y: number } | null>(null);
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<RecognitionLike | null>(null);

  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const supported = recognitionCtor() !== null;
    const detect = window.setTimeout(() => setVoiceSupported(supported), 0);
    return () => {
      window.clearTimeout(detect);
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const similar = category && pin ? findSimilar(reports, category, pin.x, pin.y) : null;
  const preview = category && pin ? priorityParts({ category, votes: 0, x: pin.x, y: pin.y, reopenCount: 0 }, 0) : null;

  const placeFromTap = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const p = toMap(rect.width, rect.height, IDENTITY_CAM, e.clientX - rect.left, e.clientY - rect.top);
    setPin({ x: Math.round(p.x), y: Math.round(p.y) });
  };

  // Keyboard path: arrows nudge the pin (Shift for bigger steps), Enter places it.
  const onMapKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 80 : 20;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const cur = pin ?? { x: 800, y: 450 };
    const m = moves[e.key];
    if (m) {
      e.preventDefault();
      setPin({ x: Math.min(Math.max(cur.x + m[0], 0), MAP_W), y: Math.min(Math.max(cur.y + m[1], 0), MAP_H) });
    } else if (e.key === "Enter" && !pin) {
      e.preventDefault();
      setPin(cur);
    }
  };

  const toggleVoice = () => {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      notify(t("voice.unsupported"));
      return;
    }
    if (listening) {
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
      setListening(false);
      return;
    }
    const rec = new Ctor();
    recognitionRef.current = rec;
    rec.lang = lang === "hi" ? "hi-IN" : "en-IN";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e) => {
      const result = e.results[e.results.length - 1];
      const transcript = result?.[0]?.transcript?.trim() ?? "";
      if (!transcript) return;
      setHeard(transcript);
      setDescription((prev) => (prev ? `${prev} ${transcript}` : transcript));
      const matched = categoryFromTranscript(transcript);
      if (matched) {
        setCategory(matched);
        notify(t("voice.matched", { category: CATEGORY_META[matched][lang] }));
      } else {
        notify(t("voice.noMatch"));
      }
    };
    rec.onerror = () => {
      setListening(false);
      notify(t("voice.error"));
    };
    rec.onend = () => setListening(false);
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
      notify(t("voice.error"));
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const data = await compressPhoto(file);
    if (!data) {
      notify(t("report.tooLarge"));
      return;
    }
    setPhoto(data);
  };

  const submit = async () => {
    if (!category) return notify(t("report.needCategory"));
    if (!pin) return notify(t("report.needPin"));
    setBusy(true);
    const report: ReportView = {
      id: newId(),
      category,
      x: pin.x,
      y: pin.y,
      description: description.trim().slice(0, 500),
      status: "reported",
      votes: 0,
      reportCount: 1,
      photo,
      afterPhoto: null,
      resolution: "none",
      reopenCount: 0,
      createdAt: new Date().toISOString(),
      verifiedAt: null,
      assignedAt: null,
      resolvedAt: null,
      confirmedAt: null,
      reopenedAt: null,
      mine: true,
      reporterName: session?.displayName ?? null,
      ownerPhoneMasked: null,
      team: null,
      assignedTeam: null,
    };
    const synced = await onCreate(report);
    setBusy(false);
    notify(synced ? t("report.success") : t("report.queued"));
    setCategory(null);
    setPin(null);
    setDescription("");
    setPhoto(null);
    setHeard(null);
    onDone(report.id);
  };

  const addVoice = () => {
    if (!similar) return;
    const result = onVote(similar.report.id);
    notify(result === "counted" ? t("vote.counted") : result === "already" ? t("vote.already") : t("error.generic"));
    onDone(similar.report.id);
  };

  const pinScreen = pin && size.w > 0 ? toScreen(size.w, size.h, IDENTITY_CAM, pin.x, pin.y) : null;
  const pinGeo = pin ? geotag(pin.x, pin.y) : null;

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div className="space-y-8">
        <fieldset>
          <legend className="kicker">01 · {t("report.step.category")}</legend>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {CATEGORIES.map((c) => {
              const on = category === c;
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setCategory(c)}
                  className={`flex min-h-16 items-center gap-3 border-2 p-3 text-left font-bold ${
                    on ? "border-[var(--ink)] bg-[var(--signal)] text-[#12202c]" : "border-[var(--rule)] bg-[var(--surface)] text-[var(--ink)]"
                  }`}
                >
                  <svg viewBox="4 2.5 24 24" width="30" height="30" aria-hidden="true" className="shrink-0">
                    <CategoryGlyph category={c} />
                  </svg>
                  <span>{CATEGORY_META[c][lang]}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Voice reporting: support is detected, and typing always stays available. */}
        <div className="panel p-4">
          <p className="kicker">{t("voice.label")}</p>
          {voiceSupported ? (
            <>
              <button type="button" className="voice-btn mt-3" data-live={listening} onClick={toggleVoice}>
                <MicIcon />
                {listening ? t("voice.stop") : t("voice.start")}
              </button>
              <p className="mt-2 text-xs text-[var(--ink-mute)]">{listening ? t("voice.listening") : `${lang === "hi" ? "hi-IN" : "en-IN"}`}</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-[var(--ink-soft)]">{t("voice.unsupported")}</p>
          )}
          {heard && <p className="mt-2 text-sm text-[var(--ink)]">{t("voice.heard", { text: heard })}</p>}
        </div>

        <div>
          <p className="kicker">03 · {t("report.step.details")}</p>
          <label htmlFor="description" className="mt-4 block text-sm font-bold text-[var(--ink)]">
            {t("report.description")}
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder={t("report.descriptionPh")}
            className="mt-2 w-full border-2 border-[var(--ink)] bg-[var(--surface)] p-3 text-[var(--ink)] placeholder:text-[var(--ink-mute)]"
          />

          <p className="mt-5 text-sm font-bold text-[var(--ink)]">{t("report.photo")}</p>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            {photo && <img src={photo} alt="" className="h-20 w-20 border-2 border-[var(--ink)] object-cover" />}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                void onFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
              {t("report.photoAdd")}
            </button>
            {photo && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPhoto(null)}>
                {t("report.photoRemove")}
              </button>
            )}
          </div>
        </div>

        {similar ? (
          <div role="status" className="panel p-5">
            <p className="font-bold text-[var(--ink)]">{t("report.similarTitle")}</p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">
              {t("report.similarBody", {
                m: Math.round(similar.meters),
                status: t(STATUS_KEYS[stageIndex(similar.report.status)]),
                votes: similar.report.votes,
              })}
            </p>
            <p className="num mt-2 text-xs text-[var(--ink-mute)]">
              {similar.report.id} · {DUPLICATE_RADIUS} m
            </p>
            <button type="button" onClick={addVoice} className="btn btn-primary mt-4">
              {t("vote.addVoice")}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <button type="button" onClick={submit} disabled={busy} className="btn btn-primary w-full sm:w-auto">
              {busy ? t("report.submitting") : t("report.submit")}
            </button>
            {(!category || !pin) && (
              <p className="text-sm text-[var(--ink-mute)]">{!category ? t("report.needCategory") : t("report.needPin")}</p>
            )}
          </div>
        )}
      </div>

      <div className="min-w-0 space-y-3">
        <p className="kicker">02 · {t("report.step.location")}</p>
        <div
          ref={mapRef}
          role="application"
          tabIndex={0}
          aria-label={t("report.step.location")}
          onClick={placeFromTap}
          onKeyDown={onMapKey}
          className="relative aspect-[4/3] w-full cursor-crosshair overflow-hidden border-2 border-[var(--ink)] bg-[var(--paper)] md:aspect-[16/10]"
        >
          <WardSvg
            deadLights={reports.filter((r) => r.category === "streetlight" && r.status !== "resolved").map((r) => ({ x: r.x, y: r.y }))}
          />
          {reports
            .filter((r) => r.status !== "resolved")
            .slice(0, 8)
            .map((r) => {
              const s = size.w > 0 ? toScreen(size.w, size.h, IDENTITY_CAM, r.x, r.y) : null;
              if (!s) return null;
              return (
                <span key={r.id} className="pin-btn pointer-events-none opacity-60" style={{ left: s.x, top: s.y }}>
                  <Pin category={r.category} tone="low" size={20} />
                </span>
              );
            })}
          {pinScreen && (
            <div
              className="pointer-events-none absolute left-0 top-0 -translate-x-1/2 -translate-y-full"
              style={{ left: pinScreen.x, top: pinScreen.y }}
            >
              <Pin category={category ?? "pothole"} tone="medium" size={34} />
            </div>
          )}
        </div>
        <p className="num text-sm text-[var(--ink-soft)]">
          {pinGeo ? t("report.pinSet", { lat: pinGeo.lat.toFixed(4), lng: pinGeo.lng.toFixed(4) }) : t("report.pinNone")}
        </p>

        {preview && (
          <div className="panel p-4">
            <p className="kicker mb-2">{t("report.preview")}</p>
            <PriorityChips parts={preview} score={preview.total} lang={lang} compact />
          </div>
        )}
      </div>
    </div>
  );
}
