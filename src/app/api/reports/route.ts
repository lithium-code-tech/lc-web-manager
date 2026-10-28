import { loadCases, withPreviews } from "@/lib/server/reports";
import { requireStaff, route } from "@/lib/server/http";

/** ?status=open (padrão) | decided | all */
export const GET = route(async (request) => {
  await requireStaff(request, ["ADM"]);
  const status = new URL(request.url).searchParams.get("status") ?? "open";
  const cases = (await loadCases()).filter((entry) => {
    if (status === "open") return entry.pendingCount > 0;
    if (status === "decided") return entry.pendingCount === 0;
    return true;
  });
  return Response.json({ cases: await withPreviews(cases.slice(0, 100)) });
});
