// Vercel Edge Function — 숙소 플랫폼별 가격 비교 (구글 호텔 "모든 옵션" 방식)
//
// 두 단계로 나눈다. ⚠️ 마이리얼트립 MCP 는 호출 제한이 빡빡하다(실측: 수십 회에 429, 60초 대기).
// 카드마다 상세를 부르면 본 검색까지 막히므로, 날짜와 무관한 "어느 호텔인가"는 30일 캐시한다.
//
// [매칭] GET /api/hotelprice?gid=1258957          (CDN 30일 캐시 — MRT 상세는 숙소당 월 1회꼴)
//   1) 마이리얼트립 getStayDetail 로 숙소 좌표·이름·도시를 얻는다.
//   2) 도시의 트립어드바이저 색인(/api/hotelidx, CDN 7일 캐시)에서 같은 호텔을 찾는다.
//      MRT 이름은 한글, 색인은 영문이라 좌표 + 로마자 유사도 둘 다 본다.
//      ⚠️ 옆 건물 호텔을 집으면 남의 가격을 보여주게 된다 → 애매하면 매칭하지 않는다.
//   → { ok, hotel:{name,city}, match:{name,key,dist,sim,ta,cur}|null, reason? }
//
// [요금] GET /api/hotelprice?key=g1066461-d1090951&cur=JPY&ci=2026-11-09&co=2026-11-10&ad=2
//   Xotelo rates(무료·무인증)로 Trip.com·Booking·Agoda 등 1박 요금을 받아 원화로 환산. MRT 호출 없음.
//   → { ok, rates:[{code,name,amount,cur,krw}], cur, fx }

export const config = { runtime: 'edge' };

const MCP = 'https://mcp-servers.myrealtrip.com/mcp';
const XO_RATES = 'https://data.xotelo.com/api/rates';

/* MRT region.city(한글) → 트립어드바이저 지역 코드 + 요금 통화.
   ⛔ 코드는 Xotelo list 로 도시명이 맞는지 확인한 것만 넣는다(2026-10-08 실측).
      장가계·강릉은 엉뚱한 지역(인도 푸리·대구)이 나와 뺐다 — 모르면 비교를 생략한다.
   통화: Xotelo 는 KRW 를 안 받는다. USD 는 정수라 1박 오차가 1,000원대라
         현지 통화로 받아 환산한다(엔·바트 등은 단위가 작아 오차가 거의 없다). */
const CITY = {
  '도쿄': [['g298184'], 'JPY'], '오사카': [['g298566'], 'JPY'], '교토': [['g298564'], 'JPY'],
  '후쿠오카': [['g298207'], 'JPY'], '삿포로': [['g298560'], 'JPY'], '나고야': [['g298106'], 'JPY'],
  '오키나와': [['g298224', 'g298223'], 'JPY'], '나하': [['g298224'], 'JPY'],
  '방콕': [['g293916'], 'THB'], '치앙마이': [['g293917'], 'THB'], '푸켓': [['g293920'], 'THB'],
  '다낭': [['g298085'], 'USD'], '나트랑': [['g293928'], 'USD'], '하노이': [['g293924'], 'USD'],
  '호치민': [['g293925'], 'USD'], '호찌민': [['g293925'], 'USD'], '푸꾸옥': [['g1184679'], 'USD'],
  '싱가포르': [['g294265'], 'USD'], '타이베이': [['g293913'], 'USD'], '홍콩': [['g294217'], 'HKD'],
  '마카오': [['g664891'], 'HKD'], '상하이': [['g308272'], 'CNY'], '계림': [['g298556'], 'CNY'],
  '세부': [['g294261'], 'USD'], '발리': [['g294226'], 'USD'], '코타키나발루': [['g298307'], 'USD'],
  '괌': [['g60668'], 'USD'], '파리': [['g187147'], 'EUR'], '런던': [['g186338'], 'GBP'],
  '뉴욕': [['g60763'], 'USD'], '서울': [['g294197'], 'USD'], '부산': [['g297884'], 'USD'],
  '제주': [['g983296'], 'USD'], '제주시': [['g983296'], 'USD'], '서귀포': [['g983296'], 'USD'],
};

const IDX_VER = 2;   // 2: 색인 정렬 popularity(누락 수정). 올리면 tours.html 의 gid 조회 v= 도 같이 올릴 것
const CURS = new Set(['JPY', 'THB', 'USD', 'HKD', 'CNY', 'EUR', 'GBP']);

export default async function handler(req) {
  const q = new URL(req.url).searchParams;
  if (q.has('key')) return rates(q);
  return match(req, q.get('gid') || '');
}

