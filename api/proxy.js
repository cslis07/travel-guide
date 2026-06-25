// Vercel Edge Function — runs at the closest PoP to the user (Korea → Seoul/Tokyo edge)
// Solves two problems:
//  1. CORS: browser → edge function → Korean API (no browser CORS restriction)
//  2. Latency: edge PoP is near Korea, so 10s Vercel limit is not a problem
//
// Usage:
//   /api/proxy?path=<korean-api-path>&<...params>        — Korean API (apis.data.go.kr)
//   /api/proxy?_url=<full-external-url>                  — Any external URL (Open-Meteo etc.)

export const config = { runtime: 'edge' };

const KEY  = '9ae1336587e873e0ff6a0524e0b0cc0333868f67f9fb4180c0be654fb7794615';
const BASE = 'https://apis.data.go.kr/B551177';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS });
  }

  const incoming = new URL(req.url);
  const externalUrl = incoming.searchParams.get('_url');
  const path        = incoming.searchParams.get('path');

  let targetUrl;
  if (externalUrl) {
    // Proxy an arbitrary external URL (Open-Meteo, Air Quality, etc.)
    targetUrl = externalUrl;
  } else if (path) {
    // Proxy a Korean API endpoint
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
