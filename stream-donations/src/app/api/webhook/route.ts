import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { env } from "@/lib/env";
import { registerTip } from "@/lib/streamelements";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Marcador guardado no PaymentIntent depois de a tip ser registada no StreamElements.
// É o que garante idempotência entre instâncias serverless (o Stripe é a "base de dados").
const SE_MARKER = "se_tip_registered_at";

// Proteção extra contra entregas concorrentes na mesma instância.
const inFlight = new Set<string>();

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Sem assinatura." }, { status: 400 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, env.stripeWebhookSecret());
  } catch (err) {
    console.error("[webhook] Assinatura inválida:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.payment_status !== "paid") {
        console.info(
          `[webhook] ${session.id} concluída mas payment_status=${session.payment_status}; à espera de async_payment_succeeded.`,
        );
        return ok();
      }
      return handlePaidSession(session, event.id);
    }
    case "checkout.session.async_payment_succeeded":
      return handlePaidSession(event.data.object, event.id);
    case "checkout.session.async_payment_failed":
      console.warn(`[webhook] Pagamento assíncrono falhou para ${event.data.object.id}.`);
      return ok();
    default:
      return ok();
  }
}

function ok() {
  return NextResponse.json({ received: true });
}

async function handlePaidSession(session: Stripe.Checkout.Session, eventId: string) {
  const stripe = getStripe();
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;

  if (!paymentIntentId) {
    console.error(`[webhook] ${session.id} sem payment_intent; não é possível garantir idempotência.`);
    return ok();
  }

  if (inFlight.has(paymentIntentId)) {
    console.info(`[webhook] ${session.id} já está a ser processada (evento ${eventId}); a ignorar.`);
    return ok();
  }
  inFlight.add(paymentIntentId);

  try {
    // Ler sempre o estado atual (o evento pode ser um retry antigo).
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (pi.metadata?.[SE_MARKER]) {
      console.info(`[webhook] Tip de ${session.id} já registada em ${pi.metadata[SE_MARKER]}; a ignorar.`);
      return ok();
    }

    const amountCents = session.amount_total ?? pi.amount_received;
    const username = session.metadata?.donor_name?.trim() || "Anónimo";
    const message = session.metadata?.donor_message ?? "";

    let tipId: string | undefined;
    try {
      tipId = await registerTip({
        userId: session.id,
        username,
        email: session.customer_details?.email ?? undefined,
        amount: amountCents / 100,
        currency: "EUR",
        message,
      });
    } catch (err) {
      // 500 => o Stripe volta a tentar mais tarde (backoff até 3 dias).
      console.error(
        `[webhook] ERRO ao registar tip no StreamElements (session=${session.id}, evento=${eventId}):`,
        err instanceof Error ? err.message : err,
      );
      return NextResponse.json({ error: "Falha ao registar tip." }, { status: 500 });
    }

    console.info(
      `[webhook] Tip registada no StreamElements: ${username} ${(amountCents / 100).toFixed(2)}€ (session=${session.id}, tip=${tipId ?? "?"}).`,
    );

    try {
      await stripe.paymentIntents.update(paymentIntentId, {
        metadata: { [SE_MARKER]: new Date().toISOString(), se_tip_id: tipId ?? "" },
      });
    } catch (err) {
      // A tip já foi criada: devolver 200 para não haver duplicados por retry.
      console.error(`[webhook] Tip criada mas falhou a marcação no PaymentIntent ${paymentIntentId}:`, err);
    }

    return ok();
  } catch (err) {
    console.error(`[webhook] Erro inesperado ao processar ${session.id}:`, err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  } finally {
    inFlight.delete(paymentIntentId);
  }
}
