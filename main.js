/* ─────────────────────────────────────────
   트립가이드 공통 스크립트
   ───────────────────────────────────────── */

// ── 보안: 출력 이스케이프 ────────────────────────────────────
// 외부 API(TourAPI)와 localStorage 값을 innerHTML에 넣기 전에 반드시 통과시킨다.
// localStorage는 /mytrip 의 #data= 가져오기로 외부 주입이 가능하므로 신뢰할 수 없다.
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// http(s) 링크만 허용 — javascript:/data: 스킴 차단
function safeUrl(u) {
  const v = String(u == null ? '' : u).trim();
  return /^https?:\/\//i.test(v) ? esc(v) : '';
}
// 설명문은 TourAPI가 <br> 등을 담아 보내므로 태그를 제거하되 줄바꿈만 살린다
function safeText(html) {
  const MARK = '\u0001';                          // 본문에 나올 수 없는 제어문자
  const plain = String(html == null ? '' : html)
    .replace(/<br\s*\/?>/gi, MARK)                // 줄바꿈만 자리표시로 보존
    .replace(/<[^>]*>/g, '');                      // 나머지 태그는 전부 제거
  return esc(plain).split(MARK).join('<br>');      // 이스케이프 후 <br>만 복원
}

// ── 헤더 스크롤 효과 ──
const header = document.getElementById('header');
if (header) {
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 10);
  });
}

// ── 모바일 메뉴 ──
const menuBtn = document.getElementById('menuBtn');
const nav = document.getElementById('nav');
if (menuBtn && nav) {
  menuBtn.addEventListener('click', () => nav.classList.toggle('open'));
  document.addEventListener('click', (e) => {
    if (!menuBtn.contains(e.target) && !nav.contains(e.target))
      nav.classList.remove('open');
  });
}

// ── 목적지 필터 (홈) ──
function filterDest(cat) {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cat === cat);
  });
  const cards = document.querySelectorAll('.dest-card');
  const noResult = document.getElementById('noResult');
  let visible = 0;
  cards.forEach(card => {
    const match = cat === '전체' || card.dataset.cat === cat;
    card.classList.toggle('hidden', !match);
    if (match) visible++;
  });
  if (noResult) noResult.classList.toggle('hidden', visible > 0);
  document.getElementById('destinations')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── 히어로 텍스트 검색 ──
function doSearch() {
  const q = (document.getElementById('heroSearch')?.value || '').trim().toLowerCase();
  if (!q) return;
  const cards = document.querySelectorAll('.dest-card');
  const noResult = document.getElementById('noResult');
  let visible = 0;
  cards.forEach(card => {
    const match = (card.dataset.name || '').toLowerCase().includes(q) || card.textContent.toLowerCase().includes(q);
    card.classList.toggle('hidden', !match);
    if (match) visible++;
  });
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.filter-btn[data-cat="전체"]')?.classList.add('active');
  if (noResult) noResult.classList.toggle('hidden', visible > 0);
  document.getElementById('destinations')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
document.getElementById('heroSearch')?.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

// ── 여행지 상세: 일정 탭 ──
function initDayTabs() {
  const tabs = document.querySelectorAll('.day-tab');
  if (!tabs.length) return;
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const day = tab.dataset.day;
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.day-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('day' + day)?.classList.add('active');
    });
  });
}

// ── 여행지 상세: 호텔 필터 ──
function initHotelFilter() {
  const btns = document.querySelectorAll('.hotel-filter-btn');
  if (!btns.length) return;
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const cat = btn.dataset.filter;
      document.querySelectorAll('.hotel-card').forEach(card => {
        card.classList.toggle('hidden', cat !== 'all' && card.dataset.cat !== cat);
      });
    });
  });
}

// ── 여행지 상세: 섹션 내비 활성화 ──
function initDestNav() {
  const navLinks = document.querySelectorAll('.dest-nav a');
  if (!navLinks.length) return;
  const sections = Array.from(navLinks).map(a => {
    return document.getElementById(a.getAttribute('href').replace('#', ''));
  }).filter(Boolean);
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(a => {
          a.classList.toggle('active', a.getAttribute('href') === '#' + entry.target.id);
        });
      }
    });
  }, { rootMargin: '-20% 0px -60% 0px' });
  sections.forEach(s => observer.observe(s));
}

// ── 날짜 기본값 (오늘+14 / +17) ──
function initDates() {
  const today = new Date();
  const fmt = d => d.toISOString().split('T')[0];
  const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
  const min = fmt(today);
  ['depDate', 'flightDep', 'dep', 'sw-dep', 'sw-cin'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.min = min; el.value = fmt(addDays(today, 14)); }
  });
  ['retDate', 'flightRet', 'ret', 'sw-ret', 'sw-cout'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.min = min; el.value = fmt(addDays(today, 17)); }
  });
}

/* ═══════════════════════════════════════════
   검색 위젯 + 환율 계산기 상태 유지 (localStorage)
   ═══════════════════════════════════════════ */
const _PREFS_KEY = 'tripguide_prefs';
function _getPrefs() {
  try { return JSON.parse(localStorage.getItem(_PREFS_KEY) || '{}'); }
  catch { return {}; }
}
function _savePref(key, val) {
  const p = _getPrefs(); p[key] = val;
  localStorage.setItem(_PREFS_KEY, JSON.stringify(p));
}
// 페이지 로드 시 마지막 선택값 복원 (날짜는 제외 — 항상 미래로)
function restorePrefs() {
  const p = _getPrefs();
  const set = (id, v) => { const el = document.getElementById(id); if (el && v != null) el.value = v; };
  set('sw-to', p.flightTo); set('sw-pax', p.flightPax);
  set('sw-hcity', p.hotelCity); set('sw-guests', p.hotelGuests);
  // 환율 계산기
  if (p.fxAmount != null) set('fxCalcAmount', p.fxAmount);
  set('fxCalcFrom', p.fxFrom);
  // 계산기 값 있으면 즉시 계산
  if (p.fxAmount) { try { calcFx(); } catch {} }
  // 변경 시 자동 저장 바인딩
  const bind = (id, key) => { const el = document.getElementById(id); if (el) el.addEventListener('change', () => _savePref(key, el.value)); };
  bind('sw-to', 'flightTo'); bind('sw-pax', 'flightPax');
  bind('sw-hcity', 'hotelCity'); bind('sw-guests', 'hotelGuests');
  bind('fxCalcFrom', 'fxFrom');
  const amtEl = document.getElementById('fxCalcAmount');
  if (amtEl) amtEl.addEventListener('input', () => _savePref('fxAmount', amtEl.value));
}

