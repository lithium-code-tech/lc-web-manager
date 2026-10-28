// Campanhas no servidor. Toda mudança passa por syncPlacement, que mantém
// adPlacements/{id} (o que o app lê) igual ao estado da campanha.
import { adminDb } from "@/lib/firebase/admin";
import { normalizeCampaign, shouldBePublished, toPlacement } from "@/lib/domain/campaign";
import type { Campaign } from "@/lib/models";
import { HttpError } from "./http";

export async function loadCampaign(id: string): Promise<Campaign> {
  const snapshot = await adminDb().doc(`Campaign/${id}`).get();
  if (!snapshot.exists) throw new HttpError(404, "Campanha não encontrada.");
  return normalizeCampaign(snapshot.id, snapshot.data() ?? {});
}

export async function syncPlacement(campaign: Campaign): Promise<boolean> {
  const ref = adminDb().doc(`adPlacements/${campaign.id}`);
  if (shouldBePublished(campaign)) {
    await ref.set(toPlacement(campaign));
    return true;
  }
  await ref.delete();
  return false;
}

export async function assertSlotsExist(slotIds: string[]) {
  if (slotIds.length === 0) return;
  const refs = slotIds.map((id) => adminDb().doc(`adSlots/${id}`));
  const snapshots = await adminDb().getAll(...refs);
  const missing = snapshots.filter((s) => !s.exists).map((s) => s.id);
  if (missing.length) throw new HttpError(400, `Posição inexistente: ${missing.join(", ")}.`);
}

export async function clientSnapshot(clientId: string): Promise<Campaign["client"]> {
  if (!clientId) return { id: "", razaoSocial: "", nomeFantasia: "", cnpj: "" };
  const snapshot = await adminDb().doc(`Client/${clientId}`).get();
  const data = snapshot.data();
  if (!data) throw new HttpError(400, "Cliente não encontrado.");
  return {
    id: snapshot.id,
    razaoSocial: data.razaoSocial ?? "",
    nomeFantasia: data.nomeFantasia ?? "",
    cnpj: data.cnpj ?? "",
  };
}
