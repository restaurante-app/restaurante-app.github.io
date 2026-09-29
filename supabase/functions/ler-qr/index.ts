// Edge Function "ler-qr": abre a página pública da NFC-e (o endereço do QR Code
// do cupom fiscal) e devolve o HTML para o app tirar os itens.
// Existe só porque o navegador não pode abrir o site da Sefaz direto (CORS).
// Grátis: não usa nenhuma API paga. Só atende quem fez login na nuvem do app
// e só abre endereços do governo (*.gov.br).

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "Método não permitido" }, 405);

  const u = await fetch(Deno.env.get("SUPABASE_URL") + "/auth/v1/user", {
    headers: { Authorization: req.headers.get("Authorization") || "", apikey: Deno.env.get("SUPABASE_ANON_KEY") || "" },
  });
  if (!u.ok) return json({ erro: "Faça login na nuvem de novo (Mais → Nuvem)." }, 401);

  let url: URL;
  try { url = new URL(String((await req.json()).url || "")); } catch { return json({ erro: "QR Code inválido" }, 400); }
  if (!/^https?:$/.test(url.protocol) || !url.hostname.endsWith(".gov.br")) {
    return json({ erro: "Esse QR Code não é de cupom fiscal (NFC-e)." }, 400);
  }

  try {
    const res = await fetch(url.toString(), {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
      signal: AbortSignal.timeout(25000),
    });
    const html = await res.text();
    if (!res.ok) return json({ erro: "A Sefaz respondeu " + res.status + ". Tente de novo mais tarde." }, 502);
    return json({ html: html.slice(0, 2_000_000), url: res.url });
  } catch (e) {
    return json({ erro: "Não deu para abrir o site da Sefaz: " + String((e as Error)?.message || e).slice(0, 160) }, 502);
  }
});