/* ═══════════════════════════════════════════
   검색 위젯
   ═══════════════════════════════════════════ */

// ── 탭 전환 ──
document.querySelectorAll('.sw-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.sw-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.sw-form').forEach(f => f.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('sw-' + tab.dataset.tab)?.classList.add('active');
  });
});

// ── 플랫폼 칩 선택 ──
let selectedFlightPlatform = 'skyscanner';
let selectedHotelPlatform  = 'agoda';

document.querySelectorAll('.sw-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const group = chip.dataset.group;
    document.querySelectorAll(`.sw-chip[data-group="${group}"]`).forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    if (group === 'flight') selectedFlightPlatform = chip.dataset.platform;
    if (group === 'hotel')  selectedHotelPlatform  = chip.dataset.platform;
  });
});

// ── 항공권 딥링크 ──
function searchFlightDeep() {
  const to  = document.getElementById('sw-to')?.value;
  const dep = document.getElementById('sw-dep')?.value;
  const ret = document.getElementById('sw-ret')?.value;
  const pax = document.getElementById('sw-pax')?.value || '2';

  if (!dep || !ret) { alert('날짜를 선택해주세요.'); return; }
  if (dep >= ret)   { alert('귀국일은 출발일보다 늦어야 합니다.'); return; }

  const sky = d => d.replace(/-/g, '').slice(2); // YYMMDD

  const urls = {
    skyscanner: `https://www.skyscanner.co.kr/transport/flights/ICN/${to}/${sky(dep)}/${sky(ret)}/?adults=${pax}&cabinclass=economy`,
    tripcom:    `https://kr.trip.com/flights/showfarefirst?dcity=ICN&acity=${to}&ddate=${dep}&rdate=${ret}&adult=${pax}&cabin=Y`,
    expedia:    `https://www.expedia.co.kr/Flights-Search?trip=roundtrip` +
                `&leg1=from%3DICN%2Cto%3D${to}%2Cdeparture%3D${dep}TANYT` +
                `&leg2=from%3D${to}%2Cto%3DICN%2Cdeparture%3D${ret}TANYT` +
                `&passengers=adults%3A${pax}`,
  };

  window.open(urls[selectedFlightPlatform] ?? urls.skyscanner, '_blank', 'noopener,noreferrer');
}

// ── 숙소 딥링크 ──
function searchHotelDeep() {
  const city   = document.getElementById('sw-hcity')?.value || 'Osaka';
  const cin    = document.getElementById('sw-cin')?.value;
  const cout   = document.getElementById('sw-cout')?.value;
  const guests = document.getElementById('sw-guests')?.value || '2';

  if (!cin || !cout) { alert('날짜를 선택해주세요.'); return; }
  if (cin >= cout)   { alert('체크아웃은 체크인보다 늦어야 합니다.'); return; }

  const enc = encodeURIComponent(city);
  const urls = {
    agoda:     `https://www.agoda.com/search?searchText=${enc}&checkIn=${cin}&checkOut=${cout}&rooms=1&adults=${guests}&lang=ko`,
    hotelscom: `https://www.hotels.com/search.do?q-destination=${enc}&q-check-in=${cin}&q-check-out=${cout}&q-rooms=1&q-room-0-adults=${guests}`,
    tripcom:   `https://kr.trip.com/hotels/?locale=ko_KR&city=${enc}&checkIn=${cin}&checkOut=${cout}&adult=${guests}&rooms=1`,
  };

  window.open(urls[selectedHotelPlatform] ?? urls.agoda, '_blank', 'noopener,noreferrer');
}

/* ═══════════════════════════════════════════
   국내여행 — 한국관광공사 TourAPI
   ═══════════════════════════════════════════ */

const AREA_MAP = {
  '1':'서울', '2':'인천', '3':'대전', '4':'대구', '5':'광주',
  '6':'부산', '7':'울산', '8':'세종', '31':'경기도', '32':'강원도',
  '33':'충청북도', '34':'충청남도', '35':'전라북도', '36':'전라남도',
  '37':'경상북도', '38':'경상남도', '39':'제주도',
};

const CTYPE_MAP = {
  '12':'관광지', '14':'문화시설', '15':'축제·행사',
  '28':'레포츠', '32':'숙박', '39':'음식점', 'cafe':'카페',
};

const CTYPE_ICON = { '12':'🏔', '14':'🏛', '15':'🎪', '28':'⛷', '32':'🏨', '39':'🍽', 'cafe':'☕' };

// 특수 카테고리 (contentTypeId + cat3 조합)
const SPECIAL_CTYPE = {
  'cafe': { contentTypeId: '39', cat3: 'A05020700' },
};

