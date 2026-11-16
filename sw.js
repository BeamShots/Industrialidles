const CACHE='tideforge-treasure-tides-v4.0.0';
const FILES=['./','./index.html','./style.css','./model.js','./app.js','./manifest.json','./icon192.png','./icon512.png','./assets/atlas.webp','./assets/frame.webp','./assets/marsh.webp'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
 event.respondWith(caches.open(CACHE).then(async cache=>{
  const saved=await cache.match(event.request);
  if(saved)return saved;
  return fetch(event.request);
 }));
});
