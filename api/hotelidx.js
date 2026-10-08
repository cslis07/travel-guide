// Vercel Edge Function — 도시별 호텔 색인 (트립어드바이저 호텔 키 ↔ 좌표)
//
// 플랫폼별 가격(Xotelo rates)은 트립어드바이저 hotel_key 로만 조회된다.
// 그런데 Xotelo 의 이름 검색은 유료(RapidAPI)라, 무료인 도시 목록(list)을
// 통째로 받아 좌표로 매칭한다. 도시당 최대 40회 호출(4,000곳)이라
// 응답을 CDN 에 7일 캐시한다 — 사용자 요청마다 다시 긁지 않는다.
//
//   GET /api/hotelidx?loc=g298184
//   → { ok, loc, n, list:[[name, key, lat, lng, taPath], ...] }

export const config = { runtime: 'edge' };

const XO = 'https://data.xotelo.com/api/list';
const PAGE = 100;
const MAX_PAGES = 40;   // 상하이처럼 1만 곳 넘는 도시는 인기순 상위 4,000곳만

export default async function handler(req) {
  const loc = new URL(req.url).searchParams.get('loc') || '';
  // 트립어드바이저 지역 코드 형식만 허용 (임의 URL 조립 방지)
  if (!/^g\d{2,9}$/.test(loc)) return out({ ok: false, error: 'invalid loc' }, 400, 0);

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

async function page(loc, offset) {
  const r = await fetch(`${XO}?location_key=${loc}&limit=${PAGE}&offset=${offset}&sort=best_value`);
  const d = await r.json();
  if (d.error || !d.result) throw new Error(d.error?.message || 'no result');
  return d.result;
}

function out(obj, status, sMaxAge) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': sMaxAge
        ? `public, s-maxage=${sMaxAge}, stale-while-revalidate=86400`
        : 'no-store',
    },
  });
}
