# Próximos passos — situação em 22/09/2026

## Situação

| O quê | Onde | Estado |
|---|---|---|
| App v1.3 "Brasa" (visual novo + compras, lucro ao vivo, nuvem com login) | ramo `main` → https://restaurante-app.github.io/ | **publicado** |
| Nuvem (Supabase) | projeto ainda não criado | **esperando o dono** |

## Redesenho "Brasa" (v1.3), concluído

- Identidade: carvão quente + brasa, fonte única **Plus Jakarta Sans**, marca nova
  (espeto na brasa) no topo, na tela do PIN e nos ícones do app (`icons/*.png`,
  desenhados com System.Drawing).
- Cores dos canais validadas para daltonismo, em ordem fixa salão → espeto → marmita.
  Status sempre com ícone + texto.
- Painel cabe numa tela sem rolar em 390×844 e em 360×640. No telefone pequeno
  (altura ≤ 690 px) as linhas de food cost/bebida e volumes da semana ficam só no Relatório.
- Relatório: barra empilhada por canal + colunas de vendas por hora com o pico em
  destaque, e tabela Hora | Faturamento | Itens | %.
- Topo: botão de ação (`.top-acao`); em telas estreitas a pílula "no aparelho/online"
  vira só o ponto (avisos como "offline" e "conectar nuvem" continuam com texto).
- As 30 rotas foram abertas no escuro e no claro, sem erros.

## Ligar a nuvem (computador + celular com os mesmos dados)

O app já está pronto. Falta o dono:

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

## Ideias para depois (não pedidas ainda)

- Etapas 3/4/5 do prompt original (Espetos, Bebidas, Rota) não foram feitas.

## Como testar localmente

`.claude/launch.json` sobe um servidor PowerShell na porta 5611 (preview `restaurante-pari`).
Em localhost o service worker fica desligado; para testá-lo: `localStorage.setItem('pari.sw','1')`.
Publicar: subir `CACHE` em `sw.js` + `git push` no `main` (GitHub Pages publica em ~1 min).
