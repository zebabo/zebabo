import { NextResponse } from "next/server";
import { donationSchema, toCents } from "@/lib/donation";
import { env } from "@/lib/env";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const parsed = donationSchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Dados inválidos.";
    return NextResponse.json({ error: first }, { status: 400 });
  }

  const { name, amount, message } = parsed.data;
  const siteUrl = env.siteUrl();
  const metadata = { donor_name: name, donor_message: message };

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      currency: "eur",
      payment_method_types: ["card", "mb_way"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: toCents(amount),
            product_data: { name: "Doação para o stream" },
          },
        },
      ],
      submit_type: "donate",
      locale: "pt",
      metadata,
      payment_intent_data: { metadata },
      success_url: `${siteUrl}/obrigado?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/cancelado`,
    });

    if (!session.url) {
      throw new Error("Checkout Session criada sem URL.");
    }
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[checkout] Erro ao criar Checkout Session:", err);
    return NextResponse.json(
      { error: "Não foi possível iniciar o pagamento. Tenta novamente." },
      { status: 500 },
    );
  }
}
