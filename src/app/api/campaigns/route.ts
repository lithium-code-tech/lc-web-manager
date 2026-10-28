import { adminDb } from "@/lib/firebase/admin";
import { validateDates } from "@/lib/domain/campaign";
import { audit } from "@/lib/server/audit";
import { campaignFields } from "@/lib/server/campaign-schema";
import { assertSlotsExist, clientSnapshot } from "@/lib/server/campaigns";
import { HttpError, readBody, requireStaff, route } from "@/lib/server/http";

export const POST = route(async (request) => {
  const staff = await requireStaff(request, ["ADM", "MKT"]);
  const { clientId, ...fields } = await readBody(request, campaignFields);
  if (fields.startDate && fields.endDate) {
    const invalid = validateDates(fields.startDate, fields.endDate);
    if (invalid) throw new HttpError(400, invalid);
  }
  await assertSlotsExist(fields.slotIds);

  const now = new Date().toISOString();
  const ref = await adminDb()
    .collection("Campaign")
    .add({
      ...fields,
      client: await clientSnapshot(clientId),
      payment: { status: "pending", method: "", note: "", paidAt: "", markedBy: "" },
      live: false,
      createdAt: now,
      createdById: staff.uid,
      createdByName: staff.name || staff.email,
      updatedAt: now,
    });
  await audit(staff, "campaign.create", { type: "campaign", id: ref.id }, `criou a campanha "${fields.name}"`);
  return Response.json({ id: ref.id });
});
