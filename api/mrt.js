// Vercel Edge Function — 마이리얼트립 MCP 프록시
//
// 브라우저는 MCP 프로토콜/CORS 때문에 MCP 서버를 직접 못 부른다.
// 이 함수가 서버측에서 JSON-RPC(tools/call)를 대신 호출한다.
// 마이리얼트립 MCP는 stateless — initialize/세션 없이 tools/call을 바로 받는다.
//
//   POST /api/mrt   { "tool": "searchTnas", "arguments": { ... } }
//   → { ok, tool, copyText, text, data }

export const config = { runtime: 'edge' };

const MCP = 'https://mcp-servers.myrealtrip.com/mcp';

const ALLOWED = new Set([
  'getCurrentTime',
  'searchDomesticFlights',
  'searchInternationalFlights',
  'flightsFareCalendar',
  'getPromotionAirlines',
  'searchStays',
  'getStayDetail',
  'getCategoryList',
  'searchTnas',
  'getTnaDetail',
  'getTnaOptions',
]);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: CORS });
  if (req.method !== 'POST') return err('POST only', 405);

  let body;
  try { body = await req.json(); }
  catch { return err('invalid JSON body', 400); }

  const tool = body?.tool;
  const args = body?.arguments || {};
  if (!tool || !ALLOWED.has(tool)) return err('unknown or missing tool', 400);

  const rpc = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: tool, arguments: args } };

  let raw;
  try {
    const up = await fetch(MCP, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'User-Agent': 'TripGuide/1.0',
      },
      body: JSON.stringify(rpc),
    });
    raw = await up.text();
  } catch (e) {
    return err('MCP 연결 실패: ' + (e.message || e), 502);
  }

  const rpcRes = parseRpc(raw);
  if (rpcRes?.error) return err('MCP 오류: ' + (rpcRes.error.message || 'unknown'), 502);

  const textBlock = rpcRes?.result?.content?.[0]?.text ?? '';
  let data = null, copyText = null;
  try {
    const parsed = JSON.parse(textBlock);
    data = parsed;
    copyText = parsed?.copy_text || null;
  } catch {
    // 순수 텍스트 응답 (getCurrentTime 등)
  }

  return json({ ok: true, tool, copyText, text: copyText || (data ? null : textBlock), data });
}

// JSON-RPC 응답이 application/json 또는 text/event-stream(SSE)일 수 있어 둘 다 처리
function parseRpc(raw) {
  const t = (raw || '').trim();
  if (!t) return null;
  if (t.startsWith('{')) { try { return JSON.parse(t); } catch { /* fall through */ } }
  let payload = '';
  for (const line of t.split(/\r?\n/)) {
    if (line.startsWith('data:')) payload += line.slice(5).trim();
  }
  if (payload) { try { return JSON.parse(payload); } catch { /* ignore */ } }
  return null;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      ...CORS,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
    },
  });
}
function err(message, status) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}
