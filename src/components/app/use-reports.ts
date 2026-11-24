"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildSeed } from "@/lib/seed";
import { KEYS, readJSON, voterId, writeJSON } from "@/lib/storage";
import type { Team } from "@/lib/auth";
import { VERIFY_AT, type EventKind, type ReportEvent, type ReportView } from "@/lib/ward";

export type SyncState = "loading" | "live" | "offline";
export type VoteResult = "counted" | "already" | "closed" | "missing";
export type ActionResult = "ok" | "queued" | "rejected" | "missing";

// Offline-first: every change applies locally at once, queues in localStorage, and syncs
// when the ward API answers. 5xx and network failures keep the operation queued.
type Pending =
  | { kind: "create"; report: ReportView }
  | { kind: "vote"; id: string; voter: string }
  | { kind: "assign"; id: string; team: Team | null }
  | { kind: "resolve"; id: string; afterPhoto: string }
  | { kind: "confirm"; id: string }
  | { kind: "reopen"; id: string };

const TIMEOUT_MS = 8000;
const POLL_MS = 20000;

async function request(url: string, init?: RequestInit, phone?: string | null) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const headers = new Headers(init?.headers);
    if (phone) headers.set("x-samadhan-phone", phone);
    return await fetch(url, { ...init, headers, signal: controller.signal, cache: "no-store" });
  } finally {
    window.clearTimeout(timer);
  }
}

async function send(op: Pending, phone?: string | null) {
  const json = { "Content-Type": "application/json" };
  if (op.kind === "create") {
    const r = op.report;
    return request(
      "/api/reports",
      {
        method: "POST",
        headers: json,
        body: JSON.stringify({
          id: r.id,
          category: r.category,
          x: r.x,
          y: r.y,
          description: r.description,
          photo: r.photo ?? undefined,
          reporterName: r.reporterName ?? undefined,
          // The reporter's phone comes from the session, never from the stored report.
          reporterPhone: phone ?? undefined,
        }),
      },
      phone,
    );
  }
  const bodies: Record<string, unknown> = {
    vote: { action: "vote", voterId: op.kind === "vote" ? op.voter : undefined },
    assign: { action: "assign", team: op.kind === "assign" ? op.team : undefined },
    resolve: { action: "resolve", afterPhoto: op.kind === "resolve" ? op.afterPhoto : undefined },
    confirm: { action: "confirm" },
    reopen: { action: "reopen" },
  };
  return request(
    `/api/reports/${encodeURIComponent(op.id)}`,
    { method: "PATCH", headers: json, body: JSON.stringify(bodies[op.kind]) },
    phone,
  );
}

function localEventId() {
  return -Date.now() - Math.floor(Math.random() * 100);
}

function event(reportId: string, kind: EventKind, extra: Partial<ReportEvent> = {}): ReportEvent {
  return { id: localEventId(), reportId, kind, level: null, at: new Date().toISOString(), ...extra };
}

