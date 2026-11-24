"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { KEYS, readString, writeString } from "@/lib/storage";

export type ThemeChoice = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const ORDER: ThemeChoice[] = ["system", "light", "dark"];
const META_LIGHT = "#eaeff3";
const META_DARK = "#0d151c";

type ThemeContextValue = {
  choice: ThemeChoice;
  resolved: ResolvedTheme;
  setChoice: (choice: ThemeChoice) => void;
  cycle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Applies a choice to <html>: explicit choices set data-theme, System clears it so the
// prefers-color-scheme media query drives the tokens. Also sets color-scheme and the meta theme-color.
function applyTheme(choice: ThemeChoice, systemDark: boolean): ResolvedTheme {
  const resolved: ResolvedTheme = choice === "system" ? (systemDark ? "dark" : "light") : choice;
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
  root.style.colorScheme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", resolved === "dark" ? META_DARK : META_LIGHT);
  return resolved;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Starts as System so server and client markup match; the saved choice applies after mount.
  const [choice, setChoiceState] = useState<ThemeChoice>("system");
  const [resolved, setResolved] = useState<ResolvedTheme>("light");

  const enableTransition = useCallback(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;
    root.classList.add("theme-anim");
    window.setTimeout(() => root.classList.remove("theme-anim"), 260);
  }, []);

  useEffect(() => {
    const saved = readString(KEYS.theme);
    const initial: ThemeChoice = saved === "light" || saved === "dark" ? saved : "system";
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    // The inline boot script has already applied the theme to <html>; this reconciles
    // React state a tick later so the effect does not set state synchronously.
    const restore = window.setTimeout(() => {
      setChoiceState(initial);
      setResolved(applyTheme(initial, media.matches));
    }, 0);

    // System follows the device setting live, with no transition on the first load.
    const onSystemChange = (event: MediaQueryListEvent) => {
      setChoiceState((current) => {
        if (current !== "system") return current;
        setResolved(applyTheme("system", event.matches));
        return current;
      });
    };
    media.addEventListener("change", onSystemChange);
    return () => {
      window.clearTimeout(restore);
      media.removeEventListener("change", onSystemChange);
    };
  }, []);

  const setChoice = useCallback(
    (next: ThemeChoice) => {
      enableTransition();
      setChoiceState(next);
      writeString(KEYS.theme, next);
      setResolved(applyTheme(next, window.matchMedia("(prefers-color-scheme: dark)").matches));
    },
    [enableTransition],
  );

  const cycle = useCallback(() => {
    setChoiceState((current) => {
      const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
      enableTransition();
      writeString(KEYS.theme, next);
      setResolved(applyTheme(next, window.matchMedia("(prefers-color-scheme: dark)").matches));
      return next;
    });
  }, [enableTransition]);

  const value = useMemo<ThemeContextValue>(() => ({ choice, resolved, setChoice, cycle }), [choice, resolved, setChoice, cycle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
