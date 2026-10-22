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

function gxShare() {
  var data = { title: document.title, url: location.href.split('#')[0] };
  if (navigator.share) { navigator.share(data).catch(function () {}); return; }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(data.url).then(function () { alert('링크를 복사했어요.'); }, function () { prompt('이 링크를 복사하세요', data.url); });
  } else { prompt('이 링크를 복사하세요', data.url); }
}
