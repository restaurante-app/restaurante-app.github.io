/* Arranque: banco local → (se houver internet e Supabase) baixa dados →
   dados iniciais → tela. Nada aqui espera a rede por mais de 4 segundos. */
(function () {
  'use strict';
  const P = window.P;
  P.VERSAO = '1.3.0';

  function comTempo(promessa, ms) {
    return Promise.race([promessa, new Promise(res => setTimeout(() => res(false), ms))]);
  }

  async function iniciar() {
    await P.Store.init();
    P.Sync.iniciar();
    // primeiro uso num aparelho novo: tenta baixar o que já existe na nuvem
    if (P.Sync.configurado() && navigator.onLine !== false && !P.Store.all('usuarios').length) {
      await comTempo(P.Sync.rodar(), 4000);
    }
    P.Seed.aplicar();
    P.Auth.travarSeExpirou();
    P.Fluxo.reconciliar();
    P.UI.tema();
    P.UI.montarCasca();
    P.UI.render();
    if (P.Sync.configurado()) P.Sync.agendar(800);

    const semSW = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && localStorage.getItem('pari.sw') !== '1';
    if ('serviceWorker' in navigator && location.protocol !== 'file:' && !semSW) {
      navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW', e));
      // o endereço é dividido com outros apps que limpam caches: refaz o nosso se sumir
      const garantir = () => navigator.serviceWorker.ready.then(r => { if (r.active) r.active.postMessage('garantir-cache'); }).catch(() => {});
      garantir();
      window.addEventListener('online', garantir);
    }
  }

  iniciar().catch(e => {
    console.error(e);
    document.getElementById('view').textContent = 'Erro ao iniciar: ' + e.message;
  });
})();
