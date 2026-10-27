/* ═══════════════════════════════════════════════════════════
   트래블코스트 — 통합 내비게이션 (상단 헤더 + 하단 탭)

   왜 한 파일인가:
   상단 헤더가 페이지마다 항목·순서·색·라벨이 제각각이었고, estimate/prepare
   에서는 '여행지'가 존재하지 않는 #destinations 앵커를 가리켜 먹통이었다.
   nav.js는 33개 전 페이지에 로드되므로 여기서 헤더까지 한 번에 표준화한다.
   → 어느 페이지를 봐도 같은 메뉴 · 같은 순서 · 같은 라벨.

   설계 원칙(직관성):
   1) 여행 흐름 순서 = 왼→오:  여행지 → 경비 계산 → 출국 준비 → 투어·티켓 → 인천공항 → 내 여행
      ('예산 견적'→'경비 계산': 내 여행의 '예산' 탭과 이름이 겹쳐 헷갈려서 2026-10-23 변경)
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
  var C_BUDGET = '#1B4FD8';  // 경비 계산
  var C_PREP   = '#039855';  // 출국 준비

  /* ── 상단 헤더(데스크톱): 여행 흐름 순서 ──
     key = currentKey()와 매칭되는 활성 판정용 값 */
  var HEADER_LINKS = [
    { href: '/destinations',  key: 'dest',      icon: 'map-pin',      label: '여행지' },
    { href: '/estimate',      key: '/estimate', icon: 'coins',        label: '경비 계산', color: C_BUDGET, bold: true },
    { href: '/prepare',       key: '/prepare',  icon: 'check-circle', label: '출국 준비', color: C_PREP,   bold: true },
    { href: '/tours',         key: '/tours',    icon: 'ticket',       label: '투어·티켓' },
    { href: '/airport',       key: '/airport',  icon: 'plane',        label: '인천공항' },
    { href: '/trips',         key: '/trips',    icon: 'briefcase',    label: '내 여행' }
  ];

  /* ── 하단 탭(모바일): 자주 여는 곳 5개 (HIG 권장) ──
     2026-10-23: '예산 견적'(여행 전 한 번 쓰는 도구) 대신 방문 2위인 '인천공항'을 탭에 올림.
     경비 계산은 상단 헤더·홈 바로가기 칩·새 여행 만들기 창에서 연다. */
  var TABS = [
    { href: '/',              key: '/',         icon: 'home',        label: '홈' },
    { href: '/trips',         key: '/trips',    icon: 'briefcase',   label: '내 여행' },
    { href: '/destinations',  key: 'dest',      icon: 'map-pin',     label: '여행지' },
    { href: '/airport',       key: '/airport',  icon: 'plane',       label: '인천공항' },
    { href: '/prepare',       key: '/prepare',  icon: 'check-circle', label: '출국 준비' }
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
    if (last === 'destinations' || DEST_PAGES.indexOf(last) > -1) return 'dest';   // 여행지 목록·가이드 23곳
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

  /* 클릭되는 div·span 접근성 — 키보드(Tab·Enter·Space)와 화면낭독기에 '버튼'으로 알린다.
     화면이 바뀌며 새로 그려지는 요소도 잡도록 MutationObserver로 따라간다.
     배경 닫기(if(event.target===this)…)는 버튼이 아니므로 건너뜀. */
  var CLICKABLE = 'div[onclick],span[onclick],li[onclick],img[onclick],i[onclick]';
  function markClickable(root) {
    var list = root.querySelectorAll ? root.querySelectorAll(CLICKABLE) : [];
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (el.getAttribute('role') || /^\s*if\s*\(\s*event\.target/.test(el.getAttribute('onclick'))) continue;
      el.setAttribute('role', 'button');
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    }
  }
  function a11yClicks() {
    markClickable(document);
    var queued = false;
    new MutationObserver(function () {
      if (queued) return; queued = true;
      (window.requestAnimationFrame || setTimeout)(function () { queued = false; markClickable(document); });
    }).observe(document.body, { childList: true, subtree: true });
    document.addEventListener('keydown', function (e) {
      var el = e.target;
      if ((e.key !== 'Enter' && e.key !== ' ') || !el || !el.getAttribute) return;
      if (el.getAttribute('role') !== 'button' || /^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) return;
      e.preventDefault(); el.click();
    });
    var st = document.createElement('style');
    st.textContent = '[role=button][tabindex]:focus-visible,[role=checkbox][tabindex]:focus-visible{outline:2px solid #1B4FD8;outline-offset:2px}';
    document.head.appendChild(st);
  }

  /* ── 어디서나 검색(🔍 · Ctrl+K · /) — 여행지·기능·내 여행·내 편명을 한 칸에서 ──
     인천공항 화면은 자체 빠른 검색(Ctrl+K)이 있어 건너뜀. 검색은 이 기기 안에서만(서버 전송 없음). */
  var DEST_NAMES = { osaka: '오사카', fukuoka: '후쿠오카', tokyo: '도쿄', kyoto: '교토', sapporo: '삿포로', okinawa: '오키나와 나하',
    zhangjiajie: '장자제 장가계', guilin: '구이린 계림', shanghai: '상하이', changbaishan: '창바이산 백두산', taipei: '타이베이 대만', hongkong: '홍콩',
    bangkok: '방콕 태국', danang: '다낭 베트남', bali: '발리 인도네시아', singapore: '싱가포르', nhatrang: '나트랑 베트남', cebu: '세부 필리핀',
    kotakinabalu: '코타키나발루 말레이시아', jeju: '제주', busan: '부산', gangneung: '강릉', paris: '파리 프랑스' };
  var FEATURES = [
    ['🧳', '내 여행', '일정 예산 지출 정산 여행 목록', '/trips'],
    ['➕', '새 여행 만들기', '여행 추가 만들기', '/trips?new=1'],
    ['💸', '지출 추가', '돈 쓴 것 기록 가계부', '/trip?quick=expense'],
    ['🧮', '경비 계산', '예산 견적 총예산 비용', '/estimate'],
    ['✅', '출국 준비', '할 일 체크리스트 준비물 타임라인', '/prepare'],
    ['🛂', '입국 준비', '비자 입국 서류 eta', '/prepare#entry'],
    ['📋', '챙길 물건', '짐 준비물 체크리스트', '/prepare#items'],
    ['✈', '인천공항 실시간', '공항 icn', '/airport'],
    ['⭐', '내 편명', '항공편 탑승구 즐겨찾기 편명', '/airport#tab=fav'],
    ['👥', '출국장 혼잡', '대기 혼잡도 출국장', '/airport#tab=congestion'],
    ['🅿', '공항 주차', '주차장 주차 요금', '/airport#tab=parking'],
    ['🚌', '공항 버스·철도', '리무진 공항철도 셔틀', '/airport#tab=transport'],
    ['🎟', '투어·티켓', '입장권 액티비티 숙소 호텔', '/tours'],
    ['🗺', '여행지 가이드', '여행지 목록 추천 비교', '/destinations'],
    ['💱', '환율 계산기', '환율 엔화 달러 바트', '/?open=fx'],
    ['🔔', '환율 알림', '환율 목표', '/?open=fxalert'],
    ['📦', '백업·복원', '백업 복원 옮기기', '/trips?backup=1'],
    ['🔒', '개인정보처리방침', '개인정보', '/privacy']
  ];
  function norm(t) { return String(t || '').toLowerCase().replace(/\s+/g, ''); }
  function searchIndex() {
    var out = [];
    try {
      (JSON.parse(localStorage.getItem('tc_trips_v1') || '[]') || []).forEach(function (t) {
        if (t && t.id) out.push({ ic: '🧳', t: (t.city || '여행') + ' 여행', sub: (t.start || '') + ' ~ ' + (t.end || ''), k: (t.city || '') + ' 내여행', u: '/trip?id=' + encodeURIComponent(t.id), mine: 1 });
      });
    } catch (e) {}
    try {
      (JSON.parse(localStorage.getItem('icn_fav_flights') || '[]') || []).forEach(function (f) {
        var no = f.flightId || f.flightNum || ''; if (no) out.push({ ic: '⭐', t: no, sub: '내 편명', k: no + ' 편명', u: '/airport#tab=fav', mine: 1 });
      });
    } catch (e) {}
    Object.keys(DEST_NAMES).forEach(function (k) { out.push({ ic: '📍', t: DEST_NAMES[k].split(' ')[0] + ' 가이드', sub: '여행지', k: DEST_NAMES[k] + ' ' + k, u: '/' + k }); });
    FEATURES.forEach(function (f) { out.push({ ic: f[0], t: f[1], sub: '바로가기', k: f[1] + ' ' + f[2], u: f[3] }); });
    return out;
  }
  function escH(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var SEARCH_CSS = '.tc-sbtn{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border:none;border-radius:12px;background:transparent;color:inherit;font-size:18px;cursor:pointer;flex-shrink:0;margin-left:auto}' +
    '.tc-sbtn:hover{background:rgba(16,24,40,.06)}' +
    '@media(max-width:900px){.header-inner{position:relative}.header-inner .tc-sbtn{position:absolute;right:8px;top:50%;transform:translateY(-50%);margin:0}}' +
    '.tc-sov{position:fixed;inset:0;z-index:2000;background:rgba(16,24,40,.45);display:flex;align-items:flex-start;justify-content:center;padding:max(10vh,16px) 16px 16px}' +
    '.tc-sbox{width:100%;max-width:560px;background:var(--surface,#fff);border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,.25);overflow:hidden;color:var(--gray-900,#101828)}' +
    '.tc-sin{width:100%;border:none;border-bottom:1px solid var(--gray-200,#E4E7EC);padding:16px 18px;font-size:17px;font-family:inherit;outline:none;background:transparent;color:inherit}' +
    '.tc-sres{max-height:60vh;overflow:auto;padding:6px}' +
    '.tc-sres a{display:flex;align-items:center;gap:10px;min-height:46px;padding:8px 12px;border-radius:10px;text-decoration:none;color:inherit}' +
    '.tc-sres a.on,.tc-sres a:hover{background:var(--primary-lt,#EEF4FF)}' +
    '.tc-sres b{font-weight:700;font-size:15px}.tc-sres small{display:block;color:var(--gray-500,#667085);font-size:12px}' +
    '.tc-sres .ic{width:26px;text-align:center;font-size:18px}.tc-sempty{padding:18px;color:var(--gray-500,#667085);font-size:14px}';
  function openSearch() {
    if (document.querySelector('.tc-sov')) return;
    var idx = searchIndex(), cur = 0, list = [];
    var ov = document.createElement('div');
    ov.className = 'tc-sov';
    ov.innerHTML = '<div class="tc-sbox" role="dialog" aria-modal="true" aria-label="검색">' +
      '<input class="tc-sin" type="search" placeholder="여행지·기능·내 여행 검색 (예: 오사카, 환율, 주차)" aria-label="검색어" autocomplete="off">' +
      '<div class="tc-sres" role="listbox"></div></div>';
    document.body.appendChild(ov);
    var inp = ov.querySelector('.tc-sin'), res = ov.querySelector('.tc-sres'), prevFocus = document.activeElement;
    function close() { if (ov.parentNode) ov.parentNode.removeChild(ov); if (prevFocus && prevFocus.focus) prevFocus.focus(); }
    function render() {
      var q = norm(inp.value);
      list = q ? idx.filter(function (x) { return norm(x.t + ' ' + x.k).indexOf(q) > -1; }).slice(0, 12)
               : idx.filter(function (x) { return x.mine; }).concat(idx.filter(function (x) { return x.sub === '바로가기'; })).slice(0, 8);
      cur = 0;
      res.innerHTML = list.length ? list.map(function (x, i) {
        return '<a href="' + escH(x.u) + '" role="option"' + (i === 0 ? ' class="on"' : '') + '><span class="ic">' + x.ic + '</span><span><b>' + escH(x.t) + '</b><small>' + escH(x.sub) + '</small></span></a>';
      }).join('') : '<div class="tc-sempty">찾는 결과가 없어요. 도시 이름이나 기능(환율·주차·지출)으로 찾아보세요.</div>';
    }
    function mark() { [].forEach.call(res.querySelectorAll('a'), function (a, i) { a.classList.toggle('on', i === cur); if (i === cur) a.scrollIntoView({ block: 'nearest' }); }); }
    inp.addEventListener('input', render);
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { cur = Math.min(cur + 1, list.length - 1); mark(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { cur = Math.max(cur - 1, 0); mark(); e.preventDefault(); }
      else if (e.key === 'Enter' && list[cur]) { e.preventDefault(); var u = list[cur].u; close(); location.href = u; }
    });
    ov.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); else if (e.target.closest && e.target.closest('a')) setTimeout(close, 0); });
    render(); inp.focus();
  }
  window.tcSearch = openSearch;

  /* 최근 본 가이드 — 홈 '최근 본 것' 칩용(이 기기에만, 최대 5개) */
  function recordRecent() {
    var last = location.pathname.replace(/\/+$/, '').replace(/\.html$/, '').split('/').pop();
    if (!DEST_NAMES[last]) return;
    try {
      var r = JSON.parse(localStorage.getItem('tc_recent') || '[]').filter(function (x) { return x && x.s !== last; });
      r.unshift({ s: last, n: DEST_NAMES[last].split(' ')[0], t: Date.now() });
      localStorage.setItem('tc_recent', JSON.stringify(r.slice(0, 5)));
    } catch (e) {}
  }

  function buildSearch() {
    if (/\/airport(\.html)?$/.test(location.pathname)) return;   // 인천공항은 자체 빠른 검색
    var st = document.createElement('style'); st.textContent = SEARCH_CSS; document.head.appendChild(st);
    var host = document.querySelector('.header-inner') || document.querySelector('.tw-head');
    if (host) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'tc-sbtn'; b.setAttribute('aria-label', '검색 (Ctrl+K)'); b.title = '검색 (Ctrl+K)';
      b.textContent = '🔍'; b.addEventListener('click', openSearch);
      host.appendChild(b);
    }
    document.addEventListener('keydown', function (e) {
      var tag = (e.target && e.target.tagName) || '';
      if (((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) || (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(tag) && !e.target.isContentEditable)) {
        e.preventDefault(); openSearch();
      }
    });
  }

  function build() {
    buildHeader();
    buildTabbar();
    a11yClicks();
    buildSearch();
    recordRecent();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
