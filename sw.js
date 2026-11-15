const cacheName='tideforge-'+self.registration.scope+'-1';
self.oninstall=e=>e.waitUntil(caches.open(cacheName).then(c=>c.addAll(['./','./index.html','./game.js','./manifest.json','./icon192.png','./icon512.png'])));
self.onfetch=e=>{if(e.request.method==='GET')e.respondWith(caches.open(cacheName).then(async c=>await c.match(e.request)||await fetch(e.request)))};
