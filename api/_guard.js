// API 함수 공용 보호 — 밑줄로 시작해 Vercel이 함수로 배포하지 않는다(import 전용).
//
// 1) CORS: 우리 사이트(travelcost.co.kr·www·Vercel 미리보기·로컬)에서 온 브라우저 요청만 허용.
//    같은 사이트 fetch는 CORS 헤더가 필요 없고, 남의 웹사이트가 브라우저에서 이 API를 쓰는 것만 막힌다.
// 2) 호출 제한: IP당 1분 요청 수 제한(인스턴스 메모리 기준 — Fluid Compute는 인스턴스를 재사용하므로
//    대부분 같은 카운터를 쓴다. 완벽한 차단이 아니라 한 곳에서 몰아치는 남용을 끊는 용도).
//    CDN 캐시에 맞은 요청은 함수까지 오지 않으므로 세지 않는다.

const ORIGIN_RE = /^https:\/\/((www\.)?travelcost\.co\.kr|[a-z0-9-]+\.vercel\.app)$|^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;

export function cors(req, methods = 'GET,OPTIONS', extra = {}) {
  const origin = req.headers.get('origin') || '';
  const h = { 'Access-Control-Allow-Methods': methods, Vary: 'Origin', ...extra };
  if (ORIGIN_RE.test(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}

/* 다른 사이트 브라우저에서 온 요청이면 true (Origin 없는 서버·같은 사이트 GET은 통과) */
export function foreignOrigin(req) {
  const origin = req.headers.get('origin');
  return !!origin && !ORIGIN_RE.test(origin);
}

const hits = new Map();
let sweptAt = 0;
export function rateLimited(req, perMin = 120) {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || '';
  if (!ip) return false;
  const now = Date.now(), win = Math.floor(now / 60000);
  if (now - sweptAt > 120000) { sweptAt = now; for (const [k, v] of hits) if (v.win !== win) hits.delete(k); }
  const h = hits.get(ip);
  if (!h || h.win !== win) { hits.set(ip, { win, n: 1 }); return false; }
  h.n += 1;
  return h.n > perMin;
}

export function tooMany(headers) {
  return new Response(JSON.stringify({ error: 'too many requests' }), {
    status: 429,
    headers: { ...headers, 'Content-Type': 'application/json', 'Retry-After': '60', 'Cache-Control': 'no-store' },
  });
}

/* 키 상태 확인용(운영 점검) — 'env-new'(새 키 등록됨) · 'env-old'(공개된 옛 키 그대로) · 'fallback'(환경변수 없음).
   키 값은 내보내지 않고, 옛 키의 sha256 앞 16자와만 비교한다. */
import { createHash } from 'node:crypto';
const OLD_KEY_SHA = '7b432c263f39bac5';
export function keyState(envVal) {
  if (!envVal) return 'fallback';
  return createHash('sha256').update(envVal).digest('hex').slice(0, 16) === OLD_KEY_SHA ? 'env-old' : 'env-new';
}
