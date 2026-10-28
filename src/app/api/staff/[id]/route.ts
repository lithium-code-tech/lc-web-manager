import { z } from "zod";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { STAFF_ROLES } from "@/lib/models";
import { audit } from "@/lib/server/audit";
import { HttpError, readBody, requireStaff, route } from "@/lib/server/http";

const schema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phoneNumber: z.string().trim().max(30).optional(),
  rule: z.enum(STAFF_ROLES).optional(),
});

async function adminCount() {
  return (await adminDb().collection("User").where("rule", "==", "ADM").count().get()).data().count;
}

export const PATCH = route(async (request, context: RouteContext<"/api/staff/[id]">) => {
  const staff = await requireStaff(request, ["ADM"]);
  const { id } = await context.params;
  const changes = await readBody(request, schema);
  const ref = adminDb().doc(`User/${id}`);
  const current = (await ref.get()).data();
  if (!current) throw new HttpError(404, "Pessoa não encontrada na equipe.");
  if (changes.rule && changes.rule !== current.rule) {
    if (id === staff.uid) throw new HttpError(409, "Você não pode mudar o seu próprio papel.");
    if (current.rule === "ADM" && (await adminCount()) <= 1) {
      throw new HttpError(409, "Precisa sobrar pelo menos um administrador.");
    }
  }
  await ref.update(changes);
  await audit(staff, "staff.update", { type: "staff", id }, `atualizou ${current.name}${changes.rule ? ` para ${changes.rule}` : ""}`);
  return Response.json({ ok: true });
});

/** Tira da equipe. O login só é apagado se a pessoa não tiver conta de skater no app. */
export const DELETE = route(async (request, context: RouteContext<"/api/staff/[id]">) => {
  const staff = await requireStaff(request, ["ADM"]);
  const { id } = await context.params;
  if (id === staff.uid) throw new HttpError(409, "Você não pode remover a si mesmo.");
  const db = adminDb();
  const ref = db.doc(`User/${id}`);
  const current = (await ref.get()).data();
  if (!current) throw new HttpError(404, "Pessoa não encontrada na equipe.");
  if (current.rule === "ADM" && (await adminCount()) <= 1) {
    throw new HttpError(409, "Precisa sobrar pelo menos um administrador.");
  }

  await ref.delete();
  const isSkater = (await db.doc(`Skater/${id}`).get()).exists;
  try {
    if (isSkater) await adminAuth().revokeRefreshTokens(id);
    else await adminAuth().deleteUser(id);
  } catch (error) {
    if ((error as { code?: string }).code !== "auth/user-not-found") throw error;
  }
  await audit(staff, "staff.delete", { type: "staff", id }, `removeu ${current.name} da equipe`);
  return Response.json({ ok: true, loginDeleted: !isSkater });
});
