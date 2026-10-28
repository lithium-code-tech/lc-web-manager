import { z } from "zod";

const optionalUrl = z.union([z.literal(""), z.url({ protocol: /^https?$/, message: "Link inválido." })]);
const isoDate = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")]);

/** Campos que a equipe edita. Pagamento e "no ar" têm rotas próprias. */
export const campaignFields = z.object({
  name: z.string().trim().min(2, "Dê um nome para a campanha.").max(120),
  clientId: z.string().max(128).default(""),
  slotIds: z.array(z.string().min(1).max(64)).max(20).default([]),
  mediaUrl: optionalUrl.default(""),
  linkUrl: optionalUrl.default(""),
  startDate: isoDate.default(""),
  endDate: isoDate.default(""),
  priceCents: z.number().int().min(0).max(100_000_000).default(0),
});

export type CampaignFields = z.infer<typeof campaignFields>;
