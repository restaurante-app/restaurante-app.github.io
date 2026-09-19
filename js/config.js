// ============================================================
//  CONFIGURAÇÃO DA NUVEM (Supabase)
//
//  Em branco: tudo funciona offline e fica só neste aparelho.
//
//  Para juntar computador e celulares: projeto NOVO no Supabase,
//  rodar o schema.sql no SQL Editor, criar o usuário da nuvem em
//  Authentication → Users e colar aqui os dois valores de
//  Project Settings → API (URL do projeto e a chave pública
//  "publishable"/"anon"). A chave pública pode ficar no código:
//  sem o e-mail e a senha da nuvem ela não abre nenhum dado.
// ============================================================
window.P = window.P || {};
P.CONFIG = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
};
