// 트립가이드 — 경량 애널리틱스 로더
// ─────────────────────────────────────────────
// GA4 측정 ID를 넣으면 자동 활성화됩니다. 비어 있으면 아무 것도 로드하지 않습니다.
//   1) https://analytics.google.com 에서 GA4 속성 생성 → 측정 ID(G-XXXXXXXXXX) 발급
//   2) 아래 GA4_ID 값에 붙여넣기
//   3) 배포하면 방문·페이지뷰·이벤트가 수집됩니다.
//
// 개인정보: IP 익명화(anonymize_ip) 적용. 개인 식별 정보는 수집하지 않습니다.

(function () {
  var GA4_ID = ''; // 예: 'G-XXXXXXXXXX'  ← 여기에 측정 ID 입력

  // 전역 JS 오류를 콘솔에 남기고(항상), 애널리틱스가 있으면 이벤트로 전송
  window.addEventListener('error', function (e) {
    try {
      var msg = (e.message || '') + ' @ ' + (e.filename || '') + ':' + (e.lineno || '');
      if (window.gtag) window.gtag('event', 'js_error', { description: msg.slice(0, 150) });
    } catch (_) {}
  });
  window.addEventListener('unhandledrejection', function (e) {
    try {
      if (window.gtag) window.gtag('event', 'promise_rejection', { description: String(e.reason).slice(0, 150) });
    } catch (_) {}
  });

  if (!GA4_ID) return; // 미설정 시 GA 스크립트는 로드하지 않음 (에러 핸들러는 동작)

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', GA4_ID, { anonymize_ip: true });

  // 편의 함수: 원하는 곳에서 trackEvent('search', {tab:'tna'}) 형태로 호출 가능
  window.trackEvent = function (name, params) {
    if (window.gtag) window.gtag('event', name, params || {});
  };
})();
