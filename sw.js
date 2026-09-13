/* Nossas Viagens — service worker
   TROQUE A VERSAO A CADA PUBLICAÇÃO. É isso que faz o app atualizar
   no celular de quem já instalou; sem trocar, o aparelho continua
   servindo a versão velha do cache. */
const VERSAO = 'nv-v1';

const CACHE_APP   = 'app-' + VERSAO;
const CACHE_TILES = 'tiles-v1';      // imagens do mapa, sobrevivem à troca de versão
const TETO_TILES  = 4000;

const CASCA = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icones/icone-192.png',
  './icones/icone-512.png',
  './icones/icone-maskable-512.png',
  './icones/apple-touch-icon.png',
  './icones/favicon.png'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE_APP);
    await Promise.allSettled(CASCA.map(u => c.add(new Request(u, {cache:'reload'}))));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.map(n => {
      if (n === CACHE_APP || n === CACHE_TILES) return null;
      return caches.delete(n);
    }));
    await self.clients.claim();
  })());
});

async function podarTiles() {
  const c = await caches.open(CACHE_TILES);
  const ks = await c.keys();
  if (ks.length <= TETO_TILES) return;
  for (let i = 0; i < ks.length - TETO_TILES; i++) await c.delete(ks[i]);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* imagens do mapa (qualquer provedor no padrão /z/x/y.png): cache primeiro */
  if (/\/\d{1,2}\/\d+\/\d+\.png$/.test(url.pathname)) {
    e.respondWith((async () => {
      const c = await caches.open(CACHE_TILES);
      const guardado = await c.match(req);
      if (guardado) return guardado;
      try {
        const resp = await fetch(req);
        if (resp && (resp.ok || resp.type === 'opaque')) {
          try { await c.put(req, resp.clone()); podarTiles(); } catch (e) { /* cota cheia */ }
        }
        return resp;
      } catch (err) {
        return new Response('', {status: 504, statusText: 'sem rede'});
      }
    })());
    return;
  }

  /* navegação: rede primeiro (pega a versão nova), cache como rede de segurança */
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const resp = await fetch(req);
        const c = await caches.open(CACHE_APP);
        c.put('./index.html', resp.clone());
        return resp;
      } catch (err) {
        return (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  /* resto (mesma origem): cache primeiro */
  if (url.origin === location.origin) {
    e.respondWith((async () => {
      const guardado = await caches.match(req);
      if (guardado) return guardado;
      try {
        const resp = await fetch(req);
        if (resp && resp.ok) (await caches.open(CACHE_APP)).put(req, resp.clone());
        return resp;
      } catch (err) {
        return Response.error();
      }
    })());
  }
});
