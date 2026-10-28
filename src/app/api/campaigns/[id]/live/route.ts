import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { cannotGoLiveReason } from "@/lib/domain/campaign";
import { audit } from "@/lib/server/audit";
import { loadCampaign, syncPlacement } from "@/lib/server/campaigns";
import { HttpError, readBody, requireStaff, route } from "@/lib/server/http";

const schema = z.object({ live: z.boolean() });

/** Liga ou desliga a campanha no app. Ligar exige campanha completa, paga e no período. */
export const POST = route(async (request, context: RouteContext<"/api/campaigns/[id]/live">) => {
  const staff = await requireStaff(request, ["ADM", "MKT"]);
  const { id } = await context.params;
  const { live } = await readBody(request, schema);
  const current = await loadCampaign(id);

  if (live) {
    const reason = cannotGoLiveReason(current);
    if (reason) throw new HttpError(409, reason);
  }
  await adminDb().doc(`Campaign/${id}`).update({ live, updatedAt: new Date().toISOString() });
  const published = await syncPlacement({ ...current, live });
  await audit(staff, live ? "campaign.on" : "campaign.off", { type: "campaign", id }, `${live ? "ligou" : "desligou"} "${current.name}"`);
  return Response.json({ live, published });
});
