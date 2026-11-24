import { listReports, resetDemo } from "@/lib/server/reports";

export const dynamic = "force-dynamic";

// Restores the Ward 14 demo data. Used by the dashboard's "Reset demo data" control.
export async function POST() {
  try {
    await resetDemo();
    return Response.json(await listReports());
  } catch (err) {
    console.error("[api/seed]", err);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
