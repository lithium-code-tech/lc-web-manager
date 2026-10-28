// Regras de negócio das campanhas: em que estado está, se pode ir ao ar e o
// que é publicado para o app. Sem dependências — roda no navegador, na API e
// nos testes (`npm test`).
import type { AdPlacement, Campaign } from "../models";

export type CampaignStatus = "draft" | "awaiting_payment" | "ready" | "scheduled" | "live" | "ended";

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "Rascunho",
  awaiting_payment: "Aguardando pagamento",
  ready: "Pago · desligado",
  scheduled: "Agendado",
  live: "No ar",
  ended: "Encerrado",
};

/** Brasil sem horário de verão: Brasília é sempre UTC−3. */
const BRT_OFFSET = "-03:00";

export function startsAt(startDate: string): string {
  return new Date(`${startDate}T00:00:00${BRT_OFFSET}`).toISOString();
}

export function endsAt(endDate: string): string {
  return new Date(`${endDate}T23:59:59.999${BRT_OFFSET}`).toISOString();
}

/** O que falta para a campanha sair do rascunho. Vazio = completa. */
export function missingFields(campaign: Campaign): string[] {
  const missing: string[] = [];
  if (!campaign.name.trim()) missing.push("nome");
  if (!campaign.client?.id) missing.push("cliente");
  if (campaign.slotIds.length === 0) missing.push("posição");
  if (!campaign.mediaUrl) missing.push("arte");
  if (!campaign.startDate || !campaign.endDate) missing.push("período");
  return missing;
}

export function campaignStatus(campaign: Campaign, now = new Date()): CampaignStatus {
  if (missingFields(campaign).length > 0) return "draft";
  if (now.getTime() > Date.parse(endsAt(campaign.endDate))) return "ended";
  if (campaign.payment.status !== "paid") return "awaiting_payment";
  if (!campaign.live) return "ready";
  if (now.getTime() < Date.parse(startsAt(campaign.startDate))) return "scheduled";
  return "live";
}

/** Motivo pelo qual não dá para ligar, ou null se pode. */
export function cannotGoLiveReason(campaign: Campaign, now = new Date()): string | null {
  const missing = missingFields(campaign);
  if (missing.length > 0) return `Falta preencher: ${missing.join(", ")}.`;
  if (campaign.payment.status !== "paid") return "A campanha ainda não foi paga.";
  if (now.getTime() > Date.parse(endsAt(campaign.endDate))) return "O período da campanha já acabou.";
  return null;
}

/** Deve existir um adPlacement para esta campanha? (no ar ou agendada) */
export function shouldBePublished(campaign: Campaign, now = new Date()): boolean {
  const status = campaignStatus(campaign, now);
  return status === "live" || status === "scheduled";
}

export function toPlacement(campaign: Campaign, now = new Date()): AdPlacement {
  return {
    campaignId: campaign.id,
    slotIds: campaign.slotIds,
    mediaUrl: campaign.mediaUrl,
    linkUrl: campaign.linkUrl,
    advertiser: campaign.client.nomeFantasia || campaign.client.razaoSocial,
    startsAt: startsAt(campaign.startDate),
    endsAt: endsAt(campaign.endDate),
    updatedAt: now.toISOString(),
  };
}

export function validateDates(startDate: string, endDate: string): string | null {
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoDate.test(startDate) || !isoDate.test(endDate)) return "Datas inválidas.";
  if (endDate < startDate) return "O fim precisa ser depois do início.";
  return null;
}

/** Converte um doc do Firestore (inclusive os do painel antigo em Angular). */
export function normalizeCampaign(id: string, data: Record<string, unknown>): Campaign {
  const legacyCreatedAt = toIso(data.createdAt);
  const legacyStart = legacyCreatedAt ? legacyCreatedAt.slice(0, 10) : "";
  const legacyDays = typeof data.days === "number" ? data.days : 0;
  const payment = (data.payment ?? {}) as Partial<Campaign["payment"]>;
  const client = (data.client ?? {}) as Partial<Campaign["client"]>;
  return {
    id,
    name: str(data.name),
    client: {
      id: str(client.id),
      razaoSocial: str(client.razaoSocial),
      nomeFantasia: str(client.nomeFantasia),
      cnpj: str(client.cnpj),
    },
    slotIds: Array.isArray(data.slotIds) ? (data.slotIds as string[]) : [],
    mediaUrl: str(data.mediaUrl),
    linkUrl: str(data.linkUrl),
    startDate: str(data.startDate) || legacyStart,
    endDate: str(data.endDate) || (legacyStart && legacyDays ? addDays(legacyStart, legacyDays - 1) : ""),
    priceCents:
      typeof data.priceCents === "number"
        ? data.priceCents
        : typeof data.price === "number"
          ? Math.round(data.price * 100)
          : 0,
    payment: {
      status: payment.status === "paid" ? "paid" : "pending",
      method: str(payment.method),
      note: str(payment.note),
      paidAt: str(payment.paidAt),
      markedBy: str(payment.markedBy),
    },
    live: data.live === true,
    createdAt: legacyCreatedAt,
    createdById: str(data.createdById),
    createdByName: str(data.createdByName),
    updatedAt: toIso(data.updatedAt),
  };
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toIso(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return (value.toDate() as Date).toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return "";
}
