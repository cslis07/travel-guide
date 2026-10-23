// 트래블코스트 Service Worker — PWA 설치 + 오프라인 캐싱
//
// 전략
//  - HTML / API : 네트워크 우선 (항상 최신). 실패 시 캐시 → 최후에 오프라인 폴백
//  - 정적 자산  : 캐시 우선 + 백그라운드 갱신 (stale-while-revalidate)

const CACHE = 'travelcost-v34';

// 설치 시 미리 담아둘 최소 셸 (오프라인 폴백용)
// 페이지는 깨끗한 주소로(cleanUrls라 '/x.html'은 리다이렉트 응답이 캐시돼 오프라인 내비게이션에 못 씀)
// 내 여행·출국 준비는 현지에서 데이터가 끊겨도 열려야 하므로 처음 설치 때부터 담는다(2026-10-23)
const SHELL = [
  '/',
  '/trips',
  '/trip',
  '/prepare',
  '/estimate',
  '/airport',
  '/trips.js',
  '/trip-attach.js',
  '/city-places.js',
  '/checklist.js',
  '/local-info.js',   // 비상 연락처·현지어는 데이터가 안 될 때 더 필요
  '/phrases.js',
  '/booking-parse.js',
  '/home-ui.js',
  '/style.css',
  '/main.js',
  '/icons.js',
  '/nav.js',
  '/bizfooter.js',
  '/affiliates.js',
  '/analytics.js',
  '/pwa-install.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

const OFFLINE_FALLBACK = '/';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      // 개별 실패가 전체 설치를 막지 않도록 하나씩 담는다
      .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {}))))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 외부 도메인은 건드리지 않음

  const accept = req.headers.get('accept') || '';
  const isHtml = req.mode === 'navigate' || accept.includes('text/html');
  const isApi = url.pathname.startsWith('/api/');

  // 1) API·HTML → 네트워크 우선
  if (isApi || isHtml) {
    e.respondWith(
      fetch(req)
        .then(res => {
          if (isHtml && res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(req, clone));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          if (isHtml) {
            // 같은 페이지의 다른 ?id= 도 열리게(여행 데이터는 localStorage라 셸만 있으면 됨)
            const any = await caches.match(req, { ignoreSearch: true });
            if (any) return any;
            const shell = await caches.match(url.pathname.replace(/\.html$/, '') || '/');
            if (shell) return shell;
            const fallback = await caches.match(OFFLINE_FALLBACK);
            if (fallback) return fallback;
          }
          return new Response('오프라인입니다. 네트워크를 확인해주세요.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        })
    );
    return;
  }

  // 2) 정적 자산 → 캐시 우선 + 백그라운드 갱신
  e.respondWith(
    caches.match(req).then(cached => {
      const fetched = fetch(req)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(req, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetched;
    })
  );
});
