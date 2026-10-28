// Fila de moderação montada no servidor: reports e moderation não são legíveis
// pelo navegador. Cada ocorrência vem com uma prévia do alvo.
import { adminDb } from "@/lib/firebase/admin";
import { groupReports, type ReportCase } from "@/lib/domain/reports";
import type { ModerationDecision, Report, ReportTargetType } from "@/lib/models";

export type TargetPreview = {
  exists: boolean;
  ownerNick: string;
  ownerImageUrl: string;
  mediaUrl: string;
  mediaType: "image" | "video" | "";
  coverUrl: string;
  hidden: boolean;
  banned: boolean;
};

export type ReportCaseWithPreview = ReportCase & { preview: TargetPreview };

export function targetPath(targetType: ReportTargetType, targetId: string): string {
  if (targetType === "skater") return `Skater/${targetId}`;
  if (targetType === "challenge") return `Challenges/${targetId}`;
  const [challengeId, responderId] = targetId.split("__");
  return `Challenges/${challengeId}/responses/${responderId}`;
}

export async function loadCases(): Promise<ReportCase[]> {
  const [reports, decisions] = await Promise.all([
    adminDb().collection("reports").get(),
    adminDb().collection("moderation").get(),
  ]);
  return groupReports(
    reports.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Report),
    new Map(decisions.docs.map((doc) => [doc.id, doc.data() as ModerationDecision])),
  );
}

export async function withPreviews(cases: ReportCase[]): Promise<ReportCaseWithPreview[]> {
  if (cases.length === 0) return [];
  const db = adminDb();
  const targets = await db.getAll(...cases.map((c) => db.doc(targetPath(c.targetType, c.targetId))));
  const owners = await db.getAll(...cases.map((c) => db.doc(`Skater/${c.targetOwnerId || "-"}`)));

  return cases.map((entry, index) => {
    const target = targets[index].data() ?? {};
    const owner = owners[index].data() ?? {};
    const preview: TargetPreview = {
      exists: targets[index].exists,
      ownerNick: owner.nickName ?? "",
      ownerImageUrl: owner.imageUrl ?? "",
      mediaUrl: "",
      mediaType: "",
      coverUrl: "",
      hidden: target.hidden === true,
      banned: owner.banned === true,
    };
    if (entry.targetType === "challenge") {
      preview.mediaUrl = target.challengedSkaterVideo || target.challengedSkaterImg || "";
      preview.mediaType = target.challengedSkaterVideo ? "video" : "image";
      preview.coverUrl = target.challengedSkaterImg ?? "";
    } else if (entry.targetType === "response") {
      preview.mediaUrl = target.mediaUrl ?? "";
      preview.mediaType = target.mediaType === "video" ? "video" : "image";
    } else {
      preview.coverUrl = target.imageUrl ?? "";
      preview.banned = target.banned === true;
    }
    return { ...entry, preview };
  });
}
