// Service Worker for Pakaja Inventory PWA
// Version is auto-generated at build time - DO NOT EDIT MANUALLY
const BUILD_VERSION = '__BUILD_VERSION__';
const CACHE_NAME = `pakaja-inventory-${BUILD_VERSION}`;
const OFFLINE_URL = '/';

// Assets to cache on install
const PRECACHE_ASSETS = [
    '/',
    '/index.html'
];

// Install event - cache core assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing new version:', BUILD_VERSION);
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Precaching app shell');
                return cache.addAll(PRECACHE_ASSETS);
            })
            .then(() => {
                // Don't skip waiting - let the app control when to update
                console.log('[SW] Installation complete, waiting for activation');
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating new version:', BUILD_VERSION);
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((cacheName) => cacheName.startsWith('pakaja-inventory-') && cacheName !== CACHE_NAME)
                        .map((cacheName) => {
                            console.log('[SW] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        })
                );
            })
            .then(() => {
                // Take control of all clients immediately
                return self.clients.claim();
            })
    );
});

// Listen for skip waiting message from the app
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('[SW] Received skip waiting message, activating now');
        self.skipWaiting();
    }
});

// Fetch event - network first for API, cache first for static assets
// Fetch event - network first for API/HTML, cache first for static assets
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip cross-origin requests and non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // specific NetworkFirst strategies
    // 1. Navigation requests (HTML) - always try network first for fresh content
    if (request.mode === 'navigate') {
        event.respondWith(networkFirst(request));
        return;
    }

    // 2. API requests (Supabase, Google APIs/Fonts, CDN)
    if (url.hostname.includes('supabase') ||
        url.hostname.includes('googleapis') ||
        url.hostname.includes('gstatic') ||
        url.hostname.includes('b-cdn.net')) {
        event.respondWith(networkFirst(request));
        return;
    }

    // 3. Static Assets (JS, CSS, Images, Fonts) - CacheFirst
    // Only cache same-origin assets or specific known extensions
    const isStaticAsset =
        url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff|woff2|ttf|eot)$/) ||
        url.hostname === self.location.hostname;

    if (isStaticAsset) {
        event.respondWith(cacheFirst(request));
        return;
    }

    // Default to network only for everything else to be safe
    return;
});

// Network first strategy - try network, fall back to cache
// Network first strategy - try network, fall back to cache
async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        // If navigation request and not in cache, try offline page
        if (request.mode === 'navigate') {
            const offlineResponse = await caches.match(OFFLINE_URL);
            if (offlineResponse) {
                return offlineResponse;
            }
        }

        throw error;
    }
}

// Cache first strategy - try cache, fall back to network
async function cacheFirst(request) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }

    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        // Return offline page if available
        if (request.mode === 'navigate') {
            const offlineResponse = await caches.match(OFFLINE_URL);
            if (offlineResponse) {
                return offlineResponse;
            }
        }
        throw error;
    }
}
