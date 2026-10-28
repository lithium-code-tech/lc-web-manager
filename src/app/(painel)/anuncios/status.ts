import type { CampaignStatus } from "@/lib/domain/campaign";
import type { Tone } from "@/components/ui";

export const STATUS_TONES: Record<CampaignStatus, Tone> = {
  draft: "neutral",
  awaiting_payment: "warn",
  ready: "brand",
  scheduled: "brand",
  live: "ok",
  ended: "neutral",
};
