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
      : (T.budgetTotal(t) ? '예산 ' + won(T.budgetTotal(t)) + ' · 준비물 다 챙겼어요' : '예산과 준비물을 정해 보세요');
    cta = todo ? '준비물' : '열기'; tab = todo ? 'pack' : '';
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
