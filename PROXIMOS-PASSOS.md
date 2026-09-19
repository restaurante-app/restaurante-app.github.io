# Próximos passos — onde paramos (19/09/2026)

## Situação

| O quê | Onde | Estado |
|---|---|---|
| App publicado (v1.2: compras, lucro ao vivo, nuvem com login) | ramo `main` → https://restaurante-app.github.io/ | **estável, em uso** |
| Redesenho visual "Brasa" (v1.3, em andamento) | ramo `redesign-brasa` (este) | **não publicado** |
| Nuvem (Supabase) | projeto ainda não criado | **esperando o dono** |

O site só publica o ramo `main`. Enquanto o redesenho estiver em `redesign-brasa`,
o app que está no celular não muda.

---

## 1. Terminar o redesenho "Brasa" (ramo `redesign-brasa`)

### Já feito
- **Identidade:** carvão quente + brilho de brasa; fonte única **Plus Jakarta Sans**
  (inclusive nos números grandes); grão fino de fundo; marca nova em SVG (espeto na
  brasa) no topo e na tela do PIN (`P.UI.marca`).
- **Cores validadas** com o validador de paleta (daltonismo): canais em ordem fixa
  salão `#3987e5` → espeto `#d95926` → marmita `#199e70` (tema claro `#2a78d6`,
  `#eb6834`, `#1baf7a`). Escuro passa tudo; no claro o verde-água fica abaixo de 3:1,
  então a legenda com valores precisa estar sempre visível (já está).
- **Status** sempre com ícone + texto (`P.UI.statusPill`), cores fixas
  bom `#0ca30c` / atenção `#fab219` / crítico `#d03b3b`, texto ajustado para 4,5:1.
- **Peças novas** em `js/ui.js`: `anel` (meta), `pilha` (barra empilhada dos canais),
  `colunas` (lucro por dia), `medidor` (com marcas de limite), `contar` (número que
  conta ao abrir), indicador deslizante nas abas, entrada suave das telas
  (atributo `data-entra` no `#view`, só ao trocar de tela).
- **Telas já com markup novo:** PIN, Painel (anel da meta, barra dos canais, colunas da
  semana, medidor da escada), Mesas (anel de tempo em cada mesa ocupada, número "03"),
  Comanda (selo da mesa, categorias em chips com contagem), Pagamento (ícones em
  círculo), Compras (iniciais do fornecedor), Fichas (medidor de food cost por prato
  com marcas 35%/40%, semáforo com ícone), Fluxo (onda no toque do +1).
- `css/app.css` reescrito inteiro no sistema novo.

### Falta (nesta ordem)
1. **CSS do botão de ação no topo** — o `ui.js` já cria `#top-acao` (Painel → botão
   "Relatório"), mas falta o estilo `.top-acao` em `css/app.css` (pílula pequena com
   ícone; esconder o texto em telas estreitas).
2. **Painel cabendo numa tela sem rolar.** Na última medida (390×844) sobravam 124 px;
   depois disso já saíram a faixa "Painel | Relatório" (≈40 px) e uma linha da semana
   (≈38 px). Medir de novo e, se precisar: número principal 2,15rem, anel 72 px,
   margens entre blocos 7–8 px. Conferir também 360×640 (media queries
   `max-height: 780px` e `690px` no CSS).
3. **Revisar tela por tela** (as 26 rotas) no escuro e no claro: textos cortados,
   contraste, espaçamentos. A varredura automática de erros está no histórico:
   percorrer `location.hash` por todas as rotas e checar "Erro ao abrir".
4. **Ícones do app (PNG)** em `icons/` ainda são os verdes antigos: redesenhar no
   estilo da marca nova (fundo carvão + espeto brasa) com System.Drawing, nos tamanhos
   192, 512 e 512 maskable.
5. **Relatório**: aplicar `colunas` nas vendas por hora (hoje são barras simples) e
   `pilha` no "Por canal".
6. **Subir a versão**: `sw.js` → `pari-v5`, `js/app.js` → `P.VERSAO = '1.3.0'`.
7. **Publicar:** juntar `redesign-brasa` no `main` e dar `git push` (o GitHub Pages
   publica sozinho em ~1 min). Conferir no ar: https://restaurante-app.github.io/

### Como testar localmente (sem mexer no ERP)
Subir um servidor estático da pasta (PowerShell `HttpListener` na porta 5611, em
segundo plano) e abrir `http://localhost:5611/` no navegador de teste. O validador de
paleta fica em `.claude/validate_palette.js` (ignorado pelo git) e roda no navegador:
`const v = await import('/.claude/validate_palette.js'); v.validate([...], { mode: 'dark', surface: '#161210', pairs: 'all' })`.

---

## 2. Ligar a nuvem (computador + celular com os mesmos dados)

O app já está pronto (login da nuvem protegido, v1.2 no ar). Falta o dono:

1. supabase.com → **New project** `restaurante`, região São Paulo.
2. **SQL Editor** → colar e rodar `schema.sql`.
3. **Authentication → Users → Add user** (e-mail + senha, marcar *Auto Confirm User*).
4. **Authentication → Sign In / Providers** → desligar *Allow new users to sign up*.
5. Mandar a **Project URL** e a chave **publishable/anon** (não a senha).

Depois: colar os dois valores em `js/config.js`, subir a versão do `sw.js`, publicar;
conectar o computador (pílula "conectar nuvem" no topo) e o celular (tela do PIN →
"Já uso em outro aparelho").

**Antes de tudo, no computador:** Mais → Ajustes → Backup → **Exportar** (os dados
de hoje estão só no navegador dele).
