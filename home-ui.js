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
