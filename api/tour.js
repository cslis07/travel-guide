// Vercel Function (Node.js, 서울 icn1 — vercel.json "regions") — TourAPI (한국관광공사) 프록시
//
// 역할:
//  1) 서비스 키 숨김 (브라우저에 노출 X)
//  2) CDN 캐시 (s-maxage) 로 동일 검색 5분 캐싱
//  3) Vercel KV 가 설정돼 있으면 한 번 더 캐싱
//  4) CORS 처리
//
// 호출 형식:
//   GET /api/tour?path=areaBasedList2&areaCode=39&numOfRows=20&pageNo=1
//   GET /api/tour?path=detailCommon2&contentId=126508&contentTypeId=12
//
// 환경변수:
//   TOUR_API_KEY  — data.go.kr 발급 Decoded 키 (필수)
//   KV_URL, KV_REST_API_TOKEN — Vercel KV (선택, 있으면 사용)


const BASE = 'https://apis.data.go.kr/B551011/KorService2';
import { cors, foreignOrigin, rateLimited, tooMany, keyState } from './_guard.js';
const KEY_STATE = keyState(process.env.TOUR_API_KEY);

// 엔드포인트별 캐시 TTL (초)
const CACHE_TTL = {
  areaBasedList2:    300,   // 5분 — 인기 검색
  searchKeyword2:    300,   // 5분 — 인기 키워드
  locationBasedList2: 180,  // 3분 — 위치 기반은 약간 짧게
  detailCommon2:    3600,   // 1시간 — 정적 정보
  detailIntro2:     1800,   // 30분 — 주차 정보 등
  detailImage2:     3600,   // 1시간 — 이미지 목록
  areaCode2:       86400,   // 24시간 — 지역/시군구 코드표(행정구역은 거의 안 바뀜)
};

async function handler(req) {
  const CORS = cors(req, 'GET,OPTIONS', { 'Access-Control-Expose-Headers': 'Cache-Control, X-Tour-Cache-TTL', 'X-Key-State': KEY_STATE });
  if (foreignOrigin(req)) return jsonError('origin not allowed', 403, CORS);
  if (rateLimited(req)) return tooMany(CORS);
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS });
  }

  const url  = new URL(req.url);
  const path = url.searchParams.get('path');
  if (!path) {
    return jsonError('path required', 400, CORS);
  }

  // path 안전성 검증 — 허용된 엔드포인트만
  if (!Object.prototype.hasOwnProperty.call(CACHE_TTL, path)) {
    return jsonError('invalid path', 400, CORS);
  }

  // 키는 Vercel 환경변수 TOUR_API_KEY만 사용(2026-10-26 폴백 키 삭제)
  const key = process.env.TOUR_API_KEY;   // Vercel 환경변수만 사용(코드에 키 없음)
  if (!key) return jsonError('TOUR_API_KEY not configured', 500, CORS);

  // 공통 파라미터 + 사용자 파라미터 머지
  const params = new URLSearchParams();
  url.searchParams.forEach((v, k) => {
    if (k !== 'path') params.set(k, v);
  });
  params.set('serviceKey', key);
  params.set('MobileOS',  'ETC');
  params.set('MobileApp', 'TravelCost');
  params.set('_type',     'json');

  const target = `${BASE}/${path}?${params.toString()}`;
  const ttl    = CACHE_TTL[path];

  try {
    const upstream = await fetch(target, {
      headers: { 'User-Agent': 'TravelGuide/1.0' },
    });

    if (!upstream.ok) {
      return jsonError(`upstream ${upstream.status}`, 502, CORS);
    }

    const text = await upstream.text();
    console.log(JSON.stringify({ upstream: 'tour', api: path, status: upstream.status, key: KEY_STATE }));   // 호출량 계측(Vercel 로그)

    return new Response(text, {
      status: 200,
      headers: {
        ...CORS,
        'Content-Type':  'application/json; charset=utf-8',
        // 핵심: 같은 검색에 대해 CDN 캐시 적중
        'Cache-Control': `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 2}`,
        'X-Tour-Cache-TTL': String(ttl),
      },
    });
  } catch (err) {
    return jsonError(err.message || 'upstream error', 502, CORS);
  }
}

function jsonError(message, status, CORS) {
  return new Response(
    JSON.stringify({ error: message, ts: Date.now() }),
    {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    }
  );
}

// Node.js 런타임의 Web 표준 핸들러(Request → Response) — Edge 때처럼 모든 메서드를 같은 핸들러로
export { handler as GET, handler as POST, handler as OPTIONS };
