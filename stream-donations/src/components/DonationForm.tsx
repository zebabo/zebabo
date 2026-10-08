"use client";

import { useState } from "react";
import {
  AMOUNT_MAX,
  AMOUNT_MIN,
  MESSAGE_MAX,
  NAME_MAX,
  QUICK_AMOUNTS,
  donationSchema,
} from "@/lib/donation";

export default function DonationForm() {
  const [name, setName] = useState("");
  const [amountText, setAmountText] = useState("5");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const amount = Number(amountText.replace(",", "."));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = donationSchema.safeParse({ name, amount, message });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Não foi possível iniciar o pagamento.");
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-base text-zinc-100 placeholder-zinc-500 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30";

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-2xl bg-zinc-900/60 p-5" noValidate>
      <div>
        <label htmlFor="name" className="mb-1.5 block text-sm font-medium">
          Nome <span className="text-violet-400">*</span>
        </label>
        <input
          id="name"
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={NAME_MAX}
          required
          autoComplete="nickname"
          placeholder="O teu nome no chat"
        />
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-medium">Valor (€)</span>
        <div className="mb-2 grid grid-cols-3 gap-2">
          {QUICK_AMOUNTS.map((v) => {
            const active = amount === v;
            return (
              <button
                key={v}
                type="button"
                onClick={() => setAmountText(String(v))}
                className={`rounded-xl py-3 text-lg font-semibold transition ${
                  active
                    ? "bg-violet-600 text-white"
                    : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                }`}
              >
                {v}€
              </button>
            );
          })}
        </div>
        <input
          id="amount"
          aria-label="Outro valor em euros"
          className={inputClass}
          type="text"
          inputMode="decimal"
          value={amountText}
          onChange={(e) => setAmountText(e.target.value.replace(/[^0-9.,]/g, ""))}
          placeholder={`Outro valor (${AMOUNT_MIN}€ – ${AMOUNT_MAX}€)`}
        />
      </div>

      <div>
        <label htmlFor="message" className="mb-1.5 block text-sm font-medium">
          Mensagem <span className="text-zinc-500">(opcional)</span>
        </label>
        <textarea
          id="message"
          className={`${inputClass} min-h-24 resize-none`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={MESSAGE_MAX}
          rows={3}
          placeholder="Diz olá ao stream!"
        />
        <div className="mt-1 text-right text-xs text-zinc-500">
          {message.length}/{MESSAGE_MAX}
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-violet-600 py-4 text-lg font-bold text-white transition hover:bg-violet-500 disabled:opacity-60"
      >
        {loading
          ? "A redirecionar…"
          : `Doar ${Number.isFinite(amount) && amount > 0 ? amount.toFixed(2).replace(".", ",") + "€" : ""}`}
      </button>
    </form>
  );
}
