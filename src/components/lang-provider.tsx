"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { translate, type Key, type Lang } from "@/lib/i18n";
import { KEYS, readString, writeString } from "@/lib/storage";

type LangContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  t: (key: Key, vars?: Record<string, string | number>) => string;
};

const LangContext = createContext<LangContextValue | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  // Always starts in English so server and client markup match; the saved choice applies after mount.
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const saved = readString(KEYS.lang);
    // Applied after mount so server and client markup match, and deferred by a tick so
    // the effect does not set state synchronously.
    const id = window.setTimeout(() => {
      if (saved === "hi" || saved === "en") setLangState(saved);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    writeString(KEYS.lang, next);
  }, []);

  const toggleLang = useCallback(() => {
    setLangState((prev) => {
      const next: Lang = prev === "en" ? "hi" : "en";
      writeString(KEYS.lang, next);
      return next;
    });
  }, []);

  const value = useMemo<LangContextValue>(
    () => ({
      lang,
      setLang,
      toggleLang,
      t: (key, vars) => translate(lang, key, vars),
    }),
    [lang, setLang, toggleLang],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used inside LangProvider");
  return ctx;
}
