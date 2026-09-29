/* global self, caches, fetch, Response */
const CACHE_NAME = 'one-shell-v1';
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(['/','/app','/one-app-icon-192.png','/one-app-icon-512.png'])).then(() => self.skipWaiting())); });
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', event => { const request = event.request; if (request.method !== 'GET' || !request.url.startsWith(self.location.origin) || request.url.includes('/api/')) return; event.respondWith(fetch(request).catch(() => caches.match(request).then(hit => hit || (request.mode === 'navigate' ? caches.match('/app') : Response.error())))); });
