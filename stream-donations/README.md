# Doações do stream (Stripe → StreamElements)

Next.js (App Router, TypeScript, Tailwind) para receber doações com **MB WAY** e **cartão** via Stripe Checkout e disparar o alerta de tip no **StreamElements**.

```
/                → formulário de doação
/obrigado        → sucesso
/cancelado       → pagamento cancelado
POST /api/checkout → valida (zod) e cria a Checkout Session
POST /api/webhook  → verifica assinatura Stripe e regista a tip no StreamElements
```

## Variáveis de ambiente

Copia `.env.example` para `.env.local` e preenche:

| Variável | Onde obter |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys (`sk_test_…` / `sk_live_…`) |
| `STRIPE_WEBHOOK_SECRET` | `stripe listen` (local) ou o endpoint criado no Dashboard (Vercel) |
| `SE_CHANNEL_ID` | StreamElements → perfil → Channels → *Account ID* |
| `SE_JWT` | StreamElements → perfil → Channels → *JWT Token* (expira; renovar periodicamente) |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` localmente, `https://o-teu-dominio` em produção |
| `SE_TIP_PROVIDER` *(opcional)* | valor de `provider` na tip (default `stripe`) |
| `SE_TIP_IMPORTED` *(opcional)* | valor do campo `imported` (default `true`; ver abaixo) |

Só `NEXT_PUBLIC_SITE_URL` chega ao browser. As restantes são lidas apenas em módulos `server-only`.

## Pedido enviado ao StreamElements