export function useReports(phone?: string | null) {
  const [reports, setReports] = useState<ReportView[]>([]);
  const [events, setEvents] = useState<ReportEvent[]>([]);
  const [ready, setReady] = useState(false);
  const [sync, setSync] = useState<SyncState>("loading");
  const [pendingCount, setPendingCount] = useState(0);
  const pendingRef = useRef<Pending[]>([]);
  const flushingRef = useRef<Promise<boolean> | null>(null);
  const reportsRef = useRef<ReportView[]>([]);
  const phoneRef = useRef<string | null>(phone ?? null);

  // Mirrored in effects so the refs are never written during render.
  useEffect(() => {
    reportsRef.current = reports;
  }, [reports]);
  useEffect(() => {
    phoneRef.current = phone ?? null;
  }, [phone]);

  const savePending = useCallback(() => {
    writeJSON(KEYS.pending, pendingRef.current);
    setPendingCount(pendingRef.current.length);
  }, []);

  const runQueue = useCallback(async (): Promise<boolean> => {
    try {
      while (pendingRef.current.length > 0) {
        const res = await send(pendingRef.current[0], phoneRef.current);
        if (res.status >= 500) throw new Error("server");
        pendingRef.current = pendingRef.current.slice(1);
        savePending();
      }
      setSync("live");
      return true;
    } catch {
      setSync("offline");
      return false;
    }
  }, [savePending]);

  const flush = useCallback((): Promise<boolean> => {
    if (flushingRef.current) return flushingRef.current;
    const p = runQueue();
    flushingRef.current = p;
    void p.finally(() => {
      if (flushingRef.current === p) flushingRef.current = null;
    });
    return p;
  }, [runQueue]);

  const refresh = useCallback(async () => {
    const ok = await flush();
    if (!ok) return;
    try {
      const res = await request("/api/reports", undefined, phoneRef.current);
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { reports: ReportView[]; events: ReportEvent[] };
      setReports(data.reports);
      setEvents(data.events);
      setSync("live");
    } catch {
      setSync("offline");
    }
  }, [flush]);

  // Boot: cache first for an instant paint, then reconcile with the ward server.
  useEffect(() => {
    const cachedReports = readJSON<ReportView[]>(KEYS.reports, []);
    const cachedEvents = readJSON<ReportEvent[]>(KEYS.events, []);
    pendingRef.current = readJSON<Pending[]>(KEYS.pending, []);
    setPendingCount(pendingRef.current.length);
    if (cachedReports.length > 0) {
      setReports(cachedReports);
      setEvents(cachedEvents);
    } else {
      const seed = buildSeed(Date.now());
      setReports(seed.reports);
      setEvents(seed.events);
    }
    setReady(true);
    void refresh();
    const onOnline = () => void refresh();
    const timer = window.setInterval(() => {
      if (pendingRef.current.length > 0) void refresh();
    }, POLL_MS);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.clearInterval(timer);
    };
  }, [refresh]);

  // A new session changes what is "mine", so the list is fetched again.
  useEffect(() => {
    if (!ready) return;
    const id = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(id);
  }, [phone, ready, refresh]);

  // Cache without photos so localStorage stays small.
  useEffect(() => {
    if (!ready) return;
    const strip = (r: ReportView) => ({
      ...r,
      photo: r.photo?.startsWith("data:") ? null : r.photo,
      afterPhoto: r.afterPhoto?.startsWith("data:") ? null : r.afterPhoto,
    });
    writeJSON(KEYS.reports, reports.map(strip));
    writeJSON(KEYS.events, events.slice(0, 80));
  }, [reports, events, ready]);

  const enqueue = (op: Pending): Promise<boolean> => {
    pendingRef.current = [...pendingRef.current, op];
    savePending();
    return flush();
  };

  const apply = (id: string, patch: (r: ReportView) => ReportView) => {
    setReports((prev) => prev.map((r) => (r.id === id ? patch(r) : r)));
  };

  const vote = (id: string): VoteResult => {
    const target = reportsRef.current.find((r) => r.id === id);
    if (!target) return "missing";
    if (target.status === "resolved") return "closed";
    // One person cannot verify the same report twice.
    const voted = readJSON<string[]>(KEYS.voted, []);
    if (voted.includes(id)) return "already";
    writeJSON(KEYS.voted, [...voted, id]);
    const promote = target.status === "reported" && target.votes + 1 >= VERIFY_AT;
    apply(id, (r) => ({
      ...r,
      votes: r.votes + 1,
      status: promote ? "verified" : r.status,
      verifiedAt: promote ? new Date().toISOString() : r.verifiedAt,
    }));
    if (promote) setEvents((prev) => [event(id, "verified"), ...prev]);
    void enqueue({ kind: "vote", id, voter: voterId() });
    return "counted";
  };

  const assign = (id: string, team?: Team | null): ActionResult => {
    const target = reportsRef.current.find((r) => r.id === id);
    if (!target) return "missing";
    if (target.status === "resolved" || target.status === "assigned") return "rejected";
    const at = new Date().toISOString();
    const wasReported = target.status === "reported";
    apply(id, (r) => ({
      ...r,
      status: "assigned",
      assignedAt: at,
      team: team ?? r.team,
      assignedTeam: team ?? r.assignedTeam,
      verifiedAt: wasReported ? at : r.verifiedAt,
    }));
    if (wasReported) setEvents((prev) => [event(id, "verified"), ...prev]);
    setEvents((prev) => [event(id, "assigned"), ...prev]);
    void enqueue({ kind: "assign", id, team: team ?? null });
    return "ok";
  };

  const resolve = (id: string, afterPhoto: string): ActionResult => {
    const target = reportsRef.current.find((r) => r.id === id);
    if (!target) return "missing";
    if (target.status !== "assigned") return "rejected";
    const at = new Date().toISOString();
    apply(id, (r) => ({ ...r, status: "resolved", resolvedAt: at, afterPhoto, resolution: "pending" }));
    setEvents((prev) => [event(id, "resolved"), ...prev]);
    void enqueue({ kind: "resolve", id, afterPhoto });
    return "ok";
  };

  const confirm = (id: string): ActionResult => {
    const target = reportsRef.current.find((r) => r.id === id);
    if (!target) return "missing";
    if (target.status !== "resolved" || target.resolution !== "pending") return "rejected";
    apply(id, (r) => ({ ...r, resolution: "confirmed", confirmedAt: new Date().toISOString() }));
    setEvents((prev) => [event(id, "confirmed"), ...prev]);
    void enqueue({ kind: "confirm", id });
    return "ok";
  };

  const reopen = (id: string): ActionResult => {
    const target = reportsRef.current.find((r) => r.id === id);
    if (!target) return "missing";
    if (target.status !== "resolved" || target.resolution !== "pending") return "rejected";
    apply(id, (r) => ({
      ...r,
      status: "assigned",
      resolution: "reopened",
      reopenCount: r.reopenCount + 1,
      reopenedAt: new Date().toISOString(),
      resolvedAt: null,
    }));
    setEvents((prev) => [event(id, "reopened"), ...prev]);
    void enqueue({ kind: "reopen", id });
    return "ok";
  };

  const create = async (report: ReportView): Promise<boolean> => {
    setReports((prev) => [report, ...prev]);
    setEvents((prev) => [event(report.id, "created"), ...prev]);
    const synced = await enqueue({ kind: "create", report });
    if (synced) void refresh();
    return synced;
  };

  const reset = async (): Promise<boolean> => {
    try {
      const res = await request("/api/seed", { method: "POST" }, phoneRef.current);
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { reports: ReportView[]; events: ReportEvent[] };
      pendingRef.current = [];
      savePending();
      setReports(data.reports);
      setEvents(data.events);
      setSync("live");
      return true;
    } catch {
      const seed = buildSeed(Date.now());
      setReports(seed.reports);
      setEvents(seed.events);
      setSync("offline");
      return false;
    }
  };

  return { reports, events, ready, sync, pendingCount, vote, assign, resolve, confirm, reopen, create, reset, refresh };
}
