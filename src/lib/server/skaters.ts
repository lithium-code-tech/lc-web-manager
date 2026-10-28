// Bloqueio, desbloqueio e exclusão de contas do app. Bloquear desativa o login,
// derruba a sessão aberta e esconde o que a pessoa publicou; desbloquear
// devolve só o que foi escondido pelo bloqueio (hiddenByBan).
import { FieldValue, type DocumentReference } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { HttpError } from "./http";

async function contentRefs(uid: string): Promise<DocumentReference[]> {
  const challenges = adminDb().collection("Challenges");
  const [created, responded] = await Promise.all([
    challenges.where("createdBy.skaterId", "==", uid).get(),
    challenges.where("responderIds", "array-contains", uid).get(),
  ]);
  return [
    ...created.docs.map((doc) => doc.ref),
    ...responded.docs.map((doc) => doc.ref.collection("responses").doc(uid)),
  ];
}

async function assertNotStaff(uid: string) {
  const staff = await adminDb().doc(`User/${uid}`).get();
  if (staff.exists) throw new HttpError(409, "Essa conta é da equipe. Remova da equipe antes.");
}

async function setAuthDisabled(uid: string, disabled: boolean) {
  try {
    await adminAuth().updateUser(uid, { disabled });
    if (disabled) await adminAuth().revokeRefreshTokens(uid);
  } catch (error) {
    // Conta de login já apagada: segue com o resto (perfil e conteúdo).
    if ((error as { code?: string }).code !== "auth/user-not-found") throw error;
  }
}

export async function banSkater(uid: string, reason: string): Promise<{ hiddenItems: number }> {
  await assertNotStaff(uid);
  const skaterRef = adminDb().doc(`Skater/${uid}`);
  if (!(await skaterRef.get()).exists) throw new HttpError(404, "Skater não encontrado.");

  await setAuthDisabled(uid, true);
  const refs = await contentRefs(uid);
  const snapshots = refs.length ? await adminDb().getAll(...refs) : [];
  const batch = adminDb().batch();
  batch.update(skaterRef, { banned: true, bannedAt: new Date().toISOString(), bannedReason: reason });
  let hiddenItems = 0;
  for (const snapshot of snapshots) {
    if (!snapshot.exists || snapshot.data()?.hidden) continue;
    batch.update(snapshot.ref, { hidden: true, hiddenByBan: true });
    hiddenItems += 1;
  }
  await batch.commit();
  return { hiddenItems };
}

export async function unbanSkater(uid: string): Promise<{ restoredItems: number }> {
  const skaterRef = adminDb().doc(`Skater/${uid}`);
  if (!(await skaterRef.get()).exists) throw new HttpError(404, "Skater não encontrado.");

  await setAuthDisabled(uid, false);
  const refs = await contentRefs(uid);
  const snapshots = refs.length ? await adminDb().getAll(...refs) : [];
  const batch = adminDb().batch();
  batch.update(skaterRef, {
    banned: FieldValue.delete(),
    bannedAt: FieldValue.delete(),
    bannedReason: FieldValue.delete(),
  });
  let restoredItems = 0;
  for (const snapshot of snapshots) {
    if (!snapshot.exists || !snapshot.data()?.hiddenByBan) continue;
    batch.update(snapshot.ref, { hidden: false, hiddenByBan: FieldValue.delete() });
    restoredItems += 1;
  }
  await batch.commit();
  return { restoredItems };
}

/**
 * Exclusão pedida pela equipe (ex.: conta de menor de idade). Corta o acesso na
 * hora e entra na fila do job de manutenção do app, que apaga tudo em até 1 hora.
 */
export async function requestSkaterDeletion(uid: string, requestedBy: string): Promise<void> {
  await assertNotStaff(uid);
  await setAuthDisabled(uid, true);
  await adminDb()
    .doc(`deletionRequests/${uid}`)
    .set({ requestedAt: new Date().toISOString(), requestedBy });
}
