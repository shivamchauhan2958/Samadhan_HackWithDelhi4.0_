import { CATEGORY_META, shortId, type Category, type EventKind, type ReportEvent, type ReportView } from "@/lib/ward";
import { translate, type Key, type Lang } from "@/lib/i18n";
import { KEYS, readJSON, writeJSON } from "@/lib/storage";

// A local SMS message, used for the simulated OTP. Status-change messages are derived
// from the server's event log instead.
export type LocalSms = { id: string; at: string; text: string };

export function readLocalSms(): LocalSms[] {
  return readJSON<LocalSms[]>(KEYS.sms, []);
}

export function pushLocalSms(text: string) {
  const list = readLocalSms();
  const next = [{ id: `local-${Date.now()}`, at: new Date().toISOString(), text }, ...list].slice(0, 30);
  writeJSON(KEYS.sms, next);
}

export function otpMessage(otp: string, lang: Lang): string {
  return lang === "hi"
    ? `समाधान: आपका OTP ${otp} है। वार्ड 14 में शिकायत दर्ज करने के लिए यह ऐप खोलें।`
    : `Samadhan: Your OTP is ${otp}. Open this app to report an issue in Ward 14.`;
}

// Status changes become SMS messages in the resident's own language.
export function smsText(ev: ReportEvent, report: ReportView, lang: Lang): string {
  const cat = CATEGORY_META[report.category][lang];
  const id = shortId(report.id);
  const t = (key: Key, vars?: Record<string, string | number>) => translate(lang, key, vars);
  switch (ev.kind) {
    case "created":
      return lang === "hi"
        ? `समाधान: आपकी शिकायत ${id} (${cat}) दर्ज हुई। हर चरण पर सूचित करेंगे।`
        : `Samadhan: Your report ${id} (${cat}) is received. We will update you at every stage.`;
    case "verified":
      return lang === "hi"
        ? `समाधान: आपकी शिकायत ${id} (${cat}) अब सत्यापित है। ${report.votes} पड़ोसियों ने पुष्टि की।`
        : `Samadhan: Your report ${id} (${cat}) is now Verified. ${report.votes} neighbours confirmed it.`;
    case "assigned":
      return lang === "hi"
        ? `समाधान: आपकी शिकायत ${id} (${cat}) अब सौंपी गई है। ${dueInDays(report)} दिन में देय।`
        : `Samadhan: Your report ${id} (${cat}) is now Assigned. Due in ${dueInDays(report)} days.`;
    case "resolved":
      return lang === "hi"
        ? `समाधान: शिकायत ${id} (${cat}) हल चिह्नित हुई। क्या वाकई ठीक हुई? ऐप में बताएँ।`
        : `Samadhan: Your report ${id} (${cat}) is marked Resolved. Is it really fixed? Tell us in the app.`;
    case "confirmed":
      return lang === "hi"
        ? `समाधान: शिकायत ${id} (${cat}) ठीक होने की पुष्टि हुई। धन्यवाद, लूप पूरा हुआ।`
        : `Samadhan: Your report ${id} (${cat}) is confirmed fixed. Thank you for closing the loop.`;
    case "reopened":
      return lang === "hi"
        ? `समाधान: शिकायत ${id} (${cat}) फिर खोली गई और अधिकारी को लौटी। प्राथमिकता +10।`
        : `Samadhan: Your report ${id} (${cat}) was reopened and returned to the officer. Priority +10.`;
    case "escalated": {
      const level = t(ev.level === "commissioner" ? "esc.commissioner" : ev.level === "zonal" ? "esc.zonal" : "esc.ward");
      return lang === "hi"
        ? `समाधान: शिकायत ${id} (${cat}) समय-सीमा पार है। ${level} को भेजी गई।`
        : `Samadhan: Your report ${id} (${cat}) is past its deadline and escalated to ${level}.`;
    }
    default:
      return `Samadhan: ${id}`;
  }
}

function dueInDays(report: ReportView) {
  const sla = CATEGORY_META[report.category].sla;
  return Math.max(1, sla);
}

export function eventLabel(kind: EventKind, lang: Lang): string {
  const map: Record<EventKind, Key> = {
    created: "stage.reported",
    verified: "stage.verified",
    assigned: "stage.assigned",
    resolved: "stage.resolved",
    confirmed: "detail.confirm",
    reopened: "peak.reopen",
    escalated: "peak.escalation",
  };
  return translate(lang, map[kind]);
}

export function formatDate(iso: string, lang: Lang) {
  const d = new Date(iso);
  return d.toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short" });
}

/* ------------------------------------------------------------------ *
 * Voice reporting: transcript keywords map to a category.
 * ------------------------------------------------------------------ */

const VOICE_KEYWORDS: { category: Category; words: string[] }[] = [
  { category: "pothole", words: ["pothole", "potholes", "hole", "holes", "crater", "ditch", "गड्ढा", "गड्ढे", "गड्डा", "ड्ढा", "गर्त"] },
  { category: "garbage", words: ["garbage", "trash", "rubbish", "waste", "bin", "dump", "कूड़ा", "कूड़े", "कचरा", "कूड़्"] },
  { category: "streetlight", words: ["light", "lights", "streetlight", "streetlights", "lamp", "bulb", "dark", "बत्ती", "लाइट", "बल्ब", "अंधेरा"] },
  { category: "water", words: ["water", "leak", "leaking", "pipe", "tap", "sewage", "पानी", "रिसाव", "रिस", "नल", "पाइप"] },
];

export function categoryFromTranscript(text: string): Category | null {
  const lower = text.toLowerCase();
  for (const entry of VOICE_KEYWORDS) {
    if (entry.words.some((w) => lower.includes(w.toLowerCase()))) return entry.category;
  }
  return null;
}