async function rates(q) {
  const key = q.get('key') || '', cur = q.get('cur') || '', ci = q.get('ci') || '', co = q.get('co') || '';
  const ad = Math.min(Math.max(parseInt(q.get('ad') || '2', 10) || 2, 1), 8);
  const D = /^\d{4}-\d{2}-\d{2}$/;
  if (!/^g\d+-d\d+$/.test(key) || !CURS.has(cur) || !D.test(ci) || !D.test(co) || co <= ci) {
    return out({ ok: false, error: 'invalid params' }, 400, 0);
  }
  try {
    const [rr, fr] = await Promise.all([
      fetch(`${XO_RATES}?hotel_key=${key}&chk_in=${ci}&chk_out=${co}&currency=${cur}&adults=${ad}`).then(r => r.json()),
      fetch(`https://open.er-api.com/v6/latest/${cur}`).then(r => r.json()),
    ]);
    if (rr?.error) throw new Error(rr.error.message || 'rates');
    const fx = Number(fr?.rates?.KRW) || 0;
    const list = (rr?.result?.rates || [])
      .filter(r => Number(r.rate) > 0)
      .map(r => ({ code: String(r.code || ''), name: String(r.name || ''), amount: Number(r.rate), cur,
                   krw: fx ? Math.round(Number(r.rate) * fx / 10) * 10 : 0 }))
      .sort((a, b) => a.amount - b.amount);
    return out({ ok: true, rates: list, cur, fx }, 200, 1800);
  } catch (e) {
    return out({ ok: false, error: '요금 조회 실패: ' + (e.message || e) }, 502, 0);
  }
}

async function match(req, gid) {
  if (!/^\d{1,12}$/.test(gid)) return out({ ok: false, error: 'invalid params' }, 400, 0);

  // 1) MRT 상세 — 좌표·도시. 날짜는 위치와 무관하니 서버가 정한다(캐시 키를 gid 하나로).
  const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  let p;
  try { p = await stayDetail(Number(gid), day(30), day(31), 2); }
  catch (e) { return out({ ok: false, error: 'MRT 상세 실패: ' + (e.message || e) }, 502, 0); }
  const hotel = { name: p.property?.name || '', city: p.property?.region?.city || '' };
  const lat = p.location?.latitude, lng = p.location?.longitude;
  const city = CITY[hotel.city];
  if (!city || typeof lat !== 'number') return out({ ok: true, hotel, match: null, reason: 'city' }, 200, 604800);

  // 2) 색인에서 같은 호텔 찾기
  const origin = new URL(req.url).origin;
  const loadIdx = async locs => {
    const parts = await Promise.all(locs.map(loc =>
      // v= 는 색인 방식이 바뀌었을 때 CDN 7일 캐시를 우회하기 위한 값(hotelidx 는 무시)
      fetch(`${origin}/api/hotelidx?loc=${loc}&v=${IDX_VER}`).then(r => r.json()).catch(() => null)));
    return parts.reduce((a, d) => (d && d.ok ? a.concat(d.list) : a), []);
  };
  const idx = await loadIdx(city[0]);
  let m = bestMatch(hotel.name, lat, lng, idx);
  if (!m) {
    /* 도시 목록은 일부만 담는다(사도닉스 우에노는 도쿄 목록엔 없고 다이토구 목록엔 있다).
       주변 30곳이 속한 하위 지역(구·동네) 코드 상위 3개의 목록으로 한 번 더 찾는다. */
    const subs = nearbyAreas(lat, lng, idx, city[0]);
    if (subs.length) m = bestMatch(hotel.name, lat, lng, await loadIdx(subs));
  }
  // 색인 로딩이 통째로 실패한 경우(Xotelo 장애)는 "없음"으로 오래 캐시하면 안 된다
  if (!m) return out({ ok: true, hotel, match: null, reason: 'nomatch' }, 200, idx.length ? 604800 : 0);
  m.cur = city[1];
  return out({ ok: true, hotel, match: m }, 200, 2592000);
}

/* ── 매칭: 좌표 거리 + 이름 유사도 ──
   실측(도쿄 10곳): 30m 안이어도 옆 호텔일 수 있고(사도닉스↔도미인 47m),
   이름만 보면 지역명(신주쿠) 때문에 남의 호텔이 0.46까지 오른다. 그래서 둘을 같이 본다.
   · 30m 이내 & 유사도 ≥ 0.30  또는  · 200m 이내 & 유사도 ≥ 0.55  → 정답 6/6, 오답 5/5 차단 */
