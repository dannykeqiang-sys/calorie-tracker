// Service Worker - Network First 策略
const CACHE_NAME = 'calorie-tracker-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.svg',
  '/icon-512.svg',
  '/favicon.svg'
];

// 安装阶段：预缓存静态资源
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// 激活阶段：清理旧缓存
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// 请求拦截：Network First 策略
self.addEventListener('fetch', (event) => {
  // 跳过非 GET 请求
  if (event.request.method !== 'GET') return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      try {
        // 1. 尝试从网络获取
        const networkResponse = await fetch(event.request);

        // 2. 如果成功，更新缓存并返回
        if (networkResponse.ok) {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        }

        throw new Error('Network response was not ok');
      } catch (error) {
        // 3. 网络失败，尝试从缓存返回
        console.log('[SW] Network failed, trying cache:', event.request.url);
        const cachedResponse = await cache.match(event.request);

        if (cachedResponse) {
          return cachedResponse;
        }

        // 4. 缓存也没有，对于导航请求返回 index.html（SPA fallback）
        if (event.request.mode === 'navigate') {
          const fallbackResponse = await cache.match('/index.html');
          if (fallbackResponse) {
            return fallbackResponse;
          }
        }

        // 5. 最终失败
        return new Response('Offline', {
          status: 503,
          statusText: 'Service Unavailable'
        });
      }
    })()
  );
});
