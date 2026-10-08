import "server-only";
import { env } from "./env";

export type Tip = {
  username: string;
  amount: number;
  currency: "EUR";
  message: string;
};

const SE_TIMEOUT_MS = 8000;

/**
 * Regista uma tip no StreamElements, o que faz disparar o alerta de "tip".
 * POST https://api.streamelements.com/kappa/v2/tips/{channel}
 * Devolve o _id da tip criada (se a API o devolver).
 */
export async function registerTip(tip: Tip): Promise<string | undefined> {
  const channelId = env.seChannelId();
  const url = `https://api.streamelements.com/kappa/v2/tips/${encodeURIComponent(channelId)}`;

  const body: Record<string, unknown> = {
    user: { username: tip.username },
    provider: env.seTipProvider(),
    message: tip.message,
    amount: tip.amount,
    currency: tip.currency,
  };
  if (env.seTipImported()) {
    body.imported = true;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.seJwt()}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(SE_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(
      `[StreamElements] Falha de rede/timeout ao registar tip: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const text = await res.text();
  if (!res.ok) {
    const hint =
      res.status === 401 || res.status === 403
        ? " (JWT inválido/expirado ou SE_CHANNEL_ID errado — gera um JWT novo no dashboard)"
        : res.status === 400
          ? " (body rejeitado — ver detalhe acima)"
          : "";
    throw new Error(
      `[StreamElements] HTTP ${res.status} ${res.statusText}${hint}. Resposta: ${text.slice(0, 1000)}`,
    );
  }

  try {
    const json = JSON.parse(text) as { _id?: string };
    return json._id;
  } catch {
    return undefined;
  }
}
