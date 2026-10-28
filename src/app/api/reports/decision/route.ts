import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { caseKey } from "@/lib/domain/reports";
import type { ModerationDecision } from "@/lib/models";
import { audit } from "@/lib/server/audit";
import { HttpError, readBody, requireStaff, route } from "@/lib/server/http";
import { targetPath } from "@/lib/server/reports";
import { banSkater } from "@/lib/server/skaters";

const schema = z.object({
  targetType: z.enum(["challenge", "response", "skater"]),
  targetId: z.string().min(1).max(300),
  /** keep: conteúdo fica no ar; remove: esconde (ou bane, se o alvo é um perfil). */
  action: z.enum(["keep", "remove"]),
  banOwner: z.boolean().default(false),
  note: z.string().max(1000).default(""),
});

export const POST = route(async (request) => {
  const staff = await requireStaff(request, ["ADM"]);
  const { targetType, targetId, action, banOwner, note } = await readBody(request, schema);
  const db = adminDb();
  const targetRef = db.doc(targetPath(targetType, targetId));
  const target = await targetRef.get();
  if (!target.exists) throw new HttpError(404, "O conteúdo não existe mais (pode ter sido excluído).");

  const ownerId =
    targetType === "skater"
      ? targetId
      : targetType === "challenge"
        ? (target.data()?.createdBy?.skaterId as string)
        : targetId.split("__")[1];

  if (targetType === "skater") {
    if (action === "remove") await banSkater(targetId, note || "Denúncias");
  } else {
    await targetRef.update({ hidden: action === "remove" });
  }
  if (banOwner && targetType !== "skater" && ownerId) await banSkater(ownerId, note || "Denúncias");

  const decision: ModerationDecision = {
    targetType,
    targetId,
    status: action === "remove" ? "removed" : "kept",
    note,
    decidedBy: staff.uid,
    decidedByName: staff.name || staff.email,
    decidedAt: new Date().toISOString(),
  };
  await db.doc(`moderation/${caseKey(targetType, targetId)}`).set(decision);

  const what = { challenge: "desafio", response: "resposta", skater: "perfil" }[targetType];
  const verb = action === "remove" ? (targetType === "skater" ? "baniu" : "removeu") : "manteve";
  await audit(
    staff,
    `moderation.${action}`,
    { type: targetType, id: targetId },
    `${verb} ${what}${banOwner ? " e baniu o autor" : ""}${note ? `: ${note}` : ""}`,
  );
  return Response.json({ decision });
});
