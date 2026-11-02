/* 트래블코스트 — 정산 내역 공유 (내 여행 › 예산 › 정산 › '정산 내역 공유')
 *
 * 화면: 바텀시트(PC는 가운데 창) 안에 정산 카드 미리보기 + [이미지 공유] [이미지 저장] [텍스트로 보내기]
 * 이미지: 같은 카드를 캔버스로 다시 그린 1080px PNG(사람 수·송금 건수만큼 높이가 늘어남)
 * 데이터: trips.js 의 T.settlements / T.balances / T.spent 결과를 미리보기·이미지·텍스트가 함께 씀(계산 로직은 건드리지 않음)
 * 일러스트: 도시 → 장면(SS_ART.CITY) → SVG. 없는 도시는 기본(도시 스카이라인 + 비행기). 같은 SVG를 화면에 넣고 캔버스에도 그림
 *
 * trip.html 전역에 기대는 것: trip, T, won, esc, svg, openSheet, closeSheet, toast, todayISO, tossUrl
 */
(function () {
  'use strict';

  /* ═══ 색 · 치수 (카드 기준 폭 1080 = 이미지 폭) ═══ */
  var C = {
    bg: '#F9FAF8', ink: '#15253A', sub: '#55657A', mute: '#6B7785', line: '#E8ECEF', thead: '#F1F4F6',
    teal: '#0F9C91', tealDeep: '#0B7F75', mint: '#E5F7F1', red: '#E5484D', zero: '#A5ADB8', panel: '#FFFFFF'
  };
  var W = 1080;
  var FONT = '"Pretendard Variable",Pretendard,"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif';

  /* ═══ 일러스트 — 640×420, 파스텔. 장면 = 공통 배경 + 랜드마크 + 전경 ═══ */
  var P = {
    sun: '#F8D3B2', cloud: '#E4EDF0', hillF: '#DDECE8', hillN: '#C9E4DA', water: '#D6EEF1', wline: '#F0F9FA',
    bld: '#CBE3E6', bldD: '#AED3D7', win: '#EEF7F8', tree: '#A8D8BC', treeD: '#84C4A1', trunk: '#C9B39A',
    blos: '#F7CAD6', blosD: '#F0AFC2', teal: '#56B3A4', tealD: '#2F8C7F', wall: '#FBFCFB', stone: '#DDE3E0',
    red: '#EFA191', gold: '#F1CD8A', goldD: '#E3B465', sand: '#F5E7CF', sea: '#CDEAF0'
  };
  var CITY = {   // 도시 이름(포함 검사) → 장면
    '오사카': 'castle', '도쿄': 'tokyo', '교토': 'kyoto', '후쿠오카': 'needleJp', '삿포로': 'snow',
    '오키나와': 'beach', '나하': 'beach', '상하이': 'pearl', '타이베이': 't101', '홍콩': 'skyline',
    '구이린': 'karst', '계림': 'karst', '장자제': 'karst', '장가계': 'karst', '창바이산': 'mountain', '백두산': 'mountain',
    '방콕': 'wat', '다낭': 'beach', '나트랑': 'beach', '발리': 'beach', '세부': 'beach', '코타키나발루': 'beach',
    '싱가포르': 'mbs', '파리': 'eiffel', '제주': 'jeju', '부산': 'needle', '서울': 'needle', '강릉': 'beach'
  };
  function sceneOf(city) { city = String(city || ''); for (var k in CITY) if (city.indexOf(k) > -1) return CITY[k]; return 'default'; }

  function poly(pts, fill, extra) { return '<polygon points="' + pts.join(' ') + '" fill="' + fill + '"' + (extra || '') + '/>'; }
  function rect(x, y, w, h, fill, rx) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '"' + (rx ? ' rx="' + rx + '"' : '') + ' fill="' + fill + '"/>'; }
  function circ(x, y, r, fill, op) { return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + fill + '"' + (op ? ' opacity="' + op + '"' : '') + '/>'; }
  function path(d, fill, extra) { return '<path d="' + d + '" fill="' + fill + '"' + (extra || '') + '/>'; }

  function cloud(x, y, s) { return '<g opacity=".95">' + circ(x, y, 16 * s, P.cloud) + circ(x + 20 * s, y - 8 * s, 20 * s, P.cloud) + circ(x + 44 * s, y, 15 * s, P.cloud) + rect(x - 4 * s, y, 62 * s, 15 * s, P.cloud, 7 * s) + '</g>'; }
  function tree(x, y, r, col, colD) { return rect(x - 2, y, 4, r * .9, P.trunk) + circ(x, y, r, col) + circ(x - r * .55, y + r * .25, r * .7, colD) + circ(x + r * .55, y + r * .2, r * .68, col); }
  function grove(blossom) {
    var a = blossom ? P.blos : P.tree, b = blossom ? P.blosD : P.treeD;
    return tree(30, 318, 26, P.tree, P.treeD) + tree(74, 330, 20, a, b) + tree(600, 300, 30, a, b) + tree(560, 322, 22, P.tree, P.treeD) + tree(628, 330, 24, P.tree, P.treeD);
  }
  function palm(x, y, h, lean) {
    var tx = x + lean, ty = y - h, s = '';
    s += path('M' + x + ' ' + y + ' Q' + (x + lean * .2) + ' ' + (y - h * .6) + ' ' + tx + ' ' + ty, 'none', ' stroke="' + P.trunk + '" stroke-width="7" stroke-linecap="round"');
    [-165, -125, -85, -45, -10, 25, 160].forEach(function (a, i) { s += '<ellipse cx="' + (tx + 24) + '" cy="' + ty + '" rx="27" ry="7" fill="' + (i % 2 ? P.tree : P.treeD) + '" transform="rotate(' + a + ' ' + tx + ' ' + ty + ')"/>'; });
    return s + circ(tx, ty, 5, P.goldD);
  }
  function skyline(dense) {
    var B = dense ? [[120, 30, 100], [154, 26, 150], [184, 40, 120], [228, 30, 190], [262, 36, 130], [302, 26, 170], [332, 34, 110], [372, 28, 140], [404, 36, 90]]
      : [[150, 34, 90], [188, 26, 130], [218, 40, 110], [262, 30, 160], [296, 36, 100], [336, 24, 70]];
    return B.map(function (b, i) {
      var x = b[0], w = b[1], h = b[2], y = 320 - h, s = rect(x, y, w, h, i % 2 ? P.bldD : P.bld, 2);
      for (var yy = y + 12; yy < 312; yy += 16) s += rect(x + 6, yy, w - 12, 5, P.win, 1);
      return s;
    }).join('');
  }
  function water(bridge) {
    var s = rect(0, 320, 640, 100, 'url(#ssFade)');
    [[70, 350, 50], [210, 372, 70], [380, 356, 60], [520, 384, 50], [130, 398, 40]].forEach(function (w) { s += rect(w[0], w[1], w[2], 4, P.wline, 2); });
    if (bridge) s += path('M210 336 Q320 296 430 336', 'none', ' stroke="' + P.teal + '" stroke-width="7" stroke-linecap="round"') + path('M210 342 Q320 304 430 342', 'none', ' stroke="' + P.tealD + '" stroke-width="3" opacity=".6"');
    return s;
  }
  function lattice(cx, col, band) {
    var s = poly([cx - 64 + ',322', cx - 42 + ',322', cx - 8 + ',172', cx - 19 + ',172'], col) + poly([cx + 64 + ',322', cx + 42 + ',322', cx + 8 + ',172', cx + 19 + ',172'], col);
    s += path('M' + (cx - 44) + ' 322 Q' + cx + ' 262 ' + (cx + 44) + ' 322', 'none', ' stroke="' + col + '" stroke-width="7"');
    s += rect(cx - 48, 236, 96, 11, col, 2) + poly([cx - 19 + ',172', cx + 19 + ',172', cx + 7 + ',110', cx - 7 + ',110'], col) + rect(cx - 24, 162, 48, 10, col, 2);
    s += poly([cx - 7 + ',110', cx + 7 + ',110', cx + 2 + ',58', cx - 2 + ',58'], col) + rect(cx - 1.5, 34, 3, 26, col);
    if (band) s += rect(cx - 44, 239, 88, 4, band) + rect(cx - 21, 165, 42, 4, band) + rect(cx - 5, 132, 10, 4, band) + rect(cx - 3, 84, 6, 4, band);
    return '<g>' + s + '</g>';
  }
  var LM = {
    castle: function () {
      var cx = 470, s = poly([cx - 96 + ',322', cx + 96 + ',322', cx + 80 + ',282', cx - 80 + ',282'], P.stone);
      for (var k = 0; k < 3; k++) s += rect(cx - 86 + k * 4, 292 + k * 10, 172 - k * 8, 2, '#C9D1CD');
      var y0 = 282, ws = [150, 122, 96, 72];
      ws.forEach(function (w, i) {
        s += rect(cx - w / 2, y0 - 22, w, 22, P.wall);
        for (var x = cx - w / 2 + 10; x < cx + w / 2 - 8; x += 16) s += rect(x, y0 - 16, 6, 9, P.tealD, 1);
        s += poly([(cx - w / 2 - 16) + ',' + (y0 - 20), (cx + w / 2 + 16) + ',' + (y0 - 20), (cx + w / 2 - 4) + ',' + (y0 - 34), (cx - w / 2 + 4) + ',' + (y0 - 34)], P.teal);
        if (i === 1 || i === 2) s += poly([(cx - 15) + ',' + (y0 - 33), (cx + 15) + ',' + (y0 - 33), cx + ',' + (y0 - 48)], P.tealD);
        y0 -= 34;
      });
      s += rect(cx - 30, y0 - 6, 60, 10, P.wall) + poly([(cx - 46) + ',' + (y0 + 2), (cx + 46) + ',' + (y0 + 2), (cx + 20) + ',' + (y0 - 24), (cx - 20) + ',' + (y0 - 24)], P.teal);
      s += circ(cx - 20, y0 - 27, 4, P.goldD) + circ(cx + 20, y0 - 27, 4, P.goldD);
      return '<g transform="translate(' + cx + ' 322) scale(1.18) translate(' + (-cx) + ' -322)">' + s + '</g>';
    },
    tokyo: function () { return lattice(460, P.red, P.wall); },
    eiffel: function () { return lattice(460, '#D9BB9F', '') + rect(380, 312, 160, 8, '#C9AC90', 3); },
    needle: function (cx) {
      cx = cx || 460;
      return poly([cx - 44 + ',322', cx + 44 + ',322', cx + 30 + ',300', cx - 30 + ',300'], P.bld) + poly([cx - 8 + ',302', cx + 8 + ',302', cx + 5 + ',150', cx - 5 + ',150'], '#B7D8E5')
        + '<ellipse cx="' + cx + '" cy="150" rx="30" ry="10" fill="#93C4D6"/>' + rect(cx - 21, 128, 42, 22, '#A9D0DF', 7) + '<ellipse cx="' + cx + '" cy="128" rx="23" ry="7" fill="#93C4D6"/>'
        + rect(cx - 2.5, 64, 5, 64, '#B7D8E5') + circ(cx, 62, 5, P.red);
    },
    pearl: function () {
      var cx = 460, s = '';
      [-30, 0, 30].forEach(function (d) { s += rect(cx + d - 4, 150, 8, 172, '#D5DCE6'); });
      s += circ(cx, 266, 32, '#E9A9C3') + circ(cx, 176, 22, '#E9A9C3') + rect(cx - 5, 100, 10, 60, '#D5DCE6') + circ(cx, 112, 9, '#E9A9C3') + rect(cx - 2, 60, 4, 44, '#D5DCE6');
      return s + circ(cx - 10, 256, 7, '#F6D2E0') + circ(cx - 6, 170, 5, '#F6D2E0');
    },
    t101: function () {
      var cx = 460, s = rect(cx - 36, 284, 72, 38, '#B4D9D4', 2), y = 284;
      for (var i = 0; i < 8; i++) { s += poly([(cx - 22) + ',' + y, (cx + 22) + ',' + y, (cx + 29) + ',' + (y - 20), (cx - 29) + ',' + (y - 20)], i % 2 ? '#A6D2CC' : '#BDE0DB'); y -= 21; }
      return s + rect(cx - 15, y - 14, 30, 14, '#A6D2CC', 2) + rect(cx - 8, y - 30, 16, 16, '#BDE0DB', 2) + rect(cx - 1.5, y - 74, 3, 44, '#A6D2CC');
    },
    mbs: function () {
      var s = '';
      [372, 432, 492].forEach(function (x) { s += poly([x + ',322', (x + 36) + ',322', (x + 32) + ',188', (x + 4) + ',188'], '#CFE4EA'); for (var y = 200; y < 316; y += 14) s += rect(x + 7, y, 22, 3, P.win); });
      return s + path('M352 182 L560 178 Q572 178 572 186 L572 190 L352 192 Z', '#98CAC7') + tree(320, 296, 16, P.tree, P.treeD);
    },
    wat: function () {
      var cx = 460, s = rect(cx - 74, 300, 148, 22, '#F6DFAF', 3) + rect(cx - 54, 282, 108, 20, '#F3D79B', 3);
      [-78, 78].forEach(function (d) { var x = cx + d; s += path('M' + (x - 18) + ' 300 Q' + (x - 16) + ' 250 ' + (x - 6) + ' 228 L' + (x + 6) + ' 228 Q' + (x + 16) + ' 250 ' + (x + 18) + ' 300 Z', P.gold) + poly([(x - 5) + ',230', (x + 5) + ',230', x + ',196'], P.goldD); });
      s += path('M' + (cx - 40) + ' 284 Q' + (cx - 38) + ' 200 ' + (cx - 14) + ' 152 L' + (cx + 14) + ' 152 Q' + (cx + 38) + ' 200 ' + (cx + 40) + ' 284 Z', P.gold);
      for (var y = 270; y > 160; y -= 22) s += rect(cx - 40, y, 80, 3, 'rgba(255,255,255,.55)');
      return s + poly([(cx - 11) + ',154', (cx + 11) + ',154', cx + ',70'], P.goldD);
    },
    kyoto: function () {
      var cx = 480, s = '', y = 306;
      [112, 98, 84, 70, 58].forEach(function (w) {
        s += rect(cx - w * .28, y - 16, w * .56, 18, '#EBA593') + poly([(cx - w / 2) + ',' + (y - 14), (cx + w / 2) + ',' + (y - 14), (cx + w / 2 - 12) + ',' + (y - 24), (cx - w / 2 + 12) + ',' + (y - 24)], '#3F8F86');
        y -= 30;
      });
      s += rect(cx - 2, y - 52, 4, 56, P.goldD) + rect(cx - 7, y - 30, 14, 3, P.goldD) + rect(cx - 7, y - 40, 14, 3, P.goldD);
      var tx = 330;   // 도리이
      s += rect(tx - 36, 252, 9, 70, '#EE8C78') + rect(tx + 27, 252, 9, 70, '#EE8C78') + rect(tx - 44, 264, 88, 7, '#EE8C78');
      return s + path('M' + (tx - 56) + ' 242 Q' + tx + ' 250 ' + (tx + 56) + ' 242 L' + (tx + 52) + ' 254 Q' + tx + ' 260 ' + (tx - 52) + ' 254 Z', '#E77A66');
    },
    snow: function () {
      var cx = 470, s = path('M180 322 L330 180 Q350 166 370 180 L520 322 Z', '#CFE0E6') + path('M300 208 L330 180 Q350 166 370 180 L400 208 L380 200 L360 214 L340 198 L320 212 Z', '#FFFFFF');
      s += rect(cx - 42, 262, 84, 60, P.wall) + poly([(cx - 50) + ',264', (cx + 50) + ',264', cx + ',232'], P.red) + rect(cx - 15, 200, 30, 50, P.wall) + poly([(cx - 20) + ',202', (cx + 20) + ',202', cx + ',178'], P.red);
      s += circ(cx, 222, 9, '#FFFFFF') + '<circle cx="' + cx + '" cy="222" r="9" fill="none" stroke="' + P.tealD + '" stroke-width="2"/>' + rect(cx - 1, 215, 2, 8, P.tealD);
      for (var x = cx - 32; x < cx + 30; x += 18) s += rect(x, 284, 9, 14, '#BFD9E0', 1);
      return s;
    },
    karst: function () {
      var s = '';
      [[280, 36, 176, P.hillN], [360, 44, 118, '#A9D4C2'], [440, 40, 150, '#9CCDB8'], [520, 50, 106, '#B8DDCD'], [600, 40, 178, P.hillN]].forEach(function (k) {
        var x = k[0], w = k[1], t = k[2];
        s += path('M' + (x - w) + ' 322 C' + (x - w) + ' ' + (t + 50) + ' ' + (x - w / 2) + ' ' + t + ' ' + x + ' ' + t + ' C' + (x + w / 2) + ' ' + t + ' ' + (x + w) + ' ' + (t + 50) + ' ' + (x + w) + ' 322 Z', k[3]);
      });
      return s + rect(400, 344, 64, 6, P.trunk, 3) + rect(424, 326, 3, 20, P.trunk);
    },
    mountain: function () {
      return path('M110 322 L320 150 Q350 128 380 150 L610 322 Z', '#BCD7D2') + path('M280 184 L320 150 Q350 128 380 150 L420 184 L396 176 L372 192 L350 174 L326 190 L304 176 Z', '#FFFFFF')
        + path('M150 322 L230 260 L310 322 Z', '#A9CEC6');
    },
    jeju: function () {
      var s = path('M90 322 Q350 140 620 322 Z', '#BFE0CC');
      [[420, 300], [470, 312], [520, 296], [380, 314]].forEach(function (t) { s += circ(t[0], t[1], 20, P.treeD) + circ(t[0] - 7, t[1] - 4, 4, '#F6A25B') + circ(t[0] + 8, t[1] + 3, 4, '#F6A25B') + circ(t[0] + 2, t[1] - 9, 4, '#F6A25B'); });
      return s;
    },
    beach: function () {
      var s = rect(0, 270, 640, 60, P.sea) + rect(0, 318, 640, 102, 'url(#ssSand)');
      [[60, 290, 70], [250, 300, 110], [470, 286, 80]].forEach(function (w) { s += rect(w[0], w[1], w[2], 4, P.wline, 2); });
      s += palm(470, 330, 140, -26) + palm(540, 334, 110, 20) + palm(600, 330, 150, -10);
      return s + path('M330 316 Q360 286 390 316 Z', '#F7B9C8') + rect(359, 314, 3, 34, P.trunk);
    },
    plane: function () {
      return '<g transform="translate(470 70) rotate(-14)">' + path('M0 0 L46 0 Q54 0 54 5 Q54 10 46 10 L0 10 Z', '#FFFFFF', ' stroke="#BFD3DB" stroke-width="2"') + poly(['18,3', '34,3', '20,-16', '14,-16'], '#BFD3DB') + poly(['18,8', '34,8', '20,26', '14,26'], '#BFD3DB') + poly(['0,2', '8,2', '2,-10', '-3,-10'], '#BFD3DB') + '</g>'
        + path('M300 120 Q380 110 462 82', 'none', ' stroke="#D9E6EB" stroke-width="3" stroke-dasharray="6 8"');
    }
  };
  var SCENES = {   // [스카이라인, 물·다리, 랜드마크, 전경]
    castle: ['s', 'wb', 'castle', 'blossom'], tokyo: ['s', 'wb', 'tokyo', 'blossom'], kyoto: ['', 'w', 'kyoto', 'blossom'],
    needleJp: ['s', 'wb', 'needle', 'blossom'], needle: ['s', 'wb', 'needle', 'trees'], snow: ['', '', 'snow', 'trees'],
    pearl: ['s', 'wb', 'pearl', 'trees'], t101: ['s', 'w', 't101', 'trees'], skyline: ['d', 'w', '', 'trees'],
    karst: ['', 'w', 'karst', 'trees'], mountain: ['', 'w', 'mountain', 'trees'], jeju: ['', '', 'jeju', 'trees'],
    wat: ['', 'w', 'wat', 'palms'], mbs: ['s', 'w', 'mbs', 'palms'], eiffel: ['s', 'wb', 'eiffel', 'trees'],
    beach: ['', '', 'beach', ''], 'default': ['d', 'w', 'plane', 'trees']
  };
  function artSvg(city) {
    var key = sceneOf(city), sc = SCENES[key] || SCENES['default'], s = '';
    s += circ(470, 112, 74, P.sun, '.8') + cloud(548, 64, 1) + cloud(250, 120, .7) + cloud(360, 60, .55);
    if (['karst', 'mountain', 'jeju', 'snow', 'beach'].indexOf(key) < 0) s += path('M140 322 Q260 214 360 270 Q440 220 560 322 Z', P.hillF);
    if (key === 'snow') s += rect(0, 318, 640, 102, 'url(#ssSnow)');
    if (key === 'jeju') s += rect(0, 318, 640, 102, 'url(#ssFade)');
    if (sc[0]) s += skyline(sc[0] === 'd');
    if (sc[2] && sc[2] !== 'plane') s += LM[sc[2]]();
    if (sc[1]) s += water(sc[1] === 'wb');
    if (sc[2] === 'plane') s += LM.plane();
    if (sc[3] === 'blossom') s += grove(true); else if (sc[3] === 'trees') s += grove(false);
    else if (sc[3] === 'palms') s += palm(590, 330, 120, -18) + tree(560, 330, 18, P.tree, P.treeD) + tree(250, 330, 16, P.tree, P.treeD);
    var defs = '<defs><linearGradient id="ssFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + P.water + '"/><stop offset=".55" stop-color="' + P.water + '"/><stop offset="1" stop-color="' + P.water + '" stop-opacity="0"/></linearGradient>'
      + '<linearGradient id="ssSnow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EEF4F6"/><stop offset="1" stop-color="#EEF4F6" stop-opacity="0"/></linearGradient>'
      + '<linearGradient id="ssSand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + P.sand + '"/><stop offset=".6" stop-color="' + P.sand + '"/><stop offset="1" stop-color="' + P.sand + '" stop-opacity="0"/></linearGradient></defs>';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420" width="640" height="420" aria-hidden="true">' + defs + s + '</svg>';
  }

  /* ═══ 데이터 — 화면·이미지·텍스트 공용 ═══ */
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function dot(iso) { return String(iso || '').replace(/-/g, '.'); }
  function data() {
    var mem = trip.members || [], s = trip.start || '', e = trip.end || '';
    var ed = e ? (e.slice(0, 4) === s.slice(0, 4) ? e.slice(5).replace('-', '.') : dot(e)) : '';
    return {
      city: trip.city || '여행', title: (trip.city || '') + ' 여행',
      period: dot(s) + (ed ? ' – ' + ed : ''), people: mem.length, total: T.spent(trip),
      setl: T.settlements(trip), bal: T.balances(trip), today: todayISO(),
      color: function (n) { var m = mem.filter(function (x) { return x.name === n; })[0]; return (m && m.color) || '#98A2B3'; }
    };
  }
  function initials(n) { n = String(n || '').trim(); return n.length <= 2 ? n : n.slice(0, 2); }
  function hon(n) { return /님$/.test(n) ? n : n + '님'; }   // '○○님' 이름에 '님' 두 번 붙지 않게
  function subj(n) { return n === '나' ? '내가' : hon(n) + '이'; }
  function obj(n) { return n === '나' ? '나에게' : hon(n) + '에게'; }
  function sendSub(s, only) { return subj(s.from) + ' ' + obj(s.to) + ' 보내' + (only ? '면 정산 완료' : '요'); }
  function signed(n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + won(Math.abs(n)); }
  function netColor(n) { return n > 0 ? C.teal : n < 0 ? C.red : C.zero; }

  /* ═══ 텍스트 — 여행 정보·총액·송금(토스 링크)·개인별·기준일 ═══ */
  function settleText() {
    var d = data(), L = [];
    L.push('💰 ' + d.title + ' 정산');
    L.push(d.period + ' · ' + d.people + '명');
    L.push('총 사용 금액 ' + won(d.total));
    L.push('');
    if (d.setl.length) {
      L.push('💸 보낼 돈');
      d.setl.forEach(function (s) { var u = tossUrl(s.to, s.amt); L.push('· ' + s.from + ' → ' + s.to + ' : ' + won(s.amt) + (u ? '  토스 ' + u : '')); });
    } else L.push('💸 정산 완료 — 서로 주고받을 금액 없음');
    L.push('');
    L.push('👤 개인별 (낸 돈 / 부담액 / 차액)');
    d.bal.forEach(function (b) { L.push('· ' + b.name + ': ' + won(b.paid) + ' / ' + won(b.share) + ' / ' + signed(b.net)); });
    L.push('');
    L.push(dot(d.today) + ' 기준 · 트래블코스트 ' + location.origin + '/trips');
    return L.join('\n');
  }

  /* ═══ 미리보기 카드(HTML) — 카드 폭 기준 단위(--u = 카드폭/1080)라 이미지와 같은 비율로 줄어듦 ═══ */
  var ARROW = '<svg viewBox="0 0 64 40" aria-hidden="true"><path d="M4 20H56M40 6l16 14-16 14" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function avatar(n, col) { return '<span class="ss-av" style="background:' + esc(col) + '">' + esc(initials(n)) + '</span>'; }
  function amtFont(text, base, avail) {   // 금액이 길면(백만 원 단위) 글자를 줄여 한 줄에
    var c = document.createElement('canvas').getContext('2d'); if (!c) return base;
    c.font = '800 ' + base + 'px ' + FONT; var w = c.measureText(text).width;
    return w > avail ? Math.floor(base * avail / w) : base;
  }
  /* 개인별 표 열 폭(1080 기준) — 금액 길이를 재서 숫자 열을 딱 맞게, 이름 열은 나머지. 너무 길면 글자를 줄임(k) */
  function tableLayout(d) {
    var c = document.createElement('canvas').getContext('2d'), mw = function (w, px, list) { c.font = w + ' ' + px + 'px ' + FONT; return Math.max.apply(null, list.map(function (t) { return c.measureText(t).width; })); };
    var paid = mw(500, 38, d.bal.map(function (b) { return won(b.paid); }).concat(['낸 돈'])),
      share = mw(500, 38, d.bal.map(function (b) { return won(b.share); }).concat(['부담액'])),
      net = mw(700, 40, d.bal.map(function (b) { return signed(b.net); }).concat(['차액']));
    var GAP = 48, PADL = 32, PADR = 32, CONTENT = 920, NAME_MIN = 180;
    var room = CONTENT - PADL - PADR - GAP * 3 - NAME_MIN, k = Math.min(1, room / (paid + share + net));
    var wPaid = Math.ceil(paid * k) + GAP, wShare = Math.ceil(share * k) + GAP, wNet = Math.ceil(net * k) + GAP + PADR;
    return { k: k, w: [CONTENT - wPaid - wShare - wNet, wPaid, wShare, wNet] };
  }
  function cardHtml(d) {
    var multi = d.setl.length > 1, send;
    if (!d.setl.length) {
      send = '<div class="ss-send"><div class="ss-st">보낼 돈</div><div class="ss-none"><b>주고받을 돈이 없어요</b><span>모두 공평하게 냈어요</span></div></div>';
    } else {
      send = '<div class="ss-send' + (multi ? ' multi' : '') + '"><div class="ss-st">보낼 돈' + (multi ? ' <em>' + d.setl.length + '건</em>' : '') + '</div>'
        + d.setl.map(function (s) {
          var base = multi ? 76 : 104;
          return '<div class="ss-tr" role="group" aria-label="' + esc(s.from + '이(가) ' + s.to + '에게 ' + won(s.amt)) + '"><div class="ss-trm">' + avatar(s.from, d.color(s.from)) + '<span class="ss-arr">' + ARROW + '</span>' + avatar(s.to, d.color(s.to))
            + '<b class="ss-amt" style="--f:' + amtFont(won(s.amt), base, multi ? 470 : 500) + '">' + won(s.amt) + '</b></div>'
            + '<div class="ss-trs">' + esc(sendSub(s, !multi)) + '</div></div>';
        }).join('') + '</div>';
    }
    var tl = tableLayout(d), rows = d.bal.map(function (b) {
      return '<tr><th scope="row"><i style="background:' + esc(d.color(b.name)) + '"></i><span>' + esc(b.name) + '</span></th><td>' + won(b.paid) + '</td><td>' + won(b.share) + '</td><td style="color:' + netColor(b.net) + '">' + signed(b.net) + '</td></tr>';
    }).join('');
    return '<div class="ss-prev" aria-label="공유 미리보기"><div class="ss-card" id="ss-card">'
      + '<div class="ss-head"><div class="ss-art" aria-hidden="true">' + artSvg(d.city) + '</div>'
      + '<div class="ss-brand"><b>travelcost</b><i>/</i><span>GROUP TRIP</span></div>'
      + '<div class="ss-title">' + esc(d.title) + '</div>'
      + '<div class="ss-date">' + esc(d.period) + '<i>·</i>' + d.people + '명</div>'
      + '<div class="ss-total"><span>총 사용 금액</span><b>' + won(d.total) + '</b></div></div>'
      + '<div class="ss-panel">' + send
      + '<div class="ss-h2">개인별 정산</div>'
      + '<table class="ss-tbl" style="--k:' + tl.k.toFixed(3) + '"><colgroup>' + tl.w.map(function (w) { return '<col style="width:calc(var(--u)*' + w + ')">'; }).join('') + '</colgroup>'
      + '<thead><tr><th scope="col">이름</th><th scope="col">낸 돈</th><th scope="col">부담액</th><th scope="col">차액</th></tr></thead><tbody>' + rows + '</tbody></table>'
      + '<div class="ss-foot"><span><b style="color:' + C.teal + '">+</b> 받을 돈<i>·</i><b style="color:' + C.red + '">−</b> 보낼 돈</span><span>' + dot(d.today) + ' 기준<i>•</i>travelcost.co.kr</span></div>'
      + '</div></div></div>';
  }

  /* ═══ 이미지(PNG) — 같은 치수로 캔버스에 그림. 폰트·일러스트 로딩을 기다린 뒤 그림 ═══ */
  function loadArt(city) {
    return new Promise(function (res) {
      var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { res(null); };
      im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(artSvg(city));
    });
  }
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function wrap(g, text, max) {   // 단어 단위 줄바꿈(한 단어가 넘치면 글자 단위)
    var words = String(text).split(' '), lines = [], cur = '';
    words.forEach(function (w) {
      var t = cur ? cur + ' ' + w : w;
      if (g.measureText(t).width <= max) { cur = t; return; }
      if (cur) lines.push(cur);
      cur = w;
      while (g.measureText(cur).width > max && cur.length > 1) { var k = cur.length; while (k > 1 && g.measureText(cur.slice(0, k)).width > max) k--; lines.push(cur.slice(0, k)); cur = cur.slice(k); }
    });
    if (cur) lines.push(cur);
    return lines;
  }
  function fit(g, s, max) { s = String(s); if (g.measureText(s).width <= max) return s; while (s.length > 1 && g.measureText(s + '…').width > max) s = s.slice(0, -1); return s + '…'; }

  function drawCard(d, art) {
    var c = document.createElement('canvas'), g = c.getContext('2d'); if (!g) return null;
    var f = function (w, px) { g.font = w + ' ' + px + 'px ' + FONT; };
    var multi = d.setl.length > 1;
    // ── 높이 계산
    c.width = W; c.height = 10; f(800, 100);
    var titleLines = wrap(g, d.title, 600).slice(0, 3);
    var headH = 60 + 52 + 30 + titleLines.length * 112 + 14 + 50 + 30 + 76 + 90;
    var sendH = 36 + 42 + 26 + (!d.setl.length ? 150 : multi ? d.setl.length * 206 - 16 : 104 + 22 + 44) + 40;
    var tblH = 52 + 52 + 24 + 80 + d.bal.length * 96;
    var panelH = 40 + sendH + tblH + 34 + 40 + 40;
    var H = headH - 50 + panelH + 40;
    c.width = W; c.height = H; g.textBaseline = 'alphabetic';
    g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
    // ── 일러스트(오른쪽 위, 왼쪽은 글자 쪽으로 흐려짐)
    if (art) {
      var o = document.createElement('canvas'); o.width = 640; o.height = 420; var og = o.getContext('2d');
      og.drawImage(art, 0, 0, 640, 420);
      var m = og.createLinearGradient(0, 0, 640, 0); m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(.32, 'rgba(0,0,0,1)');
      og.globalCompositeOperation = 'destination-in'; og.fillStyle = m; og.fillRect(0, 0, 640, 420);
      g.drawImage(o, W - 640, headH - 420);
    }
    // ── 머리
    var x = 64, y = 60;
    f(800, 40); g.fillStyle = C.teal; g.fillText('travelcost', x, y + 40);
    var bw = g.measureText('travelcost').width; f(500, 30); g.fillStyle = '#9AA5B1'; g.fillText('/', x + bw + 22, y + 38);
    f(600, 28); g.fillStyle = C.mute; g.fillText('GROUP TRIP', x + bw + 58, y + 38);
    y += 52 + 30; f(800, 100); g.fillStyle = C.ink;
    titleLines.forEach(function (t) { g.fillText(t, x - 4, y + 90); y += 112; });
    y += 14; f(500, 38); g.fillStyle = C.sub;
    var dt = d.period + '  ·  ' + d.people + '명'; g.fillText(dt, x, y + 38); y += 50 + 30;
    f(500, 34); g.fillStyle = C.sub; g.fillText('총 사용 금액', x, y + 52);
    var lw = g.measureText('총 사용 금액').width; f(800, 64); g.fillStyle = C.ink; g.fillText(won(d.total), x + lw + 28, y + 56);
    // ── 흰 패널
    var py = headH - 50, px = 40, pw = W - 80;
    g.save(); g.shadowColor = 'rgba(21,37,58,.07)'; g.shadowBlur = 40; g.shadowOffsetY = 8; g.fillStyle = C.panel; rr(g, px, py, pw, panelH, 32); g.fill(); g.restore();
    var L = px + 40, R = px + pw - 40; y = py + 40;
    // ── 보낼 돈 카드
    g.fillStyle = C.mint; rr(g, L, y, R - L, sendH, 28); g.fill();
    var sx = L + 40, sr = R - 40, sy = y + 36;
    f(800, 42); g.fillStyle = C.ink; g.fillText('보낼 돈', sx, sy + 38);
    if (multi) { var tw = g.measureText('보낼 돈 ').width; f(800, 34); g.fillStyle = C.teal; g.fillText(d.setl.length + '건', sx + tw + 4, sy + 38); }
    sy += 42 + 26;
    function av(cx, cy, r, n) {
      g.fillStyle = d.color(n); g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
      f(700, Math.round(r * .74)); g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(initials(n), cx, cy + r * .27); g.textAlign = 'left';
    }
    function arrow(x0, cy, len) {
      g.strokeStyle = C.teal; g.lineWidth = 6; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(x0, cy); g.lineTo(x0 + len, cy); g.moveTo(x0 + len - 16, cy - 14); g.lineTo(x0 + len, cy); g.lineTo(x0 + len - 16, cy + 14); g.stroke();
    }
    if (!d.setl.length) {
      f(800, 44); g.fillStyle = C.tealDeep; g.fillText('주고받을 돈이 없어요', sx, sy + 60);
      f(500, 34); g.fillStyle = C.sub; g.fillText('모두 공평하게 냈어요', sx, sy + 116);
    } else d.setl.forEach(function (s) {
      var D = multi ? 84 : 104, rx = sx, top = sy, rw = sr - sx;
      if (multi) { g.fillStyle = 'rgba(255,255,255,.7)'; rr(g, sx - 12, sy, rw + 24, 190, 22); g.fill(); rx = sx + 16; top = sy + 24; }
      var cy = top + D / 2;
      av(rx + D / 2, cy, D / 2, s.from); arrow(rx + D + 24, cy, 52); av(rx + D + 100 + D / 2, cy, D / 2, s.to);
      var base = multi ? 76 : 104, fs = amtFont(won(s.amt), base, multi ? 470 : 500);
      f(800, fs); g.fillStyle = C.tealDeep; g.textAlign = 'right'; g.fillText(won(s.amt), sr - (multi ? 4 : 0), cy + fs * .36); g.textAlign = 'left';
      f(500, multi ? 30 : 34); g.fillStyle = C.sub; g.fillText(fit(g, sendSub(s, !multi), rw - 20), rx, top + D + (multi ? 44 : 56));
      sy += multi ? 206 : 0;
    });
    y += sendH;
    // ── 개인별 정산 표
    y += 52; f(800, 44); g.fillStyle = C.ink; g.fillText('개인별 정산', L, y + 40); y += 52 + 24;
    var tl = tableLayout(d), k = tl.k, colR = [L + tl.w[0] + tl.w[1], L + tl.w[0] + tl.w[1] + tl.w[2], R - 32];
    g.fillStyle = C.thead; rr(g, L, y, R - L, 80, 20); g.fill();
    f(600, 30); g.fillStyle = C.mute; g.fillText('이름', L + 32, y + 51); g.textAlign = 'right';
    g.fillText('낸 돈', colR[0], y + 51); g.fillText('부담액', colR[1], y + 51); g.fillText('차액', colR[2], y + 51); g.textAlign = 'left';
    y += 80;
    d.bal.forEach(function (b) {
      g.fillStyle = d.color(b.name); g.beginPath(); g.arc(L + 44, y + 48, 12, 0, Math.PI * 2); g.fill();
      f(700, 40); g.fillStyle = C.ink; g.fillText(fit(g, b.name, tl.w[0] - 72 - 16), L + 72, y + 62);
      g.textAlign = 'right'; f(500, Math.round(38 * k)); g.fillStyle = C.ink; g.fillText(won(b.paid), colR[0], y + 61); g.fillText(won(b.share), colR[1], y + 61);
      f(700, Math.round(40 * k)); g.fillStyle = netColor(b.net); g.fillText(signed(b.net), colR[2], y + 62); g.textAlign = 'left';
      g.fillStyle = C.line; g.fillRect(L, y + 94, R - L, 2);
      y += 96;
    });
    // ── 바닥줄
    y += 34; f(700, 30); var fx = L + 8, fy = y + 30;
    g.fillStyle = C.teal; g.fillText('+', fx, fy); fx += g.measureText('+ ').width; f(500, 30); g.fillStyle = C.sub; g.fillText('받을 돈', fx, fy); fx += g.measureText('받을 돈').width;
    g.fillStyle = '#B6BEC8'; g.fillText('  ·  ', fx, fy); fx += g.measureText('  ·  ').width;
    f(700, 30); g.fillStyle = C.red; g.fillText('−', fx, fy); fx += g.measureText('− ').width; f(500, 30); g.fillStyle = C.sub; g.fillText('보낼 돈', fx, fy);
    g.textAlign = 'right'; g.fillStyle = C.sub; g.fillText(dot(d.today) + ' 기준  •  travelcost.co.kr', R - 8, fy); g.textAlign = 'left';
    return c;
  }
  function render() {
    var d = data(), fonts = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    return Promise.all([fonts, loadArt(d.city)]).then(function (r) {
      var c = drawCard(d, r[1]); if (!c) throw new Error('canvas');
      return new Promise(function (res) {
        if (c.toBlob) c.toBlob(function (b) { res({ canvas: c, blob: b }); }, 'image/png'); else res({ canvas: c, blob: null });
      });
    });
  }

  /* ═══ 시트 ═══ */
  var cur = null, curP = null;
  function fileName() { return (trip.city || '여행') + '-정산.png'; }
  function canShareFiles() {
    try { return !!(navigator.canShare && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] })); } catch (e) { return false; }
  }
  var IC_DL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10.5l5 5 5-5M4.5 19.5h15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var IC_CHAT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4c4.7 0 8.5 3.2 8.5 7.2s-3.8 7.2-8.5 7.2c-.9 0-1.8-.1-2.6-.4L5 20l1.1-3.5C4.6 15.2 3.5 13.3 3.5 11.2 3.5 7.2 7.3 4 12 4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="8.5" cy="11.3" r="1.1" fill="currentColor"/><circle cx="12" cy="11.3" r="1.1" fill="currentColor"/><circle cx="15.5" cy="11.3" r="1.1" fill="currentColor"/></svg>';
  var IC_SHARE = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3" fill="currentColor"/><circle cx="6" cy="12" r="3" fill="currentColor"/><circle cx="18" cy="19" r="3" fill="currentColor"/><path d="M8.6 10.5l6.8-4M8.6 13.5l6.8 4" stroke="currentColor" stroke-width="2"/></svg>';
  var IC_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  function head(sub) {
    return '<div class="ss-top"><div><h3 id="ss-h">정산 내역 공유</h3><p>' + sub + '</p></div><button type="button" class="ss-x" onclick="closeSheet()" aria-label="닫기">' + IC_X + '</button></div>';
  }
  function open() {
    if (!trip) return;
    var d = data();
    openSheet(head('친구에게 이미지나 링크로 정산을 알려주세요.')
      + '<div class="ss-lbl">공유 미리보기</div>' + cardHtml(d)
      + '<div class="ss-acts">'
      + '<button type="button" class="ss-pri" onclick="SettleShare.shareImage()">' + IC_SHARE + '이미지 공유</button>'
      + '<div class="ss-row2"><button type="button" class="ss-sec" onclick="SettleShare.saveImage()">' + IC_DL + '이미지 저장</button>'
      + '<button type="button" class="ss-sec" onclick="SettleShare.textView()">' + IC_CHAT + '텍스트로 보내기</button></div></div>');
    var sh = document.getElementById('sheet'); sh.classList.add('ss'); sbodyLabel();
    cur = null; curP = render().then(function (r) { cur = r; return r; }, function () { cur = null; return null; });   // 미리 만들어 둬야 공유 버튼이 사용자 동작 안에서 바로 열림
  }
  function sbodyLabel() { var b = document.getElementById('sheetBody'); if (b) { b.setAttribute('role', 'dialog'); b.setAttribute('aria-labelledby', 'ss-h'); } }
  function download(r) {
    var a = document.createElement('a'); a.href = r.canvas.toDataURL('image/png'); a.download = fileName();
    document.body.appendChild(a); a.click(); setTimeout(function () { document.body.removeChild(a); }, 100);
  }
  function withImage(fn) {
    if (cur) return fn(cur);
    toast('이미지를 만드는 중이에요…');
    (curP || render()).then(function (r) { if (r) fn(r); else toast('이 브라우저에선 이미지를 만들 수 없어요 — 텍스트로 보내 주세요'); });
  }
  function shareImage() {
    withImage(function (r) {
      try {
        var file = r.blob && new File([r.blob], fileName(), { type: 'image/png' });
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], title: trip.city + ' 여행 정산' }).catch(function (e) {
            if (e && e.name !== 'AbortError') { download(r); toast('공유가 안 돼서 이미지를 저장했어요'); }
          });
          return;
        }
      } catch (e) {}
      download(r); toast('이 브라우저는 이미지 공유를 지원하지 않아 저장했어요');
    });
  }
  function saveImage() { withImage(function (r) { download(r); toast('정산 이미지를 저장했어요 (' + r.canvas.width + '×' + r.canvas.height + ')'); }); }

  function textView() {
    var t = settleText(), canShare = !!navigator.share;
    openSheet(head('단톡방에 붙여넣거나 바로 공유하세요. 토스 아이디가 있으면 송금 링크가 함께 가요.')
      + '<label class="ss-lbl" for="ss-text">보낼 내용</label><textarea id="ss-text" class="ss-text" readonly rows="12">' + esc(t) + '</textarea>'
      + '<div class="ss-acts"><div class="ss-row2">'
      + '<button type="button" class="ss-' + (canShare ? 'sec' : 'pri') + '" onclick="SettleShare.copyText()">복사하기</button>'
      + (canShare ? '<button type="button" class="ss-pri" onclick="SettleShare.shareText()">' + IC_SHARE + '공유하기</button>' : '')
      + '</div><button type="button" class="ss-back" onclick="SettleShare.open()">‹ 이미지로 돌아가기</button></div>');
    document.getElementById('sheet').classList.add('ss'); sbodyLabel();
  }
  function copyText() {
    var t = settleText(), ta = document.getElementById('ss-text');
    var fallback = function () {
      try { if (ta) { ta.removeAttribute('readonly'); ta.select(); ta.setSelectionRange(0, t.length); var ok = document.execCommand('copy'); ta.setAttribute('readonly', ''); if (ok) { toast('정산 내역을 복사했어요 — 단톡방에 붙여넣으세요'); return; } } } catch (e) {}
      toast('글을 길게 눌러 직접 복사해 주세요');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { toast('정산 내역을 복사했어요 — 단톡방에 붙여넣으세요'); }, fallback);
    else fallback();
  }
  function shareText() {
    var t = settleText();
    if (navigator.share) navigator.share({ title: trip.city + ' 여행 정산', text: t }).catch(function (e) { if (e && e.name !== 'AbortError') copyText(); });
    else copyText();
  }

  /* ═══ 스타일 ═══ */
  var css = ''
    + '.mwrap.ss .modal{padding-bottom:0;background:var(--surface,#fff)}'
    + '@media (min-width:900px){.mwrap.ss{align-items:center}.mwrap.ss .modal{max-width:560px;border-radius:24px;max-height:94vh;padding-top:22px}.mwrap.ss .grip{display:none}}'
    + '.ss-top{display:flex;align-items:flex-start;gap:12px;margin-bottom:14px}.ss-top>div{flex:1;min-width:0}'
    + '.ss-top h3{font-size:22px;font-weight:800;letter-spacing:-.02em;margin:0 0 6px;color:var(--gray-900,#15253A)}'
    + '.ss-top p{font-size:14px;line-height:1.45;color:var(--gray-600,#55657A);margin:0;word-break:keep-all}'
    + '.ss-x{flex:none;width:44px;height:44px;margin:-8px -8px 0 0;border:none;background:none;border-radius:12px;color:var(--gray-700,#344054);cursor:pointer;display:grid;place-items:center}'
    + '.ss-x svg{width:24px;height:24px}.ss-x:focus-visible,.ss-pri:focus-visible,.ss-sec:focus-visible,.ss-back:focus-visible{outline:3px solid #0F9C91;outline-offset:2px}'
    + '.ss-lbl{display:block;font-size:13px;font-weight:600;color:var(--gray-500,#6B7785);margin:0 2px 8px}'
    + '.ss-prev{container-type:inline-size;width:100%}'
    + '.ss-card{--u:calc(100cqi / 1080);position:relative;overflow:hidden;background:' + C.bg + ';color:' + C.ink + ';border-radius:max(14px,calc(var(--u)*28));border:1px solid #ECEFEA;box-shadow:0 6px 24px rgba(21,37,58,.06);font-family:' + FONT + ';padding-bottom:calc(var(--u)*40);font-variant-numeric:tabular-nums;-webkit-text-size-adjust:100%}'
    + '.ss-head{position:relative;padding:calc(var(--u)*60) calc(var(--u)*64) calc(var(--u)*90)}'
    + '.ss-art{position:absolute;right:0;bottom:0;width:calc(var(--u)*640);height:calc(var(--u)*420);-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 32%);mask-image:linear-gradient(90deg,transparent 0,#000 32%);pointer-events:none}'
    + '.ss-art svg{width:100%;height:100%;display:block}'
    + '.ss-head>div:not(.ss-art){position:relative}'
    + '.ss-brand{display:flex;align-items:baseline;gap:calc(var(--u)*22);height:calc(var(--u)*52);font-size:max(8px,calc(var(--u)*30));color:#9AA5B1}'
    + '.ss-brand b{font-size:max(10px,calc(var(--u)*40));font-weight:800;color:' + C.teal + ';letter-spacing:-.01em}.ss-brand i{font-style:normal}.ss-brand span{font-size:max(8px,calc(var(--u)*28));font-weight:600;color:' + C.mute + ';letter-spacing:.02em}'
    + '.ss-title{margin-top:calc(var(--u)*30);max-width:calc(var(--u)*600);font-size:calc(var(--u)*100);line-height:1.12;font-weight:800;letter-spacing:-.03em;word-break:keep-all;overflow-wrap:anywhere}'
    + '.ss-date{margin-top:calc(var(--u)*14);font-size:max(10px,calc(var(--u)*38));line-height:1.3;font-weight:500;color:' + C.sub + '}.ss-date i{font-style:normal;margin:0 .55em}'
    + '.ss-total{margin-top:calc(var(--u)*30);display:flex;align-items:baseline;gap:calc(var(--u)*28);flex-wrap:wrap}.ss-total span{font-size:max(10px,calc(var(--u)*34));color:' + C.sub + ';font-weight:500}.ss-total b{font-size:calc(var(--u)*64);font-weight:800;letter-spacing:-.02em}'
    + '.ss-panel{position:relative;margin:calc(var(--u)*-50) calc(var(--u)*40) 0;background:#fff;border-radius:calc(var(--u)*32);padding:calc(var(--u)*40);box-shadow:0 calc(var(--u)*8) calc(var(--u)*40) rgba(21,37,58,.07)}'
    + '.ss-send{background:' + C.mint + ';border-radius:calc(var(--u)*28);padding:calc(var(--u)*36) calc(var(--u)*40) calc(var(--u)*40)}'
    + '.ss-st{font-size:calc(var(--u)*42);font-weight:800;line-height:1;margin-bottom:calc(var(--u)*26)}.ss-st em{font-style:normal;color:' + C.teal + ';font-size:calc(var(--u)*34);margin-left:.2em}'
    + '.ss-trm{display:flex;align-items:center}'
    + '.ss-av{flex:none;width:calc(var(--u)*104);height:calc(var(--u)*104);border-radius:50%;display:grid;place-items:center;color:#fff;font-weight:700;font-size:calc(var(--u)*38);line-height:1;letter-spacing:-.02em;white-space:nowrap}'
    + '.ss-arr{flex:none;width:calc(var(--u)*100);display:flex;justify-content:center;color:' + C.teal + '}.ss-arr svg{width:calc(var(--u)*56);height:auto}'
    + '.ss-amt{margin-left:auto;font-size:calc(var(--u)*var(--f));font-weight:800;color:' + C.tealDeep + ';letter-spacing:-.025em;white-space:nowrap;line-height:1}'
    + '.ss-trs{margin-top:calc(var(--u)*22);font-size:max(9px,calc(var(--u)*34));color:' + C.sub + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.ss-send.multi .ss-tr{background:rgba(255,255,255,.7);border-radius:calc(var(--u)*22);padding:calc(var(--u)*24) calc(var(--u)*20) calc(var(--u)*20) calc(var(--u)*16);margin:0 calc(var(--u)*-12) calc(var(--u)*16)}'
    + '.ss-send.multi .ss-tr:last-child{margin-bottom:0}.ss-send.multi .ss-av{width:calc(var(--u)*84);height:calc(var(--u)*84);font-size:calc(var(--u)*31)}'
    + '.ss-send.multi .ss-arr{width:calc(var(--u)*100)}.ss-send.multi .ss-trs{font-size:max(9px,calc(var(--u)*30));margin-top:calc(var(--u)*16)}'
    + '.ss-none b{display:block;font-size:calc(var(--u)*44);font-weight:800;color:' + C.tealDeep + ';margin-top:calc(var(--u)*10)}.ss-none span{display:block;margin-top:calc(var(--u)*18);font-size:max(9px,calc(var(--u)*34));color:' + C.sub + '}'
    + '.ss-h2{margin:calc(var(--u)*52) 0 calc(var(--u)*24);font-size:calc(var(--u)*44);font-weight:800;line-height:1.2}'
    + '.ss-tbl{width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed}'
    + '.ss-tbl tr,.ss-tbl tbody tr:hover{background:none!important}.ss-tbl th,.ss-tbl td{border:0;background:none;box-shadow:none;margin:0;vertical-align:middle;line-height:1.2;letter-spacing:normal}'
    + '.ss-tbl thead th{background:' + C.thead + ';height:calc(var(--u)*80);padding:0;font-size:calc(var(--u)*30);font-weight:600;color:' + C.mute + ';text-align:right}'
    + '.ss-tbl thead th:first-child{text-align:left;padding-left:calc(var(--u)*32);border-radius:calc(var(--u)*20) 0 0 calc(var(--u)*20)}.ss-tbl thead th:last-child{padding-right:calc(var(--u)*32);border-radius:0 calc(var(--u)*20) calc(var(--u)*20) 0}'
    + '.ss-tbl tbody th,.ss-tbl td{height:calc(var(--u)*96);border-bottom:calc(var(--u)*2) solid ' + C.line + ';padding:0;white-space:nowrap}'
    + '.ss-tbl tbody th{text-align:left;padding-left:calc(var(--u)*32);font-size:calc(var(--u)*40);font-weight:700;color:' + C.ink + ';overflow:hidden}'
    + '.ss-tbl tbody th i{display:inline-block;width:calc(var(--u)*24);height:calc(var(--u)*24);border-radius:50%;vertical-align:middle;margin-right:calc(var(--u)*16)}'
    + '.ss-tbl tbody th span{display:inline-block;max-width:calc(100% - var(--u)*44);overflow:hidden;text-overflow:ellipsis;vertical-align:middle}'
    + '.ss-tbl td{text-align:right;font-size:calc(var(--u)*38*var(--k));font-weight:500;color:' + C.ink + '}.ss-tbl td:last-child{padding-right:calc(var(--u)*32);font-weight:700;font-size:calc(var(--u)*40*var(--k))}'
    + '.ss-foot{display:flex;justify-content:space-between;gap:calc(var(--u)*20);margin-top:calc(var(--u)*34);padding:0 calc(var(--u)*8);font-size:max(8px,calc(var(--u)*30));color:' + C.sub + ';white-space:nowrap}'
    + '.ss-foot i{font-style:normal;margin:0 .5em;color:#B6BEC8}.ss-foot b{font-weight:700}'
    + '.ss-acts{position:sticky;bottom:0;margin:14px -18px 0;padding:12px 18px calc(16px + env(safe-area-inset-bottom));background:var(--surface,#fff);display:flex;flex-direction:column;gap:10px;z-index:2}'
    + '.ss-row2{display:flex;gap:10px}.ss-row2>button{flex:1;min-width:0}'
    + '.ss-pri,.ss-sec{min-height:54px;border-radius:16px;font:inherit;font-size:16px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;padding:0 12px;white-space:nowrap}'
    + '.ss-pri{border:none;background:' + C.teal + ';color:#fff}.ss-pri:active{background:' + C.tealDeep + '}'
    + '.ss-sec{border:1.5px solid var(--gray-200,#E4E7EC);background:var(--surface,#fff);color:var(--gray-800,#15253A)}'
    + '.ss-pri svg,.ss-sec svg{width:22px;height:22px;flex:none}'
    + '.ss-back{border:none;background:none;font:inherit;font-size:14px;font-weight:700;color:var(--gray-600,#55657A);min-height:44px;cursor:pointer}'
    + '.ss-text{width:100%;box-sizing:border-box;padding:14px;border:1px solid var(--gray-200,#E4E7EC);border-radius:16px;background:var(--gray-50,#F9FAFB);color:var(--gray-900,#15253A);font:inherit;font-size:14px !important;line-height:1.55;resize:vertical}'
    + '@media (max-width:360px){.ss-pri,.ss-sec{font-size:15px;gap:6px;padding:0 8px}.ss-pri svg,.ss-sec svg{width:20px;height:20px}.ss-top h3{font-size:20px}}'
    + '@media (max-width:330px){.ss-row2{flex-direction:column;gap:8px}.ss-pri,.ss-sec{min-height:48px}.ss-acts{gap:8px}}';
  var st = document.createElement('style'); st.id = 'ss-css'; st.textContent = css; document.head.appendChild(st);

  window.SS_ART = { CITY: CITY, SCENES: SCENES, svg: artSvg, sceneOf: sceneOf };
  window.SettleShare = { open: open, shareImage: shareImage, saveImage: saveImage, textView: textView, copyText: copyText, shareText: shareText, text: settleText, render: render, data: data };
  window.shareSettlement = open;
  window.shareSettlementText = function () { textView(); };
})();
