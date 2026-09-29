// Edge Function "ler-nota": recebe a FOTO de uma nota/cupom de compra e devolve
// fornecedor, forma de pagamento e os itens (quantidade, preço, valor), já ligando
// cada item ao insumo das fichas quando for o mesmo produto.
//
// A chave da Anthropic fica SÓ aqui, como segredo do Supabase (ANTHROPIC_API_KEY);
// nunca vai para o site. Só atende quem fez login na nuvem do app.
import Anthropic from "npm:@anthropic-ai/sdk";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const ESQUEMA = {
  type: "object",
  additionalProperties: false,
  required: ["legivel", "fornecedor", "forma", "total_nota", "itens", "observacao"],
  properties: {
    legivel: { type: "boolean", description: "false se a foto não é uma nota de compra ou não dá para ler" },
    fornecedor: { type: "string", description: "nome da loja/fornecedor; vazio se não aparece" },
    forma: { type: "string", enum: ["DINHEIRO", "PIX", "CARTAO", "PRAZO", ""] },
    total_nota: { type: "number", description: "total a pagar impresso/escrito na nota; 0 se não aparece" },
    observacao: { type: "string", description: "aviso curto em português para quem vai conferir (item ilegível, desconto…); vazio se nada" },
    itens: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["descricao", "insumo_id", "quantidade", "unidade", "preco_unit", "valor"],
        properties: {
          descricao: { type: "string" },
          insumo_id: { type: "string", description: "id do insumo da lista, ou vazio se nenhum corresponde" },
          quantidade: { type: "number" },
          unidade: { type: "string", enum: ["kg", "L", "un"] },
          preco_unit: { type: "number" },
          valor: { type: "number" },
        },
      },
    },
  },
};

const INSTRUCOES = `Você lê fotos de notas de compra de um restaurante brasileiro (cupom fiscal, NFC-e, nota de feira/açougue/atacado, às vezes escrita à mão) e transcreve a compra.

Regras:
- Um item por linha de produto da nota. "valor" é o que foi pago naquela linha, em reais (número com ponto decimal).
- Se o produto corresponde a um insumo da lista (mesmo produto, mesmo que o nome esteja abreviado — ex.: "FILE PEITO FGO" = "Filé de frango"), preencha insumo_id com o id da lista e use a UNIDADE DO INSUMO: converta a quantidade (g → kg, ml → L, caixa/fardo → total de unidades ou kg quando der para saber pela descrição) e calcule preco_unit = valor ÷ quantidade nessa unidade.
- Se não corresponde a nenhum insumo (sacola, gelo, produto de limpeza, carvão…), deixe insumo_id vazio, use a descrição da nota em português legível e a unidade que fizer sentido.
- Na dúvida entre dois insumos, ou se não tiver certeza de que é o mesmo produto, deixe insumo_id vazio — errar a ligação estraga o custo das fichas.
- Desconto geral da nota: acrescente um item "Desconto" sem insumo, quantidade 1, unidade "un", com valor NEGATIVO. Não invente itens que não estão na foto.
- forma: DINHEIRO, PIX, CARTAO (débito ou crédito) ou PRAZO (fiado, "a prazo", boleto, "pagar dia…"); vazio se a nota não diz.
- Números ilegíveis: faça a melhor leitura e avise em "observacao".
- Se a foto não for uma nota de compra ou estiver ilegível, legivel = false e itens vazio.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "Método não permitido" }, 405);

  // só quem fez login na nuvem do app
  const auth = req.headers.get("Authorization") || "";
  const u = await fetch(Deno.env.get("SUPABASE_URL") + "/auth/v1/user", {
    headers: { Authorization: auth, apikey: Deno.env.get("SUPABASE_ANON_KEY") || "" },
  });
  if (!u.ok) return json({ erro: "Faça login na nuvem de novo (Mais → Nuvem)." }, 401);

  const chave = Deno.env.get("ANTHROPIC_API_KEY");
  if (!chave) return json({ erro: "Leitura por foto não configurada: falta o segredo ANTHROPIC_API_KEY no Supabase." }, 500);

  let corpo: { imagem?: string; tipo?: string; insumos?: { id: string; nome: string; unidade: string }[] };
  try { corpo = await req.json(); } catch { return json({ erro: "Pedido inválido" }, 400); }
  const imagem = String(corpo.imagem || "");
  const tipo = ["image/jpeg", "image/png", "image/webp"].includes(String(corpo.tipo)) ? String(corpo.tipo) : "image/jpeg";
  if (!imagem || imagem.length > 7_000_000) return json({ erro: "Foto ausente ou grande demais" }, 400);
  const insumos = Array.isArray(corpo.insumos) ? corpo.insumos.slice(0, 500) : [];
  const lista = insumos.map((i) => `${i.id} | ${i.nome} | ${i.unidade}`).join("\n") || "(nenhum)";

  const client = new Anthropic({ apiKey: chave });
  try {
    const resp = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: ESQUEMA } },
      system: INSTRUCOES,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: tipo, data: imagem } },
          { type: "text", text: "Insumos cadastrados (id | nome | unidade):\n" + lista + "\n\nTranscreva a nota da foto." },
        ],
      }],
    } as any);
    if (resp.stop_reason === "refusal") return json({ erro: "Não foi possível ler esta foto." }, 422);
    if (resp.stop_reason === "max_tokens") return json({ erro: "Nota longa demais para ler de uma vez." }, 422);
    const texto = resp.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
    return json(JSON.parse(texto));
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ erro: "Muitas leituras seguidas; tente em um minuto." }, 429);
    if (e instanceof Anthropic.AuthenticationError) return json({ erro: "Chave da Anthropic inválida (segredo ANTHROPIC_API_KEY)." }, 500);
    if (e instanceof Anthropic.APIError) return json({ erro: "Serviço de leitura indisponível (" + e.status + "). Tente de novo." }, 502);
    return json({ erro: "Falha ao ler a nota: " + String((e as Error)?.message || e).slice(0, 200) }, 500);
  }
});
