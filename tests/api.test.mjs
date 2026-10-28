// Testa as rotas /api de ponta a ponta: emuladores do Firebase + `next dev`.
// Rodar: `npm run test:api` (precisa de Java 21+ para os emuladores).
import { spawn } from "node:child_process";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const PROJECT_ID = "demo-skatego";
const PORT = 3123;
const BASE = `http://127.0.0.1:${PORT}`;
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";

initializeApp({ projectId: PROJECT_ID });
const db = getFirestore();
const auth = getAuth();

let server;
const tokens = {};

async function createUser(key, email, extra = {}) {
  const user = await auth.createUser({ email, password: "senha-123", ...extra });
  const response = await fetch(
    `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`,
        {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "senha-123", returnSecureToken: true }),
    },
  );
  tokens[key] = (await response.json()).idToken;
  assert.ok(tokens[key], `sem token para ${email}`);
  return user.uid;
}

async function call(path, { as, method = "GET", body } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(as ? { Authorization: `Bearer ${tokens[as]}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, json: await response.json().catch(() => ({})) };
}

const ids = {};

before(async () => {
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", String(PORT)], {
    env: {
      ...process.env,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: PROJECT_ID,
      FIREBASE_SERVICE_ACCOUNT_JSON: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stderr.on("data", (chunk) => process.stderr.write(chunk));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("next dev não subiu")), 90_000);
    server.stdout.on("data", (chunk) => {
      if (/Ready|ready in/i.test(chunk.toString())) {
        clearTimeout(timer);
        resolve();
      }
    });
  });

  ids.adm = await createUser("adm", "adm@skatego.test");
  ids.mkt = await createUser("mkt", "mkt@skatego.test");
  ids.bia = await createUser("bia", "bia@skatego.test");
  await db.doc(`User/${ids.adm}`).set({ userId: ids.adm, email: "adm@skatego.test", name: "Adm", rule: "ADM" });
  await db.doc(`User/${ids.mkt}`).set({ userId: ids.mkt, email: "mkt@skatego.test", name: "Mkt", rule: "MKT" });
  await db.doc(`Skater/${ids.bia}`).set({ skaterId: ids.bia, name: "Bia", nickName: "bia", imageUrl: "", following: [], followers: [], trophies: [] });
  await db.doc(`Skater/${ids.bia}/private/account`).set({ email: "bia@skatego.test", birthDate: "1999-01-01" });
  await db.doc("Challenges/c1").set({ createdBy: { skaterId: ids.bia, nickName: "bia" }, challengedSkaterVideo: "https://x/v.mp4", responderIds: [] });
  await db.doc("Challenges/c2").set({ createdBy: { skaterId: "outro" }, responderIds: [ids.bia] });
  await db.doc(`Challenges/c2/responses/${ids.bia}`).set({ responderSkaterId: ids.bia, mediaUrl: "https://x/r.mp4", mediaType: "video" });
  await db.doc("Client/cl1").set({ razaoSocial: "Loja X LTDA", nomeFantasia: "Loja X", cnpj: "11.222.333/0001-81", email: "contato@lojax.test" });
  for (const reporter of ["r1", "r2", "r3"]) {
    await db.doc(`reports/${reporter}_challenge_c1`).set({
      reporterId: reporter, targetType: "challenge", targetId: "c1", targetOwnerId: ids.bia, challengeId: "c1",
      reason: "spam", createdAt: new Date(Date.now() - 60_000).toISOString(),
    });
  }
});

after(() => server?.kill());

describe("acesso", () => {
  test("sem token é 401; skater do app é 403", async () => {
    assert.equal((await call("/api/stats")).status, 401);
    assert.equal((await call("/api/stats", { as: "bia" })).status, 403);
    const stats = await call("/api/stats", { as: "mkt" });
    assert.equal(stats.status, 200);
    assert.equal(stats.json.openReports, null, "MKT não vê denúncias");
  });

  test("MKT não entra em moderação, contas nem equipe", async () => {
    assert.equal((await call("/api/reports", { as: "mkt" })).status, 403);
    assert.equal((await call(`/api/skaters/${ids.bia}/ban`, { as: "mkt", method: "POST", body: { reason: "teste" } })).status, 403);
    assert.equal((await call("/api/staff", { as: "mkt", method: "POST", body: { name: "X", email: "x@x.com", rule: "ADM" } })).status, 403);
  });
});

describe("anúncios", () => {
  test("posição: só ADM cria", async () => {
    const slot = { id: "placa-video", name: "Placa", description: "", width: 1200, height: 200 };
    assert.equal((await call("/api/slots", { as: "mkt", method: "POST", body: slot })).status, 403);
    assert.equal((await call("/api/slots", { as: "adm", method: "POST", body: slot })).status, 200);
  });

  test("ciclo: cria, não liga sem pagar, ADM confirma, liga, publica sem dado do cliente", async () => {
    const created = await call("/api/campaigns", {
      as: "mkt",
      method: "POST",
      body: {
        name: "Loja X — novembro", clientId: "cl1", slotIds: ["placa-video"], mediaUrl: "https://x/placa.png",
        linkUrl: "https://lojax.test", startDate: "2026-01-01", endDate: "2099-12-31", priceCents: 50000,
      },
    });
    assert.equal(created.status, 200, JSON.stringify(created.json));
    ids.campaign = created.json.id;

    const early = await call(`/api/campaigns/${ids.campaign}/live`, { as: "mkt", method: "POST", body: { live: true } });
    assert.equal(early.status, 409);
    assert.match(early.json.error, /paga/);

    assert.equal((await call(`/api/campaigns/${ids.campaign}/payment`, { as: "mkt", method: "POST", body: { status: "paid" } })).status, 403);
    assert.equal((await call(`/api/campaigns/${ids.campaign}/payment`, { as: "adm", method: "POST", body: { status: "paid", method: "Pix" } })).status, 200);

    const live = await call(`/api/campaigns/${ids.campaign}/live`, { as: "mkt", method: "POST", body: { live: true } });
    assert.equal(live.status, 200);
    assert.equal(live.json.published, true);
    const placement = (await db.doc(`adPlacements/${ids.campaign}`).get()).data();
    assert.equal(placement.advertiser, "Loja X");
    assert.equal(placement.cnpj, undefined);
    assert.equal(JSON.stringify(placement).includes("contato@lojax.test"), false);
  });

  test("depois de pago, MKT não muda o valor", async () => {
    const campaign = (await db.doc(`Campaign/${ids.campaign}`).get()).data();
    const body = {
      name: campaign.name, clientId: "cl1", slotIds: campaign.slotIds, mediaUrl: campaign.mediaUrl, linkUrl: campaign.linkUrl,
      startDate: campaign.startDate, endDate: campaign.endDate, priceCents: 1,
    };
    assert.equal((await call(`/api/campaigns/${ids.campaign}`, { as: "mkt", method: "PATCH", body })).status, 403);
    assert.equal((await call(`/api/campaigns/${ids.campaign}`, { as: "mkt", method: "PATCH", body: { ...body, priceCents: 50000, name: "Novo nome" } })).status, 200);
    assert.equal((await db.doc(`adPlacements/${ids.campaign}`).get()).exists, true, "edição mantém no ar");
  });

  test("desfazer pagamento tira do ar", async () => {
    assert.equal((await call(`/api/campaigns/${ids.campaign}/payment`, { as: "adm", method: "POST", body: { status: "pending" } })).status, 200);
    assert.equal((await db.doc(`adPlacements/${ids.campaign}`).get()).exists, false);
    assert.equal((await db.doc(`Campaign/${ids.campaign}`).get()).data().live, false);
  });
});

describe("moderação e contas", () => {
  test("fila agrupa as denúncias; manter grava a decisão e fecha o caso", async () => {
    const open = await call("/api/reports", { as: "adm" });
    assert.equal(open.status, 200);
    const entry = open.json.cases.find((c) => c.targetId === "c1");
    assert.equal(entry.reporterCount, 3);
    assert.equal(entry.preview.ownerNick, "bia");

    const decided = await call("/api/reports/decision", { as: "adm", method: "POST", body: { targetType: "challenge", targetId: "c1", action: "keep" } });
    assert.equal(decided.status, 200);
    assert.equal((await db.doc("moderation/challenge_c1").get()).data().status, "kept");
    assert.equal((await call("/api/reports", { as: "adm" })).json.cases.length, 0);
  });

  test("bloquear corta o login e esconde o conteúdo; desbloquear devolve", async () => {
    const banned = await call(`/api/skaters/${ids.bia}/ban`, { as: "adm", method: "POST", body: { reason: "Spam repetido" } });
    assert.equal(banned.status, 200);
    assert.equal(banned.json.hiddenItems, 2);
    assert.equal((await auth.getUser(ids.bia)).disabled, true);
    assert.equal((await db.doc(`Skater/${ids.bia}`).get()).data().banned, true);
    assert.equal((await db.doc(`Challenges/c2/responses/${ids.bia}`).get()).data().hidden, true);

    const unbanned = await call(`/api/skaters/${ids.bia}/ban`, { as: "adm", method: "DELETE" });
    assert.equal(unbanned.json.restoredItems, 2);
    assert.equal((await auth.getUser(ids.bia)).disabled, false);
    assert.equal((await db.doc("Challenges/c1").get()).data().hidden, false);
  });

  test("dados privados do skater só para ADM", async () => {
    const details = await call(`/api/skaters/${ids.bia}`, { as: "adm" });
    assert.equal(details.json.account.birthDate, "1999-01-01");
    assert.equal(details.json.challengesCreated, 1);
  });

  test("não bloqueia nem exclui alguém da equipe", async () => {
    await db.doc(`Skater/${ids.mkt}`).set({ skaterId: ids.mkt, nickName: "mkt" });
    assert.equal((await call(`/api/skaters/${ids.mkt}/ban`, { as: "adm", method: "POST", body: { reason: "teste" } })).status, 409);
  });

  test("equipe: adiciona, não remove a si mesmo, remove os outros", async () => {
    const added = await call("/api/staff", { as: "adm", method: "POST", body: { name: "Nova Pessoa", email: "Nova@Skatego.test", rule: "MKT" } });
    assert.equal(added.status, 200);
    assert.equal(added.json.existingAccount, false);
    const uid = added.json.user.userId;
    assert.equal((await auth.getUser(uid)).email, "nova@skatego.test");
    assert.equal((await call("/api/staff", { as: "adm", method: "POST", body: { name: "Nova", email: "nova@skatego.test", rule: "MKT" } })).status, 409);

    assert.equal((await call(`/api/staff/${ids.adm}`, { as: "adm", method: "DELETE" })).status, 409);
    assert.equal((await call(`/api/staff/${ids.adm}`, { as: "adm", method: "PATCH", body: { rule: "MKT" } })).status, 409);
    const removed = await call(`/api/staff/${uid}`, { as: "adm", method: "DELETE" });
    assert.equal(removed.json.loginDeleted, true);
    assert.equal((await db.doc(`User/${uid}`).get()).exists, false);
  });

  test("excluir skater entra na fila do job e corta o acesso", async () => {
    assert.equal((await call(`/api/skaters/${ids.bia}`, { as: "adm", method: "DELETE" })).status, 200);
    assert.equal((await db.doc(`deletionRequests/${ids.bia}`).get()).data().requestedBy, ids.adm);
    assert.equal((await auth.getUser(ids.bia)).disabled, true);
  });

  test("toda ação ficou no registro de atividade", async () => {
    const { json } = await call("/api/audit", { as: "adm" });
    const actions = json.entries.map((entry) => entry.action);
    for (const action of ["campaign.create", "campaign.payment.paid", "campaign.on", "moderation.keep", "skater.ban", "skater.unban", "staff.create", "staff.delete", "skater.delete"]) {
      assert.ok(actions.includes(action), `faltou ${action}`);
    }
  });
});
