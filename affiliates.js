/* ═══════════════════════════════════════════════════════════
   트립가이드 — 제휴(어필리에이트) 공용 레지스트리

   설계 근거
   · 여행 업계는 "링크 제휴는 열려 있고 가격 API는 닫혀 있다".
     그래서 라이브 가격은 마이리얼트립 MCP 한 곳뿐이고,
     나머지는 검색어를 각 플랫폼으로 넘기는 딥링크로 처리한다.
     이 파일은 그 딥링크에 추적 파라미터를 붙이는 단일 지점이다.
   · 발급값(aff)이 비어 있으면 추적 없는 일반 링크로 조용히 동작한다.
     → 파트너스 승인 전에도 사이트는 정상 작동하고, 승인 후엔 이 파일만 고치면 된다.
   · 카테고리별로 "붙일 수 있는가"가 다르다. monetizable 플래그로 구분한다.
     법적으로 개인이 수수료를 받기 어려운 영역(보험·환전)은 정보 제공만 한다.

   ⚠️ 수익 고지 의무
   공정거래위원회 「추천·보증 등에 관한 표시·광고 심사지침」상
   대가를 받는 링크는 경제적 이해관계를 명시해야 한다.
   AFF.disclosure() 를 제휴 링크가 있는 모든 페이지에 노출할 것.
   ═══════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  /* ── 파트너 레지스트리 ────────────────────────────────────
     aff: 파트너스 가입 후 발급받는 추적 파라미터. 빈 객체면 일반 링크.
     signup: 제휴 신청 경로(가입 시 조건·수수료율 직접 확인 필요).
     types: 이 파트너가 커버하는 카테고리.
     ───────────────────────────────────────────────────────── */
  var PARTNERS = [
    {
      key: 'myrealtrip', label: '마이리얼트립', color: '#0BB8B4', bg: '#E6F8F7',
      base: 'https://www.myrealtrip.com/search', qkey: 'q',
      types: ['tna', 'stay', 'flight'],
      signup: 'https://www.myrealtrip.com/partners',
      aff: {} /* 예: {utm_source:'...'} — 발급값으로 교체 */
    },
    {
      key: 'klook', label: '클룩', color: '#e8384f', bg: '#FFF0F3',
      base: 'https://www.klook.com/ko/search/', qkey: 'query',
      types: ['tna', 'stay'],
      signup: 'https://www.klook.com/ko/affiliate/',
      aff: {} /* {aid, aff_adid} */
    },
    {
      key: 'kkday', label: 'KKday', color: '#ff5b00', bg: '#FFF1E8',
      base: 'https://www.kkday.com/ko/product/productlist', qkey: 'keyword',
      types: ['tna'],
      signup: 'https://www.kkday.com/ko/affiliate',
      aff: {} /* {cid} */
    },
    {
      key: 'booking', label: '부킹닷컴', color: '#003580', bg: '#EAF0FF',
      base: 'https://www.booking.com/searchresults.ko.html', qkey: 'ss',
      types: ['stay', 'car'],
      signup: 'https://www.booking.com/affiliate-program/v2/index.html',
      aff: {} /* {aid} */
    },
    {
      key: 'agoda', label: '아고다', color: '#c1272d', bg: '#FDECEA',
      base: 'https://www.agoda.com/ko-kr/search', qkey: 'textToSearch',
      types: ['stay'],
      signup: 'https://partners.agoda.com/',
      aff: {} /* {cid} */
    },
    {
      key: 'tripcom', label: '트립닷컴', color: '#2577E3', bg: '#E9F2FF',
      base: 'https://kr.trip.com/searchresult/', qkey: 'keyword',
      types: ['stay', 'flight', 'car'],
      signup: 'https://kr.trip.com/partners/',
      aff: {} /* {allianceid, sid} */
    },
    {
      key: 'airalo', label: 'Airalo', color: '#F4364C', bg: '#FFEFF1',
      base: 'https://www.airalo.com/ko', qkey: null,
      types: ['esim'],
      signup: 'https://www.airalo.com/affiliate-program',
      aff: {} /* {ref} */
    },
    {
      key: 'ubigi', label: 'Ubigi', color: '#00A3AD', bg: '#E4F7F8',
      base: 'https://cellulardata.ubigi.com/ko/', qkey: null,
      types: ['esim'],
      signup: 'https://cellulardata.ubigi.com/ko/affiliate/',
      aff: {}
    }
  ];

  /* ── 카테고리 정의 ────────────────────────────────────────
     monetizable:false = 개인이 수수료를 받기 어려운 영역.
       · insurance : 보험업법상 '모집' 규제. 보험대리점 등록 없이
                     수수료를 받는 구조는 위험 → 정보 제공만 한다.
       · fx        : 환전은 은행·인가 업자 영역. 제휴 링크 대상 아님.
     이 두 카테고리는 CTA를 만들지 않고 공식 사이트 안내만 노출한다.
     ───────────────────────────────────────────────────────── */
  var CATEGORIES = {
    tna:       { label: '투어·티켓',   monetizable: true },
    stay:      { label: '숙소',        monetizable: true },
    flight:    { label: '항공',        monetizable: true },
    car:       { label: '렌터카',      monetizable: true },
    esim:      { label: 'eSIM·데이터', monetizable: true },
    insurance: { label: '여행자보험',  monetizable: false,
                 why: '보험업법상 모집 규제 대상이라 제휴 수수료 구조를 붙이지 않습니다.' },
    fx:        { label: '환전',        monetizable: false,
                 why: '환전은 인가받은 금융기관 영역이라 제휴 대상이 아닙니다.' }
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* 파트너 검색 URL 생성. query가 없거나 qkey가 null이면 기본 URL만 반환한다. */
  function url(p, query) {
    var u;
    try { u = new URL(p.base); } catch (e) { return p.base; }
    if (p.qkey && query) u.searchParams.set(p.qkey, query);
    var aff = p.aff || {};
    for (var k in aff) { if (aff[k]) u.searchParams.set(k, aff[k]); }
    return u.toString();
  }

  function byType(type) {
    return PARTNERS.filter(function (p) { return p.types.indexOf(type) > -1; });
  }

  /* 수수료 발생 가능 링크가 하나라도 있는지 — 고지 문구 노출 판단용 */
  function hasPaidLinks() {
    return PARTNERS.some(function (p) {
      return p.aff && Object.keys(p.aff).some(function (k) { return !!p.aff[k]; });
    });
  }

  /* 제휴 링크 버튼 묶음 HTML */
  function ctas(type, query, opts) {
    var cat = CATEGORIES[type];
    if (cat && cat.monetizable === false) return '';
    var o = opts || {};
    var list = byType(type);
    if (!list.length) return '';
    return list.map(function (p) {
      var label = o.verb
        ? esc(p.label) + '에서 ' + esc(o.verb)
        : (query ? esc(p.label) + '에서 "' + esc(query) + '" 보기' : esc(p.label) + ' 바로가기');
      return '<a class="aff-cta" style="background:' + p.bg + ';color:' + p.color + '"' +
        ' href="' + esc(url(p, query)) + '" target="_blank" rel="nofollow sponsored noopener"' +
        ' data-aff="' + esc(p.key) + '">' + label + ' ↗</a>';
    }).join('');
  }

  /* 공정위 표시 지침 대응 고지 문구.
     발급값이 하나도 없으면(=수수료 미발생) 문구를 바꿔 정직하게 표시한다. */
  function disclosure() {
    return hasPaidLinks()
      ? '이 페이지의 예약 링크 중 일부는 제휴 링크로, 이를 통해 예약이 이루어지면 ' +
        '트립가이드가 일정액의 수수료를 받을 수 있습니다. 이용자가 추가로 부담하는 비용은 없습니다.'
      : '현재 이 페이지의 링크는 제휴 수수료가 발생하지 않는 일반 링크입니다.';
  }

  function disclosureHtml() {
    return '<p class="aff-disclosure">' + esc(disclosure()) + '</p>';
  }

  /* 공용 스타일 — style.css를 안 쓰는 단일 파일 페이지에서도 동작하도록 자체 주입 */
  var CSS = [
    '.aff-cta{display:inline-flex;align-items:center;gap:6px;padding:10px 14px;border-radius:999px;',
    '  font-size:.82rem;font-weight:700;text-decoration:none;margin:4px 6px 4px 0;',
    '  transition:transform .12s ease,box-shadow .12s ease}',
    '.aff-cta:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(16,24,40,.13)}',
    '.aff-disclosure{font-size:.7rem;line-height:1.55;color:#667085;margin-top:14px;',
    '  padding:10px 12px;background:#F9FAFB;border:1px solid #E4E7EC;border-radius:10px}',
    '@media(prefers-color-scheme:dark){',
    '  .aff-disclosure{background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.1);color:#98A2B3}',
    '}'
  ].join('');

  function injectCss() {
    if (document.getElementById('aff-css')) return;
    var s = document.createElement('style');
    s.id = 'aff-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectCss);
  } else {
    injectCss();
  }

  global.AFF = {
    PARTNERS: PARTNERS,
    CATEGORIES: CATEGORIES,
    url: url,
    byType: byType,
    ctas: ctas,
    hasPaidLinks: hasPaidLinks,
    disclosure: disclosure,
    disclosureHtml: disclosureHtml
  };
})(window);
