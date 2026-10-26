/* '내 다음 여행' 카드 (네이버 For U 격) — 여행 중이면 오늘 다음 일정, 출발 전이면 D-day + 할 일, 다녀왔으면 남은 정산.
   저장된 여행(TripStore)만 읽고, 여행이 없으면 아무것도 그리지 않는다. */
(function () {
  'use strict';
  var box = document.getElementById('hxNext'), T = window.TripStore;
  if (!box || !T) return;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var won = function (n) { return '₩' + Math.round(n || 0).toLocaleString('ko-KR'); };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var now = new Date(), today = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()), hm = pad(now.getHours()) + ':' + pad(now.getMinutes());
  var COV = { osaka: '#f97316,#e5484d', blue: '#1B4FD8,#0ea5e9', purple: '#7c3aed,#1B4FD8', green: '#039855,#22c55e', pink: '#db2777,#f97316' };

  var trips = T.all();
  var going = trips.filter(function (t) { return t.start <= today && today <= t.end; })[0];
  var next = trips.filter(function (t) { return t.start > today; }).sort(function (a, b) { return a.start < b.start ? -1 : 1; })[0];
  var owed = trips.filter(function (t) { return t.end < today && T.daysBetween(t.end, today) <= 30 && T.settlements(t).length; })
    .sort(function (a, b) { return a.end > b.end ? -1 : 1; })[0];
  var t = going || next || owed;
  if (!t) return;

  var head, line, cta, tab = '';
  if (t === going) {
    var di = T.daysBetween(t.start, today), items = ((t.days && t.days[di] && t.days[di].items) || []).slice()
      .sort(function (a, b) { return (a.time || '99') < (b.time || '99') ? -1 : 1; });
    var up = items.filter(function (it) { return !it.time || it.time >= hm; })[0];
    head = '여행 ' + (di + 1) + '일차 / ' + T.tripLength(t) + '일';
    line = up ? '다음 ' + esc(up.time || '') + ' ' + esc(up.title) : (items.length ? '오늘 일정을 모두 마쳤어요 🎉' : '오늘 일정을 추가해 보세요');
    cta = '일정 보기';
  } else if (t === next) {
    var dday = T.daysBetween(today, t.start);
    var todo = (t.checklist || []).filter(function (c) { return !c.done; })
      .map(function (c) { var m = /D-(\d+)/.exec(c.when || ''); return { c: c, n: m ? +m[1] : -1 }; })
      .sort(function (a, b) { return b.n - a.n; })[0];
    head = T.ddayText(t) + ' · ' + T.tripLength(t) + '일';
    line = todo ? '할 일: ' + esc(todo.c.text) + (todo.n >= 0 ? ' <em>' + (todo.n >= dday ? '지금' : 'D-' + todo.n + '까지') + '</em>' : '')
      : !(t.checklist || []).length ? (T.budgetTotal(t) ? '예산 ' + won(T.budgetTotal(t)) + ' · 준비물을 정해 보세요' : '예산과 준비물을 정해 보세요')   // 0개를 '다 챙김'으로 보지 않음
      : (T.budgetTotal(t) ? '예산 ' + won(T.budgetTotal(t)) + ' · 준비물 다 챙겼어요' : '준비물 다 챙겼어요 · 예산을 정해 보세요');
    cta = todo ? '준비물' : '열기'; tab = todo || !(t.checklist || []).length ? 'pack' : '';
  } else {
    var s = T.settlements(t);
    head = '다녀온 여행 · 정산 남음';
    line = esc(s[0].from) + ' → ' + esc(s[0].to) + ' <b>' + won(s[0].amt) + '</b>' + (s.length > 1 ? ' 외 ' + (s.length - 1) + '건' : '');
    cta = '정산 보기'; tab = 'budget';
  }
  box.innerHTML = '<a class="hx-next" href="/trip?id=' + encodeURIComponent(t.id) + (tab ? '&tab=' + tab : '') + '">'
    + (function (ph) {   // 도시 사진이 있으면 사진, 없으면 커버 색 + 첫 글자
      return ph ? '<span class="hx-nx-dot" style="background:center/cover url(\'' + ph + '\')"></span>'
        : '<span class="hx-nx-dot" style="background:linear-gradient(135deg,' + (COV[t.cover] || COV.blue) + ')">' + esc((t.city || '여').slice(0, 1)) + '</span>';
    })(T.cityPhoto ? T.cityPhoto(t.city) : '')
    + '<span class="hx-nx-body"><small>내 다음 여행 · ' + esc(head) + '</small><strong>' + esc(t.city) + '</strong><span>' + line + '</span></span>'
    + '<span class="hx-nx-cta">' + cta + ' ›</span></a>';
})();

