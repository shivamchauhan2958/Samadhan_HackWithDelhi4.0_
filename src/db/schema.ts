import { boolean, doublePrecision, index, integer, pgTable, primaryKey, serial, text, timestamp } from "drizzle-orm/pg-core";

// One row per civic issue. Coordinates are map units on the Ward 14 plate (1 unit = 1 metre).
export const reports = pgTable(
  "reports",
  {
    id: text("id").primaryKey(),
    category: text("category").notNull(), // pothole | garbage | streetlight | water
    x: doublePrecision("x").notNull(),
    y: doublePrecision("y").notNull(),
    description: text("description").notNull().default(""),
    status: text("status").notNull().default("reported"), // reported | verified | assigned | resolved
    votes: integer("votes").notNull().default(0),
    reportCount: integer("report_count").notNull().default(1),
    photo: text("photo"), // "before" photo: data URL or static path
    afterPhoto: text("after_photo"), // required before an issue may be marked Resolved
    resolution: text("resolution").notNull().default("none"), // none | pending | confirmed | reopened
    reopenCount: integer("reopen_count").notNull().default(0),
    // Reporter identity is private: never returned in public listings.
    reporterName: text("reporter_name"),
    reporterPhone: text("reporter_phone"),
    // Ward team the issue is assigned to.
    team: text("team"), // roads | sanitation | electrical | water
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    reopenedAt: timestamp("reopened_at", { withTimezone: true }),
  },
  (t) => [index("reports_status_idx").on(t.status), index("reports_category_idx").on(t.category)],
);

// One vote per voter per report, enforced by the composite primary key.
export const reportVotes = pgTable(
  "report_votes",
  {
    reportId: text("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    voterId: text("voter_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.reportId, t.voterId] })],
);

// Status-change history. Drives the report timeline and the SMS inbox, and records each escalation.
export const reportEvents = pgTable(
  "report_events",
  {
    id: serial("id").primaryKey(),
    reportId: text("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // created | verified | assigned | resolved | confirmed | reopened | escalated
    level: text("level"), // ward | zonal | commissioner, for escalated events
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("report_events_report_idx").on(t.reportId), index("report_events_at_idx").on(t.at)],
);


