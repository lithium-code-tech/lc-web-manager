import { adminDb } from "@/lib/firebase/admin";
import { formatCents, missingFields, validateDates } from "@/lib/domain/campaign";
import { audit } from "@/lib/server/audit";
import { campaignFields } from "@/lib/server/campaign-schema";
import { assertSlotsExist, clientSnapshot, loadCampaign, syncPlacement } from "@/lib/server/campaigns";
import { HttpError, readBody, requireStaff, route } from "@/lib/server/http";

export const PATCH = route(async (request, context: RouteContext<"/api/campaigns/[id]">) => {
  const staff = await requireStaff(request, ["ADM", "MKT"]);
  const { id } = await context.params;
  const current = await loadCampaign(id);
  const { clientId, ...fields } = await readBody(request, campaignFields);

  if (fields.startDate && fields.endDate) {
    const invalid = validateDates(fields.startDate, fields.endDate);
    if (invalid) throw new HttpError(400, invalid);
  }
  // Depois de pago, valor e cliente só mudam com um administrador.
  if (current.payment.status === "paid" && staff.rule !== "ADM") {
    if (fields.priceCents !== current.priceCents || clientId !== current.client.id) {
      throw new HttpError(403, "Campanha já paga: só um administrador muda valor ou cliente.");
    }
  }
  await assertSlotsExist(fields.slotIds);

  const client = clientId === current.client.id ? current.client : await clientSnapshot(clientId);
  const changes = { ...fields, client, updatedAt: new Date().toISOString() };
  // Ficou incompleta enquanto estava ligada: desliga para não ir ao ar quebrada.
  const live = current.live && missingFields({ ...current, ...changes }).length === 0;
  await adminDb().doc(`Campaign/${id}`).update({ ...changes, live });
  const updated = { ...current, ...changes, live };
  const published = await syncPlacement(updated);

  const priceNote = fields.priceCents !== current.priceCents ? ` (valor: ${formatCents(fields.priceCents)})` : "";
  await audit(staff, "campaign.update", { type: "campaign", id }, `editou a campanha "${updated.name}"${priceNote}`);
  return Response.json({ published });
});

export const DELETE = route(async (request, context: RouteContext<"/api/campaigns/[id]">) => {
  const staff = await requireStaff(request, ["ADM"]);
  const { id } = await context.params;
  const current = await loadCampaign(id);
  if (current.live) throw new HttpError(409, "Desligue a campanha antes de excluir.");
  await adminDb().doc(`adPlacements/${id}`).delete();
  await adminDb().doc(`Campaign/${id}`).delete();
  await audit(staff, "campaign.delete", { type: "campaign", id }, `excluiu a campanha "${current.name}"`);
  return Response.json({ ok: true });
});
