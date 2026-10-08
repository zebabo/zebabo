// Envia UMA tip de teste ao StreamElements com o mesmo body que o webhook usa,
// para confirmares que o alerta dispara na overlay.
//
// Uso (Node 20+):
//   node --env-file=.env.local scripts/se-test-tip.mjs
//   node --env-file=.env.local scripts/se-test-tip.mjs --imported=false
//   node --env-file=.env.local scripts/se-test-tip.mjs --message=""
//
// Atenção: é uma tip real no teu histórico do StreamElements (podes apagá-la no dashboard).

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, "").split("=");
    return [k, v.join("=")];
  }),
);

const { SE_CHANNEL_ID, SE_JWT } = process.env;
if (!SE_CHANNEL_ID || !SE_JWT) {
  console.error("Faltam SE_CHANNEL_ID e/ou SE_JWT (usa --env-file=.env.local).");
  process.exit(1);
}

const body = {
  user: {
    userId: `test_${Date.now()}`,
    username: args.name ?? "Teste",
    email: args.email ?? "teste@example.com",
  },
  provider: process.env.SE_TIP_PROVIDER || "stripe",
  message: args.message ?? "Tip de teste 🚀",
  amount: Number(args.amount ?? "2.5"),
  currency: "EUR",
  imported: (args.imported ?? process.env.SE_TIP_IMPORTED ?? "true").toLowerCase() !== "false",
};

console.log("POST body:", JSON.stringify(body, null, 2));

const res = await fetch(`https://api.streamelements.com/kappa/v2/tips/${encodeURIComponent(SE_CHANNEL_ID)}`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${SE_JWT}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  body: JSON.stringify(body),
});

console.log(`\nHTTP ${res.status} ${res.statusText}`);
console.log(await res.text());
process.exit(res.ok ? 0 : 1);