const SIGUNGU_MAP = {
  '1':{ '1':'종로구','2':'중구','3':'용산구','4':'성동구','5':'광진구','6':'동대문구','7':'중랑구','8':'성북구','9':'강북구','10':'도봉구','11':'노원구','12':'은평구','13':'서대문구','14':'마포구','15':'양천구','16':'강서구','17':'구로구','18':'금천구','19':'영등포구','20':'동작구','21':'관악구','22':'서초구','23':'강남구','24':'송파구','25':'강동구' },
  '2':{ '1':'강화군','2':'옹진군','3':'중구','4':'동구','5':'미추홀구','6':'연수구','7':'남동구','8':'부평구','9':'계양구','10':'서구' },
  '3':{ '1':'동구','2':'중구','3':'서구','4':'유성구','5':'대덕구' },
  '4':{ '1':'중구','2':'동구','3':'서구','4':'남구','5':'북구','6':'수성구','7':'달서구','8':'달성군' },
  '5':{ '1':'동구','2':'서구','3':'남구','4':'북구','5':'광산구' },
  '6':{ '1':'중구','2':'서구','3':'동구','4':'영도구','5':'부산진구','6':'동래구','7':'남구','8':'북구','9':'해운대구','10':'사하구','11':'금정구','12':'강서구','13':'연제구','14':'수영구','15':'사상구','16':'기장군' },
  '7':{ '1':'중구','2':'남구','3':'동구','4':'북구','5':'울주군' },
  '8':{ '1':'세종특별자치시' },
  '31':{ '1':'수원시','2':'성남시','3':'의정부시','4':'안양시','5':'부천시','6':'광명시','7':'평택시','8':'동두천시','9':'안산시','10':'고양시','11':'과천시','12':'구리시','13':'남양주시','14':'오산시','15':'시흥시','16':'군포시','17':'의왕시','18':'하남시','19':'용인시','20':'파주시','21':'이천시','22':'안성시','23':'김포시','24':'화성시','25':'광주시','26':'양주시','27':'포천시','28':'여주시','29':'연천군','30':'가평군','31':'양평군' },
  '32':{ '1':'춘천시','2':'원주시','3':'강릉시','4':'동해시','5':'태백시','6':'속초시','7':'삼척시','8':'홍천군','9':'횡성군','10':'영월군','11':'평창군','12':'정선군','13':'철원군','14':'화천군','15':'양구군','16':'인제군','17':'고성군','18':'양양군' },
  '33':{ '1':'청주시','2':'충주시','3':'제천시','4':'보은군','5':'옥천군','6':'영동군','7':'증평군','8':'진천군','9':'괴산군','10':'음성군','11':'단양군' },
  '34':{ '1':'천안시','2':'공주시','3':'보령시','4':'아산시','5':'서산시','6':'논산시','7':'계룡시','8':'당진시','9':'금산군','10':'부여군','11':'서천군','12':'청양군','13':'홍성군','14':'예산군','15':'태안군' },
  '35':{ '1':'전주시','2':'군산시','3':'익산시','4':'정읍시','5':'남원시','6':'김제시','7':'완주군','8':'진안군','9':'무주군','10':'장수군','11':'임실군','12':'순창군','13':'고창군','14':'부안군' },
  '36':{ '1':'목포시','2':'여수시','3':'순천시','4':'나주시','5':'광양시','6':'담양군','7':'곡성군','8':'구례군','9':'고흥군','10':'보성군','11':'화순군','12':'장흥군','13':'강진군','14':'해남군','15':'영암군','16':'무안군','17':'함평군','18':'영광군','19':'장성군','20':'완도군','21':'진도군','22':'신안군' },
  '37':{ '1':'포항시','2':'경주시','3':'김천시','4':'안동시','5':'구미시','6':'영주시','7':'영천시','8':'상주시','9':'문경시','10':'경산시','11':'군위군','12':'의성군','13':'청송군','14':'영양군','15':'영덕군','16':'청도군','17':'고령군','18':'성주군','19':'칠곡군','20':'예천군','21':'봉화군','22':'울진군','23':'울릉군' },
  '38':{ '1':'창원시','2':'진주시','3':'통영시','4':'사천시','5':'김해시','6':'밀양시','7':'거제시','8':'양산시','9':'의령군','10':'함안군','11':'창녕군','12':'고성군','13':'남해군','14':'하동군','15':'산청군','16':'함양군','17':'거창군','18':'합천군' },
  '39':{ '1':'제주시','2':'서귀포시' },
};

// ─────────────────────────────────────────
// TourAPI 호출은 Vercel Edge Function 프록시 경유
// (서비스 키는 서버 환경변수, 브라우저에 노출 X)
// ─────────────────────────────────────────
const _TOUR_PROXY = '/api/tour';

/** TourAPI 호출 래퍼.
 *  @param {string} path  엔드포인트 (예: 'areaBasedList2')
 *  @param {object} params  쿼리 파라미터
 *  @returns {Promise<object|null>}  실패 시 null
 */
async function _callTourApi(path, params = {}) {
  const qs = new URLSearchParams({ path, ...params });
  try {
    const res = await fetch(`${_TOUR_PROXY}?${qs}`);
    if (!res.ok) {
      console.warn('[TourAPI]', path, 'HTTP', res.status);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.warn('[TourAPI]', path, e.message);
    return null;
  }
}

// (Legacy) 더 이상 호출되지 않지만, 외부 코드 호환을 위해 빈 함수만 남김
function saveTourApiKey() { /* deprecated */ }
function getTourApiKey()  { return ''; /* deprecated */ }

// 결과 섹션 헬퍼
function domShow(id)  { document.getElementById(id)?.classList.remove('hidden'); }
function domHide(id)  { document.getElementById(id)?.classList.add('hidden'); }

// 국내여행 페이지네이션 + 필터 상태
const _dom = {
  areaCode: '', sigunguCode: '', contentTypeId: '', keyword: '',
  pageNo: 1, numOfRows: 20,
  totalCount: 0, loaded: 0,
  loading: false,
};

// 주차 필터 상태
const _parkingCache = new Map();
let _parkingActive = false;

/* ─ 구/군 드롭다운 업데이트 ─ */
function updateSigunguOptions(selectId, areaCode) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const sigs = SIGUNGU_MAP[areaCode] || {};
  const opts = Object.entries(sigs).map(([k,v]) => `<option value="${k}">${v}</option>`).join('');
  sel.innerHTML = '<option value="">전체 구/군</option>' + opts;
}

