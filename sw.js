// sw.js - Service Worker para Conga Uruguaya Offline PWA

const CACHE_NAME = 'conga-uruguaya-v1';
const PRECACHE_ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './js/engine/CongaEngine.js',
    './js/engine/CongaBot.js',
    './js/soundmanager.js',
    './js/firebasemanager.js',
    './js/app.js',
    './manifest.json',
    './assets/cards_tatu/carta_reverso.png',
    './assets/cards_tatu/Comodin.png',
    './assets/icons/favicon-64.png',
    './assets/icons/icon-192.png',
    './assets/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(PRECACHE_ASSETS);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    // Para llamadas a Firebase, permitir que vayan a la red sin interceptar
    if (event.request.url.includes('firebaseio.com') || event.request.url.includes('googleapis.com')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cached) => {
            return cached || fetch(event.request).catch(() => {
                // Fallback para navegación offline
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});
