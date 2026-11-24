"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";
import { useLang } from "@/components/lang-provider";
import { useTheme, type ThemeChoice } from "@/components/theme-provider";
import type { Key } from "@/lib/i18n";

const NEXT: Record<ThemeChoice, ThemeChoice> = { system: "light", light: "dark", dark: "system" };
const CHOICE_KEY: Record<ThemeChoice, Key> = { system: "theme.system", light: "theme.light", dark: "theme.dark" };

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4.4" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.9 1.9M16.8 16.8l1.9 1.9M18.7 5.3l-1.9 1.9M7.2 16.8l-1.9 1.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" fill="currentColor" />
    </svg>
  );
}

function SystemIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M9 20h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// Anchored chrome: wordmark, nav, progress, skip link, EN | हिं, theme toggle and the account button.
export function SiteHeader({ idx }: { idx: number }): ReactNode {
  const { lang, t, toggleLang } = useLang();
  const { choice, cycle } = useTheme();
  const { session, isCitizen, isOfficer, openLogin, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Publish the header height so the stage and sections can offset themselves.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () => document.documentElement.style.setProperty("--hdr", `${el.offsetHeight}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Close the avatar menu on an outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const progressNumber = String(idx + 1).padStart(2, "0");
  const next = NEXT[choice];
  const initials = (session?.displayName ?? "S")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header ref={ref} className="fixed inset-x-0 top-0 z-50 border-b border-[var(--rule)] bg-[var(--paper)]">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 md:h-[60px] md:flex-nowrap md:px-8">
        <a href="#" className="flex min-h-11 items-center gap-2.5" aria-label="Samadhan, top of page">
          <span className="mark" aria-hidden="true" />
          <span className="flex items-baseline gap-2">
            <span className="brand">Samadhan</span>
            <span className="deva" lang="hi">
              {t("brand.deva")}
            </span>
          </span>
        </a>

        <nav aria-label="Primary" className="flex items-center gap-0.5 md:ml-3 md:gap-2">
          <a href="#live-map" className="nav-link">
            {t("nav.live")}
          </a>
          <a href="#report" className="nav-link">
            {t("nav.report")}
          </a>
          <a href="#ward-stats" className="nav-link">
            {t("nav.stats")}
          </a>
        </nav>

        <div className="ml-auto flex items-center gap-2 md:gap-3">
          <div className="flex items-center gap-2" aria-label={t("progress.label", { n: idx + 1 })}>
            <span className="num text-sm font-bold text-[var(--ink)]">{progressNumber} / 06</span>
            <span className="hidden gap-1 sm:flex" aria-hidden="true">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <span key={i} className={`seg-bar ${i <= idx ? "on" : ""}`} />
              ))}
            </span>
          </div>
          <a href="#app" className="skip hidden md:inline-flex">
            {t("skip")}
          </a>
          <button
            type="button"
            onClick={toggleLang}
            className="lang-toggle"
            aria-label={lang === "en" ? t("lang.toHindi") : t("lang.toEnglish")}
          >
            <span className={lang === "en" ? "on" : ""}>EN</span>
            <span aria-hidden="true">|</span>
            <span lang="hi" className={lang === "hi" ? "on" : ""}>
              हिं
            </span>
          </button>
          <button
            type="button"
            onClick={cycle}
            className="theme-toggle"
            aria-label={t("theme.cycle", { current: t(CHOICE_KEY[choice]), next: t(CHOICE_KEY[next]) })}
            title={t(CHOICE_KEY[choice])}
          >
            {choice === "light" ? <SunIcon /> : choice === "dark" ? <MoonIcon /> : <SystemIcon />}
            <span className="hidden text-xs sm:inline">{t(CHOICE_KEY[choice])}</span>
          </button>

          {/* Log in becomes an avatar menu once there is a session. */}
          {session ? (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className="flex h-11 w-11 items-center justify-center border-2 border-[var(--ink)] bg-[var(--signal)] text-sm font-bold text-[#12202c]"
              >
                {initials}
              </button>
              {menuOpen && (
                <div role="menu" className="absolute right-0 top-[calc(100%+8px)] z-50 w-60 border-2 border-[var(--ink)] bg-[var(--surface)]">
                  <div className="border-b border-[var(--rule)] px-4 py-3">
                    <p className="truncate font-bold text-[var(--ink)]">{session.displayName}</p>
                    <p className="truncate text-xs text-[var(--ink-mute)]">
                      {isOfficer ? t("menu.console") : t("menu.dashboard")}
                    </p>
                  </div>
                  {isCitizen && (
                    <a
                      role="menuitem"
                      href="#my-dashboard"
                      onClick={() => setMenuOpen(false)}
                      className="flex min-h-11 items-center px-4 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--paper)]"
                    >
                      {t("menu.dashboard")}
                    </a>
                  )}
                  {isOfficer && (
                    <a
                      role="menuitem"
                      href="#officer-console"
                      onClick={() => setMenuOpen(false)}
                      className="flex min-h-11 items-center px-4 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--paper)]"
                    >
                      {t("menu.console")}
                    </a>
                  )}
                  <a
                    role="menuitem"
                    href="#ward-stats"
                    onClick={() => setMenuOpen(false)}
                    className="flex min-h-11 items-center px-4 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--paper)]"
                  >
                    {t("menu.settings")}
                  </a>
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      logout();
                    }}
                    className="flex min-h-11 w-full items-center border-t border-[var(--rule)] px-4 text-left text-sm font-bold text-[var(--ink)] hover:bg-[var(--paper)]"
                  >
                    {t("menu.logout")}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => openLogin()}>
              {t("login.logIn")}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
