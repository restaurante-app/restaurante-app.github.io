/* Service worker: guarda o app no celular para abrir sem internet.
   Os dados NÃO passam por aqui (ficam no IndexedDB e vão direto ao Supabase).
   Sempre que mudar algum arquivo do app, aumente a versão abaixo.

   Publicado em endereço próprio (restaurante-app.github.io). Mesmo assim, por
   garantia: só apaga cache com o prefixo deste app e refaz o cache se sumir. */
const PREFIXO = 'pari-';
const CACHE = PREFIXO + 'v4';
const FONTES = PREFIXO + 'fontes'; // fonte Inter (Google Fonts): guardada na 1ª abertura com internet
const ARQUIVOS = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/config.js', './js/core.js', './js/db.js', './js/calc.js', './js/seed.js', './js/ui.js', './js/auth.js',
  './js/fluxo.js', './js/fichas.js', './js/mesas.js', './js/painel.js', './js/compras.js', './js/relatorio.js',
  './js/mais.js', './js/app.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith(PREFIXO) && k !== CACHE && k !== FONTES).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// a página pede ao abrir: se o cache sumiu (ou ficou incompleto), baixa tudo de novo
self.addEventListener('message', e => {
  if (e.data !== 'garantir-cache') return;
  e.waitUntil(caches.open(CACHE).then(c => c.keys().then(ks => (ks.length < ARQUIVOS.length ? c.addAll(ARQUIVOS) : null))).catch(() => {}));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    // fonte: usa a guardada; atualiza em segundo plano quando houver rede
    e.respondWith(caches.open(FONTES).then(c => c.match(e.request).then(guardada => {
      const rede = fetch(e.request).then(res => { if (res.ok || res.type === 'opaque') c.put(e.request, res.clone()); return res; }).catch(() => guardada);
      return guardada || rede;
    })));
    return;
  }
  if (url.origin !== self.location.origin) return; // Supabase etc.: rede direta
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request).then(res => {
      if (res.ok) { const copia = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(cs => (cs.length ? cs[0].focus() : self.clients.openWindow('./#/fichas'))));
});
