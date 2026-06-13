import {
  checkRouteRateLimit,
  rateLimitJsonResponse,
  RATE_LIMIT_SUBJECTS,
} from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const rateLimit = await checkRouteRateLimit(request, {
    actorType: "ANONYMOUS",
    subject: RATE_LIMIT_SUBJECTS.PUBLIC_ROUTE,
  });

  if (!rateLimit.success) {
    return rateLimitJsonResponse(rateLimit);
  }

  return Response.json({ ok: true });
}
