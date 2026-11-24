"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLang } from "@/components/lang-provider";
import { Pin } from "@/components/ward/pin";
import { WardSvg } from "@/components/ward/ward-map";

const INTRO_MS = 3000;
const REDUCED_MS = 600;

function seen() {
  try {
    if (typeof window === "undefined") return true;
    return window.sessionStorage.getItem("samadhan.intro.seen.v3") === "1";
  } catch {
    return true;
  }
}

function markSeen() {
  try {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem("samadhan.intro.seen.v3", "1");
  } catch {
    /* ignore */
  }
}

// The inline boot script decides whether the intro plays before the first paint,
// so a returning visitor never sees a flash of it.
function introArmed() {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("intro-on");
}

// State 00: the opening of the website. Plays once per session on top of the loaded page,
// then hands over to the hero. CSS and SVG only.
export function IntroOverlay({ run, onDone }: { run: number; onDone: () => void }) {
  const { lang, setLang, t } = useLang();
  const [phase, setPhase] = useState<"idle" | "play" | "leave">("idle");
  const [forced, setForced] = useState(false);
  const [gone, setGone] = useState(false);
  const timers = useRef<number[]>([]);

  const leave = useCallback(
    (fast: boolean) => {
      setPhase((current) => {
        if (current === "leave") return current;
        markSeen();
        // A skip fast-forwards the drawing animations so the handover starts from the end frame.
        if (fast) setForced(true);
        window.setTimeout(() => {
          // Disarm, so the intro is hidden and a replay starts its animations again.
          document.documentElement.classList.remove("intro-on");
          setGone(true);
          onDone();
        }, fast ? 120 : 620);
        return "leave";
      });
    },
    [onDone],
  );

  // Start: on the first visit of the session, or whenever the intro is replayed.
  useEffect(() => {
    const armed = introArmed();
    if (run === 0 && !armed) return;
    markSeen();
    const id = window.setTimeout(() => {
      // Re-arming restarts the drawing animations for a replay.
      if (!introArmed()) document.documentElement.classList.add("intro-on");
      setGone(false);
      setForced(false);
      setPhase("play");
    }, 20);
    timers.current.push(id);
    return () => {
      timers.current.forEach((x) => window.clearTimeout(x));
      timers.current = [];
    };
  }, [run]);

  // Auto-finish. Under reduced motion the wordmark and language chips simply hold.
  useEffect(() => {
    if (phase !== "play") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = window.setTimeout(() => leave(false), reduced ? REDUCED_MS : INTRO_MS);
    timers.current.push(id);
    return () => window.clearTimeout(id);
  }, [phase, leave]);

  // Skippable by button, key press, scroll or tap.
  useEffect(() => {
    if (phase !== "play") return;
    const skip = () => leave(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab") return; // keep keyboard navigation alive
      skip();
    };
    const onScroll = () => skip();
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onScroll, { passive: true });
    window.addEventListener("touchstart", skip, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", onScroll);
      window.removeEventListener("touchstart", skip);
    };
  }, [phase, leave]);

  // Continue in the device language when the visitor does nothing.
  useEffect(() => {
    if (phase !== "play") return;
    const device = typeof navigator !== "undefined" ? navigator.language.toLowerCase() : "en";
    if (device.startsWith("hi")) setLang("hi");
  }, [phase, setLang]);

  if (gone) return null;

  const pick = (next: "en" | "hi") => {
    setLang(next);
    leave(true);
  };

  return (
    <div
      className={`intro-root ${phase === "leave" ? "intro-leaving" : ""} ${forced ? "intro-fast" : ""}`}
      role="dialog"
      aria-modal="false"
      aria-label={t("intro.markName")}
    >
      {/* The map draws itself, then hands over to the hero canvas. */}
      <div className="intro-map">
        <WardSvg intro />
        <svg
          viewBox="0 0 1600 900"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <g transform="translate(1023 386)">
            <g className="intro-pin">
              <Pin category="pothole" tone="medium" size={34} />
            </g>
          </g>
          <circle className="intro-ripple" cx="1040" cy="428" r="12" />
        </svg>
      </div>

      <div className="intro-veil" />

      <div className="intro-brand">
        <span className="intro-mark" aria-hidden="true" />
        <p className="intro-wordmark">{lang === "hi" ? "समाधान" : "Samadhan"}</p>
        <p className="intro-deva" lang="hi">
          समाधान
        </p>
        <p className="intro-tagline">{t("intro.tagline")}</p>
      </div>

      {/* First-visit language chooser. */}
      <div className="intro-lang" onClick={(e) => e.stopPropagation()}>
        <p className="intro-lang-label">{t("intro.langPrompt")}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => pick("en")} className="intro-chip" lang="en">
            English
          </button>
          <button type="button" onClick={() => pick("hi")} className="intro-chip" lang="hi">
            हिन्दी
          </button>
        </div>
      </div>

      <button type="button" onClick={() => leave(true)} className="intro-skip">
        {t("intro.skip")}
      </button>
    </div>
  );
}