/* ─ 필터바 → 타이틀 텍스트 생성 ─ */
function _buildTitle() {
  const area  = AREA_MAP[_dom.areaCode] || '전국';
  const sig   = _dom.sigunguCode ? (SIGUNGU_MAP[_dom.areaCode]?.[_dom.sigunguCode] || '') : '';
  const ctype = CTYPE_MAP[_dom.contentTypeId] || '전체';
  const kw    = _dom.keyword ? ` "${_dom.keyword}"` : '';
  return `${area}${sig ? ' '+sig : ''} ${ctype}${kw}`;
}

/* ─ 위젯 값을 필터바에 동기화 ─ */
function _syncFilterBar() {
  const s = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  s('dfArea', _dom.areaCode);
  updateSigunguOptions('dfSigungu', _dom.areaCode);
  s('dfSigungu', _dom.sigunguCode);
  s('dfCtype', _dom.contentTypeId);
  const kw = document.getElementById('dfKeyword');
  if (kw) kw.value = _dom.keyword || '';
}

/* ─ 히어로 위젯에서 검색 버튼 클릭 ─ */
async function searchDomestic() {
  _dom.areaCode      = document.getElementById('sw-area')?.value     || '';
  _dom.sigunguCode   = document.getElementById('sw-sigungu')?.value  || '';
  _dom.contentTypeId = document.getElementById('sw-ctype')?.value    || '';
  _dom.keyword       = document.getElementById('sw-keyword')?.value?.trim() || '';
  _dom.pageNo        = 1;
  _dom.totalCount    = 0;
  _dom.loaded        = 0;

  _syncFilterBar();
  _resetParkingFilter();

  const section = document.getElementById('domesticSection');
  const grid    = document.getElementById('domesticGrid');
  const title   = document.getElementById('domesticTitle');

  section?.classList.remove('hidden');
  document.getElementById('domFilterBar')?.classList.remove('hidden');
  section?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  grid.innerHTML = '';
  domHide('domesticMoreWrap');
  const _mb1 = document.getElementById('domesticMoreBtn');
  if (_mb1) _mb1.style.display = '';
  domShow('domesticLoading');
  domHide('domesticError');
  title.textContent = _buildTitle();

  await _fetchDomesticPage(false);
}

/* ─ 필터바에서 지역(시도) 변경 ─ */
function onDomAreaChange() {
  updateSigunguOptions('dfSigungu', document.getElementById('dfArea')?.value || '');
  onDomFilterChange();
}

/* ─ 필터바 값 변경 → API 재검색 ─ */
function onDomFilterChange() {
  _dom.areaCode      = document.getElementById('dfArea')?.value    || '';
  _dom.sigunguCode   = document.getElementById('dfSigungu')?.value || '';
  _dom.contentTypeId = document.getElementById('dfCtype')?.value   || '';
  _dom.keyword       = document.getElementById('dfKeyword')?.value?.trim() || '';
  _dom.pageNo        = 1;
  _dom.totalCount    = 0;
  _dom.loaded        = 0;
  _resetParkingFilter();

  const grid = document.getElementById('domesticGrid');
  if (grid) grid.innerHTML = '';
  domHide('domesticMoreWrap');
  const _mb2 = document.getElementById('domesticMoreBtn');
  if (_mb2) _mb2.style.display = '';
  domShow('domesticLoading');
  domHide('domesticError');
  const title = document.getElementById('domesticTitle');
  if (title) title.textContent = _buildTitle();

  _fetchDomesticPage(false);
}

/* ─ 키워드 입력 (디바운스 400ms) ─ */
let _kwTimer = null;
function onDomKeywordInput() {
  clearTimeout(_kwTimer);
  _kwTimer = setTimeout(onDomFilterChange, 400);
}

/* ─ 주차 필터 토글 ─ */
async function onDomParkingToggle() {
  _parkingActive = !_parkingActive;
  document.getElementById('dfParkingBtn')?.classList.toggle('active', _parkingActive);
  if (_parkingActive) {
    await _batchFetchParking();
  }
  _applyParkingFilter();
}

function _resetParkingFilter() {
  _parkingActive = false;
  document.getElementById('dfParkingBtn')?.classList.remove('active');
}

/* ─ 주차 데이터 일괄 조회 ─ */
async function _batchFetchParking() {
  const btn    = document.getElementById('dfParkingBtn');

  const toFetch = [...document.querySelectorAll('#domesticGrid .dom-card[data-cid]')]
    .map(c => c.dataset.cid)
    .filter(cid => !_parkingCache.has(cid));

  if (!toFetch.length) return;

  if (btn) { btn.textContent = '🅿 조회 중…'; btn.disabled = true; }
  try {
    await Promise.all(toFetch.map(async cid => {
      const cached = _tourItemCache.get(cid);
      const ctid   = cached?.contenttypeid || '12';
      const data   = await _callTourApi('detailIntro2', { contentId: cid, contentTypeId: ctid });
      const raw    = data?.response?.body?.items?.item;
      const intro  = Array.isArray(raw) ? raw[0] : raw;
      _parkingCache.set(cid, _hasParkingFromIntro(intro));
    }));
  } finally {
    if (btn) {
      btn.textContent = '🅿 주차 가능';
      btn.disabled    = false;
      btn.classList.toggle('active', _parkingActive);
    }
  }
}

function _hasParkingFromIntro(intro) {
  if (!intro) return null;
  const fields = ['parking','parking14','parking28','parking30','parkingfood','parkingsports'];
  for (const f of fields) {
    const v = String(intro[f] || '').trim();
    if (v && !v.includes('없') && !v.includes('불가') && !v.includes('안됨')) return true;
  }
  return false;
}

function _applyParkingFilter() {
  document.querySelectorAll('#domesticGrid .dom-card[data-cid]').forEach(card => {
    if (!_parkingActive) { card.style.display = ''; return; }
    const v = _parkingCache.get(card.dataset.cid);
    card.style.display = (v === false) ? 'none' : '';
  });
}