Segue o schema `NewTip` da spec OpenAPI oficial
([StreamElements/api-docs → `api.yaml`](https://github.com/StreamElements/api-docs/blob/main/api.yaml), `POST /tips/{channel}`),
onde **todos** estes campos são obrigatórios:

```http
POST https://api.streamelements.com/kappa/v2/tips/{SE_CHANNEL_ID}
Authorization: Bearer {SE_JWT}
Content-Type: application/json

{
  "user": {
    "userId": "cs_test_…",          // id da Checkout Session (não há userId Twitch)
    "username": "Nome",
    "email": "doador@exemplo.pt"    // email que o Stripe Checkout recolhe
  },
  "provider": "stripe",
  "message": "Mensagem",
  "amount": 5,
  "currency": "EUR",
  "imported": true
}
```

A spec não diz se `imported` afeta o alerta (o exemplo oficial usa `true` e a tip fica com
`transactionId: "IMPORTED"`). Por isso o valor é configurável com `SE_TIP_IMPORTED`.

### Confirmar que o alerta dispara (5 min)

1. Abre a tua overlay de alertas do StreamElements numa aba do browser (ou no OBS) e confirma que o
   alerta de **Tip** está ativo.
2. Na pasta do projeto, com `SE_CHANNEL_ID` e `SE_JWT` no `.env.local`:
   ```bash
   node --env-file=.env.local scripts/se-test-tip.mjs
   ```
   Deves ver `HTTP 200` e a tip criada. Vê se o alerta apareceu.
3. Se deu 200 mas **não** houve alerta, testa com `imported=false`:
   ```bash
   node --env-file=.env.local scripts/se-test-tip.mjs --imported=false
   ```
   Se este disparar, mete `SE_TIP_IMPORTED=false` no `.env.local` e na Vercel.
4. Testa também o caso sem mensagem (a mensagem é opcional no formulário):
   ```bash
   node --env-file=.env.local scripts/se-test-tip.mjs --message=""
   ```
   e um valor com cêntimos (`--amount=2.5`, é o default): a spec declara `amount` como inteiro.
   Se algum destes der `400`, a resposta diz qual campo falhou — avisa e ajusta-se o código.
5. Apaga as tips de teste no dashboard do StreamElements (Activity feed / Tips).

## Idempotência

Depois de registar a tip, o webhook escreve `se_tip_registered_at` no metadata do PaymentIntent.
Em cada evento lê o PaymentIntent e, se o marcador já existir, ignora. Assim retries do Stripe
ou a combinação `completed` + `async_payment_succeeded` nunca criam duas tips, mesmo entre
instâncias serverless diferentes (não é preciso base de dados).

Se o StreamElements falhar, o webhook devolve **500** e o Stripe volta a tentar (backoff até 3 dias),
para não perderes o alerta. A chamada ao StreamElements tem timeout de 8 s, por isso a resposta é sempre rápida.

---

## Testar localmente

1. `npm install` (gera o `package-lock.json` — faz commit dele) e `cp .env.example .env.local` (preenche com chaves **de teste**).
2. Ativa o MB WAY em modo teste: Stripe Dashboard → Settings → Payment methods → **MB WAY** → Turn on.
   (MB WAY exige pagamentos em EUR e uma conta Stripe num país suportado, ex: Portugal.)
3. Instala a [Stripe CLI](https://docs.stripe.com/stripe-cli), faz login e reencaminha os eventos:
   ```bash
   stripe login
   stripe listen --forward-to localhost:3000/api/webhook \
     --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed
   ```
   Copia o `whsec_…` que aparece para `STRIPE_WEBHOOK_SECRET` no `.env.local`.
4. Noutro terminal: `npm run dev` e abre http://localhost:3000.
5. Pagamento de teste:
   - **Cartão**: `4242 4242 4242 4242`, qualquer data futura, qualquer CVC.
   - **MB WAY**: escolhe MB WAY no Checkout e introduz um número de telemóvel português
     (ex: `912345678`). Em modo teste não é enviada nenhuma notificação: o Stripe simula a
     aprovação. Confirma em https://docs.stripe.com/payments/mb-way os números/comportamentos de teste
     para simular falhas.
6. No terminal do `stripe listen` deves ver `checkout.session.completed → 200`, e nos logs do
   `npm run dev`: `[webhook] Tip registada no StreamElements: …`.
   Abre a overlay de alertas do StreamElements (ou o *Activity feed*) para ver o alerta.
7. Para testar a idempotência: `stripe events resend evt_…` — deves ver `já registada … a ignorar`.

> A chamada ao StreamElements é real (não há modo teste): as tips de teste aparecem no teu
> histórico/top tippers. Podes apagá-las no dashboard do StreamElements.

## Deploy na Vercel

1. Faz push deste repositório e em https://vercel.com/new importa-o.
   **Root Directory**: `stream-donations` (o projeto está nesta pasta). Framework: Next.js (auto).
2. Em *Settings → Environment Variables* adiciona todas as variáveis (para começar, com as chaves de **teste**)
   e `NEXT_PUBLIC_SITE_URL=https://<o-teu-projeto>.vercel.app`. Faz *Redeploy* depois de mudar env vars.
3. Webhook em **modo teste**: Stripe Dashboard (com *Test mode* ligado) → Developers → Webhooks →
   *Add endpoint*:
   - URL: `https://<o-teu-projeto>.vercel.app/api/webhook`
   - Eventos: `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
     `checkout.session.async_payment_failed`
   - Copia o *Signing secret* (`whsec_…`) para `STRIPE_WEBHOOK_SECRET` na Vercel e faz redeploy.
4. Faz uma doação de teste no site da Vercel e confirma em Webhooks → endpoint → *Event deliveries*
   que a resposta foi `200`. Os logs estão em Vercel → Project → *Logs*.
5. **Produção**: desliga o *Test mode* no Stripe, ativa o MB WAY também em live, cria **outro** endpoint
   igual ao do passo 3 (os endpoints de teste e live são separados e têm secrets diferentes) e na Vercel
   troca `STRIPE_SECRET_KEY` para `sk_live_…` e `STRIPE_WEBHOOK_SECRET` para o secret do endpoint live.
   Redeploy e faz uma doação real de 1€ para validar.

## Notas

- O JWT do StreamElements expira; se os logs mostrarem `HTTP 401`, gera um novo e atualiza `SE_JWT`.
- Não há rate limiting no `/api/checkout`; se aparecer abuso, considera Vercel Firewall / BotID.
