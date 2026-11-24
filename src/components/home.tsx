"use client";

import { useState, type ReactNode } from "react";
import { AppShell } from "@/components/app/app-shell";
import { Toaster } from "@/components/app/toaster";
import { IntroOverlay } from "@/components/intro/intro-overlay";
import { ScrollStage } from "@/components/scroll/scroll-stage";
import { SiteHeader } from "@/components/site-header";
import { useLang } from "@/components/lang-provider";

// One website: the opening, then the scroll story, then the working app.
export function Home(): ReactNode {
  const { t } = useLang();
  const [idx, setIdx] = useState(0);
  const [introRun, setIntroRun] = useState(0);

  return (
    <>
      <SiteHeader idx={idx} />
      <main>
        <ScrollStage onStateChange={setIdx} />
        <AppShell />
      </main>
      <Toaster />

      {/* State 00 plays on top of the loaded page, once per session. */}
      <IntroOverlay run={introRun} onDone={() => undefined} />

      <footer className="border-t border-[var(--rule)] px-4 py-10 md:px-8">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="mark" aria-hidden="true" />
            <span className="text-sm font-bold text-[var(--ink)]">
              Samadhan <span className="deva" lang="hi">समाधान</span>
            </span>
          </div>
          <p className="text-xs text-[var(--ink-mute)]">
            {t("login.simulated")}
          </p>
          <button
            type="button"
            onClick={() => setIntroRun((n) => n + 1)}
            className="text-sm font-bold text-[var(--ink)] underline underline-offset-4"
          >
            {t("intro.replay")}
          </button>
        </div>
      </footer>
    </>
  );
}
