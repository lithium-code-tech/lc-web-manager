import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { formatCents } from "@/lib/domain/campaign";
import { audit } from "@/lib/server/audit";
import { loadCampaign, syncPlacement } from "@/lib/server/campaigns";
import { readBody, requireStaff, route } from "@/lib/server/http";

const schema = z.object({
  status: z.enum(["paid", "pending"]),
  method: z.string().trim().max(60).default(""),
  note: z.string().trim().max(500).default(""),
});

/** Só ADM confirma pagamento. Voltar para "pendente" tira a campanha do ar. */
export const POST = route(async (request, context: RouteContext<"/api/campaigns/[id]/payment">) => {
  const staff = await requireStaff(request, ["ADM"]);
  const { id } = await context.params;
  const { status, method, note } = await readBody(request, schema);
  const current = await loadCampaign(id);

  const payment =
    status === "paid"
      ? { status, method, note, paidAt: new Date().toISOString(), markedBy: staff.name || staff.email }
      : { status, method: "", note, paidAt: "", markedBy: "" };
  const live = status === "paid" ? current.live : false;
  await adminDb().doc(`Campaign/${id}`).update({ payment, live, updatedAt: new Date().toISOString() });
  const published = await syncPlacement({ ...current, payment, live });

  const summary =
    status === "paid"
      ? `confirmou o pagamento de "${current.name}" (${formatCents(current.priceCents)}${method ? `, ${method}` : ""})`
      : `marcou "${current.name}" como não paga${note ? `: ${note}` : ""}`;
  await audit(staff, `campaign.payment.${status}`, { type: "campaign", id }, summary);
  return Response.json({ payment, live, published });
});
