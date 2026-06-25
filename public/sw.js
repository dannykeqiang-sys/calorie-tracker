// Service Worker - 动态 base 路径 + 导航请求 no-cache
const CACHE_NAME = 'calorie-tracker-v2';

// 从 SW 的 scope 动态计算 base 路径（适配 GitHub Pages 子目录部署）
// 例如 scope = https://user.github.io/calorie-tracker/ → base = /calorie-tracker/
const BASE_PATH = new URL(self.registration?.scope || self.location.origin + '/').pathname;

// 静态资源列表（使用相对路径，相对于 SW 所在位置）
const STATIC_ASSETS = [
  './',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg',
  './favicon.svg'
];

// 安装阶段：预缓存静态资源（不包含 index.html，确保每次都获取最新版）
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

// 请求拦截：导航请求 no-cache，其他资源 Network First
self.addEventListener('fetch', (event) => {
  // 跳过非 GET 请求
  if (event.request.method !== 'GET') return;

  // 导航请求：强制从网络获取（不缓存 index.html，确保用户总是获取最新版）
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        // 网络失败时，返回已缓存的 index.html 作为离线回退
        return caches.match('./index.html').then((cached) => {
          return cached || new Response('Offline - 燃烧我的卡路里', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
        });
      })
    );
    return;
  }

  // 其他资源：Network First 策略
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

        // 4. 最终失败
        return new Response('Offline', {
          status: 503,
          statusText: 'Service Unavailable'
        });
      }
    })()
  );
});