/* ─ 이미지 로드 실패 처리 ─ */
function domImgError(img) {
  const thumb = img.closest('.dom-thumb');
  if (!thumb) return;
  const cid   = img.closest('.dom-card')?.dataset.cid;
  const item  = cid ? _tourItemCache.get(cid) : null;
  const icon  = CTYPE_ICON[item?.contenttypeid] || '🗺';
  const name  = item?.title || '';
  thumb.classList.add('dom-thumb--empty');
  thumb.innerHTML = `<span class="dom-nimg-icon">${icon}</span><span class="dom-nimg-name">${name}</span>`;
}

async function loadMoreDomestic() {
  if (_dom.loading) return;
  _dom.pageNo++;
  await _fetchDomesticPage(true);
}

async function _fetchDomesticPage(append) {
  _dom.loading = true;
  const btn = document.getElementById('domesticMoreBtn');
  if (btn) btn.disabled = true;
  if (append) domShow('domesticLoading');

  try {
    const base = { numOfRows: _dom.numOfRows, pageNo: _dom.pageNo };

    // 특수 카테고리(카페 등) 처리
    const special      = SPECIAL_CTYPE[_dom.contentTypeId];
    const ctypeId      = special ? special.contentTypeId : _dom.contentTypeId;
    const cat3Override = special ? special.cat3 : '';

    let endpoint, params;
    if (_dom.keyword) {
      endpoint = 'searchKeyword2';
      params   = { ...base, keyword: _dom.keyword };
      if (_dom.areaCode) params.areaCode      = _dom.areaCode;
      if (ctypeId)       params.contentTypeId = ctypeId;
      if (cat3Override)  params.cat3          = cat3Override;
    } else {
      endpoint = 'areaBasedList2';
      params   = { ...base, arrange: 'A' };
      if (_dom.areaCode)    params.areaCode      = _dom.areaCode;
      if (_dom.sigunguCode) params.sigunguCode   = _dom.sigunguCode;
      if (ctypeId)          params.contentTypeId = ctypeId;
      if (cat3Override)     params.cat3          = cat3Override;
    }

    const data = await _callTourApi(endpoint, params);
    if (!data) throw new Error('관광 데이터 서비스에 일시적으로 연결할 수 없습니다.');

    const resultCode = data?.response?.header?.resultCode;
    if (resultCode && resultCode !== '0000')
      throw new Error(data?.response?.header?.resultMsg || '알 수 없는 오류');

    const body  = data?.response?.body;
    const raw   = body?.items?.item;
    const items = raw ? (Array.isArray(raw) ? raw : [raw]) : [];

    _dom.totalCount = Number(body?.totalCount ?? 0);
    _dom.loaded    += items.length;

    domHide('domesticLoading');

    if (!items.length && !append) {
      domShow('domesticError');
      document.getElementById('domesticErrorMsg').textContent = '검색 결과가 없습니다.';
      return;
    }

    renderDomestic(items, append);
    _updateDomMoreBtn();

  } catch (err) {
    domHide('domesticLoading');
    if (!append) {
      domShow('domesticError');
      document.getElementById('domesticErrorMsg').innerHTML =
        `<strong>일시적인 문제가 발생했어요.</strong><br>` +
        `<small>${err.message}<br>한국관광공사 API 응답이 늦거나 점검 중일 수 있습니다.</small><br>` +
        `<button class="retry-btn" onclick="domHide('domesticError');_fetchDomesticPage(false)">🔄 다시 시도</button>`;
    }
  } finally {
    _dom.loading = false;
    if (btn) btn.disabled = false;
  }
}

function _updateDomMoreBtn() {
  const wrap  = document.getElementById('domesticMoreWrap');
  const count = document.getElementById('domesticCount');
  const label = document.getElementById('domesticMoreLabel');
  if (!wrap) return;

  const remain = _dom.totalCount - _dom.loaded;
  count.textContent = `${_dom.loaded.toLocaleString()} / 전체 ${_dom.totalCount.toLocaleString()}개`;

  const moreBtn = document.getElementById('domesticMoreBtn');
  if (remain > 0) {
    label.textContent = `(${Math.min(remain, _dom.numOfRows)}개 더)`;
    if (moreBtn) moreBtn.style.display = '';
    wrap.classList.remove('hidden');
  } else {
    // 전체 로드 완료 — 버튼 숨기고 카운트만 표시
    label.textContent = '';
    if (moreBtn) moreBtn.style.display = 'none';
    if (_dom.totalCount > 0) wrap.classList.remove('hidden');
  }
}

const _tourItemCache = new Map();

/* ═══════════════════════════════════════════
   관광지·맛집 찜 (localStorage)
   ═══════════════════════════════════════════ */
