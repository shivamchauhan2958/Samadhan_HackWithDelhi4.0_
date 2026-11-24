// Defensive localStorage access: private browsing, quota errors and disabled storage must never break the app.
export const KEYS = {
  lang: "samadhan.lang.v1",
  theme: "samadhan.theme.v2",
  reports: "samadhan.reports.v2",
  events: "samadhan.events.v2",
  pending: "samadhan.pending.v2",
  sms: "samadhan.sms.v3",
  voter: "samadhan.voter.v1",
  voted: "samadhan.voted.v1",
  officer: "samadhan.officer.v1",
} as const;

export function readJSON<T>(key: string, fallback: T): T {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown) {
  try {
    if (typeof window === "undefined") return false;
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function readString(key: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeString(key: string, value: string) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore quota or privacy-mode errors */
  }
}

export function newId(prefix = "WR14") {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "X");
  return `${prefix}-${Date.now().toString(36).slice(-4).toUpperCase()}${rand.slice(0, 2)}`;
}

export function voterId() {
  const existing = readString(KEYS.voter);
  if (existing && /^[A-Za-z0-9-]{6,64}$/.test(existing)) return existing;
  const fresh = `v-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
  writeString(KEYS.voter, fresh);
  return fresh;
}
