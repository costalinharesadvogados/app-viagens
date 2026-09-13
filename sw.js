/* Nossas Viagens — service worker
   TROQUE A VERSAO A CADA PUBLICAÇÃO. É isso que faz o app atualizar
   no celular de quem já instalou; sem trocar, o aparelho continua
   servindo a versão velha do cache. */
const VERSAO = 'nv-v6';

const CACHE_APP   = 'app-' + VERSAO;
const CACHE_TILES = 'tiles-v2';      // imagens do mapa, sobrevivem à troca de versão
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
    /* apaga versões antigas do app e o cache de tiles anterior, que na v1 ficou
       cheio de imagens de bloqueio do OpenStreetMap */
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

  /* imagens do mapa (qualquer provedor no padrão /z/x/y[.ext]): cache primeiro.
     Buscamos com CORS de propósito: resposta opaca esconde o status, e foi assim
     que a v1 acabou guardando 900 imagens de "Access blocked" como se fossem mapa.
     Só entra no cache o que voltar 200. */
  if (/\/\d{1,2}\/\d+\/\d+(\.\w{2,4})?$/.test(url.pathname)) {
    e.respondWith((async () => {
      const c = await caches.open(CACHE_TILES);
      const guardado = await c.match(req);
      if (guardado) return guardado;
      try {
        const resp = await fetch(url.href, {mode: 'cors', credentials: 'omit'});
        if (resp && resp.ok) {
          try { await c.put(req, resp.clone()); podarTiles(); } catch (e) { /* cota cheia */ }
          return resp;
        }
        /* erro do provedor (403, 429...): não guarda e não mostra a imagem de aviso dele */
        return new Response('', {status: resp ? resp.status : 502, statusText: 'provedor recusou'});
      } catch (err) {
        try { return await fetch(req); } catch (e2) {
          return new Response('', {status: 504, statusText: 'sem rede'});
        }
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
