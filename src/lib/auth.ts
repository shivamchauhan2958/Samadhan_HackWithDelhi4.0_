import { KEYS, readJSON, writeJSON } from "@/lib/storage";

// SIMULATED AUTHENTICATION. No real SMS is sent and no password is stored anywhere
// beyond the demo constants below. This is a prototype, not a security boundary.

export type Role = "citizen" | "officer";

export type Session = {
  role: Role;
  displayName: string;
  phone?: string; // citizens
  officerId?: string; // officers
  team?: string;
};

export type PendingAction =
  | { kind: "report" }
  | { kind: "vote"; id: string }
  | { kind: "confirm"; id: string }
  | { kind: "reopen"; id: string }
  | { kind: "my-dashboard" }
  | { kind: "officer-console" };

export const SESSION_KEY = "samadhan.session.v3";
export const PROFILES_KEY = "samadhan.profiles.v3";

// Demo constants. The officer password lives here and nowhere else.
export const DEMO_OTP = "123456";
export const DEMO_CITIZEN = { name: "Meera Gupta", phone: "9876543210" };
export const DEMO_OFFICER = { name: "Rakesh Sharma", officerId: "W14-JE-104", password: "ward14demo", post: "Junior Engineer" };

export const OFFICER_TEAMS = ["roads", "sanitation", "electrical", "water"] as const;
export type Team = (typeof OFFICER_TEAMS)[number];

// The team that normally handles each category. Used to auto-suggest an assignment.
export const TEAM_FOR_CATEGORY: Record<string, Team> = {
  pothole: "roads",
  garbage: "sanitation",
  streetlight: "electrical",
  water: "water",
};

export function readSession(): Session | null {
  const s = readJSON<Session | null>(SESSION_KEY, null);
  if (!s || (s.role !== "citizen" && s.role !== "officer")) return null;
  return s;
}

export function writeSession(session: Session | null) {
  if (session === null) {
    try {
      if (typeof window !== "undefined") window.localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    return;
  }
  writeJSON(SESSION_KEY, session);
}

// Known citizens, so a returning visitor is not asked for their name again.
export function readProfiles(): Record<string, string> {
  return readJSON<Record<string, string>>(PROFILES_KEY, {});
}

export function saveProfile(phone: string, name: string) {
  const profiles = readProfiles();
  profiles[phone] = name;
  writeJSON(PROFILES_KEY, profiles);
}

// Public view never shows the reporter. The owner sees only a masked number.
export function maskPhone(phone: string) {
  if (phone.length < 6) return "••••••";
  return `${phone.slice(0, 2)}•••••${phone.slice(-3)}`;
}

export function normalisePhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  return digits.slice(-10);
}

export function isValidPhone(phone: string) {
  return /^[6-9]\d{9}$/.test(phone);
}

export function officerCredentialsValid(id: string, password: string) {
  return id.trim().toUpperCase() === DEMO_OFFICER.officerId && password === DEMO_OFFICER.password;
}