const _SAVED_KEY = 'tripguide_saved_places';
function getSavedPlaces() {
  try { return JSON.parse(localStorage.getItem(_SAVED_KEY) || '[]'); }
  catch { return []; }
}
function isSaved(cid) {
  return getSavedPlaces().some(p => p.contentid === cid);
}
function toggleSavePlace(cid, e) {
  if (e) { e.stopPropagation(); }
  const item = _tourItemCache.get(cid);
  let saved = getSavedPlaces();
  if (saved.some(p => p.contentid === cid)) {
    saved = saved.filter(p => p.contentid !== cid);
  } else if (item) {
    // 재방문 시 복원에 필요한 최소 필드만 저장
    saved.unshift({
      contentid: item.contentid, contenttypeid: item.contenttypeid,
      title: item.title, addr1: item.addr1 || '', tel: item.tel || '',
      firstimage: item.firstimage || '', mapx: item.mapx || '', mapy: item.mapy || '',
    });
    saved = saved.slice(0, 100);
  }
  localStorage.setItem(_SAVED_KEY, JSON.stringify(saved));
  _syncSaveButtons(cid);
  _renderSavedPlaces();
}
// 화면의 해당 cid 하트 버튼 상태 동기화 (카드 하트 + 모달 텍스트 버튼)
function _syncSaveButtons(cid) {
  const on = isSaved(cid);
  document.querySelectorAll(`.save-btn[data-cid="${cid}"]`).forEach(b => {
    b.classList.toggle('active', on);
    if (b.classList.contains('tmd-save-btn')) {
      b.textContent = on ? '♥ 찜 저장됨' : '♡ 찜하기';
    } else {
      b.textContent = on ? '♥' : '♡';
      b.title = on ? '찜 해제' : '찜하기';
    }
  });
}
function _renderSavedPlaces() {
  const sec  = document.getElementById('savedSection');
  const grid = document.getElementById('savedGrid');
  const cnt  = document.getElementById('savedCount');
  if (!sec || !grid) return;
  const saved = getSavedPlaces();
  if (!saved.length) { sec.classList.add('hidden'); return; }
  sec.classList.remove('hidden');
  if (cnt) cnt.textContent = `${saved.length}곳`;
  grid.innerHTML = saved.map(item => {
    _tourItemCache.set(item.contentid, item);
    const icon  = CTYPE_ICON[item.contenttypeid] || '🗺';
    const thumb = item.firstimage
      ? `<div class="dom-thumb"><img src="${safeUrl(item.firstimage)}" alt="${esc(item.title)}" loading="lazy" onerror="domImgError(this)"></div>`
      : `<div class="dom-thumb dom-thumb--empty"><span class="dom-nimg-icon">${icon}</span><span class="dom-nimg-name">${esc(item.title)}</span></div>`;
    return `
    <div class="dom-card dom-card--link" data-cid="${esc(item.contentid)}">
      ${thumb}
      <button class="save-btn active" data-cid="${esc(item.contentid)}" onclick="toggleSavePlace(this.dataset.cid,event)" title="찜 해제">♥</button>
      <div class="dom-body">
        <span class="dom-ctype-tag">${icon} ${CTYPE_MAP[item.contenttypeid]||''}</span>
        <h3>${esc(item.title)}</h3>
        ${item.addr1 ? `<p class="dom-addr">📍 ${esc(item.addr1)}</p>` : ''}
        <p class="dom-more">상세보기 →</p>
      </div>
    </div>`;
  }).join('');
  grid.querySelectorAll('.dom-card--link').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.classList.contains('save-btn')) return;
      const it = _tourItemCache.get(card.dataset.cid);
      if (it) openTourDetail(it.contentid, it.contenttypeid, it.mapx, it.mapy);
    });
  });
}

function renderDomestic(items, append = false) {
  const grid = document.getElementById('domesticGrid');
  items.forEach(it => _tourItemCache.set(it.contentid, it));

  const html = items.map(item => {
    const icon  = CTYPE_ICON[item.contenttypeid] || '🗺';
    const thumb = item.firstimage
      ? `<div class="dom-thumb"><img src="${safeUrl(item.firstimage)}" alt="${esc(item.title)}" loading="lazy" onerror="domImgError(this)"></div>`
      : `<div class="dom-thumb dom-thumb--empty"><span class="dom-nimg-icon">${icon}</span><span class="dom-nimg-name">${esc(item.title)}</span></div>`;
    const sv = isSaved(item.contentid);
    return `
    <div class="dom-card dom-card--link" data-cid="${esc(item.contentid)}">
      ${thumb}
      <button class="save-btn${sv?' active':''}" data-cid="${esc(item.contentid)}" onclick="toggleSavePlace(this.dataset.cid,event)" title="${sv?'찜 해제':'찜하기'}">${sv?'♥':'♡'}</button>
      <div class="dom-body">
        <span class="dom-ctype-tag">${icon} ${CTYPE_MAP[item.contenttypeid]||''}</span>
        <h3>${esc(item.title)}</h3>
        ${item.addr1 ? `<p class="dom-addr">📍 ${esc(item.addr1)}</p>` : ''}
        ${item.tel   ? `<p class="dom-tel">📞 ${item.tel}</p>`    : ''}
        <p class="dom-more">상세보기 →</p>
      </div>
    </div>`;
  }).join('');

  if (append) {
    grid.insertAdjacentHTML('beforeend', html);
  } else {
    grid.innerHTML = html;
  }

  // 새로 추가된 카드에만 이벤트 등록
  grid.querySelectorAll('.dom-card--link:not([data-bound])').forEach(card => {
    card.dataset.bound = '1';
    card.addEventListener('click', e => {
      if (e.target.classList.contains('save-btn')) return;
      const it = _tourItemCache.get(card.dataset.cid);
      if (it) openTourDetail(it.contentid, it.contenttypeid, it.mapx, it.mapy);
    });
  });

  // 주차 필터 활성화 상태면 새 카드에도 적용
  if (_parkingActive) _applyParkingFilter();
}

/* ═══════════════════════════════════════════
   TourAPI 상세 팝업
   ═══════════════════════════════════════════ */

async function openTourDetail(contentId, contentTypeId, mapX, mapY) {
  const overlay = document.getElementById('tourModalOverlay');
  const body    = document.getElementById('tourModalBody');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  body.innerHTML = `<div class="tmd-loading"><div class="dom-spinner"></div><p>상세 정보를 불러오는 중...</p></div>`;

  // 리스트 캐시에서 기본 정보 미리 확보 (detailCommon2 실패 시 폴백)
  const cached = _tourItemCache.get(contentId);
  const fallbackMapX = mapX || cached?.mapx || '';
  const fallbackMapY = mapY || cached?.mapy || '';

  try {
    const [cRes, iRes, imgRes, nbRes] = await Promise.all([
      _callTourApi('detailCommon2', { contentId, defaultYN:'Y', firstImageYN:'Y', addrinfoYN:'Y', overviewYN:'Y', mapinfoYN:'Y' }),
      _callTourApi('detailIntro2',  { contentId, contentTypeId }),
      _callTourApi('detailImage2',  { contentId, imageYN:'Y', subImageYN:'Y' }),
      (fallbackMapX && fallbackMapY)
        ? _callTourApi('locationBasedList2', { mapX: fallbackMapX, mapY: fallbackMapY, radius:5000, numOfRows:6, pageNo:1, arrange:'E' })
        : Promise.resolve(null),
    ]);

    const detail = _extractItem(cRes);
    const intro  = _extractItem(iRes);
    const imgArr = _extractItems(imgRes);
    const nbArr  = _extractItems(nbRes).filter(n => n.contentid !== contentId).slice(0, 5);

    // 주변 관광지도 캐시에 저장 (드릴다운 클릭 시 폴백 데이터로 사용)
    nbArr.forEach(n => _tourItemCache.set(n.contentid, n));

    _renderTourModal({ detail, intro, imgArr, nbArr, cached });
  } catch (err) {
    body.innerHTML = `<div class="tmd-err">⚠️ 오류: ${err.message}</div>`;
  }
}

