/* 목적지 가이드 공용 — 트립닷컴(승인·숙소 5%) 숙소 CTA 주입
   문제: 목적지 23곳의 숙소 링크가 전부 아고다/부킹(미승인=수수료 0)으로 나가고 있었다.
   숙소는 최고 요율(5%)인데 승인된 트립닷컴이 빠져 있던 가장 큰 누수.
   방식: 히어로 CTA(tours.html?city=도시)에서 도시명을 읽어 AFF 레지스트리의
         city ID로 추적 링크를 만들고, 숙소 섹션 aff-cta 맨 앞에 넣는다.
   규칙: city ID가 없는 도시는 링크를 만들지 않는다(숙소는 ID 필수, 이름은 빈 결과). */
(function () {
  'use strict';
  if (!window.AFF || !AFF.url) return;
  var a = document.querySelector('a[href*="tours.html?city="]');
  var m = a && (a.getAttribute('href') || '').match(/city=([^&]+)/);
  var city = m ? decodeURIComponent(m[1]) : '';
  if (!city) return;
  var tc = null;
  for (var i = 0; i < AFF.PARTNERS.length; i++) { if (AFF.PARTNERS[i].key === 'tripcom') { tc = AFF.PARTNERS[i]; break; } }
  var url = tc && AFF.url(tc, city, 'stay', { city: city, sub: 'dest-stay' });
  if (!url) return;
  var boxes = document.querySelectorAll('.aff-cta');
  for (var j = 0; j < boxes.length; j++) {
    var box = boxes[j];
    var sec = box.closest ? box.closest('section') : null;
    if (!sec || !sec.querySelector('.hotel-grid')) continue;   // 숙소 섹션만
    if (box.querySelector('[data-aff="tripcom"]')) continue;
    var btn = document.createElement('a');
    btn.href = url; btn.target = '_blank'; btn.rel = 'nofollow sponsored noopener';
    btn.className = 'cta-btn primary'; btn.setAttribute('data-aff', 'tripcom');
    btn.textContent = '🏨 트립닷컴에서 ' + city + ' 숙소 최저가';
    box.insertBefore(btn, box.firstChild);
  }
})();
