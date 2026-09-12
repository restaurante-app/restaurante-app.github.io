// ============================================================
//  CONFIGURAÇÃO DE SINCRONIZAÇÃO (Supabase)
//
//  Deixe em branco para usar só neste aparelho: tudo funciona
//  offline, os dados ficam guardados no celular.
//
//  Para juntar os dados de vários celulares (e o painel do dono
//  enxergar a contagem feita no celular da equipe), crie um
//  projeto NOVO no Supabase, rode o arquivo schema.sql no
//  SQL Editor e cole aqui os dois valores de
//  Project Settings → API.
// ============================================================
window.P = window.P || {};
P.CONFIG = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
};
