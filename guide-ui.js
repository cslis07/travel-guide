/* 상품 상세형 가이드 동작 — 갤러리 장수 표시 · 고정 섹션 탭 스크롤 연동 · 공유
   마크업은 scripts/guide_product_layout.py 가 만든다(.gx-*). */
(function () {
  'use strict';

  // 갤러리: 지금 보이는 사진 번호
  var track = document.getElementById('gxTrack'), idx = document.getElementById('gxIdx');
  if (track && idx) {
    track.addEventListener('scroll', function () {
      var w = track.firstElementChild ? track.firstElementChild.offsetWidth + 6 : 1;
      idx.textContent = String(Math.min(track.children.length, Math.round(track.scrollLeft / w) + 1));
    }, { passive: true });
  }

  // 고정 탭: 스크롤 위치에 맞춰 밑줄 이동
  var tabs = document.getElementById('gxTabs');
  if (tabs) {
    var links = [].slice.call(tabs.querySelectorAll('a'));
    var secs = links.map(function (a) { return document.querySelector(a.getAttribute('href')); });
    var set = function (i) { links.forEach(function (a, j) { a.classList.toggle('on', i === j); }); };
    var tick = false;
    window.addEventListener('scroll', function () {
      if (tick) return; tick = true;
      requestAnimationFrame(function () {
        tick = false;
        var y = 130, cur = 0;
        secs.forEach(function (s, i) { if (s && s.getBoundingClientRect().top <= y) cur = i; });
        set(cur);
      });
    }, { passive: true });
  }
})();

/* 가이드 추천 코스 → 내 여행 일정. 2박3일=앞 3구역, 3박4일=앞 4구역(+야경), 구역 하나가 하루. */
(function () {
  'use strict';
  var note = document.querySelector('.sgg .duration-note');
  var tours = document.querySelector('a[href*="tours.html?city="]');
  if (!note || !tours || !window.TripAttach) return;
  var city = decodeURIComponent((tours.getAttribute('href').match(/city=([^&]+)/) || [])[1] || '');
  var TIME = { '오전': '10:00', '오후': '14:00', '저녁': '18:00' };
  var FOOD = /먹|맛|시장|야타이|라멘|식당|카페|미식|노점|굴|해산물|길거리/;

  function nDays() { return document.querySelector('.sgg .destination.show-4') ? 4 : 3; }
  function course(n) {
    return [].slice.call(document.querySelectorAll('.sgg .destination')).slice(0, n).map(function (art) {
      var zone = ((art.querySelector('.cover h2') || {}).textContent || '').replace(/^[①-⑩]\s*/, '');
      return [].slice.call(art.querySelectorAll('.plan .day')).filter(function (d) {
        return n === 4 || !d.classList.contains('extra');
      }).map(function (d) {
        var when = (d.querySelector('em') || {}).textContent || '', b = (d.querySelector('b') || {}).textContent || '', p = (d.querySelector('p') || {}).textContent || b;
        return { time: TIME[when] || '20:30', type: FOOD.test(b + p) ? 'food' : 'sight', title: p, memo: zone + ' · ' + b };
      });
    });
  }

  var btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'gx-course';
  var label = function () {
    var days = course(nDays());
    btn.innerHTML = '📅 이 코스로 내 여행 일정 채우기 <small>' + days.length + '일 · 일정 ' + days.reduce(function (s, d) { return s + d.length; }, 0) + '개</small>';
  };
  btn.addEventListener('click', function () {
    TripAttach.open({ label: city + ' 추천 코스를 일정에 담기', city: city, days: course(nDays()) });
  });
  note.parentNode.insertBefore(btn, note.nextSibling);
  label();
  [].forEach.call(document.querySelectorAll('.sgg .duration button'), function (b) { b.addEventListener('click', function () { setTimeout(label, 0); }); });
})();

function gxShare() {
  var data = { title: document.title, url: location.href.split('#')[0] };
  if (navigator.share) { navigator.share(data).catch(function () {}); return; }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(data.url).then(function () { alert('링크를 복사했어요.'); }, function () { prompt('이 링크를 복사하세요', data.url); });
  } else { prompt('이 링크를 복사하세요', data.url); }
}
