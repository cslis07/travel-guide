// Vercel Function (Node.js, 서울 icn1 고정 — vercel.json "regions")
// 2026-10: 인천공항 API(B551177)가 해외 IP 호출에 SERVICETIMEOUT_ERROR(05)를 돌려줌.
//   Edge는 싱가포르(sin1)에서 실행돼 전부 503 → Node + 서울 리전으로 옮겨 국내 IP로 호출한다.
// 역할: CORS 우회(브라우저 → 함수 → 공공 API) + 키 숨김
//
// Usage:
//   /api/proxy?path=<korean-api-path>&<...params>        — Korean API (apis.data.go.kr)
//   /api/proxy?_url=<full-external-url>                  — Any external URL (Open-Meteo etc.)


// 인천공항 공공데이터 키 — Vercel 환경변수 ICN_API_KEY만 사용(2026-10-26 폴백 키 삭제)
import { cors, foreignOrigin, rateLimited, tooMany, keyState } from './_guard.js';
const KEY  = process.env.ICN_API_KEY || '';   // Vercel 환경변수만 사용(코드에 키 없음)
const KEY_STATE = keyState(process.env.ICN_API_KEY);
// 어느 배포가 응답하는지(공개 저장소의 커밋 해시라 비밀 아님) — 환경변수 반영 여부 확인용
const DEPLOY = (process.env.VERCEL_GIT_COMMIT_SHA || 'local').slice(0, 7) + '/' + (process.env.VERCEL_ENV || '-');
const BASE = 'https://apis.data.go.kr/B551177';


// ── 보안: _url 은 아래 호스트로만 프록시한다 ──────────────────────
// 예전엔 임의 URL을 그대로 fetch 해서, 누구나 이 함수를 공개 오픈 프록시로
// 쓸 수 있었다(SSRF·대역폭 도용·내부 주소 탐색). 실제로 필요한 곳은 2개뿐.
const URL_ALLOWLIST = new Set([
  'api.open-meteo.com',
  'air-quality-api.open-meteo.com',
  'geocoding-api.open-meteo.com',
]);

// path 도 화이트리스트로 제한 (경로 탈출·타 엔드포인트 호출 방지)
const PATH_RE = /^[A-Za-z0-9_]+\/[A-Za-z0-9_]+$/;
// 한국공항공사(김포·김해 등 14개 공항) 실시간 운항 — svc=kac 일 때만, 정확히 이 경로들만(2026-11-16)
const KAC_BASE = 'https://apis.data.go.kr/B551178';
const KAC_PATHS = new Set(['flight-status/info', 'flight-status/depart', 'flight-status/arrival']);

function isAllowedUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== 'https:') return false;          // http·file·gopher 등 차단
  return URL_ALLOWLIST.has(u.hostname);               // 서브도메인 와일드카드 없음
}

