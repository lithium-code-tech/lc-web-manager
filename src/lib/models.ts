// Tipos das coleções do Firebase do SkateGo (projeto skate-go-android) que o
// painel lê e grava. O app (skatego-rn) é a fonte dos tipos de Skater e reports.

export const STAFF_ROLES = ["ADM", "MKT"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const ROLE_LABELS: Record<StaffRole, string> = {
  ADM: "Administrador",
  MKT: "Marketing",
};

/** Equipe do painel (User/{uid}). */
export type StaffUser = {
  userId: string;
  email: string;
  name: string;
  imageURL: string;
  phoneNumber: string;
  rule: StaffRole;
};

/** Perfil público do app (Skater/{uid}). `banned*` só o servidor grava. */
export type Skater = {
  skaterId: string;
  name: string;
  nickName: string;
  imageUrl: string;
  following: string[];
  followers: string[];
  trophies: string[];
  banned?: boolean;
  bannedAt?: string;
  bannedReason?: string;
};

export type ReportTargetType = "challenge" | "response" | "skater";

export const REPORT_REASONS = {
  sexual: "Nudez ou conteúdo sexual",
  violence: "Violência ou risco à vida",
  hate: "Ódio, assédio ou bullying",
  spam: "Spam ou golpe",
  other: "Outro motivo",
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;

/** Denúncia feita no app (reports/{reporter}_{type}_{target}). */
export type Report = {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  /** challengeId, `${challengeId}__${ownerId}` ou skaterId. */
  targetId: string;
  targetOwnerId: string;
  challengeId: string;
  reason: ReportReason;
  createdAt: string;
};

/** Decisão da equipe sobre um alvo (moderation/{targetType}_{targetId}). */
export type ModerationDecision = {
  targetType: ReportTargetType;
  targetId: string;
  status: "kept" | "removed";
  note: string;
  decidedBy: string;
  decidedByName: string;
  decidedAt: string;
};

export type Client = {
  id: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  inscricaoEstadual?: string;
  endereco: string;
  telefone: string;
  email: string;
  responsavel: string;
};

/** Lugar do app onde um anúncio aparece (adSlots/{id}). */
export type AdSlot = {
  id: string;
  name: string;
  description: string;
  /** Tamanho recomendado da arte, em px. */
  width: number;
  height: number;
  active: boolean;
};

export type PaymentStatus = "pending" | "paid";

/** Campanha (Campaign/{id}) — dados comerciais, nunca vão para o app. */
export type Campaign = {
  id: string;
  name: string;
  client: Pick<Client, "id" | "razaoSocial" | "nomeFantasia" | "cnpj">;
  slotIds: string[];
  mediaUrl: string;
  /** Destino do toque na placa (opcional). */
  linkUrl: string;
  /** AAAA-MM-DD, inclusive, no horário de Brasília. */
  startDate: string;
  endDate: string;
  priceCents: number;
  payment: {
    status: PaymentStatus;
    method: string;
    note: string;
    paidAt: string;
    markedBy: string;
  };
  /** Ligado pela equipe. Só vai ao ar se estiver pago e dentro do período. */
  live: boolean;
  createdAt: string;
  createdById: string;
  createdByName: string;
  updatedAt: string;
};

/** O que o app lê (adPlacements/{campaignId}): só o necessário para exibir. */
export type AdPlacement = {
  campaignId: string;
  slotIds: string[];
  mediaUrl: string;
  linkUrl: string;
  advertiser: string;
  startsAt: string;
  endsAt: string;
  updatedAt: string;
};

export type AuditEntry = {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
  at: string;
};
