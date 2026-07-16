// PWA 설치 버튼 — 모든 페이지 공용
//
// - Chrome/Edge/삼성인터넷: beforeinstallprompt 이벤트 → 좌하단 "앱 설치" 버튼 표시 → 원클릭 설치
// - iOS Safari: 이벤트 미지원 → 버튼 클릭 시 "홈 화면에 추가" 안내 시트
// - 이미 설치(standalone)면 아무것도 표시하지 않음
// - 사용자가 닫으면 7일간 다시 표시하지 않음 (localStorage)

(function () {
  'use strict';

  var DISMISS_KEY = 'pwa_install_dismissed';
  var DISMISS_DAYS = 7;

  // 이미 앱으로 실행 중이면 종료
  if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return;
  if (navigator.standalone === true) return; // iOS 구버전

  // 최근에 닫았으면 종료
  try {
    var ts = +localStorage.getItem(DISMISS_KEY) || 0;
    if (Date.now() - ts < DISMISS_DAYS * 864e5) return;
  } catch (e) {}

  var deferredPrompt = null;
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;

  // ── 스타일 ──
  var css = [
    '#pwa-install-btn{position:fixed;left:16px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:9000;',
    'display:none;align-items:center;gap:8px;padding:11px 18px;border:none;border-radius:999px;cursor:pointer;',
    'background:#1B4FD8;color:#fff;font-family:inherit;font-size:13.5px;font-weight:700;',
    'box-shadow:0 6px 20px rgba(27,79,216,.4);transition:transform .15s;}',
    '#pwa-install-btn:hover{transform:translateY(-2px)}',
    '#pwa-install-btn .pwa-x{margin-left:4px;opacity:.7;font-weight:400;padding:0 2px}',
    '#pwa-ios-sheet{position:fixed;inset:0;z-index:9100;background:rgba(0,0,0,.5);display:none;align-items:flex-end;justify-content:center}',
    '#pwa-ios-sheet.open{display:flex}',
    '#pwa-ios-inner{background:#fff;border-radius:18px 18px 0 0;padding:24px 22px calc(28px + env(safe-area-inset-bottom));max-width:480px;width:100%;font-family:inherit}',
    '#pwa-ios-inner h3{font-size:17px;font-weight:800;color:#0f172a;margin:0 0 12px}',
    '#pwa-ios-inner ol{margin:0 0 16px 20px;padding:0;color:#334155;font-size:14.5px;line-height:2}',
    '#pwa-ios-inner .pwa-close{width:100%;padding:13px;border:none;border-radius:12px;background:#f1f5f9;color:#334155;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit}'
  ].join('');
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // ── 버튼 ──
  var btn = document.createElement('button');
  btn.id = 'pwa-install-btn';
  btn.innerHTML = '📱 앱으로 설치 <span class="pwa-x" title="닫기">✕</span>';
  document.body.appendChild(btn);

  function dismiss() {
    btn.style.display = 'none';
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (e) {}
  }

  btn.addEventListener('click', function (e) {
    // ✕ 클릭 → 닫기 (7일간 미표시)
    if (e.target.classList.contains('pwa-x')) { dismiss(); return; }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function () {
        deferredPrompt = null;
        btn.style.display = 'none';
      });
    } else if (isIOS) {
      openIosSheet();
    }
  });

  // ── Chrome 계열: 설치 프롬프트 잡기 ──
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    btn.style.display = 'inline-flex';
  });

  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    btn.style.display = 'none';
    try { localStorage.setItem(DISMISS_KEY, String(Date.now() + 365 * 864e5)); } catch (e) {}
  });

  // ── iOS: 이벤트가 없으므로 버튼을 항상 노출 (안내 시트 연결) ──
  if (isIOS) {
    // DOM 준비 후 표시
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { btn.style.display = 'inline-flex'; });
    } else {
      btn.style.display = 'inline-flex';
    }
  }

  // ── iOS 안내 시트 ──
  var sheet = null;
  function openIosSheet() {
    if (!sheet) {
      sheet = document.createElement('div');
      sheet.id = 'pwa-ios-sheet';
      sheet.innerHTML =
        '<div id="pwa-ios-inner">' +
        '<h3>📱 홈 화면에 추가하기</h3>' +
        '<ol>' +
        '<li>하단 <strong>공유 버튼</strong> <span style="font-size:17px">⎋</span> 을 누르세요</li>' +
        '<li><strong>"홈 화면에 추가"</strong>를 선택하세요</li>' +
        '<li>우측 상단 <strong>추가</strong>를 누르면 완료!</li>' +
        '</ol>' +
        '<button class="pwa-close">닫기</button>' +
        '</div>';
      document.body.appendChild(sheet);
      sheet.addEventListener('click', function (e) {
        if (e.target === sheet || e.target.classList.contains('pwa-close')) {
          sheet.classList.remove('open');
        }
      });
    }
    sheet.classList.add('open');
  }
})();
