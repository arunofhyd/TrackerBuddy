// Service Worker for TrackerBuddy
// Cache version - increment to invalidate cache
const CACHE_NAME = 'trackerbuddy-v3-dynamic-firebase';

// Static core assets to cache immediately
const CORE_ASSETS = [
    '/',
    '/index.html',
    '/app.js',
    '/constants.js',
    '/services/i18n.js',
    '/services/utils.js',
    '/services/state.js',
    '/services/logger.js',
    '/services/firebase.js',
    '/manifest.json',
    '/assets/logo_rounded.webp',
    '/assets/splashbg.webp',
    '/assets/splashtext.webp'
];

// Install Event - Cache Core Assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(CORE_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate Event - Clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch Event - Stale-While-Revalidate with Dynamic Caching
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 1. Ignore Non-GET requests
    if (event.request.method !== 'GET') return;

    // 2. Ignore Firebase/API/External requests (except fonts/CDNs we explicitly want)
    // We want to cache our own assets, and maybe fonts.
    const isSelf = url.origin === self.location.origin;
    const isFont = url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com') || url.hostname.includes('cdnjs.cloudflare.com');

    if (!isSelf && !isFont) return;

    // 3. Network First for HTML (to ensure updates), Cache First for hashed assets
    // Vite assets in /assets/ contain hashes, so they are immutable. We can return cache immediately.
    const isImmutableAsset = isSelf && url.pathname.startsWith('/assets/');

    if (isImmutableAsset) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) return cachedResponse;

                return fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
                    }
                    return networkResponse;
                });
            })
        );
        return;
    }

    // Standard Stale-While-Revalidate for everything else (index.html, etc)
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
                }
                return networkResponse;
            }).catch(() => {
                // Network failed, return nothing (or offline page if we had one)
            });

            return cachedResponse || fetchPromise;
        })
    );
});
