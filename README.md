# Painel SkateGo (lc-web-manager)

Painel da equipe do SkateGo: moderação de denúncias, bloqueio e exclusão de
contas, equipe, clientes e campanhas de anúncio (placas no app).

Next.js 16 (App Router) + Firebase. Mesmo projeto Firebase do app
(`skate-go-android`); as regras do Firestore/Storage ficam no repositório do
app (`skatego-rn/firestore.rules`).

## Como funciona

- **Navegador**: login com Firebase Auth e leituras protegidas pelas regras
  (só quem tem doc em `User/{uid}` com `rule` `ADM` ou `MKT` entra).
- **API (`src/app/api`)**: tudo que mexe em conta de outra pessoa ou em dinheiro
  roda no servidor com `firebase-admin`, conferindo o papel de quem chama, e
  grava em `auditLog`.

| Papel | Pode |
|---|---|
| ADM | Tudo: denúncias, bloqueio/exclusão de skaters, equipe, posições, pagamentos, chaves |
| MKT | Clientes e campanhas: cria, edita, liga e desliga (só as pagas) |

### Anúncios

`Campaign` guarda os dados comerciais (cliente, valor, pagamento) e só a API
grava. Quando uma campanha paga é ligada, a API publica `adPlacements/{id}`
— só arte, link, nome do anunciante, posições e período — que é o que o app
lê. Desligar, desfazer o pagamento ou o fim do período tiram do ar.

Estados: rascunho → aguardando pagamento → pago · desligado → agendado / no ar → encerrado.

Posições (`adSlots`) são cadastradas em **Posições no app**; a primeira é a
`placa-video` (1200×200px, abaixo do vídeo).

### Moderação

A fila agrupa as denúncias (`reports`) por conteúdo. Decisões ficam em
`moderation/{tipo}_{id}`; o job de manutenção do app (que esconde conteúdo com
3+ denúncias) passa a contar só denúncias feitas depois da decisão.

Bloquear: desativa o login, derruba a sessão e esconde o que a pessoa publicou
(`hiddenByBan`). Excluir: cria `deletionRequests/{uid}` e o job apaga tudo em
até 1 hora.

## Rodar

```bash
cp .env.example .env.local   # preencha a config web do Firebase
npm install
npm run dev
```

Para a API funcionar localmente contra produção é preciso
`FIREBASE_SERVICE_ACCOUNT_JSON` no `.env.local`. Prefira os emuladores:

```bash
npx firebase emulators:start --project demo-skatego
# em outro terminal:
NEXT_PUBLIC_FIREBASE_EMULATORS=1 NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-skatego \
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npm run dev
```

## Testes

```bash
npm test          # regras de negócio (campanha, denúncias, CNPJ)
npm run test:api  # rotas /api de ponta a ponta nos emuladores (precisa de Java 21)
```

## Deploy (Vercel)

Variáveis de ambiente: as `NEXT_PUBLIC_FIREBASE_*` do `.env.example` e
`FIREBASE_SERVICE_ACCOUNT_JSON` (JSON da conta de serviço, só no servidor).
No Firebase Auth, adicione o domínio do painel em *Authorized domains*.
