import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente em falta: ${name}`);
  }
  return value;
}

// Lidas só quando usadas, para o build não falhar sem env vars.
export const env = {
  stripeSecretKey: () => required("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: () => required("STRIPE_WEBHOOK_SECRET"),
  seChannelId: () => required("SE_CHANNEL_ID"),
  seJwt: () => required("SE_JWT"),
  seTipProvider: () => process.env.SE_TIP_PROVIDER || "stripe",
  seTipImported: () => (process.env.SE_TIP_IMPORTED ?? "true").toLowerCase() !== "false",
  siteUrl: () => required("NEXT_PUBLIC_SITE_URL").replace(/\/+$/, ""),
};
