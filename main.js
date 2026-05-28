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
  menuBtn.addEventListener('click', () => {
    nav.classList.toggle('open');
  });
  document.addEventListener('click', (e) => {
    if (!menuBtn.contains(e.target) && !nav.contains(e.target)) {
      nav.classList.remove('open');
    }
  });
}

// ── 목적지 필터 (홈 페이지) ──
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

  // 히어로 태그 클릭 시 #destinations로 스크롤
  const destSection = document.getElementById('destinations');
  if (destSection) {
    destSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ── 히어로 검색 ──
function doSearch() {
  const q = (document.getElementById('heroSearch')?.value || '').trim().toLowerCase();
  if (!q) return;

  const cards = document.querySelectorAll('.dest-card');
  const noResult = document.getElementById('noResult');
  let visible = 0;

  cards.forEach(card => {
    const name = card.dataset.name || '';
    const text = card.textContent.toLowerCase();
    const match = name.toLowerCase().includes(q) || text.includes(q);
    card.classList.toggle('hidden', !match);
    if (match) visible++;
  });

  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  const allBtn = document.querySelector('.filter-btn[data-cat="전체"]');
  if (allBtn) allBtn.classList.add('active');

  if (noResult) noResult.classList.toggle('hidden', visible > 0);

  document.getElementById('destinations')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Enter 키 검색 ──
document.getElementById('heroSearch')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doSearch();
});

// ── 여행지 상세 페이지: 일정 탭 ──
function initDayTabs() {
  const tabs = document.querySelectorAll('.day-tab');
  const contents = document.querySelectorAll('.day-content');
  if (!tabs.length) return;

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const day = tab.dataset.day;
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('day' + day)?.classList.add('active');
    });
  });
}

// ── 여행지 상세 페이지: 호텔 필터 ──
function initHotelFilter() {
  const btns = document.querySelectorAll('.hotel-filter-btn');
  if (!btns.length) return;

  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const cat = btn.dataset.filter;

      document.querySelectorAll('.hotel-card').forEach(card => {
        const match = cat === 'all' || card.dataset.cat === cat;
        card.classList.toggle('hidden', !match);
      });
    });
  });
}

// ── 여행지 상세 페이지: 섹션 내비 활성화 ──
function initDestNav() {
  const navLinks = document.querySelectorAll('.dest-nav a');
  if (!navLinks.length) return;

  const sections = Array.from(navLinks).map(a => {
    const id = a.getAttribute('href').replace('#', '');
    return document.getElementById(id);
  }).filter(Boolean);

  const observer = new IntersectionObserver((entries) => {
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

// ── 날짜 기본값: 오늘 + 3일 / + 6일 ──
function initDates() {
  const today = new Date();
  const fmt = d => d.toISOString().split('T')[0];

  const addDays = (d, n) => {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  };

  ['depDate', 'flightDep', 'dep'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = fmt(addDays(today, 14));
  });

  ['retDate', 'flightRet', 'ret'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = fmt(addDays(today, 17));
  });
}

// ── 항공권 검색 시뮬레이션 ──
const FLIGHTS = [
  { airline: '🟠 제주항공', dep: '08:30', arr: '10:15', dur: '1h 45m', price: '189,000', url: 'https://www.skyscanner.co.kr/routes/icn/kix/' },
  { airline: '🔵 티웨이항공', dep: '11:20', arr: '13:05', dur: '1h 45m', price: '205,000', url: 'https://www.skyscanner.co.kr/routes/icn/kix/' },
  { airline: '🟡 진에어', dep: '13:00', arr: '14:45', dur: '1h 45m', price: '215,000', url: 'https://www.skyscanner.co.kr/routes/icn/kix/' },
  { airline: '🔵 아시아나항공', dep: '09:00', arr: '10:45', dur: '1h 45m', price: '265,000', url: 'https://www.skyscanner.co.kr/routes/icn/kix/' },
  { airline: '🔴 대한항공', dep: '15:00', arr: '16:45', dur: '1h 45m', price: '310,000', url: 'https://www.skyscanner.co.kr/routes/icn/kix/' },
];

function searchFlights() {
  const tbody = document.getElementById('flightTbody');
  if (!tbody) return;

  tbody.querySelectorAll('tr').forEach(tr => tr.remove());

  FLIGHTS.forEach((f, i) => {
    const tr = document.createElement('tr');
    tr.style.animation = `fadeIn 0.2s ease ${i * 0.06}s both`;
    tr.innerHTML = `
      <td><span class="airline-badge">${f.airline}</span></td>
      <td>${f.dep} → ${f.arr}</td>
      <td>${f.dur}</td>
      <td><span class="price-cell">${f.price}원~</span></td>
      <td><a href="${f.url}" target="_blank" rel="noopener" class="book-btn">예약 보기</a></td>
    `;
    tbody.appendChild(tr);
  });
}

// ── 초기화 ──
document.addEventListener('DOMContentLoaded', () => {
  initDayTabs();
  initHotelFilter();
  initDestNav();
  initDates();
});

// 페이드인 애니메이션
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;
document.head.appendChild(style);
