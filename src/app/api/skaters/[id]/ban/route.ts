import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { audit } from "@/lib/server/audit";
import { readBody, requireStaff, route } from "@/lib/server/http";
import { banSkater, unbanSkater } from "@/lib/server/skaters";

const schema = z.object({ reason: z.string().trim().min(3, "Informe o motivo do bloqueio.").max(500) });

async function nickname(id: string) {
  return (await adminDb().doc(`Skater/${id}`).get()).data()?.nickName ?? id;
}

export const POST = route(async (request, context: RouteContext<"/api/skaters/[id]/ban">) => {
  const staff = await requireStaff(request, ["ADM"]);
  const { id } = await context.params;
  const { reason } = await readBody(request, schema);
  const result = await banSkater(id, reason);
  await audit(staff, "skater.ban", { type: "skater", id }, `bloqueou @${await nickname(id)}: ${reason}`);
  return Response.json(result);
});

export const DELETE = route(async (request, context: RouteContext<"/api/skaters/[id]/ban">) => {
  const staff = await requireStaff(request, ["ADM"]);
  const { id } = await context.params;
  const result = await unbanSkater(id);
  await audit(staff, "skater.unban", { type: "skater", id }, `desbloqueou @${await nickname(id)}`);
  return Response.json(result);
});