function _extractItem(res)  { const r = res?.response?.body?.items?.item; return Array.isArray(r) ? r[0] : (r || null); }
function _extractItems(res) { const r = res?.response?.body?.items?.item; return r ? (Array.isArray(r) ? r : [r]) : []; }

function _extractIntroFields(intro) {
  if (!intro) return [];
  const rows = [];
  const add = (label, ...keys) => {
    const val = keys.map(k => intro[k]).find(v => v && String(v).trim());
    if (val) rows.push([label, String(val).trim()]);
  };
  add('문의처',    'infocenter','infocenter12','infocenter14','infocenter28','infocenterlodging','infocenterfood','infocenterculture','infocentersports');
  add('이용시간',  'usetime','usetime14','usetime28','usetimefestival','opentimefood','checkintime');
  add('쉬는 날',   'restdate','restdate12','restdate14','restdate28','restdatefood','restdatesports');
  add('주차',      'parking','parking14','parking28','parking30','parkingfood','parkingsports');
  add('입장료',    'usefee','usefee14','usefee28','admission','usefeeculture');
  add('유모차',    'chkbabycarriage','chkbabycarriageculture');
  add('반려동물',  'chkpet','chkpetculture');
  add('체크인',    'checkintime');
  add('체크아웃',  'checkouttime');
  add('객실 수',   'roomcount');
  add('부대시설',  'subfacility');
  add('대표 메뉴', 'firstmenu','menu');
  add('행사 장소', 'eventplace');
  if (intro.eventstartdate && intro.eventenddate)
    rows.push(['행사 기간', `${intro.eventstartdate} ~ ${intro.eventenddate}`]);
  else if (intro.eventstartdate)
    rows.push(['행사 기간', intro.eventstartdate]);
  return rows;
}

function _renderTourModal({ detail, intro, imgArr, nbArr, cached }) {
  const body = document.getElementById('tourModalBody');

  // detailCommon2 실패 시 캐시 데이터로 폴백
  const title    = detail?.title    || cached?.title    || '';
  const addr     = [detail?.addr1   || cached?.addr1, detail?.addr2].filter(Boolean).join(' ');
  const tel      = detail?.tel      || cached?.tel      || '';
  const overview = detail?.overview ? detail.overview.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim() : '';
  const heroImg  = detail?.firstimage || detail?.firstimage2 || cached?.firstimage || '';
  const mx = detail?.mapx || cached?.mapx || '';
  const my = detail?.mapy || cached?.mapy || '';
  const fields = _extractIntroFields(intro);

  const kakaoUrl = (mx && my) ? `https://map.kakao.com/link/map/${encodeURIComponent(title)},${my},${mx}` : '';
  const naverUrl = (mx && my) ? `https://map.naver.com/v5/search/${encodeURIComponent(title)}` : '';

  let html = `<div class="tmd-inner">`;

  if (heroImg) html += `<div class="tmd-hero"><img src="${safeUrl(heroImg)}" alt="${esc(title)}"></div>`;
  html += `<div class="tmd-content">`;

  // 제목·주소·연락처 + 찜 버튼
  const _cid   = detail?.contentid || cached?.contentid || '';
  const _svOn  = _cid && isSaved(_cid);
  html += `<div class="tmd-head">
    <h2 class="tmd-name">${esc(title)}</h2>
    ${addr ? `<p class="tmd-addr">📍 ${esc(addr)}</p>` : ''}
    ${tel  ? `<p class="tmd-tel">📞 ${esc(tel)}</p>`   : ''}
    ${_cid ? `<button class="tmd-save-btn save-btn${_svOn?' active':''}" data-cid="${esc(_cid)}" onclick="toggleSavePlace(this.dataset.cid,event)">${_svOn?'♥ 찜 저장됨':'♡ 찜하기'}</button>` : ''}
  </div>`;

  // 지도 버튼
  if (mx && my) {
    html += `<div class="tmd-map-row">
      <a href="${safeUrl(kakaoUrl)}" target="_blank" rel="noopener" class="tmd-mapbtn tmd-mapbtn--kakao">🗺 카카오맵</a>
      <a href="${safeUrl(naverUrl)}" target="_blank" rel="noopener" class="tmd-mapbtn tmd-mapbtn--naver">🗺 네이버지도</a>
    </div>`;
  }

  // 개요
  html += `<div class="tmd-section">
    <h3 class="tmd-sec-title">📝 개요</h3>
    ${overview
      ? `<p class="tmd-overview">${safeText(overview)}</p>`
      : `<p class="tmd-empty">등록된 설명이 없습니다.</p>`}
  </div>`;

  // 이용 정보
  if (fields.length) {
    html += `<div class="tmd-section">
      <h3 class="tmd-sec-title">ℹ️ 이용 정보</h3>
      <table class="tmd-table">
        ${fields.map(([l,v]) => `<tr><th>${l}</th><td>${v}</td></tr>`).join('')}
      </table>
    </div>`;
  }

  // 상세 이미지
  html += `<div class="tmd-section">
    <h3 class="tmd-sec-title">🖼 상세 이미지</h3>
    ${imgArr.length
      ? `<div class="tmd-imgstrip">
          ${imgArr.map(img => `<div class="tmd-imgitem"><img src="${safeUrl(img.originimgurl || img.smallimageurl)}" alt="${esc(img.imgname || title)}" loading="lazy"></div>`).join('')}
        </div>`
      : `<p class="tmd-empty">등록된 이미지가 없습니다.</p>`}
  </div>`;

  // 주변 관광지
  if (nbArr.length) {
    html += `<div class="tmd-section">
      <h3 class="tmd-sec-title">📍 주변 관광지</h3>
      <div class="tmd-nearby">
        ${nbArr.map(n => `
          <div class="tmd-nb-card" data-cid="${esc(n.contentid)}" data-ctid="${esc(n.contenttypeid)}" data-mx="${esc(n.mapx)}" data-my="${esc(n.mapy)}">
            ${n.firstimage ? `<img src="${safeUrl(n.firstimage)}" alt="${esc(n.title)}" loading="lazy">` : `<div class="tmd-nb-empty">🗺</div>`}
            <p>${esc(n.title)}</p>
            ${n.dist ? `<small>${Math.round(n.dist)}m</small>` : ''}
          </div>`).join('')}
      </div>
    </div>`;
  }

  html += `</div></div>`;
  body.innerHTML = html;

  // 주변 관광지 클릭 이벤트
  body.querySelectorAll('.tmd-nb-card').forEach(card => {
    card.addEventListener('click', () => openTourDetail(card.dataset.cid, card.dataset.ctid, card.dataset.mx, card.dataset.my));
  });
}

