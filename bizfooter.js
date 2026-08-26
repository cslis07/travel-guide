/* ═══════════════════════════════════════════════════════════
   트래블코스트 — 사업자 정보 법적 표기 (전 페이지 공용)

   전자상거래법 §10: 영리 목적으로 재화·용역 정보를 제공하는 사이트는
   상호·대표자·사업자등록번호·주소 등 사업자 식별정보를 표시해야 한다.
   제휴 수수료가 발생하는 사이트라 표기 대상이다.

   왜 스크립트 하나로:
   - 법적 문구·사업자 정보가 페이지마다 어긋나면 안 된다(단일 출처).
   - 수익 페이지(estimate/prepare/tours)엔 아예 footer가 없어 여기서 보강한다.

   ⚠️ 공개 표기에서 제외한 것: 대표자 생년월일 — 법정 표기 항목이 아니고
      민감 개인정보라 사업자등록증에 있더라도 사이트에는 넣지 않는다.

   ⛳ 아직 비어 있어 완성이 필요한 항목(사용자 확인 후 BIZ 에 채우면 자동 반영):
      - email : 공개용 문의 이메일 (전자상거래법 표기 항목)
      - tongsin : 통신판매업 신고번호 (해당 시). 미신고면 면제사유 확인 필요.
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var BIZ = {
    brand:  '트래블코스트',
    name:   '피부담앙',            // 사업자등록증 상호
    owner:  '이상민',              // 대표자
    regno:  '335-21-02118',        // 사업자등록번호
    addr:   '서울특별시 영등포구 당산로54길 26(당산동6가)',
    email:  '',                    // TODO: 공개용 문의 이메일
    tongsin: ''                    // TODO: 통신판매업 신고번호(해당 시)
  };

  var CSS = [
    '.biz-footer{background:var(--gray-50,#F9FAFB);border-top:1px solid var(--gray-200,#E4E7EC);',
    '  color:var(--gray-500,#667085);font-size:11.5px;line-height:1.8;padding:18px 16px;',
    '  text-align:center;letter-spacing:-.01em}',
    '.biz-footer .biz-row{max-width:720px;margin:0 auto}',
    '.biz-footer .biz-name{font-weight:700;color:var(--gray-600,#475467)}',
    '.biz-footer a{color:inherit;text-decoration:underline;text-underline-offset:2px}',
    '.biz-footer .biz-sep{opacity:.5;margin:0 5px}',
    '.biz-footer .biz-legal{margin-top:7px}',
    '@media(max-width:900px){.biz-footer{padding-bottom:calc(18px + 56px + env(safe-area-inset-bottom,0px))}}',
    '@media(prefers-color-scheme:dark){',
    '  .biz-footer{background:#12161d;border-top-color:rgba(255,255,255,.08);color:#8A94A6}',
    '  .biz-footer .biz-name{color:#AEB6C2}}'
  ].join('');

  function sep() { return '<span class="biz-sep">·</span>'; }

  function build() {
    if (document.querySelector('.biz-footer')) return;

    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var line1 =
      '<span class="biz-name">' + BIZ.brand + '</span>' +
      '<span class="biz-sep">·</span>' + BIZ.name + ' (대표 ' + BIZ.owner + ')' +
      sep() + '사업자등록번호 ' + BIZ.regno +
      (BIZ.tongsin ? sep() + '통신판매업신고 ' + BIZ.tongsin : '');

    var line2 = BIZ.addr + (BIZ.email ? sep() + '<a href="mailto:' + BIZ.email + '">' + BIZ.email + '</a>' : '');

    var legal =
      '<a href="/privacy">개인정보처리방침</a>' + sep() +
      '<a href="/terms">이용약관</a>' + sep() +
      '<a href="/guide">이용가이드</a>' +
      sep() + '© 2026 ' + BIZ.brand;

    var el = document.createElement('footer');
    el.className = 'biz-footer';
    el.setAttribute('role', 'contentinfo');
    el.innerHTML =
      '<div class="biz-row">' + line1 + '</div>' +
      '<div class="biz-row">' + line2 + '</div>' +
      '<div class="biz-row biz-legal">' + legal + '</div>';
    document.body.appendChild(el);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