async function handler(req) {
  const CORS = cors(req, 'GET,OPTIONS', { 'Access-Control-Expose-Headers': 'Cache-Control', 'X-Key-State': KEY_STATE, 'X-Deploy': DEPLOY });
  if (foreignOrigin(req)) {
    return new Response(JSON.stringify({ error: 'origin not allowed' }), { status: 403, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  }
  if (rateLimited(req)) return tooMany(CORS);
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS });
  }

  const incoming = new URL(req.url);
  const externalUrl = incoming.searchParams.get('_url');
  const path        = incoming.searchParams.get('path');

  let targetUrl;
  if (externalUrl) {
    // 허용 호스트(Open-Meteo 계열)만 통과
    if (!isAllowedUrl(externalUrl)) {
      return new Response(JSON.stringify({ error: 'url not allowed' }), {
        status: 403,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    targetUrl = externalUrl;
  } else if (path && incoming.searchParams.get('svc') === 'kac') {
    if (!KAC_PATHS.has(path)) {
      return new Response(JSON.stringify({ error: 'invalid path' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
    if (!KEY) {
      return new Response(JSON.stringify({ error: 'ICN_API_KEY not configured' }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    }
    incoming.searchParams.delete('path'); incoming.searchParams.delete('svc');
    incoming.searchParams.set('serviceKey', KEY);
    incoming.searchParams.set('type', 'json');
    targetUrl = `${KAC_BASE}/${path}?${incoming.searchParams.toString()}`;
  } else if (path) {
    // Proxy a Korean API endpoint
    if (!PATH_RE.test(path)) {
      return new Response(JSON.stringify({ error: 'invalid path' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    if (!KEY) {
      return new Response(JSON.stringify({ error: 'ICN_API_KEY not configured' }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    }
    incoming.searchParams.delete('path');
    incoming.searchParams.set('serviceKey', KEY);
    incoming.searchParams.set('type', 'json');
    targetUrl = `${BASE}/${path}?${incoming.searchParams.toString()}`;
  } else {
    return new Response(JSON.stringify({ error: 'path or _url required' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  /* 상류 연결이 순간적으로 끊기면(2026-11-17 운영: Open-Meteo 예보만 'fetch failed' — 몇 분 뒤 정상)
     날씨가 통째로 '--' 가 되므로, 연결 오류는 0.5초 쉬고 한 번 더 묻는다. 12초 시간 초과는 다시 묻지 않는다(사용자 대기 24초 방지) */
  const get = () => fetch(targetUrl, {
    headers: { 'User-Agent': 'TravelGuide/1.0' },
    signal: AbortSignal.timeout(12000),   // 공공 API가 멈추면 12초에 끊고 502로 알림
  });
  try {
    let upstream;
    try { upstream = await get(); }
    catch (e1) {
      // 시간 초과(전체 12초·접속 10초)는 다시 물어도 같은 만큼 더 기다리기만 한다(운영 실측 21초)
      if (e1 && (e1.name === 'TimeoutError' || e1.name === 'AbortError' || (e1.cause && /TIMEOUT/.test(e1.cause.code || '')))) throw e1;
      await new Promise(r => setTimeout(r, 500));
      upstream = await get();
    }
    const text = await upstream.text();
    // 호출량 계측 — CDN 캐시를 지나 상류까지 간 호출만 찍힌다(Vercel 로그에서 'upstream' 검색·집계)
    console.log(JSON.stringify({ upstream: 'proxy', api: path || new URL(targetUrl).hostname, status: upstream.status, key: KEY_STATE }));

    return new Response(text, {
      status: upstream.status,
      headers: {
        ...CORS,
        'Content-Type': 'application/json; charset=utf-8',
        // 날씨(Open-Meteo)는 15분 단위로 바뀌어 10분 CDN 캐시면 충분 — 상류가 잠깐 죽어도 1시간 동안은 직전 값을 준다
        'Cache-Control': externalUrl && upstream.ok ? 's-maxage=600, stale-while-revalidate=3600' : 's-maxage=30, stale-while-revalidate=60',
      },
    });
  } catch (err) {
    // 상류 주소는 돌려주지 않는다 — 주소 안의 키는 URL 인코딩돼 있어 문자열 치환으로 가려지지 않는다
    // 원인 코드(ENOTFOUND·ECONNRESET·UND_ERR_CONNECT_TIMEOUT 등)만 덧붙인다 — 주소·키는 넣지 않음
    const cause = (err && err.cause && (err.cause.code || err.cause.name)) || (err && err.name) || '';
    console.log(JSON.stringify({ upstream: 'proxy', api: path || (externalUrl ? new URL(targetUrl).hostname : ''), error: String(err && err.message || err).slice(0, 80), cause }));
    return new Response(JSON.stringify({ error: err.message, cause }), {
      status: 502,
      headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }
}

// Node.js 런타임의 Web 표준 핸들러(Request → Response)
export { handler as GET, handler as OPTIONS };
