import type { Category, PriorityParts, Tone } from "@/lib/ward";
import { translate, type Key, type Lang } from "@/lib/i18n";

// Pin fills: priority colours only. Resolved pins share the green and carry a check.
export const TONE_VAR: Record<Tone, string> = {
  high: "var(--high)",
  medium: "var(--medium)",
  low: "var(--low)",
  resolved: "var(--resolved)",
};

// Priority is never colour alone: every pin carries a letter (or a check) and its score.
export function pinTag(tone: Tone, score: number) {
  if (tone === "resolved") return "✓";
  const letter = tone === "high" ? "H" : tone === "medium" ? "M" : "L";
  return `${letter} ${score}`;
}

export function toneLabelKey(tone: Tone): Key {
  return tone === "high" ? "map.high" : tone === "medium" ? "map.medium" : tone === "low" ? "map.low" : "map.resolved";
}

// Category glyphs share one drawing grid (32 x 40, glyph centred near 16, 13.5).
export function CategoryGlyph({ category, check = false }: { category?: Category; check?: boolean }) {
  if (check || !category) {
    return (
      <path d="M11.6 13.6l3 3 5.8-6" fill="none" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    );
  }
  switch (category) {
    case "pothole":
      return <ellipse cx="16" cy="14" rx="5.4" ry="3" fill="var(--ink)" />;
    case "garbage":
      return (
        <g>
          <path d="M10.8 10.4h10.4" stroke="var(--ink)" strokeWidth="1.9" strokeLinecap="round" />
          <path d="M11.8 12.2h8.4l-.9 7.2h-6.6z" fill="var(--ink)" />
        </g>
      );
    case "streetlight":
      return (
        <g>
          <path d="M12.1 11.6q3.9-5.2 7.8 0z" fill="var(--ink)" />
          <path d="M16 11.6v6.6" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M13.4 18.6h5.2" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round" />
        </g>
      );
    case "water":
      return <path d="M16 8.2c0 0-4.9 5.3-4.9 8.4a4.9 4.9 0 0 0 9.8 0c0-3.1-4.9-8.4-4.9-8.4z" fill="var(--ink)" />;
    default:
      return null;
  }
}

// Teardrop pin: white disc, category glyph, resolved issues get a check.
export function Pin({
  category,
  tone,
  size = 30,
  check = false,
  className = "",
}: {
  category: Category;
  tone: Tone;
  size?: number;
  check?: boolean;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={Math.round(size * 1.25)}
      viewBox="0 0 32 40"
      className={`block overflow-visible ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M16 39C16 39 2 23.6 2 13.5A14 14 0 0 1 30 13.5C30 23.6 16 39 16 39Z"
        style={{ fill: TONE_VAR[tone], transition: "fill 600ms ease" }}
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="13.5" r="9.2" fill="#ffffff" />
      <CategoryGlyph category={category} check={check || tone === "resolved"} />
    </svg>
  );
}

// Label that rides with a pin: the priority letter and the score.
export function PinTag({ tone, score }: { tone: Tone; score: number }) {
  return <span className="pin-tag">{pinTag(tone, score)}</span>;
}

const CTX_KEY: Record<string, Key> = {
  school: "ctx.school",
  bus: "ctx.bus",
  metro: "ctx.metro",
  hospital: "ctx.hospital",
};

// "Why this priority" as short chips: category, neighbours, days open, each context boost, reopen.
export function PriorityChips({
  parts,
  score,
  lang,
  compact = false,
}: {
  parts: PriorityParts;
  score: number;
  lang: Lang;
  compact?: boolean;
}) {
  const t = (key: Key) => translate(lang, key);
  const items: { label: string; value: number; ctx?: boolean }[] = [
    { label: t("chip.category"), value: parts.category },
    { label: t("chip.neighbours"), value: parts.neighbours },
    { label: t("chip.days"), value: parts.days },
    ...parts.near.map((p) => ({ label: translate(lang, CTX_KEY[p.kind] ?? "ctx.school"), value: 10, ctx: true })),
  ];
  if (parts.reopened > 0) items.push({ label: t("chip.reopened"), value: parts.reopened });
  return (
    <div className="flex flex-wrap gap-1.5" aria-label={t("function.why")}>
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className={`chip ${item.ctx ? "chip-ctx" : ""}`}>
          {item.label} <strong>{item.value}</strong>
        </span>
      ))}
      {!compact && (
        <span className="chip" style={{ borderColor: "var(--ink)" }}>
          {t("function.score")} <strong>{score}</strong>
        </span>
      )}
    </div>
  );
}
