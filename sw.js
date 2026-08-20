/* Zusje App — self-destruct service worker.
   De caching-laag hield op sommige apparaten (iPad/iPhone/Safari) hardnekkig een
   oude versie vast. Deze service worker wist alle caches, meldt zichzelf af en
   herlaadt de pagina vers, zodat er voortaan altijd rechtstreeks van het netwerk
   wordt geladen (geen SW-cache meer). */

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // 1) Wis alle caches van eerdere versies.
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (e) {}
    // 2) Neem de controle even over zodat we de clients kunnen herladen.
    try { await self.clients.claim(); } catch (e) {}
    // 3) Meld deze service worker af — hierna is er geen SW-laag meer.
    try { await self.registration.unregister(); } catch (e) {}
    // 4) Herlaad open vensters (met cache-bust) zodat de verse, SW-loze versie laadt.
    try {
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) {
        const u = new URL(client.url);
        u.searchParams.set("fresh", String(Date.now()));
        client.navigate(u.href).catch(() => {});
      }
    } catch (e) {}
  })());
});

/* Geen fetch-handler: alle verzoeken gaan rechtstreeks naar het netwerk. */
