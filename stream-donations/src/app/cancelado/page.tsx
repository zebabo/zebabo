import Link from "next/link";

export default function Cancelado() {
  return (
    <div className="rounded-2xl bg-zinc-900 p-6 text-center">
      <div className="text-5xl">🙃</div>
      <h1 className="mt-3 text-2xl font-bold">Pagamento cancelado</h1>
      <p className="mt-2 text-zinc-400">Não foi cobrado nada. Podes tentar de novo quando quiseres.</p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-xl bg-violet-600 px-5 py-3 font-semibold hover:bg-violet-500"
      >
        Tentar novamente
      </Link>
    </div>
  );
}
