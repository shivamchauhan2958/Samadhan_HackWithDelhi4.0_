import { ApiError, createReport, listReports } from "@/lib/server/reports";

export const dynamic = "force-dynamic";

function fail(err: unknown) {
  if (err instanceof ApiError) {
    return Response.json({ error: err.message, ...(err.extra ?? {}) }, { status: err.status });
  }
  console.error("[api/reports]", err);
  return Response.json({ error: "Database unavailable" }, { status: 503 });
}

// The caller's phone is sent as a header. The server uses it only to mark which reports
// are theirs, and never returns it. Authentication is simulated: this is a privacy
// default, not a security boundary.
function viewerOf(request: Request) {
  const phone = request.headers.get("x-samadhan-phone");
  return phone && /^[6-9]\d{9}$/.test(phone) ? phone : null;
}

export async function GET(request: Request) {
  try {
    const data = await listReports(viewerOf(request));
    return Response.json({ ...data, serverTime: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) throw new ApiError(400, "Invalid JSON");
    const { report } = await createReport({
      id: body.id,
      category: body.category,
      x: body.x,
      y: body.y,
      description: body.description,
      photo: body.photo,
      reporterName: body.reporterName,
      reporterPhone: body.reporterPhone,
    });
    return Response.json({ report }, { status: 201 });
  } catch (err) {
    return fail(err);
  }
}
