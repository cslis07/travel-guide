// Vercel Function (Node.js, 서울 icn1 — vercel.json "regions") — 도시별 호텔 색인 (트립어드바이저 호텔 키 ↔ 좌표)
//
// 플랫폼별 가격(Xotelo rates)은 트립어드바이저 hotel_key 로만 조회된다.
// 그런데 Xotelo 의 이름 검색은 유료(RapidAPI)라, 무료인 도시 목록(list)을
// 통째로 받아 좌표로 매칭한다. 도시당 최대 40회 호출(4,000곳)이라
// 응답을 CDN 에 7일 캐시한다 — 사용자 요청마다 다시 긁지 않는다.
//
//   GET /api/hotelidx?loc=g298184
//   → { ok, loc, n, list:[[name, key, lat, lng, taPath], ...] }


import { cors, foreignOrigin, rateLimited, tooMany } from './_guard.js';

const XO = 'https://data.xotelo.com/api/list';
const PAGE = 100;
const MAX_PAGES = 60;   // 상하이처럼 1만 곳 넘는 도시는 인기순 상위 6,000곳만

async function handler(req) {
  // 남의 사이트 차단·IP당 호출 제한 — 요청 1건이 상류를 최대 60번 부르므로 캐시 우회 남용을 끊는다
  if (foreignOrigin(req)) return out({ ok: false, error: 'origin not allowed' }, 403, 0, cors(req));
  if (rateLimited(req, 20)) return tooMany(cors(req));
  const q = new URL(req.url).searchParams;
  const loc = q.get('loc') || '';
  // 트립어드바이저 지역 코드 형식만 허용 (임의 URL 조립 방지). 모르는 파라미터는 캐시 우회용이라 거절
  if (!/^g\d{2,9}$/.test(loc)) return out({ ok: false, error: 'invalid loc' }, 400, 0);
  if ([...q.keys()].some(k => k !== 'loc' && k !== 'v') || (q.has('v') && !/^\d{1,3}$/.test(q.get('v')))) {
    return out({ ok: false, error: 'invalid params' }, 400, 0);
  }

  try {
    const first = await page(loc, 0);
    const total = Math.min(first.total_count || 0, PAGE * MAX_PAGES);
    const offsets = [];
    for (let o = PAGE; o < total; o += PAGE) offsets.push(o);
    // 한꺼번에 37회를 쏘면 일부가 실패해 색인이 30%가량 빠진다(실측 3,666→2,537).
    // 8개씩 나눠 받고, 실패한 페이지는 한 번 더 시도한다.
    const rest = [];
    for (let i = 0; i < offsets.length; i += 8) {
      rest.push(...await Promise.all(offsets.slice(i, i + 8).map(o =>
        page(loc, o).catch(() => page(loc, o)).catch(() => ({ list: [] })))));
    }
    const seen = new Set();
    const list = [];
    for (const p of [first, ...rest]) {
      for (const h of p.list || []) {
        const g = h.geo || {};
        if (!h.key || seen.has(h.key) || typeof g.latitude !== 'number') continue;
        seen.add(h.key);
        list.push([
          h.name || '', h.key,
          Math.round(g.latitude * 1e6) / 1e6, Math.round(g.longitude * 1e6) / 1e6,
          String(h.url || '').replace(/^https:\/\/www\.tripadvisor\.com/, ''),
        ]);
      }
    }
    if (!list.length) return out({ ok: false, error: 'empty' }, 502, 0);
    return out({ ok: true, loc, n: list.length, list }, 200, 604800);
  } catch (e) {
    return out({ ok: false, error: 'list 실패: ' + (e.message || e) }, 502, 0);
  }
}

/* ⚠️ sort=best_value 는 페이지를 넘기는 사이 순서가 흔들려 같은 호텔이 반복되고 다른 호텔이 빠진다
   (실측 부산 2,229건 중 고유 1,773). popularity 는 고유 2,229 — 순서가 안정적이다. */
async function page(loc, offset) {
  const r = await fetch(`${XO}?location_key=${loc}&limit=${PAGE}&offset=${offset}&sort=popularity`, { signal: AbortSignal.timeout(8000) });
  const d = await r.json();
  if (d.error || !d.result) throw new Error(d.error?.message || 'no result');
  return d.result;
}

function out(obj, status, sMaxAge, extra = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      ...extra,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': sMaxAge
        ? `public, s-maxage=${sMaxAge}, stale-while-revalidate=86400`
        : 'no-store',
    },
  });
}

// Node.js 런타임의 Web 표준 핸들러(Request → Response) — Edge 때처럼 모든 메서드를 같은 핸들러로
export { handler as GET, handler as POST, handler as OPTIONS };
