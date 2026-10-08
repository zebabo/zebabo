import DonationForm from "@/components/DonationForm";

export default function Home() {
  return (
    <>
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-bold">Apoia o stream 💜</h1>
        <p className="mt-1 text-sm text-zinc-400">
          A tua doação aparece no ecrã durante o live. Paga com MB WAY ou cartão.
        </p>
      </header>
      <DonationForm />
      <p className="mt-6 text-center text-xs text-zinc-500">
        Pagamentos processados de forma segura pelo Stripe.
      </p>
    </>
  );
}
