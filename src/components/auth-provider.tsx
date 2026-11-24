"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { LoginPanel } from "@/components/auth/login-panel";
import {
  DEMO_CITIZEN,
  DEMO_OFFICER,
  DEMO_OTP,
  normalisePhone,
  officerCredentialsValid,
  readSession,
  saveProfile,
  writeSession,
  type PendingAction,
  type Role,
  type Session,
} from "@/lib/auth";

type AuthContextValue = {
  session: Session | null;
  isCitizen: boolean;
  isOfficer: boolean;
  loginOpen: boolean;
  pending: PendingAction | null;
  openLogin: (pending?: PendingAction) => void;
  closeLogin: () => void;
  logout: () => void;
  /** Runs the action the visitor attempted, once they are signed in. */
  resume: (action: PendingAction) => void;
  setResumeHandler: (fn: ((action: PendingAction, session: Session) => void) | null) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [resumeHandler, setResumeHandler] = useState<((action: PendingAction, session: Session) => void) | null>(null);

  // Restore the saved session after mount so server and client markup match.
  useEffect(() => {
    const saved = readSession();
    if (saved) {
      const id = window.setTimeout(() => setSession(saved), 0);
      return () => window.clearTimeout(id);
    }
  }, []);

  const signIn = useCallback(
    (next: Session, action: PendingAction | null) => {
      setSession(next);
      writeSession(next);
      setLoginOpen(false);
      if (action && resumeHandler) {
        // Let the panel close before the interrupted action runs.
        window.setTimeout(() => resumeHandler(action, next), 0);
      }
      setPending(null);
    },
    [resumeHandler],
  );

  const openLogin = useCallback((action?: PendingAction) => {
    setPending(action ?? null);
    setLoginOpen(true);
  }, []);

  const closeLogin = useCallback(() => {
    setLoginOpen(false);
    setPending(null);
  }, []);

  const logout = useCallback(() => {
    setSession(null);
    writeSession(null);
  }, []);

  const resume = useCallback((action: PendingAction) => {
    setPending(action);
    setLoginOpen(true);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isCitizen: session?.role === "citizen",
      isOfficer: session?.role === "officer",
      loginOpen,
      pending,
      openLogin,
      closeLogin,
      logout,
      resume,
      setResumeHandler,
    }),
    [session, loginOpen, pending, openLogin, closeLogin, logout, resume],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <LoginPanel
        open={loginOpen}
        pending={pending}
        onClose={closeLogin}
        onSignIn={signIn}
        demoOtp={DEMO_OTP}
        demoCitizen={DEMO_CITIZEN}
        demoOfficer={DEMO_OFFICER}
        normalisePhone={normalisePhone}
        officerCredentialsValid={officerCredentialsValid}
        saveProfile={saveProfile}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export type { PendingAction, Role, Session };
