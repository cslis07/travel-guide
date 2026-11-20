/* 홈 검색 상자 '🇯🇵 일본' 탭 — 구글 지도 장소 검색(/api/places)으로 일본 관광지 찾기
   구글 약관: 결과 곁에 'Google 지도' 표시·사진 작가 이름·구글 지도 링크를 보여 주고, 결과를 저장하지 않는다(이 페이지가 열려 있는 동안만 기억) */
(function () {
  'use strict';
  var GUIDES = [
    ['osaka', '오사카', /오사카|Osaka/i], ['kyoto', '교토', /교토|Kyoto/i], ['tokyo', '도쿄', /도쿄|Tokyo/i],
    ['fukuoka', '후쿠오카', /후쿠오카|Fukuoka/i], ['sapporo', '삿포로', /삿포로|Sapporo/i], ['okinawa', '오키나와', /오키나와|Okinawa/i]
  ];
  var memo = {}, seq = 0;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var okUrl = function (u) { return /^https:\/\/[^\s"'<>]+$/.test(u || '') ? u : ''; };

  function guideFor(p) {
    var hay = (p.addr || '') + ' ' + (p.name || '');
    for (var i = 0; i < GUIDES.length; i++) if (GUIDES[i][2].test(hay)) return GUIDES[i];
    return null;
  }

  function card(p) {
    var thumb = p.photo
      ? '<div class="dom-thumb"><img src="/api/places?photo=' + encodeURIComponent(p.photo) + '" alt="' + esc(p.name) + '" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.classList.add(\'dom-thumb--empty\');this.parentNode.innerHTML=\'<span class=dom-nimg-icon>🗾</span>\'"></div>'
      : '<div class="dom-thumb dom-thumb--empty"><span class="dom-nimg-icon">🗾</span></div>';
    var by = p.by ? '<p class="jp-by">사진: ' + (okUrl(p.byUri) ? '<a href="' + esc(p.byUri) + '" target="_blank" rel="noopener nofollow">' + esc(p.by) + '</a>' : esc(p.by)) + '</p>' : '';
    var rate = p.rating ? '<p class="jp-rate">★ ' + Number(p.rating).toFixed(1) + ' <small>(' + Number(p.count || 0).toLocaleString('ko-KR') + ')</small></p>' : '';
    var g = guideFor(p);
    var maps = okUrl(p.maps);
    return '<div class="dom-card jp-card">' + thumb + '<div class="dom-body">'
      + (p.type ? '<span class="dom-ctype-tag">' + esc(p.type) + '</span>' : '')
      + '<h3>' + esc(p.name) + '</h3>' + rate
      + (p.addr ? '<p class="dom-addr">📍 ' + esc(p.addr) + '</p>' : '') + by
      + '<div class="jp-links">'
      + (maps ? '<a href="' + esc(maps) + '" target="_blank" rel="noopener">구글 지도에서 보기 ↗</a>' : '')
      + (g ? '<a href="/' + g[0] + '">' + g[1] + ' 가이드 →</a>' : '')
      + '</div></div></div>';
  }

  function show(state, msg) {
    $('jpLoading').classList.toggle('hidden', state !== 'loading');
    $('jpError').classList.toggle('hidden', state !== 'error');
    if (state === 'error') $('jpErrorMsg').textContent = msg;
  }

  function render(q, places) {
    $('jpTitle').textContent = '‘' + q + '’ 검색 결과 ' + places.length + '곳';
    $('jpGrid').innerHTML = places.map(card).join('');
    $('jpAttr').classList.toggle('hidden', !places.length);
    if (!places.length) show('error', '일본에서 찾은 곳이 없어요. ‘교토 사찰’처럼 도시 이름과 함께 검색해 보세요.');
  }

  window.searchJapan = function (preset) {
    var input = $('sw-jp-q');
    if (preset) input.value = preset;
    var q = (input.value || '').replace(/\s+/g, ' ').trim();
    if (q.length < 2) { input.focus(); input.setAttribute('aria-invalid', 'true'); return; }
    input.removeAttribute('aria-invalid');
    var sec = $('jpSection');
    sec.classList.remove('hidden');
    sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('jpGrid').innerHTML = '';
    $('jpAttr').classList.add('hidden');
    $('jpTitle').textContent = '‘' + q + '’ 찾는 중…';
    if (memo[q]) { show(''); render(q, memo[q]); return; }
    show('loading');
    var my = ++seq;
    fetch('/api/places?q=' + encodeURIComponent(q))
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { s: r.status, j: j }; }); })
      .then(function (x) {
        if (my !== seq) return;
        if (x.s === 200 && x.j && Array.isArray(x.j.places)) { show(''); memo[q] = x.j.places; render(q, x.j.places); return; }
        $('jpTitle').textContent = '일본 관광지 검색';
        show('error', x.s === 503 ? '일본 관광지 검색은 준비 중이에요. 곧 열려요.'
          : x.s === 429 && x.j && x.j.error !== 'daily limit' ? '검색이 너무 잦아요. 1분 뒤 다시 시도해 주세요.'
          : x.s === 429 ? '오늘 검색할 수 있는 횟수를 다 썼어요. 내일 다시 찾아 주세요. 그동안 아래 일본 여행지 가이드를 봐 주세요.'
          : '검색 결과를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.');
      })
      .catch(function () {
        if (my !== seq) return;
        $('jpTitle').textContent = '일본 관광지 검색';
        show('error', '인터넷 연결을 확인한 뒤 다시 시도해 주세요.');
      });
  };
})();
