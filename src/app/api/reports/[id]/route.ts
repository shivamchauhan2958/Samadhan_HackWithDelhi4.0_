import { ApiError, assignReport, confirmReport, getReport, reopenReport, resolveReport, voteReport } from "@/lib/server/reports";

export const dynamic = "force-dynamic";

function fail(err: unknown) {
  if (err instanceof ApiError) {
    return Response.json({ error: err.message, ...(err.extra ?? {}) }, { status: err.status });
  }
  console.error("[api/reports/:id]", err);
  return Response.json({ error: "Database unavailable" }, { status: 503 });
}

type Ctx = { params: Promise<{ id: string }> };

function viewerOf(request: Request) {
  const phone = request.headers.get("x-samadhan-phone");
  return phone && /^[6-9]\d{9}$/.test(phone) ? phone : null;
}

export async function GET(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    return Response.json({ report: await getReport(id, viewerOf(request)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return fail(err);
  }
}

// Actions: vote (citizen), assign (officer + team), resolve (officer + after photo),
// confirm and reopen (the citizen who reported it).
export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = (await request.json().catch(() => null)) as {
      action?: string;
      voterId?: string;
      afterPhoto?: string;
      team?: string;
    } | null;
    switch (body?.action) {
      case "vote":
        return Response.json(await voteReport(id, String(body.voterId ?? "")));
      case "assign":
        return Response.json(await assignReport(id, body.team ?? null));
      case "resolve":
        return Response.json(await resolveReport(id, body.afterPhoto));
      case "confirm":
        return Response.json(await confirmReport(id));
      case "reopen":
        return Response.json(await reopenReport(id));
      default:
        throw new ApiError(400, "Unknown action");
    }
  } catch (err) {
    return fail(err);
  }
}
