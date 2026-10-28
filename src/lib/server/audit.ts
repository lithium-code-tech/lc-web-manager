// Registro de quem fez o quê (auditLog). Toda ação sensível da API grava aqui.
import { adminDb } from "@/lib/firebase/admin";
import type { Staff } from "./http";

export async function audit(
  actor: Staff,
  action: string,
  target: { type: string; id: string },
  summary: string,
): Promise<void> {
  await adminDb().collection("auditLog").add({
    actorId: actor.uid,
    actorName: actor.name || actor.email,
    action,
    targetType: target.type,
    targetId: target.id,
    summary,
    at: new Date().toISOString(),
  });
}
