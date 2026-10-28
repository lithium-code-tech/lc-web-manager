import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { audit } from "@/lib/server/audit";
import { HttpError, requireStaff, route } from "@/lib/server/http";
import { requestSkaterDeletion } from "@/lib/server/skaters";

/** Dados privados e situação da conta — só ADM (contato e idade são dado pessoal). */
export const GET = route(async (request, context: RouteContext<"/api/skaters/[id]">) => {
  await requireStaff(request, ["ADM"]);
  const { id } = await context.params;
  const db = adminDb();
  const [skater, account, created, reported, deletion] = await Promise.all([
    db.doc(`Skater/${id}`).get(),
    db.doc(`Skater/${id}/private/account`).get(),
    db.collection("Challenges").where("createdBy.skaterId", "==", id).count().get(),
    db.collection("reports").where("targetOwnerId", "==", id).count().get(),
    db.doc(`deletionRequests/${id}`).get(),
  ]);
  if (!skater.exists) throw new HttpError(404, "Skater não encontrado.");

  let login: { email: string; disabled: boolean; createdAt: string; lastSignInAt: string } | null = null;
  try {
    const user = await adminAuth().getUser(id);
    login = {
      email: user.email ?? "",
      disabled: user.disabled,
      createdAt: user.metadata.creationTime,
      lastSignInAt: user.metadata.lastSignInTime,
    };
  } catch {
    login = null;
  }

  const privateData = account.data() ?? {};
  return Response.json({
    skater: { id, ...skater.data() },
    account: {
      email: privateData.email ?? login?.email ?? "",
      phoneNumber: privateData.phoneNumber ?? skater.data()?.phoneNumber ?? "",
      birthDate: privateData.birthDate ?? "",
      acceptedTermsAt: privateData.acceptedTermsAt ?? "",
    },
    login,
    challengesCreated: created.data().count,
    reportsAgainst: reported.data().count,
    deletionPending: deletion.exists,
  });
});

export const DELETE = route(async (request, context: RouteContext<"/api/skaters/[id]">) => {
  const staff = await requireStaff(request, ["ADM"]);
  const { id } = await context.params;
  const skater = await adminDb().doc(`Skater/${id}`).get();
  if (!skater.exists) throw new HttpError(404, "Skater não encontrado.");
  await requestSkaterDeletion(id, staff.uid);
  await audit(staff, "skater.delete", { type: "skater", id }, `pediu a exclusão de @${skater.data()?.nickName ?? id}`);
  return Response.json({ ok: true });
});
