/* ═══════════════════════════════════════════════════════════
   트립가이드 — 하단 탭 내비게이션 (모바일)

   왜 하단 탭인가:
   Apple HIG·Material Design 3 모두 3~5개 핵심 목적지를 하단에 두길 권장.
   여행자는 낯선 곳에서 한 손으로 쓰므로 엄지 반경 안에 이동 수단이 있어야 한다.
   (상단 햄버거 = 두 번 탭 + 손 위치 이동 필요)

   - 모바일(≤900px)에서만 노출, 데스크톱은 기존 상단 nav 유지
   - iOS 홈 인디케이터 safe-area 대응
   - CSS 자체 포함 → style.css를 안 쓰는 페이지(airport/guide)에서도 동작
   - icons.js가 있으면 SVG, 없으면 조용히 생략(의존 실패해도 안 깨짐)
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var TABS = [
    { href: '/',        icon: 'home',      label: '홈' },
    { href: '/#destinations', icon: 'map-pin', label: '여행지', key: 'dest' },
    { href: '/tours',   icon: 'ticket',    label: '투어·티켓' },
    { href: '/mytrip',  icon: 'briefcase', label: '내 여행' },
    { href: '/airport', icon: 'plane',     label: '공항' }
  ];

  // 목적지 가이드 13곳 — '여행지' 탭으로 활성 표시
  var DEST_PAGES = ['osaka', 'fukuoka', 'tokyo', 'kyoto', 'sapporo', 'bangkok',
    'danang', 'bali', 'singapore', 'jeju', 'busan', 'gangneung', 'paris'];

  var CSS = [
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
    '@media(max-width:900px){',
    '  .tabbar{display:block}',
    '  body{padding-bottom:calc(56px + env(safe-area-inset-bottom,0px))!important}',
    /* 기존 하단 고정 요소들을 탭바 위로 밀어올림 (가려짐 방지) */
    '  #pwa-install-btn{bottom:calc(72px + env(safe-area-inset-bottom,0px))!important}',
    '  #icn-toast{bottom:calc(80px + env(safe-area-inset-bottom,0px))!important}',
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
    return '/' + last;
  }

  function build() {
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
      var key = t.key || t.href;
      var on = (key === cur);
      var svg = (typeof window.icon === 'function') ? window.icon(t.icon, 22) : '';
      html += '<a class="tab' + (on ? ' active' : '') + '" href="' + t.href + '"' +
        (on ? ' aria-current="page"' : '') + '>' + svg +
        '<span>' + t.label + '</span></a>';
    }
    html += '</div>';
    nav.innerHTML = html;
    document.body.appendChild(nav);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