function bestMatch(name, lat, lng, idx) {
  const cosLat = Math.cos(lat * Math.PI / 180);
  let best = null;
  for (const [n, key, la, lo, ta] of idx) {
    const d = Math.hypot((la - lat) * 111000, (lo - lng) * 111000 * cosLat);
    if (d > 200) continue;
    const s = sim(name, n);
    if (!((d <= 30 && s >= 0.30) || s >= 0.55)) continue;
    const score = s - d / 1000;   // 유사도 우선, 같으면 가까운 쪽
    if (!best || score > best.score) best = { name: n, key, dist: Math.round(d), sim: Math.round(s * 100) / 100, ta, score };
  }
  if (best) delete best.score;
  return best;
}

function nearbyAreas(lat, lng, idx, exclude) {
  const cosLat = Math.cos(lat * Math.PI / 180);
  const near = idx
    .map(h => [Math.hypot((h[2] - lat) * 111000, (h[3] - lng) * 111000 * cosLat), h[4]])
    .sort((a, b) => a[0] - b[0]).slice(0, 30);
  const cnt = new Map();
  for (const [, ta] of near) {
    const g = (String(ta).match(/Review-(g\d+)-/) || [])[1];
    if (g && !exclude.includes(g)) cnt.set(g, (cnt.get(g) || 0) + 1);
  }
  return [...cnt].sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]);
}

/* 한글 → 로마자(간이 국어의 로마자 표기) */
const CHO = ['g','kk','n','d','tt','r','m','b','pp','s','ss','','j','jj','ch','k','t','p','h'];
const JUNG = ['a','ae','ya','yae','eo','e','yeo','ye','o','wa','wae','oe','yo','u','wo','we','wi','yu','eu','ui','i'];
const JONG = ['','k','k','k','n','n','n','t','l','k','m','l','l','l','p','l','m','p','p','t','t','ng','t','t','k','t','p','t'];
function romanize(s) {
  let o = '';
  for (const ch of String(s)) {
    const c = ch.charCodeAt(0) - 0xAC00;
    if (c < 0 || c > 11171) { o += ch; continue; }
    o += CHO[Math.floor(c / 588)] + JUNG[Math.floor((c % 588) / 28)] + JONG[c % 28];
  }
  return o;
}
/* 외래어 표기 차이(r/l, f/p, sh/s, 장음 등)를 같은 기호로 접어서 비교한다 */
function fold(s) {
  return romanize(s).toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/eu/g, 'u').replace(/eo/g, 'o').replace(/ae/g, 'e')
    .replace(/[fp]/g, 'p').replace(/[vb]/g, 'b').replace(/[lr]/g, 'r').replace(/[kgcq]/g, 'k').replace(/[td]/g, 't')
    .replace(/sh/g, 's').replace(/ch|j|z/g, 'j').replace(/x/g, 'ks').replace(/w/g, 'u').replace(/y/g, 'i')
    .replace(/(.)\1+/g, '$1');
}
const GENERIC = /(hotel|hostel|resort|inn|by ihg|호텔|호스텔|리조트)/gi;
function sim(ko, en) {
  const a = fold(String(ko).replace(GENERIC, ' ')), b = fold(String(en).replace(GENERIC, ' '));
  if (a.length < 2 || b.length < 2) return 0;
  const bg = s => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const k = s.slice(i, i + 2); m.set(k, (m.get(k) || 0) + 1); } return m; };
  const A = bg(a), B = bg(b);
  let inter = 0;
  for (const [k, v] of A) inter += Math.min(v, B.get(k) || 0);
  return 2 * inter / (a.length - 1 + b.length - 1);
}

async function stayDetail(gid, checkIn, checkOut, adultCount) {
  const rpc = { jsonrpc: '2.0', id: 1, method: 'tools/call',
    params: { name: 'getStayDetail', arguments: { gid, checkIn, checkOut, adultCount, childCount: 0 } } };
  const r = await fetch(MCP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream', 'User-Agent': 'TravelCost/1.0' },
    body: JSON.stringify(rpc),
  });
  if (r.status === 429) throw new Error('rate');   // 호출 제한 — 클라이언트가 "잠시 후" 안내
  const raw = (await r.text()).trim();
  let res = null;
  if (raw.startsWith('{')) { try { res = JSON.parse(raw); } catch { /* SSE 로 재시도 */ } }
  if (!res) {
    let payload = '';
    for (const line of raw.split(/\r?\n/)) if (line.startsWith('data:')) payload += line.slice(5).trim();
    try { res = JSON.parse(payload); } catch { /* 아래에서 오류 */ }
  }
  const text = res?.result?.content?.[0]?.text;
  if (!text) throw new Error(res?.error?.message || 'empty');
  const d = JSON.parse(text);
  if (!d.property) throw new Error('no property');
  return d;
}

function out(obj, status, sMaxAge) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': sMaxAge ? `public, s-maxage=${sMaxAge}, stale-while-revalidate=3600` : 'no-store',
    },
  });
}
