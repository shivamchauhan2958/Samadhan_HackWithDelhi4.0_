"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLang } from "@/components/lang-provider";
import { notify } from "@/components/app/toaster";
import type { PendingAction, Session } from "@/lib/auth";
import { readProfiles } from "@/lib/auth";
import { otpMessage, pushLocalSms } from "@/lib/sms";

type Props = {
  open: boolean;
  pending: PendingAction | null;
  onClose: () => void;
  onSignIn: (session: Session, pending: PendingAction | null) => void;
  demoOtp: string;
  demoCitizen: { name: string; phone: string };
  demoOfficer: { name: string; officerId: string; password: string; post: string };
  normalisePhone: (raw: string) => string;
  officerCredentialsValid: (id: string, password: string) => boolean;
  saveProfile: (phone: string, name: string) => void;
};

// Login panel: a modal on desktop, a full screen on mobile. Two roles, one form each.
export function LoginPanel({
  open,
  pending,
  onClose,
  onSignIn,
  demoOtp,
  demoCitizen,
  demoOfficer,
  normalisePhone,
  officerCredentialsValid,
  saveProfile,
}: Props) {
  const { t, lang } = useLang();
  const [role, setRole] = useState<"citizen" | "officer">("citizen");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [officerId, setOfficerId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  // Reset the form each time the panel opens.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      setRole("citizen");
      setStep("phone");
      setPhone("");
      setOtp("");
      setError(null);
      setOtpSent(false);
      const known = readProfiles();
      firstFieldRef.current?.focus();
      void known;
    }, 0);
    return () => window.clearTimeout(id);
  }, [open]);

  // Escape closes the panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const sendOtp = (e: FormEvent) => {
    e.preventDefault();
    const digits = normalisePhone(phone);
    if (!/^[6-9]\d{9}$/.test(digits)) {
      setError(t("login.errPhone"));
      return;
    }
    setError(null);
    setStep("otp");
    setOtpSent(true);
    // The mock OTP also lands in the SMS inbox, so the flow is visible end to end.
    pushLocalSms(otpMessage(demoOtp, lang));
    notify(t("login.otpSent"));
  };

  const verifyOtp = (e: FormEvent) => {
    e.preventDefault();
    if (otp.trim() !== demoOtp) {
      setError(t("login.errOtp"));
      return;
    }
    const digits = normalisePhone(phone);
    const profiles = readProfiles();
    const knownName = profiles[digits];
    const display = name.trim() || knownName || "";
    if (display) saveProfile(digits, display);
    onSignIn(
      { role: "citizen", displayName: display || t("login.tabCitizen"), phone: digits },
      pending,
    );
  };

  const officerSignIn = (e: FormEvent) => {
    e.preventDefault();
    if (!officerCredentialsValid(officerId, password)) {
      setError(t("login.errCreds"));
      return;
    }
    setError(null);
    onSignIn(
      { role: "officer", displayName: demoOfficer.name, officerId: demoOfficer.officerId, team: "ward14" },
      pending,
    );
  };

  const useDemoCitizen = () => {
    const digits = normalisePhone(demoCitizen.phone);
    saveProfile(digits, demoCitizen.name);
    onSignIn({ role: "citizen", displayName: demoCitizen.name, phone: digits }, pending);
  };

  const useDemoOfficer = () => {
    onSignIn(
      { role: "officer", displayName: demoOfficer.name, officerId: demoOfficer.officerId, team: "ward14" },
      pending,
    );
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[var(--ink)]/55 p-0 md:items-center md:p-6">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
        className="max-h-[100svh] w-full overflow-y-auto border-t-2 border-[var(--ink)] bg-[var(--paper)] md:max-w-lg md:border-2"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--rule)] p-5">
          <div>
            <h2 id="login-title" className="display-sm">
              {t("login.title")}
            </h2>
            <p className="mt-2 text-sm text-[var(--ink-soft)]">{t("login.lead")}</p>
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm shrink-0">
            {t("login.close")}
          </button>
        </div>

        <div className="p-5">
          {/* Role switch */}
          <div role="tablist" aria-label={t("login.title")} className="seg w-full">
            <button
              type="button"
              role="tab"
              aria-selected={role === "citizen"}
              onClick={() => {
                setRole("citizen");
                setError(null);
              }}
              className={`seg-item flex-1 justify-center ${role === "citizen" ? "seg-on" : ""}`}
            >
              {t("login.tabCitizen")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={role === "officer"}
              onClick={() => {
                setRole("officer");
                setError(null);
              }}
              className={`seg-item flex-1 justify-center ${role === "officer" ? "seg-on" : ""}`}
            >
              {t("login.tabOfficer")}
            </button>
          </div>

          {pending && (
            <p className="mt-4 border-l-2 border-[var(--signal)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--ink)]">
              {t("auth.required")}
            </p>
          )}

          <div className="mt-5">
            {role === "citizen" ? (
              step === "phone" ? (
                <form onSubmit={sendOtp}>
                  <label htmlFor="login-phone" className="block text-sm font-bold text-[var(--ink)]">
                    {t("login.mobile")}
                  </label>
                  <div className="mt-2 flex items-stretch">
                    <span className="flex items-center border-2 border-r-0 border-[var(--ink)] bg-[var(--surface)] px-3 text-sm font-bold text-[var(--ink)]">
                      +91
                    </span>
                    <input
                      ref={firstFieldRef}
                      id="login-phone"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      maxLength={10}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      placeholder={t("login.mobilePh")}
                      aria-invalid={Boolean(error)}
                      className="num min-w-0 flex-1 border-2 border-[var(--ink)] bg-[var(--surface)] px-3 py-3 text-[var(--ink)] placeholder:text-[var(--ink-mute)]"
                    />
                  </div>
                  {error && (
                    <p role="alert" className="mt-2 text-sm font-semibold text-[var(--high)]">
                      {error}
                    </p>
                  )}
                  <button type="submit" className="btn btn-primary mt-4 w-full">
                    {t("login.sendOtp")}
                  </button>
                </form>
              ) : (
                <form onSubmit={verifyOtp}>
                  <label htmlFor="login-otp" className="block text-sm font-bold text-[var(--ink)]">
                    {t("login.otp")}
                  </label>
                  <input
                    id="login-otp"
                    ref={firstFieldRef}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    aria-invalid={Boolean(error)}
                    className="num mt-2 w-full border-2 border-[var(--ink)] bg-[var(--surface)] px-3 py-3 text-center text-2xl tracking-[0.4em] text-[var(--ink)]"
                  />
                  <p className="mt-2 text-sm font-bold text-[var(--ink-mute)]">{t("login.otpHint")}</p>
                  {error && (
                    <p role="alert" className="mt-2 text-sm font-semibold text-[var(--high)]">
                      {error}
                    </p>
                  )}

                  {!readProfiles()[normalisePhone(phone)] && (
                    <>
                      <label htmlFor="login-name" className="mt-4 block text-sm font-bold text-[var(--ink)]">
                        {t("login.name")}
                      </label>
                      <input
                        id="login-name"
                        type="text"
                        autoComplete="name"
                        maxLength={60}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t("login.namePh")}
                        className="mt-2 w-full border-2 border-[var(--ink)] bg-[var(--surface)] px-3 py-3 text-[var(--ink)] placeholder:text-[var(--ink-mute)]"
                      />
                    </>
                  )}

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button type="submit" className="btn btn-primary flex-1">
                      {t("login.verify")}
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => setStep("phone")}>
                      {t("login.back")}
                    </button>
                  </div>
                </form>
              )
            ) : (
              <form onSubmit={officerSignIn}>
                <label htmlFor="login-officer-id" className="block text-sm font-bold text-[var(--ink)]">
                  {t("login.officerId")}
                </label>
                <input
                  ref={firstFieldRef}
                  id="login-officer-id"
                  type="text"
                  autoComplete="username"
                  value={officerId}
                  onChange={(e) => setOfficerId(e.target.value)}
                  placeholder={t("login.officerIdPh")}
                  aria-invalid={Boolean(error)}
                  className="mt-2 w-full border-2 border-[var(--ink)] bg-[var(--surface)] px-3 py-3 text-[var(--ink)] placeholder:text-[var(--ink-mute)]"
                />

                <label htmlFor="login-password" className="mt-4 block text-sm font-bold text-[var(--ink)]">
                  {t("login.password")}
                </label>
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={Boolean(error)}
                  className="mt-2 w-full border-2 border-[var(--ink)] bg-[var(--surface)] px-3 py-3 text-[var(--ink)]"
                />
                {error && (
                  <p role="alert" className="mt-2 text-sm font-semibold text-[var(--high)]">
                    {error}
                  </p>
                )}
                <button type="submit" className="btn btn-primary mt-4 w-full">
                  {t("login.logIn")}
                </button>
              </form>
            )}
          </div>

          {/* One-tap demo shortcuts for judges */}
          <div className="mt-6 border-t border-[var(--rule)] pt-5">
            <p className="kicker">{t("login.tabOfficer")} · {lang === "hi" ? "डेमो" : "Demo"}</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={useDemoCitizen} className="btn btn-ghost btn-sm flex-1">
                {t("login.demoCitizen")}
              </button>
              <button type="button" onClick={useDemoOfficer} className="btn btn-ghost btn-sm flex-1">
                {t("login.demoOfficer")}
              </button>
            </div>
            <p className="num mt-3 text-xs text-[var(--ink-mute)]">{t("login.demoCreds")}</p>
            <p className="mt-2 text-xs leading-relaxed text-[var(--ink-mute)]">{t("login.simulated")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
