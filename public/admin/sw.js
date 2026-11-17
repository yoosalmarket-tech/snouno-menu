/* Admin-specific service worker: enables standalone installation without
   intercepting, caching or exposing authenticated dashboard requests. */
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