/* 환율 좋은 날 알림 — 목표 환율(원)을 정해 두면, 홈을 열 때 실시간 환율(trips.js RATES = 1단위당 원)과 비교해 배너.
   푸시가 아니라 '열었을 때' 확인(서버 없음). 단위는 엔·동처럼 작은 통화는 100/10,000 단위로. */
var FX_CUR = { JPY: ['엔', '¥'], USD: ['달러', '$'], EUR: ['유로', '€'], THB: ['바트', '฿'], VND: ['동', '₫'], CNY: ['위안', '¥'], TWD: ['대만달러', 'NT$'], HKD: ['홍콩달러', 'HK$'], SGD: ['싱가포르달러', 'S$'] };
function fxUnit(c) { var r = (window.TripStore && TripStore.RATES[c]) || 1; return r < 1 ? 10000 : r < 100 ? 100 : 1; }
function fxNow(c) { var T = window.TripStore; return T ? Math.round(T.RATES[c] * fxUnit(c) * 10) / 10 : 0; }
function fxLoad() { try { return JSON.parse(localStorage.getItem('tc_fx_alert') || 'null'); } catch (e) { return null; } }
function hxFxAlert() {
  var box = document.getElementById('hxFxBox'); if (!box) return false;
  if (!box.hidden) { box.hidden = true; return false; }
  var a = fxLoad() || { cur: 'JPY', target: '' };
  box.innerHTML = '<div class="fxa"><b>🔔 환율 좋은 날 알림</b><small>정한 환율 이하로 내려가면, 홈을 열 때 알려 드려요</small>'
    + '<div class="fxa-r"><select id="fxaCur">' + Object.keys(FX_CUR).map(function (c) { return '<option value="' + c + '"' + (c === a.cur ? ' selected' : '') + '>' + FX_CUR[c][0] + ' (' + c + ')</option>'; }).join('') + '</select>'
    + '<span id="fxaUnit"></span><input id="fxaVal" type="number" inputmode="decimal" placeholder="목표" value="' + (a.target || '') + '"><span>원 이하</span></div>'
    + '<div class="fxa-now" id="fxaNow"></div><div class="fxa-b"><button onclick="hxFxSave()">저장</button>' + (fxLoad() ? '<button class="off" onclick="hxFxOff()">알림 끄기</button>' : '') + '</div></div>';
  box.hidden = false;
  var upd = function () { var c = document.getElementById('fxaCur').value, u = fxUnit(c); document.getElementById('fxaUnit').textContent = FX_CUR[c][1] + u.toLocaleString('ko-KR') + ' ='; document.getElementById('fxaNow').textContent = '지금 ' + FX_CUR[c][1] + u.toLocaleString('ko-KR') + ' = ' + fxNow(c).toLocaleString('ko-KR') + '원'; };
  document.getElementById('fxaCur').addEventListener('change', upd);
  if (window.TripStore) TripStore.refreshRates(upd); else upd();
  return false;
}
function hxFxSave() {
  var c = document.getElementById('fxaCur').value, v = parseFloat(document.getElementById('fxaVal').value);
  if (!(v > 0)) { alert('목표 환율을 숫자로 넣어 주세요'); return; }
  try { localStorage.setItem('tc_fx_alert', JSON.stringify({ cur: c, target: v })); } catch (e) {}
  document.getElementById('hxFxBox').hidden = true; fxCheck();
}
function hxFxOff() { try { localStorage.removeItem('tc_fx_alert'); } catch (e) {} document.getElementById('hxFxBox').hidden = true; fxCheck(); }
function fxCheck() {
  var el = document.getElementById('hxFxHit'), a = fxLoad(); if (!el) return;
  if (!a || !window.TripStore) { el.innerHTML = ''; return; }
  TripStore.refreshRates(function () {
    var now = fxNow(a.cur), u = fxUnit(a.cur), sym = FX_CUR[a.cur][1] + u.toLocaleString('ko-KR'), hit = now > 0 && now <= a.target;
    el.innerHTML = '<a class="fxhit' + (hit ? ' on' : '') + '" href="#" onclick="return hxFxAlert()">' + (hit ? '🔔 <b>' + FX_CUR[a.cur][0] + ' 목표 환율 도달!</b> ' : '🔔 ' + FX_CUR[a.cur][0] + ' 알림 · ')
      + sym + ' = <b>' + now.toLocaleString('ko-KR') + '원</b> (목표 ' + a.target.toLocaleString('ko-KR') + '원 이하)</a>';
  });
}
(function () {
  var next = document.getElementById('hxNext'); if (!next) return;
  var hit = document.createElement('div'); hit.id = 'hxFxHit'; next.parentNode.insertBefore(hit, next.nextSibling);
  var box = document.createElement('div'); box.id = 'hxFxBox'; box.hidden = true; hit.parentNode.insertBefore(box, hit.nextSibling);
  fxCheck();
})();

