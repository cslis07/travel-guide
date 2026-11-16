/* 영수증 사진 → 금액 읽기 (2026-11-16)
 *
 * - 글자 인식은 이 폰 브라우저 안에서만(Tesseract.js). 사진은 어디로도 보내지 않는다.
 *   받는 것은 인식 프로그램·언어 데이터뿐(cdn.jsdelivr.net, 처음 한 번 약 5~6MB, 이후 브라우저 캐시).
 * - 누를 때만 불러온다(지출 창을 열 때마다 받지 않게).
 * - 금액 고르기는 추측이므로 자동 저장하지 않는다 — 금액 칸에 넣고 후보 칩을 함께 보여 사용자가 확인한다.
 */
(function () {
  'use strict';
  var VER = '5.1.1';
  var CDN = 'https://cdn.jsdelivr.net/npm/';
  var SRI = 'sha384-GJqSu7vueQ9qN0E9yLPb3Wtpd7OrgK8KmYzC8T1IysG1bcvxvIO4qtYR/D3A991F';
  /* 통화 → 현지 글자(합계 같은 말을 읽으려고). 숫자는 영어 데이터로도 읽힌다 */
  var LANG = { JPY: 'jpn', KRW: 'kor', CNY: 'chi_sim', TWD: 'chi_tra', HKD: 'chi_tra', THB: 'tha', VND: 'vie' };
  /* 소수점이 없는 통화 — '1.234'·'1,234' 는 모두 천 단위 */
  var ZERO_DEC = { JPY: 1, KRW: 1, VND: 1, IDR: 1 };

  var TOTAL_RE = /(合\s*計|総\s*計|総\s*額|お\s*会\s*計|ご\s*請\s*求|請\s*求\s*額|お\s*支\s*払|TOTAL|Total|total|AMOUNT\s*DUE|Amount\s*Due|GRAND|합\s*계|총\s*액|총\s*금\s*액|결\s*제\s*금\s*액|받\s*을\s*금\s*액|청\s*구|合\s*计|總\s*計|总\s*计|應\s*付|应\s*付|實\s*付|实\s*付|TỔNG|Tổng|tổng|รวม|ยอดสุทธิ|JUMLAH|Jumlah)/;
  var SKIP_RE = /(小\s*計|小\s*计|SUB\s*-?\s*TOTAL|Sub\s*-?\s*total|subtotal|お\s*預|預\s*り|預\s*か|釣|CHANGE|Change|CASH|Cash|現\s*金|TAX|Tax|税|VAT|포인트|거스름|받은\s*돈|할\s*인|割\s*引|DISCOUNT|Discount|點\s*數|找\s*零|POINT|Point)/;
  /* 금액이 아닌 번호 줄(승인번호·가게 번호·전화·계산대) */
  var NOISE_RE = /(승\s*인|번\s*호|No\.|NO\.|#|TEL|Tel|電\s*話|レ\s*ジ|伝\s*票|会\s*員|카\s*드\s*번|STORE|Store|REG|Reg)/;

  function half(s) {
    return String(s || '').replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
      .replace(/[，、]/g, ',').replace(/[．。]/g, '.').replace(/[：]/g, ':').replace(/[／]/g, '/').replace(/[－ー―−]/g, '-');
  }
  function toNum(tok, zeroDec) {
    var s = tok.replace(/[^\d.,]/g, '');
    if (!s) return 0;
    if (zeroDec) return +s.replace(/[.,]/g, '');
    var m = s.match(/^(.*?)[.,](\d{1,2})$/);
    if (m && m[1]) return +(m[1].replace(/[.,]/g, '') + '.' + m[2]);
    return +s.replace(/[.,]/g, '');
  }
  /* 한 줄에서 금액 후보 — 날짜·시각·전화번호·카드번호는 먼저 지운다 */
  function numsOf(line, zeroDec) {
    var l = line
      .replace(/\d{2,4}\s*[./-]\s*\d{1,2}\s*[./-]\s*\d{1,4}/g, ' ')    // 2026.11.16 · 11/16/26
      .replace(/\d{2,4}\s*年\s*\d{1,2}\s*月(\s*\d{1,2}\s*日)?/g, ' ')
      .replace(/\d{1,2}\s*:\s*\d{2}(\s*:\s*\d{2})?/g, ' ')              // 13:45
      .replace(/\d{2,4}-\d{3,4}-\d{4}/g, ' ')                           // 전화
      .replace(/[*xX]{2,}\s*\d+/g, ' ');                                  // ****1234
    var out = [], re = /([¥￥$€£₩฿]\s*)?(\d[\d.,]*\d|\d)(\s*(円|원|元|圓|đ|₫))?/g, m;
    while ((m = re.exec(l))) {
      var digits = m[2].replace(/[.,]/g, '');
      if (digits.length > 9) continue;
      var v = toNum(m[2], zeroDec);
      if (!(v > 0) || v >= 1e9) continue;
      out.push({ v: v, mark: !!(m[1] || m[3]) });
    }
    return out;
  }
  /* 영수증에 찍힌 통화 기호 — 하나로 정해지는 것만($·元 은 여러 나라라 모름) */
  var MARK_CUR = [[/[¥￥]|円/g, 'JPY'], [/₩|원/g, 'KRW'], [/€/g, 'EUR'], [/฿|บาท/g, 'THB'], [/₫|VND/g, 'VND']];
  function curOf(text) {
    var best = null, n = 0;
    MARK_CUR.forEach(function (m) { var k = (text.match(m[0]) || []).length; if (k > n) { n = k; best = m[1]; } });
    return n >= 1 ? best : null;
  }
  /* 가게 이름 — 위쪽 몇 줄 중 글자가 대부분인 첫 줄(영수증 머리말·인사·날짜·전화 줄은 건너뜀). 인식이 흔들리면 안 낸다 */
  var HEAD_SKIP = /(領\s*収|レシート|RECEIPT|Receipt|영\s*수\s*증|매\s*출\s*전\s*표|계\s*산\s*서|WELCOME|Welcome|いらっしゃい|ありがと|감사합니다|THANK|Thank|TEL|Tel|電話|전화|発\s*行|No\.|#)/;
  function shopOf(lines) {
    for (var i = 0; i < Math.min(lines.length, 4); i++) {
      // 일본어·중국어 인식은 글자 사이에 띄어쓰기를 끼운다('ロー ソン 難波 店') → 한자·가나 사이 공백은 지운다
      var l = lines[i].replace(/[\s　]+/g, ' ').replace(/([぀-ヿ一-鿿]) (?=[぀-ヿ一-鿿])/g, '$1').trim();
      if (HEAD_SKIP.test(l) || /\d{3,}/.test(l)) continue;
      var letters = (l.match(/[A-Za-z가-힣぀-ヿ一-鿿]/g) || []).length;
      var nonSpace = l.replace(/ /g, '').length;
      if (letters >= 2 && nonSpace <= 24 && letters / nonSpace >= 0.75) return l.replace(/[^\w가-힣぀-ヿ一-鿿 &'.-]/g, '').trim().slice(0, 20);
    }
    return '';
  }
  /* 인식된 글자 → 금액 후보(가능성 높은 순). best 는 '합계' 줄이나 통화 기호가 붙은 값일 때만 */
  function parse(text, cur) {
    var seen = curOf(half(text));
    if (seen) cur = seen;   // 영수증 기호가 있으면 그 통화 기준으로 소수점 판단
    var zeroDec = !!ZERO_DEC[String(cur || '').toUpperCase()];
    var lines = half(text).split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
    var score = {};
    var add = function (v, s) { var k = String(v); if (!(k in score) || score[k] < s) score[k] = s; };
    lines.forEach(function (line, i) {
      var ns = numsOf(line, zeroDec);
      var isTotal = TOTAL_RE.test(line) && !SKIP_RE.test(line);
      if (isTotal) {
        if (ns.length) add(ns[ns.length - 1].v, 3);
        else if (lines[i + 1] && !SKIP_RE.test(lines[i + 1])) { var nx = numsOf(lines[i + 1], zeroDec); if (nx.length) add(nx[nx.length - 1].v, 2); }
      }
      var skip = SKIP_RE.test(line) || (!isTotal && NOISE_RE.test(line));
      ns.forEach(function (n) { add(n.v, skip ? -1 : n.mark ? 1 : 0); });
    });
    var cands = Object.keys(score).map(function (k) { return { v: +k, s: score[k] }; })
      .filter(function (c) { return c.s >= 0 && (zeroDec ? c.v >= 10 : c.v >= 0.5); })
      .sort(function (a, b) { return b.s - a.s || b.v - a.v; });
    var top = cands.filter(function (c) { return c.s >= 1; })[0];
    return { best: top ? top.v : null, cands: cands.slice(0, 4).map(function (c) { return c.v; }), cur: seen, shop: shopOf(String(text || '').split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean)) };   // 원문 줄 — 'ー' 가 '-' 로 바뀌지 않게
  }

  var loading = null;
  function loadLib() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (loading) return loading;
    loading = new Promise(function (ok, no) {
      var s = document.createElement('script');
      s.src = CDN + 'tesseract.js@' + VER + '/dist/tesseract.min.js';
      s.integrity = SRI; s.crossOrigin = 'anonymous';
      s.onload = function () { window.Tesseract ? ok(window.Tesseract) : no(new Error('lib')); };
      s.onerror = function () { loading = null; no(new Error('load')); };
      document.head.appendChild(s);
    });
    return loading;
  }
  /* dataUrl(이미 줄인 JPEG) → { best, cands, text } */
  /* 글자 데이터를 고를 통화들 — 여행 도시 현지 통화 + 지출 통화(원화로 두고 일본 영수증을 읽어도 일본어로 읽게, 2026-11-16) */
  //   현지어 하나만 + 영어 — 일본어·한국어를 같이 실으면 '一蘭'을 한글로 잘못 읽었다(실측). 앞 통화부터 처음 맞는 것
  function langOf(curs) {
    for (var i = 0; i < curs.length; i++) { var l = LANG[String(curs[i] || '').toUpperCase()]; if (l) return l + '+eng'; }
    return 'eng';
  }
  var cancelCur = null;
  /* 읽는 중이면 멈춘다 — 작업자를 끝내고 기다리던 쪽엔 'cancel' 오류 */
  function cancel() { if (cancelCur) cancelCur(); }
  function read(dataUrl, cur, onProgress, localCur) {
    var lang = langOf([localCur, cur]);
    var worker = null, done = false;
    var timer = new Promise(function (_, no) {
      setTimeout(function () { if (!done) no(new Error('timeout')); }, 90000);
      cancelCur = function () { if (!done) { done = true; if (worker) worker.terminate(); no(new Error('cancel')); } };
    });
    var job = loadLib().then(function (T) {
      return T.createWorker(lang, 1, {
        workerPath: CDN + 'tesseract.js@' + VER + '/dist/worker.min.js',
        corePath: CDN + 'tesseract.js-core@' + VER,
        logger: function (m) { if (onProgress && m && typeof m.progress === 'number') onProgress(m.status || '', m.progress); }
      });
    }).then(function (w) { worker = w; if (done) { w.terminate(); throw new Error('cancel'); } return w.recognize(dataUrl); })   // 준비 중에 멈췄으면 바로 끝냄
      .then(function (res) { var text = (res && res.data && res.data.text) || ''; var p = parse(text, cur); p.text = text; return p; });
    return Promise.race([job, timer]).then(function (r) { done = true; cancelCur = null; if (worker) worker.terminate(); return r; },
      function (e) { done = true; cancelCur = null; if (worker) worker.terminate(); throw e; });
  }
  window.ReceiptOCR = { read: read, parse: parse, langOf: langOf, cancel: cancel };
})();
