// Vercel Function (Node.js, 서울 icn1 고정 — vercel.json "regions")
// 2026-10: 인천공항 API(B551177)가 해외 IP 호출에 SERVICETIMEOUT_ERROR(05)를 돌려줌.
//   Edge는 싱가포르(sin1)에서 실행돼 전부 503 → Node + 서울 리전으로 옮겨 국내 IP로 호출한다.
// 역할: CORS 우회(브라우저 → 함수 → 공공 API) + 키 숨김
//
// Usage:
//   /api/proxy?path=<korean-api-path>&<...params>        — Korean API (apis.data.go.kr)
//   /api/proxy?_url=<full-external-url>                  — Any external URL (Open-Meteo etc.)


// 인천공항 공공데이터 키 — 환경변수 우선, 없으면 폴백 (환경변수 등록 후 폴백 제거 권장)
const KEY  = process.env.ICN_API_KEY || '9ae1336587e873e0ff6a0524e0b0cc0333868f67f9fb4180c0be654fb7794615';
const BASE = 'https://apis.data.go.kr/B551177';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Expose-Headers': 'Cache-Control',
};

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

function isAllowedUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== 'https:') return false;          // http·file·gopher 등 차단
  return URL_ALLOWLIST.has(u.hostname);               // 서브도메인 와일드카드 없음
}

async function handler(req) {
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
  } else if (path) {
    // Proxy a Korean API endpoint
    if (!PATH_RE.test(path)) {
      return new Response(JSON.stringify({ error: 'invalid path' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
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

  try {
    const upstream = await fetch(targetUrl, {
      headers: { 'User-Agent': 'TravelGuide/1.0' },
      signal: AbortSignal.timeout(12000),   // 공공 API가 멈추면 12초에 끊고 502로 알림
    });
    const text = await upstream.text();

    return new Response(text, {
      status: upstream.status,
      headers: {
        ...CORS,
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 's-maxage=30, stale-while-revalidate=60',
      },
    });
  } catch (err) {
    const safe = targetUrl.replace(KEY, '[KEY]');
    return new Response(JSON.stringify({ error: err.message, target: safe }), {
      status: 502,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
}

// Node.js 런타임의 Web 표준 핸들러(Request → Response)
export { handler as GET, handler as OPTIONS };
