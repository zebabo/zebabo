import { z } from "zod";

// Partilhado entre cliente e servidor (sem segredos aqui).
export const NAME_MAX = 25;
export const MESSAGE_MAX = 200;
export const AMOUNT_MIN = 1;
export const AMOUNT_MAX = 500;
export const QUICK_AMOUNTS = [2, 5, 10] as const;

export const donationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "O nome é obrigatório.")
    .max(NAME_MAX, `O nome tem no máximo ${NAME_MAX} caracteres.`),
  amount: z
    .number({ invalid_type_error: "Valor inválido." })
    .finite("Valor inválido.")
    .min(AMOUNT_MIN, `O valor mínimo é ${AMOUNT_MIN}€.`)
    .max(AMOUNT_MAX, `O valor máximo é ${AMOUNT_MAX}€.`)
    .refine(
      (v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6,
      "Usa no máximo 2 casas decimais.",
    ),
  message: z
    .string()
    .trim()
    .max(MESSAGE_MAX, `A mensagem tem no máximo ${MESSAGE_MAX} caracteres.`)
    .optional()
    .default(""),
});

export type DonationInput = z.infer<typeof donationSchema>;

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}
