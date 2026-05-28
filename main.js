/* ─────────────────────────────────────────
   트립가이드 공통 스크립트
   ───────────────────────────────────────── */

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
  '28':'레포츠', '32':'숙박', '39':'음식점',
};

// API 키 저장/불러오기 (localStorage)
const _TOUR_KEY = '9ae1336587e873e0ff6a0524e0b0cc0333868f67f9fb4180c0be654fb7794615';

function saveTourApiKey(val) {
  const key = val.trim();
  if (key) localStorage.setItem('tripguide_tour_key', key);
}

function getTourApiKey() {
  const key = localStorage.getItem('tripguide_tour_key') || _TOUR_KEY;
  const el  = document.getElementById('sw-apikey');
  if (el) el.value = key; // 저장된 키 복원
  return key;
}

// 결과 섹션 헬퍼
function domShow(id)  { document.getElementById(id)?.classList.remove('hidden'); }
function domHide(id)  { document.getElementById(id)?.classList.add('hidden'); }

async function searchDomestic() {
  const areaCode      = document.getElementById('sw-area')?.value  || '39';
  const contentTypeId = document.getElementById('sw-ctype')?.value || '12';
  const apiKey        = getTourApiKey();

  const section = document.getElementById('domesticSection');
  const grid    = document.getElementById('domesticGrid');
  const title   = document.getElementById('domesticTitle');

  // 섹션 표시 후 스크롤
  section?.classList.remove('hidden');
  section?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // 상태 초기화
  grid.innerHTML = '';
  domShow('domesticLoading');
  domHide('domesticError');

  // 제목 업데이트
  title.textContent = `${AREA_MAP[areaCode] ?? '국내'} ${CTYPE_MAP[contentTypeId] ?? '여행'}`;

  // API 키 없음
  if (!apiKey) {
    domHide('domesticLoading');
    domShow('domesticError');
    document.getElementById('domesticErrorMsg').innerHTML =
      '한국관광공사 TourAPI 서비스 키가 필요합니다.<br>' +
      '➡ <a href="https://www.data.go.kr/data/15101578/openapi.do" target="_blank" rel="noopener">' +
      'data.go.kr에서 무료 발급</a> 후, 검색 위젯의 🔑 키 입력란에 붙여넣으세요.';
    return;
  }

  try {
    const params = new URLSearchParams({
      serviceKey:    apiKey,
      MobileOS:      'ETC',
      MobileApp:     'TripGuide',
      _type:         'json',
      areaCode,
      contentTypeId,
      numOfRows:     12,
      pageNo:        1,
      arrange:       'A',   // 제목순
    });

    const res  = await fetch(`https://apis.data.go.kr/B551011/KorService2/areaBasedList2?${params}`);
    const data = await res.json();

    // 에러 코드 체크
    const resultCode = data?.response?.header?.resultCode;
    if (resultCode && resultCode !== '0000') {
      throw new Error(data?.response?.header?.resultMsg || '알 수 없는 오류');
    }

    const raw   = data?.response?.body?.items?.item;
    const items = raw ? (Array.isArray(raw) ? raw : [raw]) : [];

    domHide('domesticLoading');

    if (!items.length) {
      domShow('domesticError');
      document.getElementById('domesticErrorMsg').textContent = '검색 결과가 없습니다.';
      return;
    }

    renderDomestic(items);
  } catch (err) {
    domHide('domesticLoading');
    domShow('domesticError');
    document.getElementById('domesticErrorMsg').innerHTML =
      `오류: ${err.message}<br><small>API 키를 확인하거나, 잠시 후 다시 시도해주세요.</small>`;
  }
}

function renderDomestic(items) {
  const grid = document.getElementById('domesticGrid');
  grid.innerHTML = items.map(item => `
    <div class="dom-card">
      ${item.firstimage
        ? `<div class="dom-thumb"><img src="${item.firstimage}" alt="${item.title}" loading="lazy"></div>`
        : `<div class="dom-thumb dom-thumb--empty">🗺</div>`}
      <div class="dom-body">
        <h3>${item.title}</h3>
        ${item.addr1 ? `<p class="dom-addr">📍 ${item.addr1}</p>` : ''}
        ${item.tel   ? `<p class="dom-tel">📞 ${item.tel}</p>`    : ''}
      </div>
    </div>
  `).join('');
}

/* ═══════════════════════════════════════════
   초기화
   ═══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initDayTabs();
  initHotelFilter();
  initDestNav();
  initDates();
  getTourApiKey(); // 저장된 키 복원
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
