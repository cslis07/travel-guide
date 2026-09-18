/* ═══════════════════════════════════════════════════════════
   트래블코스트 — 통합 내비게이션 (상단 헤더 + 하단 탭)

   왜 한 파일인가:
   상단 헤더가 페이지마다 항목·순서·색·라벨이 제각각이었고, estimate/prepare
   에서는 '여행지'가 존재하지 않는 #destinations 앵커를 가리켜 먹통이었다.
   nav.js는 33개 전 페이지에 로드되므로 여기서 헤더까지 한 번에 표준화한다.
   → 어느 페이지를 봐도 같은 메뉴 · 같은 순서 · 같은 라벨.

   설계 원칙(직관성):
   1) 여행 흐름 순서 = 왼→오:  여행지 → 예산 견적 → 출국 준비 → 투어·티켓 → 인천공항 → 내 여행
   2) 색 위계 최소화:  핵심 도구 2개(예산=파랑·준비=초록)만 강조, 나머지 중립색
   3) 데스크톱 헤더와 모바일 하단 탭이 같은 순서를 말한다(일관성)

   - 하단 탭: 모바일(≤900px)에서만 노출, HIG 권장 5개 이내
   - CSS 자체 포함 → style.css를 안 쓰는 페이지(airport/guide)에서도 동작
   - icons.js가 있으면 SVG, 없으면 조용히 생략(의존 실패해도 안 깨짐)
   - #nav(상단 헤더 nav)가 없는 페이지(airport 등)는 헤더 표준화 건너뜀
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── 브랜드 강조색 (핵심 도구 2개만) ── */
  var C_BUDGET = '#1B4FD8';  // 예산 견적
  var C_PREP   = '#039855';  // 출국 준비

  /* ── 상단 헤더(데스크톱): 여행 흐름 순서 ──
     key = currentKey()와 매칭되는 활성 판정용 값 */
  var HEADER_LINKS = [
    { href: '/#destinations', key: 'dest',      icon: 'map-pin',      label: '여행지' },
    { href: '/estimate',      key: '/estimate', icon: 'coins',        label: '예산 견적', color: C_BUDGET, bold: true },
    { href: '/prepare',       key: '/prepare',  icon: 'check-circle', label: '출국 준비', color: C_PREP,   bold: true },
    { href: '/tours',         key: '/tours',    icon: 'ticket',       label: '투어·티켓' },
    { href: '/airport',       key: '/airport',  icon: 'plane',        label: '인천공항' },
    { href: '/trips',         key: '/trips',    icon: 'briefcase',    label: '내 여행' }
  ];

  /* ── 하단 탭(모바일): 홈 + 여행 흐름 상위 4단계 (5개, HIG 권장) ──
     공항은 헤더·홈 배너·푸터에 남기고, 탐색 진입점인 '여행지'를 탭에 올린다. */
  var TABS = [
    { href: '/',              key: '/',         icon: 'home',        label: '홈' },
    { href: '/#destinations', key: 'dest',      icon: 'map-pin',     label: '여행지' },
    { href: '/estimate',      key: '/estimate', icon: 'coins',       label: '예산 견적' },
    { href: '/prepare',       key: '/prepare',  icon: 'check-circle', label: '출국 준비' },
    { href: '/tours',         key: '/tours',    icon: 'ticket',      label: '투어·티켓' }
  ];

  // 목적지 가이드 23곳 — 활성 표시용(전용 탭 없이 '여행지'가 대표)
  var DEST_PAGES = ['osaka', 'fukuoka', 'tokyo', 'kyoto', 'sapporo', 'okinawa',
    'zhangjiajie', 'guilin', 'shanghai', 'changbaishan', 'taipei', 'hongkong',
    'bangkok', 'danang', 'bali', 'singapore', 'nhatrang', 'cebu', 'kotakinabalu',
    'jeju', 'busan', 'gangneung', 'paris'];

  var CSS = [
    /* 하단 탭바 */
    '.tabbar{position:fixed;left:0;right:0;bottom:0;z-index:900;display:none;',
    '  background:rgba(255,255,255,.92);-webkit-backdrop-filter:saturate(180%) blur(20px);',
    '  backdrop-filter:saturate(180%) blur(20px);border-top:1px solid rgba(0,0,0,.07);',
    '  padding-bottom:env(safe-area-inset-bottom,0px)}',
    '.tabbar-inner{display:flex;align-items:stretch;height:56px;max-width:640px;margin:0 auto}',
    '.tab{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;',
    '  text-decoration:none;color:#8A94A6;font-size:10.5px;font-weight:600;letter-spacing:-.02em;',
    '  -webkit-tap-highlight-color:transparent;transition:color .15s;position:relative;min-width:0}',
    '.tab span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}',
    '.tab svg{width:22px;height:22px;flex-shrink:0}',
    '.tab.active{color:#1B4FD8}',
    '.tab.active svg{stroke-width:2.1}',
    '.tab:active{opacity:.55}',
    /* 상단 헤더 활성 표시(밑줄 바) — 색 위계를 해치지 않게 currentColor 사용 */
    '.nav a.nav-active{position:relative}',
    '.nav a.nav-active::after{content:"";position:absolute;left:0;right:0;bottom:-6px;',
    '  height:2px;background:currentColor;border-radius:2px;opacity:.9}',
    '@media(max-width:900px){',
    '  .tabbar{display:block}',
    '  body{padding-bottom:calc(56px + env(safe-area-inset-bottom,0px))!important}',
    /* 기존 하단 고정 요소들을 탭바 위로 밀어올림 (가려짐 방지) */
    '  #pwa-install-btn{bottom:calc(72px + env(safe-area-inset-bottom,0px))!important}',
    '  #icn-toast{bottom:calc(80px + env(safe-area-inset-bottom,0px))!important}',
    '  .nav a.nav-active::after{display:none}',   /* 모바일 드롭다운에선 밑줄 숨김 */
    '}',
    '@media(prefers-color-scheme:dark){',
    '  .tabbar{background:rgba(24,28,36,.92);border-top-color:rgba(255,255,255,.09)}',
    '}',
    'body.dark .tabbar,html[data-theme="dark"] .tabbar{background:rgba(24,28,36,.92);border-top-color:rgba(255,255,255,.09)}'
  ].join('');

  function currentKey() {
    var p = location.pathname.replace(/\/+$/, '').replace(/\.html$/, '');
    var last = p.split('/').pop() || '';
    if (!last || last === 'index') return '/';
    if (DEST_PAGES.indexOf(last) > -1) return 'dest';
    if (last === 'trip') return '/trips';   // 여행 허브도 '내 여행' 활성
    return '/' + last;
  }

  function iconSvg(name, size) {
    return (typeof window.icon === 'function') ? window.icon(name, size) : '';
  }

  /* 상단 헤더 표준화: 기존 #nav의 내용을 통일된 메뉴로 교체.
     정적 마크업은 그대로 두고 런타임에 덮어써 '단일 진실 원본'을 만든다. */
  function buildHeader() {
    var navEl = document.getElementById('nav');
    if (!navEl) return;               // airport 등 헤더 nav 없는 페이지는 건너뜀

    var cur = currentKey();
    var html = '';
    for (var i = 0; i < HEADER_LINKS.length; i++) {
      var l = HEADER_LINKS[i];
      var on = (l.key === cur);
      var style = '';
      if (l.color) style += 'color:' + l.color + ';';
      if (l.bold)  style += 'font-weight:700;';
      html += '<a href="' + l.href + '"' +
        (style ? ' style="' + style + '"' : '') +
        (on ? ' class="nav-active" aria-current="page"' : '') + '>' +
        iconSvg(l.icon, 17) + ' ' + l.label + '</a>';
    }
    navEl.innerHTML = html;
  }

  /* 하단 탭바 생성 */
  function buildTabbar() {
    if (document.querySelector('.tabbar')) return;   // 중복 방지

    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var cur = currentKey();
    var nav = document.createElement('nav');
    nav.className = 'tabbar';
    nav.setAttribute('aria-label', '주요 메뉴');

    var html = '<div class="tabbar-inner">';
    for (var i = 0; i < TABS.length; i++) {
      var t = TABS[i];
      var on = (t.key === cur);
      html += '<a class="tab' + (on ? ' active' : '') + '" href="' + t.href + '"' +
        (on ? ' aria-current="page"' : '') + '>' + iconSvg(t.icon, 22) +
        '<span>' + t.label + '</span></a>';
    }
    html += '</div>';
    nav.innerHTML = html;
    document.body.appendChild(nav);
  }

  function build() {
    buildHeader();
    buildTabbar();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
