// SERVICE WORKER KILL SWITCH
// This script replaces the previous service worker to force-unregister it
// and clear caches for users who have the old version installed.

self.addEventListener('install', (event) => {
    // Skip waiting to activate immediately
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        // 1. Delete all caches associated with this origin
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    console.log('[SW Kill Switch] Deleting cache:', cacheName);
                    return caches.delete(cacheName);
                })
            );
        }).then(() => {
            // 2. Unregister self
            return self.registration.unregister();
        }).then(() => {
            // 3. Take control of all clients to force reload if needed
            return self.clients.claim();
        })
    );
});