/* 환율 계산기 — 홈 맨 위를 차지하던 바를 접어 두고 칩으로 연다 */
function hxFx() {
  var bar = document.getElementById('fxCalcBar'); if (!bar) return false;
  bar.classList.toggle('hx-hide');
  if (!bar.classList.contains('hx-hide')) {
    var inp = document.getElementById('fxCalcAmount');
    bar.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (inp) setTimeout(function () { inp.focus(); }, 300);
  }
  return false;
}

/* 여행지 목록 — 처음엔 8곳만, '전체 보기'로 펼침(분류 필터·검색을 쓰면 자동으로 펼침) */
(function () {
  'use strict';
  var grid = document.getElementById('destGrid');
  if (!grid) return;
  var total = grid.querySelectorAll('.dest-card').length, SHOW = 8;
  if (total <= SHOW) return;
  grid.classList.add('hx-collapsed');
  var btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'hx-more hx-more-btn';
  btn.innerHTML = '여행지 ' + total + '곳 모두 보기 <span>(' + (total - SHOW) + '곳 더) ›</span>';
  var open = function () { grid.classList.remove('hx-collapsed'); btn.remove(); };
  btn.addEventListener('click', open);
  grid.parentNode.insertBefore(btn, grid.nextSibling);
  ['filterDest', 'doSearch'].forEach(function (fn) {
    var orig = window[fn]; if (typeof orig !== 'function') return;
    window[fn] = function (cat) { if (fn === 'doSearch' || cat !== '전체') open(); return orig.apply(this, arguments); };
  });
})();

/* 홈 '여행핫딜'형 동작 — 고정 카테고리 탭: 해당 섹션으로 이동(항공권·숙소는 검색 탭 전환) + 스크롤 위치에 맞춰 밑줄 이동.
   마크업은 scripts/home_hotdeal_layout.py 가 만든다(.hx-*). */
(function () {
  'use strict';
  var tabs = document.getElementById('hxTabs');
  if (!tabs) return;
  var links = [].slice.call(tabs.querySelectorAll('a'));
  var set = function (a) { links.forEach(function (x) { x.classList.toggle('on', x === a); }); };
  var lock = 0;

  links.forEach(function (a) {
    a.addEventListener('click', function () {
      var sw = a.getAttribute('data-sw');
      if (sw) { var t = document.querySelector('.sw-tab[data-tab="' + sw + '"]'); if (t) t.click(); }
      set(a); lock = Date.now();
    });
  });

  // 스크롤 위치 → 탭 (항공권·숙소는 같은 #hero라 현재 선택된 검색 탭을 따름)
  var tick = false;
  window.addEventListener('scroll', function () {
    if (tick || Date.now() - lock < 900) return; tick = true;
    requestAnimationFrame(function () {
      tick = false;
      var cur = links[0];
      links.forEach(function (a) {
        var el = document.querySelector(a.getAttribute('href'));
        if (!el || el.getBoundingClientRect().top > 140) return;
        if (a.getAttribute('data-sw')) {
          var act = document.querySelector('.sw-tab.active');
          if (act && act.getAttribute('data-tab') !== a.getAttribute('data-sw')) return;
        }
        cur = a;
      });
      set(cur);
    });
  }, { passive: true });
})();

/* 홈 '지금 많이 찾는 여행지'·'따뜻한 휴양지' 레일 → 마키(자동 흐름). 동작 줄이기 설정이면 그대로 스크롤 레일 */
(function () {
  'use strict';
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelectorAll('.hx-rail').forEach(function (rail) {
    var cards = [].slice.call(rail.children);
    if (cards.length < 3) return;
    var track = document.createElement('div');
    track.className = 'hx-track';
    cards.forEach(function (c) { track.appendChild(c); });
    cards.forEach(function (c) {   // 이음새용 복제 — 화면낭독기·탭 이동에선 빼기
      var k = c.cloneNode(true); k.setAttribute('aria-hidden', 'true'); k.setAttribute('tabindex', '-1');
      track.appendChild(k);
    });
    track.style.setProperty('--hx-dur', (cards.length * 5) + 's');   // 카드 1장당 5초
    rail.appendChild(track);
    rail.classList.add('hx-marquee');
    // 손가락으로 누르고 있는 동안 멈춤(휴대폰엔 hover가 없음)
    var hold = function (on) { return function () { rail.classList.toggle('hx-hold', on); }; };
    rail.addEventListener('touchstart', hold(true), { passive: true });
    rail.addEventListener('touchend', hold(false));
    rail.addEventListener('touchcancel', hold(false));
  });
})();
