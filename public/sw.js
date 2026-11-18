/* Snounu installable menu. Network-first shell, no caching user actions,
   authentication, delivery referral tracking, or API responses. */
const CACHE='snounu-menu-shell-v4';
const CORE=['/welcome','/assets/snounu-original-192.png?v=20261118-original','/assets/snounu-original-512.png?v=20261118-original','/assets/logo.webp'];
const PUBLIC_ROUTES=new Set(['/','/welcome','/menu','/contact']);
const ASSET_PATHS=new Set([
 '/menu.css','/desktop.css','/menu.js','/rich-menu.js','/rich-menu.css',
 '/brand.css','/assets/logo.webp','/assets/snounu-icon.png',
 '/assets/snounu-original-192.png','/assets/snounu-original-512.png',
 '/assets/qatar-bold.woff'
]);
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>Promise.allSettled(
  CORE.map(path=>cache.add(new Request(path,{cache:'reload'})))
 )).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(Promise.all([
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('snounu-menu-shell-')&&k!==CACHE).map(k=>caches.delete(k)))),
  self.clients.claim()
 ]));
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
 const url=new URL(request.url),path=url.pathname;
 // Never intercept admin routes, Supabase/serverless calls or their tokens.
 if(path.startsWith('/admin')||path.startsWith('/api/')||path.startsWith('/auth/'))return;
 const isPage=request.mode==='navigate'&&PUBLIC_ROUTES.has(path);
 const isStatic=ASSET_PATHS.has(path);
 if(!isPage&&!isStatic)return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  try{
   const response=await fetch(request);
   if(response.ok&&response.type==='basic'){
    // Do not hold a live menu request while writing its offline cache.
    event.waitUntil(cache.put(request,response.clone()).catch(()=>{}));
   }
   return response;
  }catch(error){
   // Offline is best-effort; live menu data and ordering still need internet.
   const fallback=await cache.match(request) || (isPage?await cache.match('/welcome'):null);
   if(fallback)return fallback;
   throw error;
  }
 })());
});
