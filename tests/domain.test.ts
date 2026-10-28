// Regras de negócio puras. Rodar: `npm test`.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  campaignStatus,
  cannotGoLiveReason,
  endsAt,
  normalizeCampaign,
  shouldBePublished,
  startsAt,
  toPlacement,
} from "../src/lib/domain/campaign.ts";
import { groupReports } from "../src/lib/domain/reports.ts";
import { isValidCnpj, maskCnpj } from "../src/lib/domain/cnpj.ts";
import type { Campaign, ModerationDecision, Report } from "../src/lib/models.ts";

const NOW = new Date("2026-11-10T15:00:00Z");

function campaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    ...normalizeCampaign("k1", {}),
    name: "Placa Loja X",
    client: { id: "c1", razaoSocial: "Loja X LTDA", nomeFantasia: "Loja X", cnpj: "" },
    slotIds: ["placa-video"],
    mediaUrl: "https://x/placa.png",
    startDate: "2026-11-01",
    endDate: "2026-11-30",
    priceCents: 50000,
    ...overrides,
  };
}

const paid = { status: "paid", method: "pix", note: "", paidAt: "2026-11-01", markedBy: "adm" } as const;

describe("campanha", () => {
  test("incompleta é rascunho e não liga", () => {
    const draft = campaign({ mediaUrl: "" });
    assert.equal(campaignStatus(draft, NOW), "draft");
    assert.match(cannotGoLiveReason(draft, NOW)!, /arte/);
  });

  test("sem pagamento não liga", () => {
    assert.equal(campaignStatus(campaign(), NOW), "awaiting_payment");
    assert.equal(cannotGoLiveReason(campaign(), NOW), "A campanha ainda não foi paga.");
  });

  test("paga: desligada, agendada, no ar e encerrada", () => {
    assert.equal(campaignStatus(campaign({ payment: paid }), NOW), "ready");
    assert.equal(cannotGoLiveReason(campaign({ payment: paid }), NOW), null);
    const future = campaign({ payment: paid, live: true, startDate: "2026-11-20" });
    assert.equal(campaignStatus(future, NOW), "scheduled");
    assert.equal(shouldBePublished(future, NOW), true);
    assert.equal(campaignStatus(campaign({ payment: paid, live: true }), NOW), "live");
    const past = campaign({ payment: paid, live: true, endDate: "2026-11-09" });
    assert.equal(campaignStatus(past, NOW), "ended");
    assert.equal(shouldBePublished(past, NOW), false);
    assert.match(cannotGoLiveReason(past, NOW)!, /acabou/);
  });

  test("período vale o dia inteiro no horário de Brasília", () => {
    assert.equal(startsAt("2026-11-01"), "2026-11-01T03:00:00.000Z");
    assert.equal(endsAt("2026-11-30"), "2026-12-01T02:59:59.999Z");
  });

  test("o que vai para o app não tem dado do cliente além do nome", () => {
    const placement = toPlacement(campaign({ payment: paid, live: true }), NOW);
    assert.deepEqual(Object.keys(placement).sort(), [
      "advertiser", "campaignId", "endsAt", "linkUrl", "mediaUrl", "slotIds", "startsAt", "updatedAt",
    ]);
    assert.equal(placement.advertiser, "Loja X");
  });

  test("lê campanhas do painel antigo (price em reais, days, Timestamp)", () => {
    const legacy = normalizeCampaign("old", {
      name: "Antiga",
      price: 150.5,
      days: 10,
      status: "ACTIVE",
      createdAt: { toDate: () => new Date("2025-07-01T12:00:00Z") },
      client: { id: "c1", nomeFantasia: "Loja" },
    });
    assert.equal(legacy.priceCents, 15050);
    assert.equal(legacy.startDate, "2025-07-01");
    assert.equal(legacy.endDate, "2025-07-10");
    assert.equal(legacy.live, false);
    assert.equal(legacy.payment.status, "pending");
  });
});

describe("denúncias", () => {
  const report = (reporterId: string, targetId: string, createdAt: string, reason: Report["reason"] = "spam"): Report => ({
    id: `${reporterId}_challenge_${targetId}`,
    reporterId,
    targetType: "challenge",
    targetId,
    targetOwnerId: "bia",
    challengeId: targetId,
    reason,
    createdAt,
  });

  test("agrupa por alvo, conta pessoas distintas e põe pendentes primeiro", () => {
    const decided: ModerationDecision = {
      targetType: "challenge", targetId: "c2", status: "kept", note: "", decidedBy: "adm", decidedByName: "Adm",
      decidedAt: "2026-11-05T00:00:00Z",
    };
    const cases = groupReports(
      [
        report("r1", "c1", "2026-11-01T00:00:00Z", "sexual"),
        report("r2", "c1", "2026-11-02T00:00:00Z", "sexual"),
        report("r1", "c2", "2026-11-01T00:00:00Z"),
        report("r2", "c2", "2026-11-04T00:00:00Z"),
        report("r3", "c3", "2026-11-03T00:00:00Z"),
      ],
      new Map([["challenge_c2", decided]]),
    );
    assert.deepEqual(cases.map((c) => c.targetId), ["c1", "c3", "c2"]);
    assert.equal(cases[0].reporterCount, 2);
    assert.equal(cases[0].reasons.sexual, 2);
    assert.equal(cases[2].pendingCount, 0);
    assert.equal(cases[2].decision?.status, "kept");
  });

  test("denúncia nova depois da decisão reabre o caso", () => {
    const decided: ModerationDecision = {
      targetType: "challenge", targetId: "c1", status: "kept", note: "", decidedBy: "adm", decidedByName: "Adm",
      decidedAt: "2026-11-05T00:00:00Z",
    };
    const [entry] = groupReports(
      [report("r1", "c1", "2026-11-01T00:00:00Z"), report("r9", "c1", "2026-11-06T00:00:00Z")],
      new Map([["challenge_c1", decided]]),
    );
    assert.equal(entry.pendingCount, 1);
  });
});

describe("CNPJ", () => {
  test("máscara e dígitos verificadores", () => {
    assert.equal(maskCnpj("11222333000181"), "11.222.333/0001-81");
    assert.equal(isValidCnpj("11.222.333/0001-81"), true);
    assert.equal(isValidCnpj("11.222.333/0001-82"), false);
    assert.equal(isValidCnpj("11.111.111/1111-11"), false);
  });
});