function closeTourModal() {
  document.getElementById('tourModalOverlay')?.classList.add('hidden');
  document.body.style.overflow = '';
}

/* ═══════════════════════════════════════════
   환율 정보 + 계산기
   ═══════════════════════════════════════════ */
let _fxRates     = null;
let _fxKrwPerUsd = 0;

/** 환율 계산기 — 입력한 금액·통화를 다른 5개 통화로 환산 */
function calcFx() {
  const amtEl  = document.getElementById('fxCalcAmount');
  const fromEl = document.getElementById('fxCalcFrom');
  const out    = document.getElementById('fxCalcResults');
  if (!amtEl || !out) return;
  const amt  = parseFloat(amtEl.value);
  const from = fromEl?.value || 'KRW';
  if (!_fxRates || !isFinite(amt) || amt <= 0) {
    out.innerHTML = '<span class="fx-calc-hint">금액을 입력하세요</span>';
    return;
  }
  // 모든 환율은 USD 기준 → 일단 amt를 USD로 환산 후 각 통화로
  const amtUsd = from === 'USD' ? amt
                 : from === 'KRW' ? amt / _fxKrwPerUsd
                 : amt / _fxRates[from];
  const TARGETS = [
    { code: 'KRW', sym: '₩', dec: 0 },
    { code: 'USD', sym: '$', dec: 2 },
    { code: 'JPY', sym: '¥', dec: 0 },
    { code: 'EUR', sym: '€', dec: 2 },
    { code: 'VND', sym: '₫', dec: 0 },
    { code: 'THB', sym: '฿', dec: 2 },
  ];
  out.innerHTML = TARGETS.filter(t => t.code !== from).map(t => {
    const rate = t.code === 'USD' ? 1 : _fxRates[t.code];
    const v    = amtUsd * rate;
    const fmt  = v.toLocaleString('ko-KR', { maximumFractionDigits: t.dec });
    return `<span class="fx-calc-item">${t.sym}<strong>${fmt}</strong></span>`;
  }).join('');
}

async function loadExchangeRates() {
  const el  = document.getElementById('fxRates');
  const upd = document.getElementById('fxUpdated');
  if (!el) return;

  const CURRENCIES = [
    { flag: '🇺🇸', code: 'USD', label: 'USD/KRW', unit: 1,     sym: '$1'      },
    { flag: '🇯🇵', code: 'JPY', label: 'JPY/KRW', unit: 100,   sym: '¥100'    },
    { flag: '🇪🇺', code: 'EUR', label: 'EUR/KRW', unit: 1,     sym: '€1'      },
    { flag: '🇻🇳', code: 'VND', label: 'VND/KRW', unit: 10000, sym: '₫10,000' },
    { flag: '🇹🇭', code: 'THB', label: 'THB/KRW', unit: 1,     sym: '฿1'      },
  ];

  try {
    const res  = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await res.json();
    if (data.result !== 'success') throw new Error();

    const r          = data.rates;
    const krwPerUsd  = r.KRW;
    _fxRates         = r;          // 계산기용 보관
    _fxKrwPerUsd     = krwPerUsd;
    calcFx();                       // 첫 계산 시도

    el.innerHTML = CURRENCIES.map(c => {
      const krw = Math.round((krwPerUsd / r[c.code]) * c.unit);
      return `<span class="fx-item">
        <span class="fx-flag">${c.flag}</span>
        <span class="fx-pair">${c.label}</span>
        <span class="fx-rate">${c.sym} = <strong>${krw.toLocaleString()}원</strong></span>
      </span>`;
    }).join('');

    if (upd) {
      const d = new Date(data.time_last_update_unix * 1000);
      upd.textContent = `${d.getMonth()+1}/${d.getDate()} 기준`;
    }
  } catch {
    el.innerHTML = '<span class="fx-skeleton">환율 정보를 불러올 수 없습니다</span> ' +
      '<button class="retry-btn" onclick="loadExchangeRates()">🔄 다시 시도</button>';
  }
}

/* ═══════════════════════════════════════════
   초기화
   ═══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initDayTabs();
  initHotelFilter();
  initDestNav();
  initDates();
  loadExchangeRates();
  _renderSavedPlaces();   // 찜한 장소 복원
  restorePrefs();         // 검색 위젯·계산기 마지막 값 복원

  // 모달 닫기 이벤트
  const _ov = document.getElementById('tourModalOverlay');
  if (_ov) {
    _ov.addEventListener('click', e => { if (e.target === _ov) closeTourModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeTourModal(); });
  }
});

// 페이드인 애니메이션
const _fadeStyle = document.createElement('style');
_fadeStyle.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;
document.head.appendChild(_fadeStyle);
