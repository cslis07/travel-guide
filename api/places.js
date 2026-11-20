// Vercel Function (Node.js, 서울 icn1) — 구글 지도 장소 검색(Places API New) 프록시 · 일본 관광지 검색
//
// 호출 형식:
//   GET /api/places?q=교토 단풍                       → 일본 안 장소 최대 10곳(JSON)
//   GET /api/places?photo=places/XXX/photos/YYY      → 사진 주소로 302 이동(img src 로 바로 씀)
//
// 환경변수:
//   GOOGLE_PLACES_KEY      — 구글 클라우드 'Places API (New)' 키 (없으면 503 → 화면에 '준비 중')
//   PLACES_DAILY_SEARCH    — 하루 검색 상한(기본 160 ≈ 월 무료 5,000회 ÷ 31일)
//   PLACES_DAILY_PHOTO     — 하루 사진 상한(기본 32 ≈ 월 무료 1,000장 ÷ 31일)
//   PLACES_RATING=1        — 별점 함께 받기(요금 등급이 Pro → Enterprise 로 올라 무료 검색이 월 1,000회로 줄어든다)
//
// 구글 약관(2026-11-20 확인):
//   - 장소 이름·주소·후기는 우리 쪽에 저장하지 않는다 → CDN 캐시 없음(Cache-Control: private), 서버 저장 없음
//   - 결과를 보여 줄 때 'Google 지도' 표시, 사진 작가 이름, googleMapsUri 링크를 같이 보여 준다(화면 쪽 jp-search.js)
//   - 하루 상한은 인스턴스 메모리 기준이라 근사치다 — 정확한 상한은 구글 클라우드 콘솔의 할당량으로 건다

import { cors, foreignOrigin, rateLimited, tooMany } from './_guard.js';

const API = 'https://places.googleapis.com/v1';
const JAPAN = { low: { latitude: 24.0, longitude: 122.9 }, high: { latitude: 45.6, longitude: 146.0 } };
const PHOTO_RE = /^places\/[A-Za-z0-9_-]{10,300}\/photos\/[A-Za-z0-9_-]{10,1200}$/;

const LIMIT = {
  search: Math.max(0, parseInt(process.env.PLACES_DAILY_SEARCH || '160', 10) || 0),
  photo: Math.max(0, parseInt(process.env.PLACES_DAILY_PHOTO || '32', 10) || 0),
};
const used = { day: '', search: 0, photo: 0 };
function take(kind) {
  const day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);   // 한국 날짜 기준으로 0시에 초기화
  if (used.day !== day) { used.day = day; used.search = 0; used.photo = 0; }
  if (used[kind] >= LIMIT[kind]) return false;
  used[kind] += 1;
  return true;
}

function json(body, status, headers, cache = 'no-store') {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache },
  });
}

async function handler(req) {
  const CORS = cors(req, 'GET,OPTIONS');
  if (foreignOrigin(req)) return json({ error: 'origin not allowed' }, 403, CORS);
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: CORS });
  if (req.method !== 'GET') return json({ error: 'method not allowed' }, 405, CORS);
  if (rateLimited(req, 30)) return tooMany(CORS);

  const key = process.env.GOOGLE_PLACES_KEY;
  if (!key) return json({ error: 'not configured' }, 503, CORS);

  const url = new URL(req.url);
  const photo = url.searchParams.get('photo');
  if (photo != null) return photoRedirect(photo, key, CORS);

  const q = (url.searchParams.get('q') || '').replace(/\s+/g, ' ').trim();
  if (q.length < 2 || q.length > 60) return json({ error: 'q must be 2-60 chars' }, 400, CORS);
  if (!take('search')) return json({ error: 'daily limit' }, 429, CORS);

  const rating = process.env.PLACES_RATING === '1';
  const mask = ['places.id', 'places.displayName', 'places.formattedAddress', 'places.primaryTypeDisplayName',
    'places.googleMapsUri', 'places.photos'].concat(rating ? ['places.rating', 'places.userRatingCount'] : []).join(',');

  try {
    const up = await fetch(`${API}/places:searchText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': mask },
      body: JSON.stringify({ textQuery: q, languageCode: 'ko', regionCode: 'JP', pageSize: 10, locationRestriction: { rectangle: JAPAN } }),
      signal: AbortSignal.timeout(10000),
    });
    console.log(JSON.stringify({ upstream: 'places', api: 'searchText', status: up.status, sku: rating ? 'enterprise' : 'pro', n: used.search }));   // 호출량 계측(Vercel 로그)
    if (!up.ok) {
      const t = await up.text().catch(() => '');
      console.log(JSON.stringify({ upstream: 'places', err: t.slice(0, 300) }));
      return json({ error: `upstream ${up.status}` }, 502, CORS);
    }
    const data = await up.json();
    // 사각형이 부산·제주·북한·블라디보스토크 일부도 덮는다 → 다른 나라 주소는 뺀다
    // (regionCode=JP 라 일본 주소에는 나라 이름이 안 붙는다 — '일본'으로 거르면 다 빠지던 문제, 2026-11-20)
    const places = (data.places || [])
      .filter(p => !/대한민국|한국|Korea|북한|조선|러시아|Russia|중국|China/i.test(p.formattedAddress || ''))
      .map(p => {
        const ph = (p.photos || [])[0];
        const au = ph && (ph.authorAttributions || [])[0];
        return {
          id: p.id,
          name: p.displayName?.text || '',
          addr: (p.formattedAddress || '').replace(/^일본[,\s]*/, '').replace(/^〒\d{3}-\d{4}\s*/, ''),
          type: p.primaryTypeDisplayName?.text || '',
          maps: p.googleMapsUri || '',
          photo: ph ? ph.name : '',
          by: au ? au.displayName || '' : '',
          byUri: au ? au.uri || '' : '',
          ...(rating ? { rating: p.rating || 0, count: p.userRatingCount || 0 } : {}),
        };
      });
    // 구글 콘텐츠는 저장 금지 → CDN 캐시 없이, 같은 사람 브라우저에서만 10분
    return json({ places, raw: (data.places || []).length }, 200, CORS, 'private, max-age=600');
  } catch (e) {
    return json({ error: e.message || 'upstream error' }, 502, CORS);
  }
}

async function photoRedirect(name, key, CORS) {
  if (!PHOTO_RE.test(name)) return json({ error: 'bad photo' }, 400, CORS);
  if (!take('photo')) return json({ error: 'daily limit' }, 429, CORS);   // 화면은 그림 대신 아이콘을 보여 준다
  try {
    const up = await fetch(`${API}/${name}/media?maxWidthPx=480&skipHttpRedirect=true`, {
      headers: { 'X-Goog-Api-Key': key },
      signal: AbortSignal.timeout(8000),
    });
    console.log(JSON.stringify({ upstream: 'places', api: 'photo', status: up.status, n: used.photo }));
    if (!up.ok) return json({ error: `upstream ${up.status}` }, 502, CORS);
    const j = await up.json();
    if (!/^https:\/\/[a-z0-9.-]+\.googleusercontent\.com\//.test(j.photoUri || '')) return json({ error: 'no photo' }, 502, CORS);
    // 키 없는 구글 사진 주소로 보낸다(브라우저에서만 1시간 기억)
    return new Response(null, { status: 302, headers: { ...CORS, Location: j.photoUri, 'Cache-Control': 'private, max-age=3600' } });
  } catch (e) {
    return json({ error: e.message || 'upstream error' }, 502, CORS);
  }
}

export { handler as GET, handler as OPTIONS };
