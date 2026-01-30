// SERVICE WORKER KILL SWITCH
// This script forces immediate activation, clears all caches, and takes control of clients.
// It effectively "resets" the browser's state for this origin.

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
            // 2. Take control of all clients to ensure we control the current page
            // This is critical to stop the old worker from serving broken files
            console.log('[SW Kill Switch] Caches cleared. Claiming clients...');
            return self.clients.claim();
        })
    );
});

