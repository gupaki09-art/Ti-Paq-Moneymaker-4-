const C='tipaq-v13';
const CORE=['./','./index.html','./weekly-chart.js?v=12','./manifest.webmanifest?v=20261006b','./icon-192.png?v=20261006b','./icon-512.png?v=20261006b'];

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(C).then(cache=>cache.addAll(CORE)));
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==C).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(url.pathname.startsWith('/api/')){
    event.respondWith(fetch(event.request));
    return;
  }
  if(event.request.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        const response=await fetch(event.request);
        const type=response.headers.get('content-type')||'';
        if(!type.includes('text/html')) return response;
        let html=await response.text();
        if(!html.includes('weekly-chart.js')) html=html.replace('</body>','<script src="./weekly-chart.js?v=12"></script></body>');
        return new Response(html,{status:response.status,statusText:response.statusText,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
      }catch(e){return caches.match('./index.html')}
    })());
    return;
  }
  event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)));
});
