// Service worker JobFacile : rend le site installable et utilisable hors connexion
// (toutes les pages ; le suivi s'affiche depuis la dernière version gardée par le navigateur)
const CACHE = 'jobfacile-v5';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/css/app.css',
    '/js/i18n.js', '/js/app-core.js', '/js/interview.js', '/js/job-detail.js', '/js/tracker.js', '/js/account.js', '/js/navigation.js', '/js/ui.js', '/js/badges.js', '/js/rights.js', '/js/recruiter.js', '/js/messages.js', '/js/community.js', '/js/search.js'];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

// Notification reçue (même site fermé) : on l'affiche
self.addEventListener('push', (event) => {
    let data = {};
    try { data = event.data ? event.data.json() : {}; } catch (e) { data = { body: event.data && event.data.text() }; }
    const title = data.title || 'JobFacile';
    event.waitUntil(self.registration.showNotification(title, {
        body: data.body || 'De nouvelles offres vous attendent.',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: data.tag || 'jobfacile',
        renotify: true,
        data: { url: data.url || '/' }
    }));
});

// Clic sur la notification : on ouvre (ou on réutilise) l'onglet JobFacile à la bonne page
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const target = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
    event.waitUntil((async () => {
        const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const w of windows) {
            if (new URL(w.url).origin === self.location.origin && 'focus' in w) {
                await w.focus();
                if ('navigate' in w) return w.navigate(target);
                return;
            }
        }
        return clients.openWindow(target);
    })());
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);

    // Données personnelles et API : jamais en cache
    if (url.origin === location.origin && (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/'))) return;
    // Fonds de carte : laissés au navigateur
    if (url.hostname.endsWith('tile.openstreetmap.org')) return;

    // Pages : réseau d'abord (toujours la dernière version), cache si hors connexion
    if (req.mode === 'navigate') {
        event.respondWith(
            fetch(req)
                .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('/', copy)); return res; })
                .catch(() => caches.match('/'))
        );
        return;
    }

    // Fichiers statiques (icônes, polices, Tailwind, Leaflet) : réseau d'abord, cache en secours
    event.respondWith(
        fetch(req)
            .then((res) => {
                if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
                return res;
            })
            // Hors connexion : même fichier, quelle que soit sa version (?v=…)
            .catch(() => caches.match(req).then((hit) => hit || caches.match(req, { ignoreSearch: true })))
    );
});
