// Agrupa as denúncias por alvo para a fila de moderação. Uma "ocorrência" é um
// conteúdo ou perfil denunciado, com todas as denúncias que recebeu.
import type { ModerationDecision, Report, ReportReason, ReportTargetType } from "../models";

export type ReportCase = {
  key: string;
  targetType: ReportTargetType;
  targetId: string;
  targetOwnerId: string;
  challengeId: string;
  reporterCount: number;
  reasons: Partial<Record<ReportReason, number>>;
  firstAt: string;
  lastAt: string;
  decision: ModerationDecision | null;
  /** Denúncias feitas depois da última decisão (ou todas, se não houve). */
  pendingCount: number;
};

export function caseKey(targetType: ReportTargetType, targetId: string): string {
  return `${targetType}_${targetId}`;
}

/** Ocorrências ordenadas: pendentes primeiro, as com mais denúncias no topo. */
export function groupReports(reports: Report[], decisions: Map<string, ModerationDecision>): ReportCase[] {
  const cases = new Map<string, ReportCase & { reporters: Set<string>; pendingReporters: Set<string> }>();
  for (const report of reports) {
    const key = caseKey(report.targetType, report.targetId);
    let entry = cases.get(key);
    if (!entry) {
      entry = {
        key,
        targetType: report.targetType,
        targetId: report.targetId,
        targetOwnerId: report.targetOwnerId,
        challengeId: report.challengeId,
        reporterCount: 0,
        reasons: {},
        firstAt: report.createdAt,
        lastAt: report.createdAt,
        decision: decisions.get(key) ?? null,
        pendingCount: 0,
        reporters: new Set(),
        pendingReporters: new Set(),
      };
      cases.set(key, entry);
    }
    entry.reporters.add(report.reporterId);
    entry.reasons[report.reason] = (entry.reasons[report.reason] ?? 0) + 1;
    if (report.createdAt < entry.firstAt) entry.firstAt = report.createdAt;
    if (report.createdAt > entry.lastAt) entry.lastAt = report.createdAt;
    if (!entry.decision || report.createdAt > entry.decision.decidedAt) {
      entry.pendingReporters.add(report.reporterId);
    }
  }

  return [...cases.values()]
    .map(({ reporters, pendingReporters, ...rest }) => ({
      ...rest,
      reporterCount: reporters.size,
      pendingCount: pendingReporters.size,
    }))
    .sort((a, b) => {
      const pendingFirst = Number(b.pendingCount > 0) - Number(a.pendingCount > 0);
      if (pendingFirst !== 0) return pendingFirst;
      if (b.pendingCount !== a.pendingCount) return b.pendingCount - a.pendingCount;
      return b.lastAt.localeCompare(a.lastAt);
    });
}
