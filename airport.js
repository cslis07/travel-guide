/* 인천공항 실시간 화면(airport.html) 스크립트 — 2026-11-17 airport.html 에서 분리.
   여러 파일로 더 나누지 않은 이유: 이 파일의 맨 아래쪽 초기 실행(새로고침·딥링크·언어)이 앞뒤 구역 함수를 함께 부르고,
   비동기 응답이 다음 파일이 받아지기 전에 도착하면 함수가 아직 없을 수 있어서 한 파일(동기 로드)로 둔다. */
// ════════════════════════════════
//  CORE
// ════════════════════════════════
async function api(path, params={}) {
  const p = new URLSearchParams({numOfRows:500, ...params});
  try {
    const r = await fetch(`/api/proxy?path=${encodeURIComponent(path)}&${p}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();   // await 가 없으면 JSON 이 아닌 응답(한도 초과 XML 등)의 오류가 catch 를 빠져나가 '조회 중'에서 멈췄다
  } catch(e) { console.warn('[API]', path, e.message); return null; }
}
/* 공항 데이터는 모두 한국 시간(KST). 해외에서 귀국편을 볼 때도 한국 기준으로 계산한다.
   kstDate(): getHours()·getDate() 등이 한국 시각을 돌려주는 Date(표시·비교용 — 실제 시각 계산엔 kstInstant) */
function kstDate(ms){ const t=ms==null?Date.now():ms; return new Date(t+(540+new Date(t).getTimezoneOffset())*60000); }
function kstInstant(y,mo,d,h,mi){ return new Date(Date.UTC(y,mo,d,h-9,mi)); }   // 한국 시각 → 실제 시각
function items(data) {
  const b = data?.response?.body;
  if (!b) return [];
  const i = b.items;
  if (!i) return [];
  if (Array.isArray(i)) return i;
  if (i.item !== undefined) return Array.isArray(i.item) ? i.item : [i.item];
  return [];
}
function el(id) { return document.getElementById(id); }
function html(id, h) { const e=el(id); if(e) e.innerHTML=h; }
function spin(id) { html(id,'<div class="loading">⏳ 로딩 중...</div>'); }
function err(id, msg) { html(id,`<div class="err">⚠ ${msg||'데이터를 불러올 수 없습니다'}</div>`); }

function fmtTime(s) {
  if (!s) return '';
  s = String(s).trim();
  if (s.length >= 12) return s.slice(8,10)+':'+s.slice(10,12);
  if (s.length === 4) return s.slice(0,2)+':'+s.slice(2,4);
  return s;
}

function badge(s) {
  s = (s||'').trim();
  const m = {'출발':'bb','도착':'bg','지연':'by','결항':'br','탑승중':'bo','게이트오픈':'bg',
    '수하물수취':'bb','입국장도착':'bg','운항취소':'br','예정':'bm'};
  const cls = m[s] || 'bb';
  return s ? `<span class="badge ${cls}">${s}</span>` : '';
}

function prClass(r) {
  r=parseFloat(r)||0;
  return r<60?'prg':r<80?'pry':r<95?'pro':'prr';
}
function prBar(r) {
  const cls = prClass(r);
  return `<div class="rate-bar"><div class="rate-fill ${cls}" style="width:${Math.min(r,100)}%"></div></div>`;
}

// State
let _tab='congestion', _entryDir='arr', _fltDir='dep', _fltCache=[];
let _fltTermView='all', _fltSec={P01:'all',P02:'all',P03:'all'};
let _transTab='shuttle', _shuttleMode='time', _arexData=[], _arexStnList=[], _arexSelIdx=0, _arexDir='to';
let _congTab='dep';
let _facTab='comm', _facCache=[], _airlineCache=[], _facFilters={term:'all',duty:'all',floor:'all'}, _facPage=1;
let _chartDay=0, _chartMode='all', _paxChart=null;

const WMO={0:'맑음',1:'대체로 맑음',2:'구름 많음',3:'흐림',45:'안개',51:'이슬비',61:'비',63:'비',65:'강한 비',71:'눈',73:'눈',80:'소나기',95:'뇌우'};
const STN={'010':'서울역','020':'공덕역','030':'홍대입구역','040':'디지털미디어시티역','050':'김포공항역','060':'계양역','070':'검암역','077':'청라국제도시역','080':'영종역','090':'공항화물청사역','100':'인천공항T1역','110':'인천공항T2역'};
const STOP={'10000140':'제1터미널','10000141':'제2터미널','10000142':'탑승동','10000143':'교통센터','10000144':'장기주차장'};
// 운항정보(StatusOfPassengerFlightsOdp)의 terminalId: P01=T1(탑승구 1~50) · P02=탑승동(101~132) · P03=T2(2xx)
// 2026-11-02 실데이터로 확인(대한항공·아시아나·델타=P03). 혼잡도 API의 P01/P02(T1/T2)와는 다른 체계다.
const TERM={P01:'T1',P02:'탑승동',P03:'T2'};

// ════════════════════════════════
//  THEME
// ════════════════════════════════
function toggleTheme() {
  const html = document.documentElement;
  const next = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  html.setAttribute('data-theme', next);
  localStorage.setItem('icn-theme', next);
  const btn = el('theme-toggle');
  if(btn) btn.textContent = next === 'light' ? '🌙 다크' : '☀ 라이트';
  loadPaxChart();
}

// ════════════════════════════════
//  CLOCK
// ════════════════════════════════
function tickClock() {
  const n=kstDate();
  const days=['일','월','화','수','목','금','토'];
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dayEn=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  html('hdr-time',new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'Asia/Seoul'}));
  html('hdr-date',`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')} (${dayEn[n.getDay()]})`);
  // update pax-date-lbl with korean date
  const paxLbl=el('pax-date-lbl');
  if(paxLbl&&_chartDay===0) paxLbl.textContent=`${n.getMonth()+1}월 ${n.getDate()}일 (${days[n.getDay()]}) 오늘`;
}
setInterval(tickClock,1000); tickClock();

// ════════════════════════════════
//  WEATHER
// ════════════════════════════════
let _wxRetry = 0;   // 날씨 조회가 실패하면 30초 뒤 한 번만 다시(10분 갱신을 기다리지 않게)
function wxRetry(){ if(_wxRetry++ < 1) setTimeout(loadWeather, 30000); }
async function loadWeather() {
  try {
    const wxUrl='https://api.open-meteo.com/v1/forecast?latitude=37.46&longitude=126.44&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m,precipitation&daily=temperature_2m_max,temperature_2m_min&timezone=Asia%2FSeoul';
    const aqUrl='https://air-quality-api.open-meteo.com/v1/air-quality?latitude=37.46&longitude=126.44&current=pm10,pm2_5&timezone=Asia%2FSeoul';
    // 값이 null 이면 '--'.toFixed 가 TypeError 를 내 날씨 카드 전체가 비던 문제 — 숫자일 때만 자릿수 맞춤
    const f=(v,n)=>typeof v==='number'?v.toFixed(n):'--';
    // 미세먼지는 따로 — 늦거나 실패해도 기온은 먼저 그린다(예전엔 둘을 함께 기다려 기온까지 비었다)
    fetch(`/api/proxy?_url=${encodeURIComponent(aqUrl)}`).then(r=>r.json()).then(aq=>{
      if(!aq || !aq.current) return;   // 실패면 보던 값 유지
      html('w-pm25',f(aq.current.pm2_5,0)+' μg');
      html('w-pm10',f(aq.current.pm10,0)+' μg');
    }).catch(()=>{});
    // 예보 주소(api.open-meteo.com)는 서버(서울 리전)에서 접속 시간 초과가 잦아(2026-11-17) 브라우저가 직접 받고, 안 될 때만 서버 경유
    const w=await fetch(wxUrl).then(r=>{ if(!r.ok) throw 0; return r.json(); })
      .catch(()=>fetch(`/api/proxy?_url=${encodeURIComponent(wxUrl)}`).then(r=>r.json()));
    if(!w || !w.current){ wxRetry(); return; }   // 실패 응답이면 보던 값 그대로 두고 다시 시도
    _wxRetry = 0;
    const c=w.current, d=w.daily;
    html('w-temp',f(c.temperature_2m,1)+'°C');
    html('w-desc',WMO[c.weather_code]||'--');
    html('w-hi',`${f(d?.temperature_2m_min?.[0],0)}° / ${f(d?.temperature_2m_max?.[0],0)}°`);
    html('w-wind',f(c.wind_speed_10m,1)+'m/s');
    html('w-hum',(c.relative_humidity_2m??'--')+'%');
    html('w-prec',c.precipitation>0?(c.precipitation.toFixed(1)+'mm'):'없음');
  } catch(e){ wxRetry(); }
}

// ════════════════════════════════
//  PASSENGER CHART
// ════════════════════════════════
function fmtD(d){return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`}

async function loadPaxChart() {
  try {
    // 내일 예측은 selectdate=1 로만 온다(오늘 응답에는 내일 행이 없어 '내일'이 늘 비어 있었다)
    const data=await api('passgrAnncmt/getPassgrAnncmt',_chartDay===0?{numOfRows:1000}:{numOfRows:1000,selectdate:1});
    if(data==null) return;   // 조회 실패 — 보던 숫자 유지
    const list=items(data);
    const dayStr=fmtD(kstDate(Date.now()+_chartDay*86400000));
    const dayLbl=_chartDay===0?'오늘':'내일';
    // 그날 행이 없으면(내일 예측은 아침엔 아직 안 나온다 — 2026-11-09 09시 실측) 0을 더해 '-' 만 보이던 것 → 공개 전 안내
    if(!list.some(r=>(r.adate||'')===dayStr)){
      if(_chartDay===0 && !list.length) return;
      ['ph-total','ph-t1','ph-t2'].forEach(id=>html(id,'-'));
      ['ph-t2-pk','hs-t1-pk','hs-t2-pk'].forEach(id=>html(id,''));
      html('ph-pk-lbl','공개 전');
      html('ph-t1-pk',dayLbl+' 예측이 아직 나오지 않았어요 · 조금 뒤 다시 보세요');
      const lb=el('pax-date-lbl'); if(lb) lb.textContent=dayLbl+' · 예측 공개 전';
      if(_paxChart){ _paxChart.destroy(); _paxChart=null; }
      return;
    }
    const t1h=new Array(24).fill(0), t2h=new Array(24).fill(0);
    list.forEach(r=>{
      if((r.adate||'')!==dayStr) return;
      const hr=parseInt((r.atime||'').split('_')[0]);
      if(isNaN(hr)||hr<0||hr>23) return;
      t1h[hr]=parseFloat(r.t1egsum1||0)+parseFloat(r.t1dgsum1||0);
      t2h[hr]=parseFloat(r.t2egsum1||0)+parseFloat(r.t2dgsum2||0);
    });
    const t1tot=t1h.reduce((a,b)=>a+b,0), t2tot=t2h.reduce((a,b)=>a+b,0);
    const t1pk=Math.max(...t1h), t2pk=Math.max(...t2h);
    const t1pkH=t1h.indexOf(t1pk), t2pkH=t2h.indexOf(t2pk);
    const tot=t1tot+t2tot;
    html('ph-total',tot>0?tot.toLocaleString():'-');
    html('ph-t1',t1tot>0?t1tot.toLocaleString():'-');
    html('ph-t2',t2tot>0?t2tot.toLocaleString():'-');
    html('ph-t1-pk',t1pk>0?`피크 ${t1pkH}시 ${t1pk.toLocaleString()}명`:'');
    html('ph-t2-pk',t2pk>0?`피크 ${t2pkH}시 ${t2pk.toLocaleString()}명`:'');
    html('ph-pk-lbl',t1pk>0?`${t1pkH}시 ${t1pk.toLocaleString()}`:'');
    html('hs-t1-pk',t1pk>0?`피크 ${t1pkH}시 · ${t1pk.toLocaleString()}명`:'');
    html('hs-t2-pk',t2pk>0?`피크 ${t2pkH}시 · ${t2pk.toLocaleString()}명`:'');
    // update date label
    const n=kstDate(); const days=['일','월','화','수','목','금','토'];
    const paxLbl=el('pax-date-lbl');
    if(paxLbl) paxLbl.textContent=_chartDay===0?`${n.getMonth()+1}월 ${n.getDate()}일 (${days[n.getDay()]}) 오늘`:'내일';
    // 차트 캔버스가 화면에 표시될 때만 렌더 (모바일은 CSS로 숨김 → 라이브러리 로드 생략)
    const canvas=el('paxChart');
    if(!canvas || canvas.offsetParent===null) return;  // 숨김 상태면 차트 스킵
    await window._loadChartJs();                        // Chart.js 지연 로드
    const nowH=kstDate().getHours();
    const labels=Array.from({length:24},(_,i)=>i+'시');
    const datasets=[];
    if(_chartMode!=='T2') datasets.push({label:'T1',data:t1h,borderColor:'#00c8ff',backgroundColor:'rgba(0,200,255,.08)',borderWidth:2,tension:.4,fill:true,pointRadius:t1h.map((_,i)=>i===t1pkH?4:i===nowH?3:0),pointBackgroundColor:'#00c8ff'});
    if(_chartMode!=='T1') datasets.push({label:'T2',data:t2h,borderColor:'#f97316',backgroundColor:'rgba(249,115,22,.07)',borderWidth:2,tension:.4,fill:true,pointRadius:t2h.map((_,i)=>i===t2pkH?4:i===nowH?3:0),pointBackgroundColor:'#f97316'});
    const ctx=canvas.getContext('2d');
    if(_paxChart) _paxChart.destroy();
    const isLight=document.documentElement.getAttribute('data-theme')==='light';
    const gc=isLight?'rgba(0,0,0,.07)':'rgba(255,255,255,.06)';
    const tc=isLight?'#8090b0':'#4a6080';
    _paxChart=new Chart(ctx,{type:'line',data:{labels,datasets},options:{
      responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
      plugins:{legend:{display:false},tooltip:{
        backgroundColor:isLight?'#fff':'#0d1628',
        borderColor:isLight?'#ccd5e8':'#1f2d48',borderWidth:1,
        titleColor:isLight?'#0d1421':'#d0dbf5',bodyColor:isLight?'#677296':'#8aa4c6',
        padding:8,cornerRadius:8,
        callbacks:{label:c=>`${c.dataset.label}: ${c.parsed.y.toLocaleString()}명`}
      }},
      scales:{
        x:{grid:{color:gc},ticks:{color:tc,font:{size:9}},border:{color:'transparent'}},
        y:{grid:{color:gc},ticks:{color:tc,font:{size:9},callback:v=>v>0?(v/1000).toFixed(0)+'K':'0'},border:{color:'transparent'}}
      }
    }});
  } catch(e){}
}
function shiftDay(d){_chartDay=Math.max(0,Math.min(1,_chartDay+d));loadPaxChart();}
function setChartT(m,btn){_chartMode=m;document.querySelectorAll('.ct-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');loadPaxChart();}

// ════════════════════════════════
//  NOTICE
// ════════════════════════════════
async function loadNotice() {
  try {
    const data=await api('passgrAnncmt/getPassgrAnncmt',{numOfRows:1000});   // 시간대 24줄 + 합계 1줄 — 5줄만 받으면 0~5시만 더해졌다(차트와 같은 요청이라 CDN 캐시 공유)
    const list=items(data);
    const fmtN=d=>`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
    const today=fmtN(kstDate());
    const todayItems=list.filter(r=>r.adate===today);
    const t1tot=todayItems.reduce((a,r)=>a+parseFloat(r.t1egsum1||0)+parseFloat(r.t1dgsum1||0),0);
    const t2tot=todayItems.reduce((a,r)=>a+parseFloat(r.t2egsum1||0)+parseFloat(r.t2dgsum2||0),0);
    if(t1tot+t2tot>0) html('notice-text',`오늘 예상 여객 — T1: ${Math.round(t1tot).toLocaleString()}명 · T2: ${Math.round(t2tot).toLocaleString()}명 · 인천국제공항 실시간 정보 서비스`);
  } catch(e){}
}

// ════════════════════════════════
//  TAB ROUTING
// ════════════════════════════════
function showTab(tab, btn) {
  _tab=tab;
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  el('tab-'+tab)?.classList.add('active');
  if(btn) btn.classList.add('active');
  loadTab(tab);
}
function loadTab(tab) {
  if(tab==='entry')      loadEntry();
  if(tab==='parking')    { loadParking(); loadParkSpots(); }
  if(tab==='transport')  loadTransTab();
  if(tab==='congestion') loadCong();
  if(tab==='flights')    loadFlights();
  if(tab==='facilities') loadFacTab();
  if(tab==='fav')        loadFavFlights();
  if(tab==='prep')       loadPrepTab();
}

// ════════════════════════════════
//  ① 진출입 현황
// ════════════════════════════════
function setEntryDir(d,btn){_entryDir=d;document.querySelectorAll('#tab-entry .sub-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');loadEntry();}

async function loadEntry() {
  spin('entry-area');
  try {
    const op=_entryDir==='arr'?'getPassengerArrivalsOdp':'getPassengerDeparturesOdp';
    const data=await api(`StatusOfPassengerFlightsOdp/${op}`,{numOfRows:300});
    const list=items(data);
    if(!list.length){html('entry-area','<div class="loading">데이터 없음</div>');return;}
    const cols=_entryDir==='arr'
      ?'<tr><th>편명</th><th>출발지</th><th>항공사</th><th>예정</th><th>실제</th><th>상태</th><th>수하물</th><th>터미널</th></tr>'
      :'<tr><th>편명</th><th>목적지</th><th>항공사</th><th>예정</th><th>실제</th><th>상태</th><th>게이트</th><th>터미널</th></tr>';
    const rows=list.map(f=>{
      const gate=_entryDir==='arr'?(f.carousel||f.exitnumber||'-'):(f.gatenumber||'-');
      return `<tr>
        <td><strong class="hi">${f.flightId||'-'}</strong></td>
        <td>${f.airport||'-'} <span style="font-size:.62rem;color:var(--muted)">${f.airportCode||''}</span></td>
        <td>${f.airline||'-'}</td>
        <td>${fmtTime(f.scheduleDateTime)||'-'}</td>
        <td style="color:${f.estimatedDateTime&&f.estimatedDateTime!==f.scheduleDateTime?'#f59e0b':'inherit'}">${fmtTime(f.estimatedDateTime)||'-'}</td>
        <td>${badge(f.remark||'')}</td>
        <td>${gate}</td>
        <td><span style="font-size:.68rem;color:var(--muted)">${TERM[f.terminalId]||f.terminalId||'-'}</span></td>
      </tr>`;
    }).join('');
    html('entry-area',`<div class="tbl-wrap"><table><thead>${cols}</thead><tbody>${rows}</tbody></table></div>`);
  } catch(e){err('entry-area',e.message);}
}

// ════════════════════════════════
//  ② 주차장 현황
// ════════════════════════════════
async function loadParking() {
  initParkCalc();
  spin('park-area');
  try {
    const data=await api('StatusOfParking/getTrackingParking',{numOfRows:200});
    const list=items(data);
    if(!list.length){html('park-area','<div class="loading">데이터 없음</div>');return;}

    function enrich(p) {
      const nm=p.floor||'', avail=parseInt(p.parking||0), total=parseInt(p.parkingarea||0);
      const occ=total-avail, rate=total?Math.round(occ/total*100):0;
      let cat='기타';
      if(nm.includes('단기')) cat='단기';
      else if(nm.includes('장기')) cat='장기';
      else if(nm.includes('예약')) cat='예약';
      else if(nm.includes('우선')) cat='우선';
      return {...p, _nm:nm, _avail:avail, _total:total, _occ:occ, _rate:rate, _cat:cat};
    }

    function renderTerm(grp, label) {
      if(!grp.length) return '';
      const totOcc=grp.reduce((a,p)=>a+p._occ,0);
      const totAll=grp.reduce((a,p)=>a+p._total,0);
      const totRate=totAll?Math.round(totOcc/totAll*100):0;
      // Category summaries
      const cats=['단기','장기','예약','우선','기타'];
      const catSumHtml=cats.map(cat=>{
        const cp=grp.filter(p=>p._cat===cat);
        if(!cp.length) return '';
        const co=cp.reduce((a,p)=>a+p._occ,0), ct=cp.reduce((a,p)=>a+p._total,0);
        const cr=ct?Math.round(co/ct*100):0;
        return `<div class="park-sum-box"><div class="park-sum-lbl">${cat} 주차장</div>
          <div class="park-sum-val ${prClass(cr)}">${cr}%</div>
          <div class="park-sum-sub">기여 ${ct.toLocaleString()}면</div></div>`;
      }).join('');
      // Rows by category
      const rowsHtml=cats.flatMap(cat=>{
        const cp=grp.filter(p=>p._cat===cat);
        if(!cp.length) return [];
        const catHdr=`<tr><td colspan="4" class="park-cat-hdr">• ${cat}주차장</td></tr>`;
        const rows=cp.map(p=>`<tr>
          <td>${p._nm}</td>
          <td>${badge(p._rate<60?'여유':p._rate<80?'보통':p._rate<95?'혼잡':'만차')}</td>
          <td><span class="${prClass(p._rate)}">${p._rate}%</span>${prBar(p._rate)}</td>
          <td style="color:var(--muted)">${p._occ.toLocaleString()} / ${p._total.toLocaleString()}</td>
        </tr>`).join('');
        return [catHdr, rows];
      }).join('');
      return `<div class="park-term-section">
        <div class="park-term-hdr">
          <h3>${label}</h3>
          <div><span class="${prClass(totRate)}" style="font-size:.95rem;font-weight:700">${totRate}%</span>
          <span class="park-term-total"> · 총 ${totAll.toLocaleString()}면</span></div>
        </div>
        <div class="park-summary">
          <div class="park-sum-box"><div class="park-sum-lbl">전체 주차율</div>
            <div class="park-sum-val ${prClass(totRate)}">${totRate}%</div>
            <div class="park-sum-sub">${totOcc.toLocaleString()} / ${totAll.toLocaleString()}</div></div>
          ${catSumHtml}
        </div>
        <div class="tbl-wrap"><table><thead><tr><th>주차장</th><th>상태</th><th>주차율</th><th>입차/주차면</th></tr></thead>
        <tbody>${rowsHtml}</tbody></table></div>
      </div>`;
    }

    const enriched=list.map(enrich);
    const t1=enriched.filter(p=>p._nm.includes('T1'));
    const t2=enriched.filter(p=>p._nm.includes('T2'));
    const other=enriched.filter(p=>!p._nm.includes('T1')&&!p._nm.includes('T2'));
    let out=renderTerm(t1,'제1여객터미널')+renderTerm(t2,'제2여객터미널');
    if(other.length) out+=renderTerm(other,'기타');
    html('park-area',out||renderTerm(enriched,'전체'));
  } catch(e){err('park-area',e.message);}
}

async function loadParkSpots() {
  spin('spot-area');
  try {
    const data=await api('ParkLocationData/getParkLocationData',{terminalid:'T1',numOfRows:6000});   // 전체 4,614면(2026-11 실측) — 압축 후 약 40KB
    const list=items(data);
    if(!list.length){html('spot-area','<div class="loading">주차면 정보 없음 (T1 전용)</div>');return;}
    const zones={};
    list.forEach(s=>{
      const k=`${s.parklotno||'?'}-${s.parkzoneno||'?'}`;
      if(!zones[k]) zones[k]={lot:s.parklotno,zone:s.parkzoneno,total:0,occ:0};
      zones[k].total++;
      if(s.carstatus==='Y') zones[k].occ++;
    });
    const tot=list.length, occ=list.filter(s=>s.carstatus==='Y').length;
    const sumHtml=`<div class="park-summary" style="grid-template-columns:repeat(4,1fr);margin-bottom:10px">
      <div class="park-sum-box"><div class="park-sum-lbl">전체 주차면</div><div class="park-sum-val">${tot.toLocaleString()}</div></div>
      <div class="park-sum-box"><div class="park-sum-lbl">사용 중</div><div class="park-sum-val ${prClass(occ/tot*100)}">${occ.toLocaleString()}</div></div>
      <div class="park-sum-box"><div class="park-sum-lbl">빈 자리</div><div class="park-sum-val prg">${(tot-occ).toLocaleString()}</div></div>
      <div class="park-sum-box"><div class="park-sum-lbl">점유율</div><div class="park-sum-val ${prClass(occ/tot*100)}">${Math.round(occ/tot*100)}%</div></div>
    </div>`;
    const zoneHtml=Object.values(zones).sort((a,b)=>a.lot-b.lot||a.zone-b.zone).map(z=>{
      const r=Math.round(z.occ/z.total*100);
      return `<div class="spot-box"><div class="spot-zone">구역 ${z.lot}-${z.zone}</div>
        <div class="spot-rate ${prClass(r)}">${r}%</div>
        <div class="spot-cnt">${z.occ}/${z.total}</div>
        ${prBar(r)}</div>`;
    }).join('');
    html('spot-area',sumHtml+`<div class="spot-summary">${zoneHtml}</div>`);
    html('spot-upd','갱신: '+new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}));
  } catch(e){err('spot-area',e.message);}
}

// ════════════════════════════════
//  ③ 교통
// ════════════════════════════════
function setTrans(tab,btn){
  _transTab=tab;
  ['shuttle','arex','taxi'].forEach(t=>{const e=el('trans-'+t);if(e)e.style.display=t===tab?'block':'none';});
  document.querySelectorAll('.tr-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  loadTransTab();
}
function loadTransTab(){
  if(_transTab==='shuttle') loadShuttle();
  if(_transTab==='arex')    loadArex();
  if(_transTab==='taxi')    loadTaxi();
}
function setShuttleMode(m,btn){_shuttleMode=m;document.querySelectorAll('#trans-shuttle .sub-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');loadShuttle();}
function setArexDir(d,btn){_arexDir=d;document.querySelectorAll('#trans-arex .sub-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');renderArex();}

/* 셔틀 시간표 요일 구분 — 2026-11 실측으로는 dayType 이 '1' 하나뿐이라 거르지 않는다.
   여러 값이 오기 시작하면 평일(KST)에는 '1'만(주말 값의 뜻은 문서 확인 전이라 주말엔 거르지 않음) */
function shuttleDayType(list){ const s=new Set(list.map(x=>String(x.dayType))); const wd=kstDate().getDay(); return s.size>1&&s.has('1')&&wd>=1&&wd<=5?'1':null; }
let _shuttleSeq=0;
async function loadShuttle() {
  const seq=++_shuttleSeq, mode=_shuttleMode;   // 시간표(6,000행)가 늦게 와서 '도착 예측' 화면을 덮어쓰지 않게
  spin('shuttle-area');
  try {
    if(mode==='time') {
      const data=await api('ShtbusInfo/getShtbTimeInfo',{numOfRows:6000});   // 전체 4,754건(2026-11 실측) — 1,000건만 받으면 노선 일부가 빠졌다
      if(seq!==_shuttleSeq) return;
      const all=items(data), dt=shuttleDayType(all);
      const list=dt?all.filter(s=>String(s.dayType)===dt):all;
      if(!list.length){html('shuttle-area','<div class="loading">시간표 없음</div>');return;}
      // Group by routeId then by hour
      const routes={};
      list.forEach(s=>{
        const r=s.routeId||'-';
        if(!routes[r]) routes[r]=[];
        routes[r].push(s);
      });
      const html_out=Object.entries(routes).map(([route,stops])=>{
        // Group by hour
        const hours={};
        stops.forEach(s=>{
          const t=s.startTime||'';
          if(t.length>=4){const h=parseInt(t.slice(0,2));if(!hours[h])hours[h]=[];hours[h].push(t.slice(2,4));}
        });
        const tbl=Object.entries(hours).sort(([a],[b])=>+a-+b).map(([h,mins])=>
          `<div class="arex-hour-row"><span class="arex-hr">${String(h).padStart(2,'0')}시</span>
            <div class="arex-mins">${mins.map(m=>`<span class="arex-min">${m}</span>`).join(' ')}</div></div>`
        ).join('');
        return `<div class="shuttle-route"><div class="shuttle-route-id">노선 ${route}</div><div class="shuttle-hours">${tbl}</div></div>`;
      }).join('');
      html('shuttle-area',html_out);
    } else {
      const data=await api('ShtbusInfo/getShtbArrivalPredInfo',{numOfRows:200});
      if(seq!==_shuttleSeq) return;
      const list=items(data);
      if(!list.length){html('shuttle-area','<div class="loading">예측 정보 없음</div>');return;}
      const rows=list.map(s=>`<tr>
        <td>${STOP[s.stopId]||s.stopId||'-'}</td>
        <td>${s.routeId||'-'}</td>
        <td><strong style="color:var(--accent)">${s.predTimes!=null?s.predTimes+'분 후':fmtTime(s.ofrTime)||'-'}</strong></td>
        <td>${s.loc||s.ord||'-'}</td>
      </tr>`).join('');
      html('shuttle-area',`<div class="tbl-wrap"><table><thead><tr><th>정류장</th><th>노선</th><th>예상 도착</th><th>위치</th></tr></thead><tbody>${rows}</tbody></table></div>`);
    }
  } catch(e){ if(seq===_shuttleSeq) err('shuttle-area',e.message); }
}

/* 공항철도: 전체는 39,668건(7일치·전 역)이라 1,000건만 받으면 정렬 안 된 일부만 와서 역 시간표가 비었다.
   역별로 받는다(역당 약 2,900건·압축 후 약 25KB). 같은 역은 한 번만 받고, 오늘(KST) 운행만 쓴다 */
const _arexByStn={};
async function loadArex() {
  _arexStnList=Object.keys(STN);
  if(_arexSelIdx>=_arexStnList.length) _arexSelIdx=0;
  renderArexMap();
  await loadArexStn(_arexStnList[_arexSelIdx]);
}
async function loadArexStn(cd) {
  if(_arexByStn[cd]){ _arexData=_arexByStn[cd]; renderArex(); return; }
  spin('arex-area');
  try {
    const data=await api('AirportRailroadOperationInfo/getAirportRailroad',{stnCd:cd,numOfRows:4000});
    const list=items(data);
    if(_arexStnList[_arexSelIdx]!==cd){ if(list.length) _arexByStn[cd]=list; return; }   // 그사이 다른 역을 골랐으면 그 역 화면을 건드리지 않는다
    if(!list.length){html('arex-area','<div class="loading">철도 운행 정보 없음</div>');return;}
    _arexByStn[cd]=list;
    _arexData=list;
    renderArex();
  } catch(e){ if(_arexStnList[_arexSelIdx]===cd) err('arex-area',e.message); }
}

function renderArexMap() {
  const stns=_arexStnList;
  const mapHtml=stns.map((cd,i)=>`
    <div class="arex-stn ${i===_arexSelIdx?'sel':''}" onclick="selectArexStn(${i})">
      <div class="arex-stn-name">${STN[cd]||cd}</div>
      <div class="arex-dot"></div>
    </div>
    ${i<stns.length-1?'<div class="arex-line"></div>':''}
  `).join('');
  html('arex-map',mapHtml);
}

function selectArexStn(idx){
  _arexSelIdx=idx;
  renderArexMap();
  loadArexStn(_arexStnList[idx]);
}

function renderArex() {
  if(!_arexData.length) return;
  const cd=_arexStnList[_arexSelIdx];
  const stnName=STN[cd]||cd;
  const nowDt=kstDate();
  const nowH=nowDt.getHours(), nowM=nowDt.getMinutes(), today=fmtD(nowDt);

  // 이 역·오늘(KST) 출발편만, 방향: 열차번호 홀수=공항행·짝수=서울행(2026-11 실측 — 서울역 출발은 모두 홀수, T2 출발은 모두 짝수)
  const wantOdd=_arexDir==='to';
  let stnTrains=_arexData.filter(f=>f.stnCd===cd && f.planDptrDttm && f.drvDt===today && ((parseInt(String(f.trnNo||'').replace(/\D/g,''),10)%2===1)===wantOdd))
    .sort((a,b)=>a.planDptrDttm.localeCompare(b.planDptrDttm));

  // Group by hour
  const hours={};
  stnTrains.forEach(f=>{
    const dt=f.planDptrDttm||'';
    if(dt.length<12) return;
    const h=parseInt(dt.slice(8,10));
    const m=dt.slice(10,12);
    if(!hours[h]) hours[h]=[];
    hours[h].push({m, dirc:f.trnClsfNm==='Dirc', trnNo:f.trnNo});
  });

  const nowAbs=nowH*60+nowM;
  const tblHtml=Object.entries(hours).sort(([a],[b])=>+a-+b).map(([h,mins])=>`
    <div class="arex-hour-row">
      <span class="arex-hr">${String(h).padStart(2,'0')}시</span>
      <div class="arex-mins">${mins.map(({m,dirc})=>{
        const abs=+h*60+parseInt(m);
        const isNow=abs>=nowAbs&&abs<=nowAbs+2;
        return `<span class="arex-min${dirc?' dirc':''}${isNow?' now':''}" title="${dirc?'직행':'일반'}">${m}</span>`;
      }).join(' ')}</div>
    </div>
  `).join('');

  const total=stnTrains.length;
  const dircCnt=stnTrains.filter(f=>f.trnClsfNm==='Dirc').length;
  html('arex-area',`
    <div class="arex-tbl-hdr">
      <span class="arex-stn-sel">${stnName}</span>
      <span class="arex-tbl-meta">총 ${total}편 · <span style="color:var(--o)">직행 ${dircCnt}편</span> · <span style="color:var(--muted)">일반 ${total-dircCnt}편</span></span>
    </div>
    <div class="card" style="padding:8px">${tblHtml||(_arexData.some(f=>f.stnCd===cd&&f.planDptrDttm&&f.drvDt===today)?`<div class="loading">${stnName}에서 ${_arexDir==='to'?'공항':'서울'} 방향으로 출발하는 열차가 없어요 (종점)</div>`:'<div class="loading">해당 역 시간표 없음</div>')}</div>
    <div style="font-size:.62rem;color:var(--muted);margin-top:6px;padding-left:2px">
      <span style="color:var(--o);font-weight:700">굵은 숫자</span> = 직행 · 현재 시각 근방 = <span style="background:var(--accent);color:#fff;padding:1px 3px;border-radius:2px">강조</span>
    </div>
  `);
}

async function loadTaxi() {
  spin('taxi-area');
  try {
    const data=await api('StatusOfTaxi/getTaxiStatus',{terno:'P01',numOfRows:10});
    const list=items(data);
    if(!list.length){html('taxi-area','<div class="loading">택시 정보 없음</div>');return;}
    const f=list[0];
    const types=[
      {n:'서울 택시',cnt:f.seoultaxicnt,wait:f.seoulstandtime,loc:f.seoultaxistand},
      {n:'인천 택시',cnt:f.incheontaxicnt,wait:f.incheonstandtime,loc:f.incheontaxistand},
      {n:'경기 택시',cnt:f.gyenggitaxicnt,wait:f.gyenggistandtime,loc:f.gyenggitaxistand},
      {n:'인터시티',cnt:f.intercitytaxicnt,wait:f.intercitystandtime,loc:f.intercitytaxistand},
      {n:'우등/밴',cnt:f.besttaxicnt,wait:f.beststandtime,loc:f.bestVantaxistand},
    ].filter(t=>t.cnt!=null&&t.cnt!=='');
    const cards=types.map(t=>{
      const cnt=parseInt(t.cnt)||0;
      const wt=parseInt(t.wait)||0;
      return `<div class="taxi-card">
        <div class="taxi-name">${t.n}</div>
        <div class="taxi-cnt">${cnt}대</div>
        <div class="taxi-wait">${wt?`대기 ${wt}분`:'즉시'}</div>
        ${t.loc?`<div class="taxi-loc">📍 ${t.loc}</div>`:''}
      </div>`;
    }).join('');
    html('taxi-area',`<div class="taxi-cards">${cards}</div>`);
  } catch(e){err('taxi-area',e.message);}
}

// ════════════════════════════════
//  ④ 출·입국장 현황 (통합)
// ════════════════════════════════
async function loadCong() {
  ['cong-dep1-area','cong-arr1-area','cong-dep2-area','cong-arr2-area'].forEach(id=>spin(id));
  try {
    const [d1,d2,arrData]=await Promise.all([
      api('statusOfDepartureCongestion/getDepartureCongestion',{terminalId:'P01',numOfRows:200}),
      api('statusOfDepartureCongestion/getDepartureCongestion',{terminalId:'P02',numOfRows:200}),
      api('StatusOfArrivals/getArrivalsCongestion',{numOfRows:200}),
    ]);
    renderDepCong(items(d1),'cong-dep1-area','제1여객터미널 출국장',false);
    renderDepCong(items(d2),'cong-dep2-area','제2여객터미널 출국장',true);
    const arrList=items(arrData);
    renderArrCong(arrList.filter(i=>(i.terno||'T1')==='T1'),'cong-arr1-area','제1여객터미널 입국장');
    renderArrCong(arrList.filter(i=>(i.terno||'T1')!=='T1'),'cong-arr2-area','제2여객터미널 입국장');
  } catch(e){
    ['cong-dep1-area','cong-arr1-area','cong-dep2-area','cong-arr2-area'].forEach(id=>err(id,e.message));
  }
}

function renderDepCong(list,areaId,label,isT2) {
  const waitCls=wt=>wt<5?'wait-good':wt<15?'wait-ok':wt<30?'wait-busy':'wait-jam';
  const gateLabel=g=>{const m=(g.gateId||'').match(/DG(\d+)_([EW])/);return m?`${m[1]}번 ${m[2]==='E'?'동':'서'}편`:g.gateId||'-';};

  // Parse gate map
  const gmap={};
  list.forEach(g=>{
    const m=(g.gateId||'').match(/DG(\d+)_([EW])/);
    if(!m) return;
    const [,num,side]=m;
    if(!gmap[num]) gmap[num]={num,E:null,W:null,opTime:g.operatingTime||''};
    gmap[num][side]=g;
  });
  const gates=Object.values(gmap).sort((a,b)=>+a.num-+b.num);

  // Summary
  const totLen=list.reduce((a,g)=>a+parseInt(g.waitLength||0),0);
  const maxG=list.length?list.reduce((a,g)=>parseInt(g.waitLength||0)>parseInt(a.waitLength||0)?g:a,list[0]):null;
  // '가장 여유'는 지금 운영 중인 출국장만(닫힌 곳은 대기 0이라 1등으로 뽑히던 문제) — 대기시간, 같으면 대기인원 순
  // 대기시간은 "60+" 처럼 오기도 함 — 숫자로 바꾸면 0(가장 빠름)이 되던 문제. 60+ 는 60보다 조금 길게 친다
  const waitMin=g=>{const t=String(g.waitTime||'');return (parseInt(t,10)||0)+(/\+/.test(t)?0.5:0);};
  // 운영시간이 비어 있는 출국장은 닫힌 곳(대기 0명). 다른 곳에 운영시간이 하나도 없을 때만 모두 연 것으로 본다
  const OP_RE=/(\d{1,2}):(\d{2})\s*~\s*(\d{1,2}):(\d{2})/, anyOp=list.some(g=>OP_RE.test(g.operatingTime||''));
  const openNow=g=>{const m=OP_RE.exec(g.operatingTime||'');if(!m)return !anyOp;
    const d=kstDate(),n=d.getHours()*60+d.getMinutes(),a=+m[1]*60+ +m[2],b=+m[3]*60+ +m[4];return a<=b?(n>=a&&n<=b):(n>=a||n<=b);};
  const openList=list.filter(g=>/DG\d+_[EW]/.test(g.gateId||'')&&openNow(g))
    .sort((a,b)=>waitMin(a)-waitMin(b)||(parseInt(a.waitLength,10)||0)-(parseInt(b.waitLength,10)||0));
  const minG=openList[0]||null;

  const statHtml=`<div class="cong-stat-strip">
    <div class="cong-stat-card">
      <div class="cong-stat-lbl">전체 대기인원</div>
      <div class="cong-stat-val" style="color:var(--y)">${totLen>0?totLen+'명':'-'}</div>
    </div>
    <div class="cong-stat-card">
      <div class="cong-stat-lbl">가장 혼잡</div>
      <div class="cong-stat-val" style="color:var(--r)">${maxG?gateLabel(maxG):'-'}</div>
      ${maxG?`<div class="cong-stat-sub">${maxG.waitLength||0}명 약 ${maxG.waitTime||0}분</div>`:''}
    </div>
    <div class="cong-stat-card">
      <div class="cong-stat-lbl">가장 빠름(운영 중)</div>
      <div class="cong-stat-val" style="color:var(--g)">${minG?gateLabel(minG):'-'}</div>
      ${minG?`<div class="cong-stat-sub">${minG.waitLength||0}명 약 ${minG.waitTime||0}분</div>`:''}
    </div>
  </div>`;

  const worstOpen=openList[openList.length-1];
  const bestHtml=minG?`<div class="best-gate">🚶 <b>지금은 ${gateLabel(minG)} 출국장이 가장 빨라요</b> · 약 ${minG.waitTime||0}분${worstOpen&&waitMin(worstOpen)>waitMin(minG)?` <span>(가장 붐비는 ${gateLabel(worstOpen)} 약 ${worstOpen.waitTime}분)</span>`:''}</div>`:'';
  const rowsHtml=gates.map(g=>{
    const cell=(side,lbl)=>{
      if(!side) return `<td style="color:var(--muted)">-</td>`;
      const wt=parseInt(side.waitTime||0), wl=parseInt(side.waitLength||0);
      return `<td><span class="${waitCls(wt)}">${lbl} ${wl}명 약${wt}분</span></td>`;
    };
    return `<tr>
      <td class="hi-b">${g.num}번</td>
      ${cell(g.E,'동')}${cell(g.W,'서')}
      <td style="font-size:.65rem;color:var(--muted)">${g.opTime||'-'}</td>
    </tr>`;
  }).join('');

  const noteHtml=isT2?'<div style="font-size:.6rem;color:var(--muted);padding:8px 12px">※ T2 출국장 혼잡도 정보는 공공데이터 미제공 · 운영시간만 표시</div>':'';

  html(areaId,`<div class="cong-section">
    <div class="cong-sec-hdr"><h3>${label}</h3><span class="cong-sec-badge">출국장 ${gates.length||'-'}개</span></div>
    ${bestHtml}${statHtml}
    <div class="tbl-wrap"><table>
      <thead><tr><th>출국장</th><th>동편</th><th>서편</th><th>운영시간</th></tr></thead>
      <tbody>${rowsHtml||`<tr><td colspan="4" style="color:var(--muted);text-align:center;padding:12px">데이터 없음</td></tr>`}</tbody>
    </table></div>
    ${noteHtml}
  </div>`);
}

function renderArrCong(list,areaId,label) {
  // Group by entrygate; each item is one flight
  const gmap={};
  list.forEach(f=>{
    const g=f.entrygate||'?';
    if(!gmap[g]) gmap[g]={gate:g,flights:[]};
    gmap[g].flights.push(f);
  });
  const gates=Object.values(gmap).sort((a,b)=>a.gate.localeCompare(b.gate));
  const totalPax=Math.round(list.reduce((a,f)=>a+parseFloat(f.korean||0)+parseFloat(f.foreigner||0),0));

  const rowsHtml=gates.map(g=>{
    const totKr=Math.round(g.flights.reduce((a,f)=>a+parseFloat(f.korean||0),0));
    const totFo=Math.round(g.flights.reduce((a,f)=>a+parseFloat(f.foreigner||0),0));
    const totPax=totKr+totFo;
    const clsId='ae-'+areaId+'-'+g.gate;

    const gateHdr=`<tr class="arr-gate-hdr" onclick="toggleArrGate('${clsId}',this)">
      <td class="hi-b" style="font-size:.82rem;width:50px">${g.gate}</td>
      <td style="font-weight:600">${totPax.toLocaleString()}명</td>
      <td>${g.flights.length}편</td>
      <td>${totKr}</td>
      <td>${totFo}</td>
      <td style="color:var(--muted);text-align:right">►</td>
    </tr>`;

    // 입국장 혼잡 응답은 필드가 소문자(scheduletime·estimatedtime·flightid) — 대문자만 읽어 편명·시각이 모두 '-' 이던 문제
    const schOf=f=>String(f.scheduletime||f.scheduleDateTime||''), estOf=f=>String(f.estimatedtime||f.estimatedDateTime||'');
    const flightRows=g.flights
      .sort((a,b)=>schOf(a).localeCompare(schOf(b)))
      .map(f=>{
        const sch=fmtTime(schOf(f))||'-';
        const act=fmtTime(estOf(f))||'-';
        const early=act!=='-'&&sch!=='-'&&act<sch;
        const kr=Math.round(parseFloat(f.korean||0));
        const fo=Math.round(parseFloat(f.foreigner||0));
        return `<tr class="arr-expand-row ${clsId}" style="display:none">
          <td class="hi">${f.flightid||f.flightId||f.flightNum||'-'}</td>
          <td>${f.airportCode||f.airport||'-'}</td>
          <td>${f.gatenumber||f.carousel||'-'}</td>
          <td>${sch}</td>
          <td style="color:${early?'var(--o)':act!==sch&&act!=='-'?'var(--y)':'inherit'}">${act}</td>
          <td>${kr}</td>
          <td>${fo}</td>
        </tr>`;
      }).join('');

    return gateHdr+flightRows;
  }).join('');

  html(areaId,`<div class="cong-section">
    <div class="cong-sec-hdr"><h3>${label}</h3><span class="cong-sec-badge">총 ${totalPax.toLocaleString()}명</span></div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>입국장</th><th>입국여객</th><th>항공편</th><th>내국인</th><th>외국인</th><th></th></tr></thead>
      <tbody>${rowsHtml||`<tr><td colspan="6" style="color:var(--muted);text-align:center;padding:12px">데이터 없음</td></tr>`}</tbody>
    </table></div>
    <div style="font-size:.6rem;color:var(--muted);padding:8px 12px">현재시간 기준 · 행 클릭으로 편별 확인</div>
  </div>`);
}

function toggleArrGate(clsId,rowEl) {
  const rows=document.querySelectorAll('.'+clsId);
  const visible=rows.length&&rows[0].style.display!=='none';
  rows.forEach(r=>r.style.display=visible?'none':'table-row');
  const arrow=rowEl.querySelector('td:last-child');
  if(arrow) arrow.textContent=visible?'►':'▼';
}

// ════════════════════════════════
//  ⑤ 항공편 현황
// ════════════════════════════════
function setFltDir(d,btn){
  _fltDir=d;
  _fltTermView='all';
  _fltSec={P01:'all',P02:'all',P03:'all'};
  document.querySelectorAll('#tab-flights .sub-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.flt-term-btn').forEach(b=>b.classList.remove('active'));
  const allBtn=document.querySelector('.flt-term-btn');
  if(allBtn) allBtn.classList.add('active');
  const termTabs=el('flt-term-tabs');
  if(termTabs) termTabs.style.display=(d==='dep'||d==='arr')?'flex':'none';
  loadFlights();
}
function setFltTerm(term,btn){
  _fltTermView=term;
  document.querySelectorAll('.flt-term-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderFlights();
}
function setFltSec(term,sec,btn){
  _fltSec[term]=sec;
  document.querySelectorAll(`.flt-sec-btn[data-term="${term}"]`).forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderFlights();
}

let _fltSeq=0;
async function loadFlights() {
  const seq=++_fltSeq, dir=_fltDir;   // 느린 응답(수하물 4,000행 등)이 나중에 와서 지금 고른 탭을 덮어쓰지 않게
  html('flt-area','<div class="loading">⏳ 로딩 중...</div>');
  html('flt-count','');
  try {
    _fltCache=[];
    let d=null;
    if(dir==='dep') d=await api('StatusOfPassengerFlightsOdp/getPassengerDeparturesOdp',{numOfRows:500});
    else if(dir==='arr') d=await api('StatusOfPassengerFlightsOdp/getPassengerArrivalsOdp',{numOfRows:500});
    else if(dir==='bag') d=await api('StatusOfBaggageLateral/getDeparturesBaggage',{numOfRows:4000});   // 오늘·내일 2,367건(2026-11 실측) — 300건이면 오전 10시 편까지만 보였다
    else if(dir==='close') d=await api('FlightClosingInfoSpot/getFlightClosingInfoSpot',{numOfRows:4000});   // 하루 2,547건(2026-11 실측) — 300건이면 오전 7시까지만 보였다
    if(seq!==_fltSeq) return;
    _fltCache=d?items(d):[];
    renderFlights();
  } catch(e){ if(seq===_fltSeq) err('flt-area',e.message); }
}

function renderFlights() {
  const q=(el('flt-q')?.value||'').trim().toLowerCase();
  let list=_fltCache;
  if(q) list=list.filter(f=>(f.flightId||f.flightNum||'').toLowerCase().includes(q)||(f.airport||'').toLowerCase().includes(q)||(f.airline||'').toLowerCase().includes(q)||(f.airportCode||'').toLowerCase().includes(q));
  // 출발·도착 전광판: 공동운항(Slave) 편명은 같은 비행기의 다른 번호(전체 1,192편 중 645편) — 검색할 때만 보인다
  else if(_fltDir==='dep'||_fltDir==='arr') list=list.filter(f=>f.codeshare!=='Slave');

  // Show/hide terminal tabs
  const termTabs=el('flt-term-tabs');
  if(termTabs) termTabs.style.display=(_fltDir==='dep'||_fltDir==='arr')?'flex':'none';

  if(_fltDir==='bag') {
    html('flt-count',`${list.length}편`);
    const rows=list.map(f=>`<tr>
      <td><strong class="hi">${f.flightId||'-'}</strong></td>
      <td>${f.airline||'-'}</td>
      <td>${f.airport||'-'}</td>
      <td><strong style="color:var(--accent)">${f.lateral1||f.lateral2||'-'}</strong></td>
      <td>${badge(f.remark||'')}</td>
      <td><span style="font-size:.68rem;color:var(--muted)">${TERM[f.terminalId]||f.terminalId||'-'}</span></td>
    </tr>`).join('');
    html('flt-area',`<div class="tbl-wrap"><table><thead><tr><th>편명</th><th>항공사</th><th>출발지</th><th>수하물벨트</th><th>상태</th><th>터미널</th></tr></thead><tbody>${rows}</tbody></table></div>`);
    return;
  }
  if(_fltDir==='close') {
    html('flt-count',`${list.length}편`);
    const rows=list.map(f=>`<tr>
      <td><strong class="hi">${f.flightNum||'-'}</strong></td>
      <td>${f.msIo==='D'?'출발':'도착'} ${f.msLine==='I'?'국제':'국내'}</td>
      <td>${f.msSspot||'-'}</td>
      <td>${f.msAspot||'-'}</td>
      <td>${fmtTime(f.msStime)||'-'}</td>
    </tr>`).join('');
    html('flt-area',`<div class="tbl-wrap"><table><thead><tr><th>편명</th><th>구분</th><th>계획스팟</th><th>실제스팟</th><th>시간</th></tr></thead><tbody>${rows}</tbody></table></div>`);
    return;
  }

  // ── dep/arr: terminal board with SEC sub-tabs ──
  const isDep=_fltDir==='dep';
  const byTerm={P01:[],P02:[],P03:[]};
  list.forEach(f=>{const t=f.terminalId||'P01';(byTerm[t]||byTerm.P01).push(f);});
  html('flt-count',`${list.length.toLocaleString()}편 · T1 ${byTerm.P01.length} · 탑승동 ${byTerm.P02.length} · T2 ${byTerm.P03.length}`);

  const isSingle=_fltTermView!=='all';

  // Get section letter from a flight (check-in zone first char)
  const secOf=f=>{
    const src=isDep?(f.chkinrange||'').replace(/\s/g,''):(f.gatenumber||f.exitnumber||f.carousel||'');
    const c=(src||'').charAt(0).toUpperCase();
    return /[A-Z]/.test(c)?c:null;
  };

  const termDefs=[{id:'P01',label:'T1'},{id:'P02',label:'탑승동'},{id:'P03',label:'T2'}];

  const colsHtml=termDefs.map(({id,label})=>{
    if(_fltTermView!=='all'&&_fltTermView!==id) return '';

    const flights=byTerm[id];
    const sections=[...new Set(flights.map(secOf).filter(Boolean))].sort();
    const secFilter=_fltSec[id];
    const filtered=secFilter==='all'?flights:flights.filter(f=>secOf(f)===secFilter);

    // Build SEC tabs: 전체 + dynamic sections
    const secBtns=['all',...sections].map((s,i)=>{
      const lbl=s==='all'?'전체':`SEC${i}`;
      const active=secFilter===s;
      return `<button class="flt-sec-btn${active?' active':''}" data-term="${id}" onclick="setFltSec('${id}','${s}',this)">${lbl}</button>`;
    }).join('');

    const cardsHtml=filtered.map(f=>{
      const sch=fmtTime(f.scheduleDateTime)||'-';
      const est=fmtTime(f.estimatedDateTime)||'';
      const delayed=est&&est!==sch;
      const gate=isDep?(f.gatenumber||''):(f.carousel||f.exitnumber||'');
      const ck=f.chkinrange||'';
      const dest=(f.airport||f.airportCode||'-');
      const air=(f.airline||'-').length>8?(f.airline||'-').slice(0,7)+'…':(f.airline||'-');
      return `<div class="flt-card2">
        <div class="flt-c2-top">
          <span class="flt-c2-time${delayed?' delayed':''}">${sch}${delayed?`<br><small style="font-size:.56rem">${est}</small>`:''}</span>
          ${badge(f.remark||'')}
        </div>
        <div class="flt-c2-flt">${f.flightId||'-'}</div>
        <div class="flt-c2-dest">${isDep?'↑':'↓'} ${dest}</div>
        <div class="flt-c2-air">${air}</div>
        <div class="flt-c2-info">${ck?`체크인 ${ck.split('-')[0]}~`:''}${gate?` ✈${gate}`:''}</div>
      </div>`;
    }).join('');

    return `<div class="flt-col2${isSingle?' single':''}">
      <div class="flt-col2-hdr">
        <span class="flt-col2-label">${label} <span style="font-size:.62rem;font-weight:400;color:var(--muted)">${filtered.length}편</span></span>
        <div class="flt-sec-tabs">${secBtns}</div>
      </div>
      <div class="flt-col2-body">
        <div class="flt-grid">
          ${cardsHtml||'<div style="padding:12px;color:var(--muted);font-size:.72rem;grid-column:1/-1">해당 편 없음</div>'}
        </div>
      </div>
    </div>`;
  }).join('');

  html('flt-area',`<div class="flt-board2">${colsHtml}</div>`);
}

// ════════════════════════════════
//  ⑥ 시설정보
// ════════════════════════════════
function setFacTab(t,btn){
  _facTab=t;
  ['comm','airline','noise'].forEach(id=>{const e=el('fac-'+id);if(e)e.style.display=id===t?'block':'none';});
  document.querySelectorAll('#tab-facilities>.sub-tabs .sub-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  loadFacTab();
}
function loadFacTab(){
  if(_facTab==='comm')    loadFacComm();
  if(_facTab==='airline') loadAirlines();
}

// Facility helpers
function facParse(f) {
  const loc=f.lckoreannm||'', nm=f.entrpskoreannm||'-';
  let term='';
  if(loc.includes('탑승동')||nm.includes('탑승동')) term='탑승동';
  else if(loc.includes('제1여객터미널')||loc.includes('T1')) term='T1';
  else if(loc.includes('제2여객터미널')||loc.includes('T2')) term='T2';
  let floor='';
  if(loc.includes('지하')) floor='B'+(loc.match(/지하\s*(\d+)/)?.[1]||'1');
  else if(loc.match(/(\d)층/)) floor=loc.match(/(\d)층/)[1]+'F';
  const duty=loc.includes('면세')?'면세':'일반';
  const prods=(f.trtmntprdlstkoreannm||'').split(/[,·]/).map(s=>s.trim()).filter(Boolean);
  return {nm,loc,term,floor,duty,prods,tel:f.tel||'',time:f.servicetime||''};
}

function setFacFilter(type,val,btn) {
  _facFilters[type]=val;
  const groupId=type==='term'?'fac-term-btns':type==='duty'?undefined:'fac-floor-btns-all';
  // Toggle active in the right group
  const parent=btn.closest('.fac-filter-row');
  if(parent) {
    // Deactivate siblings in the same logical group
    const allBtns=[...parent.querySelectorAll('.sub-btn')];
    const groups=[];
    let cur=[];
    allBtns.forEach(b=>{
      if(b.classList.contains('fac-sep')||b.nextSibling?.classList?.contains?.('fac-sep')){
        // separator logic handled by DOM - just find same "logical group"
      }
      cur.push(b);
    });
    // Simple: just find all buttons with same onclick pattern
    const typeStr=`setFacFilter('${type}',`;
    allBtns.filter(b=>(b.getAttribute('onclick')||'').includes(typeStr)).forEach(b=>b.classList.remove('active'));
  }
  btn.classList.add('active');
  _facPage=1;
  renderFac();
}

const FAC_PER_PAGE=18;

async function loadFacComm() {
  if(_facCache.length){renderFac();return;}
  html('fac-grid','<div class="loading">로딩 중...</div>');
  try {
    const data=await api('StatusOfFacility/getFacilityKR',{numOfRows:2000});
    _facCache=items(data).map(f=>({...f,_p:facParse(f)}));
    renderFac();
  } catch(e){err('fac-grid',e.message);}
}

function renderFac() {
  const q=(el('fac-q')?.value||'').trim().toLowerCase();
  let list=_facCache;
  if(_facFilters.term!=='all') list=list.filter(f=>f._p.term===_facFilters.term);
  if(_facFilters.duty!=='all') list=list.filter(f=>f._p.duty===_facFilters.duty);
  if(_facFilters.floor!=='all') {
    const fv=_facFilters.floor;
    list=list.filter(f=>f._p.floor.includes(fv)||f._p.loc.includes(fv==='B'?'지하':fv.replace('F','층')));
  }
  if(q) list=list.filter(f=>f._p.nm.toLowerCase().includes(q)||f._p.loc.toLowerCase().includes(q)||(f._p.prods.join(' ')).toLowerCase().includes(q));
  const total=list.length;
  const pages=Math.ceil(total/FAC_PER_PAGE)||1;
  if(_facPage>pages) _facPage=1;
  const slice=list.slice((_facPage-1)*FAC_PER_PAGE,_facPage*FAC_PER_PAGE);
  html('fac-count',`${total.toLocaleString()}개 결과`);
  const cards=slice.map(f=>{
    const p=f._p;
    return `<div class="fac-card">
      <div class="fac-card-name">${p.nm}</div>
      <div class="fac-tags">
        ${p.term?`<span class="fac-tag">${p.term}</span>`:''}
        ${p.floor?`<span class="fac-tag fac-tag-floor">${p.floor}</span>`:''}
        <span class="fac-tag fac-tag-duty">${p.duty}</span>
      </div>
      ${p.loc?`<div class="fac-loc">${p.loc}</div>`:''}
      ${p.time?`<div class="fac-time">${p.time}</div>`:''}
      ${p.tel?`<div class="fac-tel">${p.tel}</div>`:''}
      ${p.prods.length?`<div class="fac-prods">${p.prods.map(pr=>`<span class="fac-tag fac-tag-prod">${pr}</span>`).join('')}</div>`:''}
    </div>`;
  }).join('');
  html('fac-grid',cards||'<div class="loading">검색 결과 없음</div>');
  html('fac-pager',total>FAC_PER_PAGE?`
    <button onclick="facGoPage(_facPage-1)" ${_facPage<=1?'disabled':''}>◀ 이전</button>
    <span>${_facPage} / ${pages}</span>
    <button onclick="facGoPage(_facPage+1)" ${_facPage>=pages?'disabled':''}>다음 ▶</button>
  `:'');
}
function facGoPage(p){const pages=Math.ceil(_facCache.length/FAC_PER_PAGE);_facPage=Math.max(1,Math.min(pages,p));renderFac();}

async function loadAirlines() {
  if(_airlineCache.length){renderAirlines();return;}
  html('airline-grid','<div class="loading">로딩 중...</div>');
  try {
    const data=await api('StatusOfSrvAirlines/getServiceAirlineInfo',{numOfRows:300});
    _airlineCache=items(data);
    renderAirlines();
  } catch(e){err('airline-grid',e.message);}
}
function renderAirlines() {
  const q=(el('airline-q')?.value||'').trim().toLowerCase();
  const list=q?_airlineCache.filter(a=>(a.airlineName||'').toLowerCase().includes(q)||(a.airlineIata||'').toLowerCase().includes(q)):_airlineCache;
  const cards=list.map(a=>{
    const logo=a.airlineImage?`<img src="${a.airlineImage}" alt="${a.airlineName}" style="height:26px;object-fit:contain;margin-bottom:3px" onerror="this.style.display='none'">`:'';
    return `<div class="fac-card" style="text-align:center">
      ${logo}
      <div class="fac-card-name">${a.airlineName||'-'}</div>
      <div style="font-size:.68rem;color:var(--muted)">${a.airlineIata||'-'} / ${a.airlineIcao||'-'}</div>
      ${a.airlineTel?`<div class="fac-tel" style="text-align:left;margin-top:4px">${a.airlineTel}</div>`:''}
    </div>`;
  }).join('');
  html('airline-grid',cards||'<div class="loading">결과 없음</div>');
}

// ════════════════════════════════
//  INIT & AUTO REFRESH
// ════════════════════════════════
/* 1분 갱신 — 화면이 숨겨져 있으면(다른 탭·화면 꺼짐) 건너뛰고, 다시 보일 때 한 번 갱신한다.
   예전엔 숨겨 둔 탭 하나가 1분마다 API 7회(하루 약 1만 회). 날씨·미세먼지·여객 예측·공지는 10분마다면 충분 */
let _slowAt=Date.now(), _lastRefresh=Date.now();
const SLOW_MS=10*60*1000;
function refreshAll(force) {
  if(document.hidden && !force) return;
  _lastRefresh=Date.now();
  if(force || Date.now()-_slowAt>=SLOW_MS){
    _slowAt=Date.now();
    loadWeather();
    loadPaxChart();
    loadNotice();
  }
  if(_tab==='entry')      loadEntry();
  if(_tab==='parking')    { loadParking(); loadParkSpots(); }
  if(_tab==='transport' && !(_transTab==='shuttle' && _shuttleMode==='time')) loadTransTab();   // 셔틀 시간표(6,000행)는 바뀌지 않는다
  if(_tab==='congestion') loadCong();
  if(_tab==='flights')    loadFlights();
}
document.addEventListener('visibilitychange', () => {
  if(document.hidden) return;
  if(Date.now()-_lastRefresh>=60000) refreshAll(Date.now()-_slowAt>=SLOW_MS);
  if(getFavs().length && Date.now()-_favAt>=60000) loadFavFlights();
});

// Init — set correct theme button label
(function(){
  const t = document.documentElement.getAttribute('data-theme') || 'dark';
  const btn = el('theme-toggle');
  if(btn) btn.textContent = t === 'light' ? '🌙 다크' : '☀ 라이트';
})();

loadWeather();
loadNotice();
/* 첫 탭: 저장한 편명이 있으면 '내 편명', 없으면 '출국장 혼잡'(주소에 #tab=…가 있으면 그쪽이 이김) */
(function(){
  let favs=[]; try{ favs=JSON.parse(localStorage.getItem('icn_fav_flights')||'[]'); }catch(e){}
  const first = favs.length ? 'fav' : 'congestion';
  showTab(first, [...document.querySelectorAll('#tabs .tab-btn')].find(b => b.getAttribute('onclick')?.includes(`'${first}'`)));
})();
// 차트는 패널이 열릴 때 로드 (초기에는 데이터만 조회해 헤더 수치 채움)
loadPaxChart();
setInterval(() => refreshAll(), 60000);

// ── 공유 + 토스트 ──
function _toast(msg){
  const t = el('icn-toast');
  if(!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_toast._tm);
  _toast._tm = setTimeout(() => t.classList.remove('show'), 2200);
}
async function sharePage(){
  const url = window.location.href;
  const title = '인천공항 실시간 정보 - 트래블코스트';
  if(navigator.share){
    try { await navigator.share({ title, url }); return; }
    catch(e) { /* user cancelled, fall through to clipboard */ }
  }
  try {
    await navigator.clipboard.writeText(url);
    _toast('🔗 링크가 복사되었습니다');
  } catch(e){
    _toast('복사 실패: ' + url);
  }
}

// ════════════════════════════════
//  통합 검색 (Ctrl+K)
// ════════════════════════════════
const QS_STATIC = [
  // 탭
  { type:'탭', icon:'📊', title:'진출입 현황', sub:'도착편/출발편 실시간', go:()=>showTab('entry',_qsTabBtn('entry')) },
  { type:'탭', icon:'🅿', title:'주차장 현황', sub:'T1·T2 주차면 실시간', go:()=>showTab('parking',_qsTabBtn('parking')) },
  { type:'탭', icon:'🚌', title:'셔틀·철도 시간표', sub:'공항버스/AREX/택시', go:()=>showTab('transport',_qsTabBtn('transport')) },
  { type:'탭', icon:'👥', title:'출국장 혼잡', sub:'터미널별 출·입국장 혼잡도', go:()=>showTab('congestion',_qsTabBtn('congestion')) },
  { type:'탭', icon:'✈', title:'항공편 현황', sub:'출발/도착/수하물/운항마감', go:()=>showTab('flights',_qsTabBtn('flights')) },
  { type:'탭', icon:'🏢', title:'시설정보', sub:'상업시설/항공사', go:()=>showTab('facilities',_qsTabBtn('facilities')) },
  { type:'탭', icon:'⭐', title:'내 편명', sub:'즐겨찾기 항공편 추적', go:()=>showTab('fav',_qsTabBtn('fav')) },
  { type:'탭', icon:'🛫', title:'공항 안내', sub:'출국 진행·수하물·면세·라운지', go:()=>showTab('prep',_qsTabBtn('prep')) },
  // 빠른 액션
  { type:'액션', icon:'✅', title:'출국 체크리스트', sub:'34개 준비물 체크', go:()=>{showTab('prep',_qsTabBtn('prep'));setPrepTab('check',_qsSubBtn('check'));} },
  { type:'액션', icon:'🚗', title:'공항 가는 길', sub:'리무진/철도/택시 비교', go:()=>{showTab('prep',_qsTabBtn('prep'));setPrepTab('route',_qsSubBtn('route'));} },
  { type:'액션', icon:'🛋', title:'라운지 가이드', sub:'T1·T2 PP카드 무료 라운지', go:()=>{showTab('prep',_qsTabBtn('prep'));setPrepTab('lounge',_qsSubBtn('lounge'));} },
  { type:'액션', icon:'🏢', title:'공항 편의시설', sub:'와이파이/충전/환전/흡연실', go:()=>{showTab('prep',_qsTabBtn('prep'));setPrepTab('amenity',_qsSubBtn('amenity'));} },
  { type:'액션', icon:'🧳', title:'수하물 규정', sub:'기내/위탁 무게·크기', go:()=>{showTab('prep',_qsTabBtn('prep'));setPrepTab('bag',_qsSubBtn('bag'));} },
  { type:'액션', icon:'💰', title:'면세 한도', sub:'USD 800 + 술/담배/향수', go:()=>{showTab('prep',_qsTabBtn('prep'));setPrepTab('duty',_qsSubBtn('duty'));} },
  { type:'액션', icon:'🚫', title:'반입 금지 품목', sub:'기내/위탁 금지물품', go:()=>{showTab('prep',_qsTabBtn('prep'));setPrepTab('ban',_qsSubBtn('ban'));} },
];
function _qsTabBtn(id){
  return [...document.querySelectorAll('#tabs .tab-btn')].find(b => b.getAttribute('onclick')?.includes(`'${id}'`));
}
function _qsSubBtn(id){
  return [...document.querySelectorAll('#tab-prep .sub-btn')].find(b => b.getAttribute('onclick')?.includes(`'${id}'`));
}
let _qsResults = [];
let _qsActive = 0;
function openQuickSearch(){
  const ov = el('qs-overlay');
  if(!ov) return;
  ov.classList.remove('qs-hidden');
  const inp = el('qs-input');
  if(inp){ inp.value = ''; setTimeout(()=>inp.focus(), 50); }
  renderQuickSearch();
}
function closeQuickSearch(){
  el('qs-overlay')?.classList.add('qs-hidden');
}
function renderQuickSearch(){
  const q = (el('qs-input')?.value || '').trim().toLowerCase();
  const out = el('qs-results');
  if(!out) return;
  _qsActive = 0;
  // 정적 항목 점수 매기기
  let staticHits = QS_STATIC;
  if(q){
    staticHits = QS_STATIC.filter(it =>
      (it.title+' '+it.sub+' '+it.type).toLowerCase().includes(q)
    );
  }
  // 항공편 검색 (캐시 활용)
  const flightHits = [];
  if(q && Array.isArray(_fltCache)){
    _fltCache.forEach(f => {
      const id = (f.flightId || f.flightNum || '').toLowerCase();
      const ap = (f.airport || '').toLowerCase();
      const apc = (f.airportCode || '').toLowerCase();
      const air = (f.airline || '').toLowerCase();
      if(id.includes(q) || ap.includes(q) || apc.includes(q) || air.includes(q)){
        flightHits.push(f);
      }
    });
  }
  // 시설 검색 (캐시 활용)
  const facHits = [];
  if(q && Array.isArray(_facCache) && _facCache.length){
    // 시설 응답 필드는 entrpskoreannm(이름)·lckoreannm(위치)·trtmntprdlstkoreannm(취급 품목) — facParse 결과(_p)로 찾는다
    //  (예전엔 없는 필드 entrFacltNm·svcEtc 를 읽어 1,205곳 중 늘 0건)
    _facCache.forEach(it => {
      const p = it._p || facParse(it);
      if(p.nm.toLowerCase().includes(q) || p.loc.toLowerCase().includes(q) || p.prods.join(' ').toLowerCase().includes(q)) facHits.push(it);
    });
  }
  _qsResults = [];
  let html = '';
  if(staticHits.length){
    html += '<div class="qs-group">탭 / 액션</div>';
    staticHits.slice(0, 12).forEach(it => {
      _qsResults.push(it);
      const idx = _qsResults.length - 1;
      html += `<div class="qs-item" data-idx="${idx}" onclick="selectQs(${idx})">
        <span class="qs-item-icon">${it.icon}</span>
        <div class="qs-item-body">
          <div class="qs-item-title">${it.title}</div>
          <div class="qs-item-sub">${it.sub}</div>
        </div>
        <span class="qs-item-key">${it.type}</span>
      </div>`;
    });
  }
  if(flightHits.length){
    html += '<div class="qs-group">항공편 (현재 운항)</div>';
    flightHits.slice(0, 10).forEach(f => {
      const item = {
        type:'편명', icon:'✈',
        title: f.flightId || f.flightNum || '',
        sub: `${f.airline||''} · ${f.airport||f.airportCode||''} · ${fmtTime(f.scheduleDateTime)||''}`,
        go: () => { closeQuickSearch(); showTab('flights',_qsTabBtn('flights')); setTimeout(()=>{ const q2=el('flt-q'); if(q2){q2.value=f.flightId||f.flightNum||'';renderFlights();}},100); }
      };
      _qsResults.push(item);
      const idx = _qsResults.length - 1;
      html += `<div class="qs-item" data-idx="${idx}" onclick="selectQs(${idx})">
        <span class="qs-item-icon">${item.icon}</span>
        <div class="qs-item-body">
          <div class="qs-item-title">${item.title}</div>
          <div class="qs-item-sub">${item.sub}</div>
        </div>
        <span class="qs-item-key">편명</span>
      </div>`;
    });
  }
  if(facHits.length){
    html += '<div class="qs-group">공항 시설</div>';
    const qe = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    facHits.slice(0, 10).forEach(it => {
      const p = it._p || facParse(it);
      const item = {
        type:'시설', icon:'🏢',
        title: qe(p.nm),
        sub: qe([p.loc, p.prods.slice(0, 3).join(', ')].filter(Boolean).join(' · ')),
        go: () => { closeQuickSearch(); showTab('facilities',_qsTabBtn('facilities')); setTimeout(()=>{ const q2=el('fac-q'); if(q2){q2.value=p.nm;_facPage=1;renderFac();}},150); }
      };
      _qsResults.push(item);
      const idx = _qsResults.length - 1;
      html += `<div class="qs-item" data-idx="${idx}" onclick="selectQs(${idx})">
        <span class="qs-item-icon">${item.icon}</span>
        <div class="qs-item-body">
          <div class="qs-item-title">${item.title}</div>
          <div class="qs-item-sub">${item.sub}</div>
        </div>
        <span class="qs-item-key">시설</span>
      </div>`;
    });
  }
  if(!html){
    html = q ? `<div class="qs-empty">"${q}" 결과가 없습니다.<br><span style="font-size:.66rem">항공편/시설 검색은 해당 탭을 한번 열어 데이터 로드 후 가능합니다.</span></div>`
            : '<div class="qs-empty">검색어를 입력하세요</div>';
  }
  out.innerHTML = html;
  _qsHighlight();
}
function _qsHighlight(){
  document.querySelectorAll('.qs-item').forEach((el,i) => el.classList.toggle('active', i === _qsActive));
  const cur = document.querySelector(`.qs-item[data-idx="${_qsActive}"]`);
  if(cur) cur.scrollIntoView({ block:'nearest' });
}
function onQsKey(e){
  if(e.key === 'Escape'){ e.preventDefault(); closeQuickSearch(); return; }
  if(e.key === 'ArrowDown'){ e.preventDefault(); _qsActive = Math.min(_qsActive+1, _qsResults.length-1); _qsHighlight(); }
  else if(e.key === 'ArrowUp'){ e.preventDefault(); _qsActive = Math.max(_qsActive-1, 0); _qsHighlight(); }
  else if(e.key === 'Enter'){ e.preventDefault(); selectQs(_qsActive); }
}
function selectQs(idx){
  const it = _qsResults[idx];
  if(!it) return;
  closeQuickSearch();
  try { it.go(); } catch(e){ console.warn(e); }
}
document.addEventListener('keydown', e => {
  if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'){
    e.preventDefault();
    openQuickSearch();
  }
});

// ════════════════════════════════
//  편명 자동완성
// ════════════════════════════════
function updateFavSuggestions(){
  const inp = el('fav-add-q');
  const dir = el('fav-add-dir')?.value || 'dep';
  const list = el('fav-suggestions');
  if(!inp || !list) return;
  const q = (inp.value || '').trim().toUpperCase();
  if(!q || q.length < 2){ list.innerHTML = ''; return; }
  // 현재 _fltCache 또는 즐겨찾기 캐시에서 추천
  const pool = Array.isArray(_fltCache) ? _fltCache : [];
  const seen = new Set();
  const matches = [];
  pool.forEach(f => {
    const id = ((f.flightId || f.flightNum || '') + '').toUpperCase();
    if(id && id.includes(q) && !seen.has(id)){
      seen.add(id);
      matches.push({ id, lbl: `${id} — ${f.airline||''} · ${f.airport||f.airportCode||''}` });
    }
  });
  list.innerHTML = matches.slice(0, 12).map(m => `<option value="${m.id}">${m.lbl}</option>`).join('');
}

// ════════════════════════════════
//  ICS 캘린더 다운로드
// ════════════════════════════════
function _icsDate(d){
  // YYYYMMDDTHHmmssZ (UTC)
  const pad = n => n.toString().padStart(2,'0');
  return d.getUTCFullYear() + pad(d.getUTCMonth()+1) + pad(d.getUTCDate()) +
         'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + '00Z';
}
async function downloadFavIcs(flightId, dir){
  // 캐시에서 항공편 찾기
  const op = dir === 'dep' ? 'StatusOfPassengerFlightsOdp/getPassengerDeparturesOdp' : 'StatusOfPassengerFlightsOdp/getPassengerArrivalsOdp';
  const data = await api(op, { numOfRows: 500 });
  const list = items(data);
  const live = list.find(x => ((x.flightId || x.flightNum || '') + '').toUpperCase().replace(/\s+/g,'') === flightId);
  if(!live){ _toast(`${flightId} 운항 정보를 찾을 수 없습니다`); return; }
  const start = _flightInstant(live);
  if(!start){ _toast('출발/도착 시간을 파싱할 수 없습니다'); return; }
  // 출발편: 출발 3시간 전부터 출발까지 / 도착편: 도착시간부터 1시간
  const isDep = dir === 'dep';
  const calStart = isDep ? new Date(start.getTime() - 3*3600*1000) : start;
  const calEnd = isDep ? start : new Date(start.getTime() + 60*60*1000);
  const dest = live.airport || live.airportCode || '';
  const air = live.airline || '';
  const gate = isDep ? (live.gatenumber||'') : (live.carousel||live.exitnumber||'');
  const term = TERM[live.terminalId] || live.terminalId || '';
  const title = `${isDep ? '✈ 출국' : '🛬 입국'} ${flightId} ${dest}`;
  const desc = [
    `항공사: ${air}`,
    `${isDep?'출발':'도착'}: ${fmtTime(live.scheduleDateTime)||'-'}`,
    live.estimatedDateTime ? `변경: ${fmtTime(live.estimatedDateTime)}` : '',
    gate ? `${isDep?'게이트':'수하물벨트'}: ${gate}` : '',
    term ? `터미널: ${term}` : '',
    `https://travelcost.co.kr/airport`,
  ].filter(Boolean).join('\\n');
  // 알람: 출발편은 2개(공항 출발 시각 + 게이트 이동 권장=출발 1시간 전), 도착편은 1개
  const alarms = isDep
    ? [
        // DTSTART(=출발 3시간 전) 시점 → "공항으로 출발"
        ['PT0S', `${flightId} 공항으로 출발할 시간 (출발 3시간 전)`],
        // DTSTART + 2시간 = 출발 1시간 전 → "게이트로 이동"
        ['PT2H', `${flightId} 게이트로 이동하세요 (출발 1시간 전)`],
      ]
    : [['PT0S', `${flightId} 곧 도착 — 짐 찾기·입국심사 준비`]];
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//트래블코스트//인천공항//KR',
    'BEGIN:VEVENT',
    `UID:icn-${flightId}-${dir}@travel-guide`,
    `DTSTAMP:${_icsDate(new Date())}`,
    `DTSTART:${_icsDate(calStart)}`,
    `DTEND:${_icsDate(calEnd)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${desc}`,
    `LOCATION:인천국제공항 ${term}`,
    ...alarms.flatMap(([trig, d]) => [
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${d}`, `TRIGGER:${trig}`, 'END:VALARM',
    ]),
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${flightId}_${isDep?'departure':'arrival'}.ics`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  _toast(`📅 ${flightId} 일정 다운로드 — 캘린더 앱에서 가져오기`);
}

// ════════════════════════════════
//  URL 딥링크 (#tab=fav&sub=lounge)
// ════════════════════════════════
function _parseHash(){
  const h = window.location.hash.slice(1);
  if(!h) return {};
  const out = {};
  h.split('&').forEach(p => {
    const [k,v] = p.split('=');
    if(k) out[k] = decodeURIComponent(v || '');
  });
  return out;
}
function applyDeeplink(){
  const p = _parseHash();
  if(p.tab){
    const btn = [...document.querySelectorAll('#tabs .tab-btn')].find(b => b.getAttribute('onclick')?.includes(`'${p.tab}'`));
    if(btn) btn.click();
  }
  if(p.sub){
    setTimeout(() => {
      const subBtn = [...document.querySelectorAll('#tab-prep .sub-btn')].find(b => b.getAttribute('onclick')?.includes(`'${p.sub}'`));
      if(subBtn) subBtn.click();
    }, 80);
  }
}
window.addEventListener('hashchange', applyDeeplink);
// 페이지 로드 후 1초 뒤 적용 (탭 DOM 준비 보장)
setTimeout(applyDeeplink, 200);

// ════════════════════════════════
//  다국어 토글 (한/영)
// ════════════════════════════════
const I18N = {
  ko: {
    '진출입 현황':'진출입 현황','주차장 현황':'주차장 현황','셔틀·철도 시간표':'셔틀·철도 시간표',
    '출·입국장 현황':'출·입국장 현황','항공편 현황':'항공편 현황','시설정보':'시설정보',
    '⭐ 내 편명':'⭐ 내 편명','🛫 출국 준비':'🛫 출국 준비',
    '✅ 체크리스트':'✅ 체크리스트','🚗 공항 가는 길':'🚗 공항 가는 길','🗺 평면도':'🗺 평면도',
    '🛋 라운지':'🛋 라운지','🏢 공항 편의':'🏢 공항 편의','🧳 수하물 규정':'🧳 수하물 규정',
    '💰 면세 한도':'💰 면세 한도','🚫 반입 금지':'🚫 반입 금지',
    'EN':'EN','☀ 라이트':'☀ 라이트','🌙 다크':'🌙 다크',
  },
  en: {
    '진출입 현황':'Pax In/Out','주차장 현황':'Parking','셔틀·철도 시간표':'Shuttle/Rail',
    '출·입국장 현황':'Checkpoint','항공편 현황':'Flights','시설정보':'Facilities',
    '⭐ 내 편명':'⭐ My Flights','🛫 출국 준비':'🛫 Travel Prep',
    '✅ 체크리스트':'✅ Checklist','🚗 공항 가는 길':'🚗 Getting Here','🗺 평면도':'🗺 Floor Map',
    '🛋 라운지':'🛋 Lounges','🏢 공항 편의':'🏢 Amenities','🧳 수하물 규정':'🧳 Baggage',
    '💰 면세 한도':'💰 Duty-Free','🚫 반입 금지':'🚫 Prohibited',
    'EN':'한국어','☀ 라이트':'☀ Light','🌙 다크':'🌙 Dark',
  }
};
function _getLang(){ return localStorage.getItem('icn-lang') || 'ko'; }
function toggleLang(){
  const cur = _getLang();
  const next = cur === 'ko' ? 'en' : 'ko';
  localStorage.setItem('icn-lang', next);
  applyLang();
}
function applyLang(){
  const lang = _getLang();
  const dict = I18N[lang];
  if(!dict) return;
  // 탭 버튼
  document.querySelectorAll('#tabs .tab-btn, #tab-prep .sub-tabs .sub-btn').forEach(b => {
    const orig = b.dataset.ko || b.textContent.trim();
    if(!b.dataset.ko) b.dataset.ko = orig;
    if(dict[orig]) b.textContent = dict[orig];
  });
  // 토글 버튼 자체 라벨
  const lt = el('lang-toggle');
  if(lt) lt.textContent = dict['EN'];
  // 테마 토글 라벨
  const tt = el('theme-toggle');
  if(tt){
    const t = document.documentElement.getAttribute('data-theme') || 'dark';
    const key = t === 'light' ? '🌙 다크' : '☀ 라이트';
    tt.textContent = dict[key] || key;
  }
}
setTimeout(applyLang, 250);

// ── Service Worker 등록 (PWA) ──
if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// ════════════════════════════════
//  ⑦ 내 편명 (즐겨찾기)
// ════════════════════════════════
const FAV_KEY = 'icn_fav_flights';
function getFavs(){
  // 가져오기 링크(/mytrip#data=)로 들어온 값도 있으므로 편명 형식·방향만 통과(화면 onclick·innerHTML 에 들어감)
  try {
    const v = JSON.parse(localStorage.getItem(FAV_KEY) || '[]');
    return Array.isArray(v) ? v.filter(f => f && /^[A-Z0-9]{2,8}$/.test(String(f.flightId || '')) && (f.dir === 'dep' || f.dir === 'arr')) : [];
  }
  catch(e){ return []; }
}
function setFavs(arr){
  localStorage.setItem(FAV_KEY, JSON.stringify(arr));
}
function addFavFlight(){
  const inp = el('fav-add-q');
  const dir = el('fav-add-dir')?.value || 'dep';
  if(!inp) return;
  const id = (inp.value || '').trim().toUpperCase().replace(/\s+/g,'');
  if(!id){ inp.focus(); return; }
  if(!/^[A-Z0-9]{2,8}$/.test(id)){ alert('편명은 영문·숫자 2~8자로 입력하세요 (예: KE723, 7C1101)'); inp.focus(); return; }
  const favs = getFavs();
  if(favs.some(f => f.flightId === id && f.dir === dir)){
    inp.value = '';
    loadFavFlights();
    return;
  }
  favs.push({ flightId: id, dir, added: Date.now() });
  setFavs(favs);
  inp.value = '';
  loadFavFlights();
}
function removeFavFlight(flightId, dir){
  const favs = getFavs().filter(f => !(f.flightId === flightId && f.dir === dir));
  setFavs(favs);
  loadFavFlights();
}
// 출발/도착 카운트다운 + 이동 권장 시간 계산
// 출발편: 게이트 도착 권장 = 출발 60분 전 (보안검색 25 + 출국심사 20 + 도보 15)
// 도착편: 짐 찾기까지 = 도착 후 평균 30분
function _parseFlightTime(dtStr, hhmmStr){
  // scheduleDateTime이 'YYYYMMDDHHMM' 같은 12자리
  if(dtStr && dtStr.length >= 12){
    const y=+dtStr.slice(0,4), mo=+dtStr.slice(4,6)-1, d=+dtStr.slice(6,8),
          h=+dtStr.slice(8,10), mi=+dtStr.slice(10,12);
    return kstInstant(y, mo, d, h, mi);
  }
  // 'HHMM' 4자리만 있는 경우 → 오늘(KST) + HHMM. 운항 현황은 그날 편만 오므로 날짜를 넘기지 않는다
  // (예전엔 3시간 넘게 지난 시각을 내일로 넘겨 이미 떠난 비행기에 '게이트 도착 권장 19시간 후'가 떴다)
  if(hhmmStr && /^\d{4}$/.test(hhmmStr)){
    const k = kstDate();
    return kstInstant(k.getFullYear(), k.getMonth(), k.getDate(), +hhmmStr.slice(0,2), +hhmmStr.slice(2,4));
  }
  return null;
}
/* 실제(예상) 시각: 예정 시각(오늘) 기준으로 ±12시간 안에 놓는다 — 00:05 편이 전날 23:54 에 일찍 뜨거나,
   23:50 편이 지연돼 다음 날 00:30 에 뜨는 경우 */
function _flightInstant(live){
  const sch = String(live.scheduleDateTime || ''), est = String(live.estimatedDateTime || '');
  const base = _parseFlightTime(sch, sch.slice(-4));
  const t = _parseFlightTime(est, est.slice(-4)) || base;
  if(!t || !base || est.length >= 12) return t;
  const gap = t.getTime() - base.getTime(), H12 = 12*3600*1000, D = 24*3600*1000;
  return gap > H12 ? new Date(t.getTime() - D) : gap < -H12 ? new Date(t.getTime() + D) : t;
}
function buildCountdown(live, dir){
  const target = _flightInstant(live);
  if(!target) return '';
  const ts = target.getTime();
  const isDep = dir === 'dep';
  // 출발편: 게이트 도착 권장 시간 = 출발 60분 전
  const goTs = isDep ? ts - 60*60*1000 : ts;
  return `<div class="fav-countdown" data-target="${ts}" data-go="${goTs}" data-dir="${dir}">
    <span class="fav-cd-time" data-cd-time>--:--:--</span>
    <span class="fav-cd-msg" data-cd-msg>계산 중...</span>
  </div>`;
}
function _updateCountdowns(){
  const now = Date.now();
  document.querySelectorAll('.fav-countdown').forEach(box => {
    const ts = +box.dataset.target;
    const goTs = +box.dataset.go;
    const isDep = box.dataset.dir === 'dep';
    const diff = ts - now;
    const goDiff = goTs - now;
    const timeEl = box.querySelector('[data-cd-time]');
    const msgEl = box.querySelector('[data-cd-msg]');
    box.classList.remove('urgent','warning','go');
    if(diff <= 0){
      if(timeEl) timeEl.textContent = isDep ? '출발 완료' : '도착 완료';
      if(msgEl) msgEl.innerHTML = isDep
        ? '항공기가 이미 출발했습니다'
        : '도착 후 짐 찾기·입국심사 진행 중일 수 있어요';
      box.classList.add('go');
      return;
    }
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    const fmt = (h>0 ? `${h}시간 ` : '') + `${m}분 ${s.toString().padStart(2,'0')}초`;
    if(timeEl) timeEl.textContent = fmt;
    if(!isDep){
      if(msgEl) msgEl.innerHTML = `🛬 도착까지 — 짐 찾기 + 입국심사 통상 <b>30~50분</b> 추가 소요`;
      return;
    }
    // 출발편: 이동 권장 메시지
    if(goDiff <= 0){
      if(msgEl) msgEl.innerHTML = `🏃 <b>지금 게이트로 이동하세요</b> · 출발까지 ${fmt}`;
      box.classList.add('urgent');
    } else if(goDiff <= 30*60*1000){
      const gm = Math.ceil(goDiff/60000);
      if(msgEl) msgEl.innerHTML = `⚠️ <b>${gm}분 후 게이트로 이동 권장</b> · 보안검색·심사 약 45분 소요`;
      box.classList.add('warning');
    } else {
      const goH = Math.floor(goDiff/3600000);
      const goM = Math.floor((goDiff%3600000)/60000);
      if(msgEl) msgEl.innerHTML = `✈ 게이트 도착 권장: <b>${goH>0?goH+'시간 ':''}${goM}분 후</b> · 출발 60분 전`;
    }
  });
}
setInterval(_updateCountdowns, 1000);

// 게이트/시간 변경 알림용 이전 상태
const FAV_SNAP_KEY = 'icn_fav_snapshot';
function _getFavSnap(){
  try { return JSON.parse(localStorage.getItem(FAV_SNAP_KEY) || '{}'); }
  catch(e){ return {}; }
}
function _setFavSnap(s){ localStorage.setItem(FAV_SNAP_KEY, JSON.stringify(s)); }
function _notify(title, body){
  // 토스트는 항상
  _toast(`🔔 ${title}: ${body}`);
  // 권한 있으면 OS 알림도
  if('Notification' in window && Notification.permission === 'granted'){
    try {
      new Notification(title, { body, icon: '/icons/icon-192.png', tag: 'icn-gate' });
    } catch(e){ /* ignore */ }
  }
}
function requestFavNotifyPermission(){
  if(!('Notification' in window)){ _toast('이 브라우저는 알림 미지원'); return; }
  if(Notification.permission === 'granted'){ _toast('알림 이미 허용됨 ✓'); return; }
  Notification.requestPermission().then(p => {
    _toast(p === 'granted' ? '알림 허용됨 ✓' : '알림 거부됨');
  });
}

var _favAt=0;
async function loadFavFlights(){
  _favAt=Date.now();
  const area = el('fav-area');
  if(!area) return;
  const favs = getFavs();
  if(!favs.length){
    area.innerHTML = '<div class="fav-empty">⭐ 저장된 편명이 없습니다.<br><span style="font-size:.7rem;color:var(--muted)">위에 편명을 입력해 추가하세요.</span></div>';
    return;
  }
  const hadCards = !!area.querySelector('.fav-card');
  if(!hadCards) area.innerHTML = '<div class="loading">⏳ 항공편 데이터 조회 중...</div>';   // 1분 갱신 때마다 카드가 '조회 중'으로 깜빡이지 않게

  // Fetch live flight data for matching
  const needDep = favs.some(f => f.dir === 'dep');
  const needArr = favs.some(f => f.dir === 'arr');
  const [depData, arrData] = await Promise.all([
    needDep ? api('StatusOfPassengerFlightsOdp/getPassengerDeparturesOdp', {numOfRows:500}) : null,
    needArr ? api('StatusOfPassengerFlightsOdp/getPassengerArrivalsOdp', {numOfRows:500}) : null,
  ]);
  // 조회 실패(null)면 '운항 정보 없음'으로 바꾸지 말고 직전 화면·변경 감지 기록을 그대로 둔다
  // (예전엔 한 번 실패하면 기록이 비어 그사이 게이트 변경 알림을 놓쳤다)
  if((needDep && !depData) || (needArr && !arrData)){
    if(!hadCards) area.innerHTML = '<div class="err">⚠ 항공편 정보를 불러오지 못했어요. 1분 뒤 다시 확인합니다.</div>';
    return;
  }
  const depList = depData ? items(depData) : [];
  const arrList = arrData ? items(arrData) : [];

  const cards = favs.map(f => {
    const src = f.dir === 'dep' ? depList : arrList;
    const live = src.find(x =>
      ((x.flightId || x.flightNum || '') + '').toUpperCase().replace(/\s+/g,'') === f.flightId
    );
    const dirLbl = f.dir === 'dep' ? '✈ 출발' : '🛬 도착';
    if(!live){
      return `<div class="fav-card">
        <div class="fav-flight-id">${f.flightId}</div>
        <div class="fav-meta">
          <div class="fav-route">${dirLbl} · <span style="color:var(--muted)">현재 운항 정보 없음</span></div>
          <div class="fav-times" style="color:var(--muted)">오늘 운항 목록에 없어요 · 내일 편은 그날 0시부터 보여요</div>
        </div>
        <button class="fav-remove-btn" onclick="removeFavFlight('${f.flightId}','${f.dir}')" title="삭제">✕</button>
      </div>`;
    }
    const sch = fmtTime(live.scheduleDateTime) || '-';
    const est = fmtTime(live.estimatedDateTime) || '';
    const delayed = est && est !== sch;
    const remark = (live.remark || '').toLowerCase();
    const cancelled = /결항|취소|cancel/.test(remark);   // 공항 표기는 '결항' — 빠져 있어 결항편에 '게이트로 이동하세요'가 떴다
    const dest = live.airport || live.airportCode || '-';
    const air = live.airline || '-';
    const gate = f.dir === 'dep' ? (live.gatenumber || '') : (live.carousel || live.exitnumber || '');
    const gateLbl = f.dir === 'dep' ? '게이트' : '수하물벨트';
    const ck = live.chkinrange || '';
    const term = TERM[live.terminalId] || live.terminalId || '';
    const cls = cancelled ? 'cancelled' : (delayed ? 'delayed' : '');
    const cd = !cancelled ? buildCountdown(live, f.dir) : '';
    return `<div class="fav-card ${cls}">
      <div class="fav-flight-id">${f.flightId}</div>
      <div class="fav-meta">
        <div class="fav-route">${dirLbl} · ${air} · <span style="color:var(--accent)">${dest}</span> <span style="color:var(--muted);font-size:.7rem">${term}</span></div>
        <div class="fav-times">
          <span>예정 <b>${sch}</b></span>
          ${est ? `<span class="${delayed?'delay-tag':''}">${delayed?'변경':'실제'} <b>${est}</b></span>` : ''}
          ${live.remark ? `<span>${badge(live.remark)}</span>` : ''}
        </div>
        ${gate || ck ? `<div class="fav-gate">${gate ? `${gateLbl} <b>${gate}</b>` : ''}${gate && ck ? ' · ' : ''}${ck ? `체크인 <b>${ck}</b>` : ''}</div>` : ''}
        ${cd}
      </div>
      <div class="fav-card-actions">
        <button class="fav-ics-btn" onclick="downloadFavIcs('${f.flightId}','${f.dir}')" title="캘린더 추가">📅</button>
        <button class="fav-remove-btn" onclick="removeFavFlight('${f.flightId}','${f.dir}')" title="삭제">✕</button>
      </div>
    </div>`;
  }).join('');
  area.innerHTML = cards;
  _updateCountdowns();

  // ── 변경 감지 (게이트/시간/상태) ──
  const snap = _getFavSnap();
  const next = {};
  favs.forEach(f => {
    const src = f.dir === 'dep' ? depList : arrList;
    const live = src.find(x =>
      ((x.flightId || x.flightNum || '') + '').toUpperCase().replace(/\s+/g,'') === f.flightId
    );
    const key = f.flightId + '|' + f.dir;
    if(!live){ if(snap[key]) next[key] = snap[key]; return; }   // 목록에서 잠깐 빠져도 기록은 남긴다
    const cur = {
      gate: f.dir === 'dep' ? (live.gatenumber || '') : (live.carousel || live.exitnumber || ''),
      est: live.estimatedDateTime || '',
      sch: live.scheduleDateTime || '',
      remark: live.remark || ''
    };
    next[key] = cur;
    const prev = snap[key];
    if(prev){
      if(prev.gate && cur.gate && prev.gate !== cur.gate){
        const lbl = f.dir === 'dep' ? '게이트' : '수하물벨트';
        _notify(`${f.flightId} ${lbl} 변경`, `${prev.gate} → ${cur.gate}`);
      }
      if(prev.est && cur.est && prev.est !== cur.est){
        const before = fmtTime(prev.est), after = fmtTime(cur.est);
        if(before && after && before !== after){
          _notify(`${f.flightId} 시간 변경`, `${before} → ${after}`);
        }
      }
      if((prev.remark || '') !== (cur.remark || '') && cur.remark){
        _notify(`${f.flightId} 상태 변경`, cur.remark);
      }
    }
  });
  _setFavSnap(next);
}

// 즐겨찾기 자동 갱신 (60초마다) — 숨겨진 화면에선 OS 알림을 허용했을 때만(게이트 변경 알림이 목적). 아니면 다시 보일 때 갱신
setInterval(() => {
  if(!getFavs().length) return;
  if(document.hidden && !('Notification' in window && Notification.permission === 'granted')) return;
  loadFavFlights();
}, 60000);

// ════════════════════════════════
//  ⑧ 출국 준비
// ════════════════════════════════
function setPrepTab(t, btn){
  ['check','route','map','lounge','amenity','bag','duty','ban'].forEach(k => {
    const p = el('prep-'+k);
    if(p) p.style.display = (k === t) ? '' : 'none';
  });
  document.querySelectorAll('#tab-prep .sub-btn').forEach(b => b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  if(t === 'lounge') renderLounges();
  if(t === 'map') drawMap();
}

// ── 평면도 (SVG 인포그래픽) ──
let _mapTerm = 'T1';
const MAP_DATA = {
  T1: {
    title: '제1터미널 (T1) — 출국장 3F / 면세구역 4F',
    zones: [
      // 출국장 (좌측)
      { x:40,  y:60,  w:220, h:90, label:'체크인 카운터 (3F)', sub:'A·B·C·D·E·F·G·H·J·K·L·M' },
      // 면세구역 게이트 (우측)
      { x:330, y:50,  w:230, h:110, label:'면세구역·게이트 (4F)', sub:'게이트 11~50' },
      // 입국장 (하단)
      { x:40,  y:230, w:220, h:80, label:'입국장 (1F)', sub:'수하물·세관' },
      { x:330, y:230, w:230, h:80, label:'교통센터·주차장', sub:'B1 AREX / 리무진' },
    ],
    corridors: [
      { x1:260, y1:105, x2:330, y2:105 }, // 출국장→게이트
      { x1:445, y1:160, x2:445, y2:230 }, // 게이트→교통센터
      { x1:150, y1:150, x2:150, y2:230 }, // 출국장→입국장
    ],
    pins: [
      { x:90,  y:75,  c:'#f59e0b', t:'환', d:'환전·은행 (3F)' },
      { x:200, y:75,  c:'#f59e0b', t:'환', d:'환전소' },
      { x:130, y:115, c:'#ef4444', t:'🚬', d:'흡연실 (3F)' },
      { x:230, y:115, c:'#3b82f6', t:'👶', d:'수유실' },
      { x:355, y:75,  c:'#00c8f0', t:'11', d:'게이트 11~14' },
      { x:400, y:75,  c:'#00c8f0', t:'25', d:'게이트 22~25' },
      { x:455, y:75,  c:'#00c8f0', t:'30', d:'게이트 26~30' },
      { x:520, y:75,  c:'#00c8f0', t:'50', d:'게이트 41~50' },
      { x:370, y:130, c:'#22c55e', t:'L', d:'아시아나 라운지 (동편)' },
      { x:440, y:130, c:'#22c55e', t:'M', d:'마티나/SKY HUB 라운지' },
      { x:520, y:130, c:'#22c55e', t:'L', d:'아시아나 라운지 (서편)' },
      { x:400, y:105, c:'#a78bfa', t:'면', d:'면세점' },
      { x:480, y:105, c:'#a78bfa', t:'면', d:'면세점' },
      { x:425, y:155, c:'#ef4444', t:'🚬', d:'흡연실 (4F)' },
      { x:520, y:155, c:'#3b82f6', t:'👶', d:'키즈존·수유실' },
      { x:80,  y:265, c:'#94a3b8', t:'수', d:'수하물 컨베이어' },
      { x:200, y:265, c:'#94a3b8', t:'세', d:'세관' },
      { x:380, y:265, c:'#94a3b8', t:'리', d:'공항리무진 정류장' },
      { x:480, y:265, c:'#94a3b8', t:'A', d:'AREX 공항철도' },
    ]
  },
  T2: {
    title: '제2터미널 (T2) — 출국장 3F / 면세구역 4F',
    zones: [
      { x:40,  y:60,  w:220, h:90, label:'체크인 카운터 (3F)', sub:'A~H 카운터 · 자동수하물' },
      { x:330, y:50,  w:230, h:110, label:'면세구역·게이트 (4F)', sub:'게이트 230~270' },
      { x:40,  y:230, w:220, h:80, label:'입국장 (1F)', sub:'수하물·세관' },
      { x:330, y:230, w:230, h:80, label:'교통센터·주차장', sub:'B1 AREX / 리무진' },
    ],
    corridors: [
      { x1:260, y1:105, x2:330, y2:105 },
      { x1:445, y1:160, x2:445, y2:230 },
      { x1:150, y1:150, x2:150, y2:230 },
    ],
    pins: [
      { x:90,  y:75,  c:'#f59e0b', t:'환', d:'환전·은행 (3F)' },
      { x:200, y:75,  c:'#f59e0b', t:'환', d:'환전소' },
      { x:150, y:115, c:'#ef4444', t:'🚬', d:'흡연실 (3F)' },
      { x:230, y:115, c:'#3b82f6', t:'👶', d:'수유실 (3F)' },
      { x:360, y:75,  c:'#00c8f0', t:'230', d:'게이트 230~234' },
      { x:420, y:75,  c:'#00c8f0', t:'250', d:'게이트 250~254' },
      { x:480, y:75,  c:'#00c8f0', t:'260', d:'게이트 255~260' },
      { x:540, y:75,  c:'#00c8f0', t:'270', d:'게이트 261~270' },
      { x:380, y:130, c:'#22c55e', t:'L', d:'KAL 라운지 (East)' },
      { x:460, y:130, c:'#22c55e', t:'L', d:'Lounge L' },
      { x:530, y:130, c:'#22c55e', t:'L', d:'KAL 라운지 (West)' },
      { x:410, y:105, c:'#a78bfa', t:'면', d:'대한항공 면세점' },
      { x:490, y:105, c:'#a78bfa', t:'면', d:'면세점' },
      { x:445, y:155, c:'#ef4444', t:'🚬', d:'흡연실 (4F)' },
      { x:510, y:155, c:'#3b82f6', t:'👶', d:'키즈존·수유실' },
      { x:80,  y:265, c:'#94a3b8', t:'수', d:'수하물 컨베이어' },
      { x:200, y:265, c:'#94a3b8', t:'세', d:'세관 (자동심사 우선)' },
      { x:380, y:265, c:'#94a3b8', t:'리', d:'공항리무진 정류장' },
      { x:480, y:265, c:'#94a3b8', t:'A', d:'AREX 공항철도' },
    ]
  }
};
function setMapTerm(t, btn){
  _mapTerm = t;
  document.querySelectorAll('.map-term-tabs .sub-btn').forEach(b => b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  drawMap();
}
function drawMap(){
  const svg = el('map-svg');
  if(!svg) return;
  const data = MAP_DATA[_mapTerm];
  if(!data) return;
  let out = `<text x="300" y="28" text-anchor="middle" class="map-label" font-size="13">${data.title}</text>`;
  // zones
  data.zones.forEach(z => {
    out += `<rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="6" class="map-zone"/>`;
    out += `<text x="${z.x + z.w/2}" y="${z.y + z.h/2 - 2}" text-anchor="middle" class="map-label">${z.label}</text>`;
    out += `<text x="${z.x + z.w/2}" y="${z.y + z.h/2 + 12}" text-anchor="middle" class="map-label-sm">${z.sub}</text>`;
  });
  // corridors
  data.corridors.forEach(c => {
    out += `<line x1="${c.x1}" y1="${c.y1}" x2="${c.x2}" y2="${c.y2}" class="map-corridor"/>`;
  });
  // pins
  data.pins.forEach(p => {
    const tt = (p.t || '').length;
    out += `<g><title>${p.d}</title>`;
    out += `<circle class="map-pin" cx="${p.x}" cy="${p.y}" r="11" fill="${p.c}"/>`;
    out += `<text class="map-pin-label" x="${p.x}" y="${p.y + (tt > 2 ? 2 : 3)}" font-size="${tt > 2 ? 7 : 9}">${p.t}</text>`;
    out += `</g>`;
  });
  svg.innerHTML = out;
}
function loadPrepTab(){
  renderDepartTracker();
}

// ── 출국 진행 트래커 ──
const DEPART_KEY = 'icn_depart_step';
const DEPART_TIPS = [
  '체크인 카운터에서 항공권 발권·짐 위탁. 모바일 체크인 시 셀프수하물도 가능.',
  '액체류 100ml·노트북·보조배터리는 별도 트레이에 분리. 신발·벨트 검사 가능.',
  '여권+탑승권 준비. 자동출국심사(만 7세 이상, 등록자 무료) 권장.',
  '면세점/라운지 이용. 게이트까지 평균 도보 10분, 탑승동 이동 시 +5분.',
  '게이트 이동 후 탑승 대기. 탑승동은 셔틀트레인 5분 추가.',
  '탑승 완료! 좋은 여행 되세요 ✈',
];
function getDepartStep(){
  const v = +localStorage.getItem(DEPART_KEY);
  return Number.isFinite(v) ? v : -1;
}
function setDepartStep(s){
  const cur = getDepartStep();
  // 같은 단계 다시 누르면 그 단계로 진입 (현재로) / 이미 현재면 한 단계 뒤로
  if(s === cur) localStorage.setItem(DEPART_KEY, String(s - 1));
  else localStorage.setItem(DEPART_KEY, String(s));
  renderDepartTracker();
}
function resetDepart(){
  localStorage.removeItem(DEPART_KEY);
  renderDepartTracker();
}
function renderDepartTracker(){
  const cur = getDepartStep();
  document.querySelectorAll('.dt-step').forEach(s => {
    const i = +s.dataset.step;
    s.classList.toggle('done', i < cur);
    s.classList.toggle('current', i === cur);
  });
  const tip = el('dt-tip');
  if(tip){
    if(cur < 0) tip.textContent = '현재 단계를 눌러 시작하세요';
    else if(cur >= DEPART_TIPS.length - 1) tip.innerHTML = '<b>탑승 완료!</b> 좋은 여행 되세요 ✈';
    else tip.innerHTML = `<b>현재:</b> ${DEPART_TIPS[cur]}`;
  }
}

// ── 공항 가는 길 ──
function compareRoute(){
  const from = (el('route-from')?.value || '').trim();
  const term = el('route-term')?.value || 'T1';
  if(!from) return;
  const dest = term === 'T1' ? '인천공항 제1여객터미널' : '인천공항 제2여객터미널';
  const kakao = el('route-kakao-link');
  if(kakao){
    kakao.href = `https://map.kakao.com/?sName=${encodeURIComponent(from)}&eName=${encodeURIComponent(dest)}`;
    kakao.textContent = `카카오맵: ${from} → ${term} ↗`;
  }
  const arex = el('route-arex-link');
  if(arex){
    arex.href = `https://www.arex.or.kr/content.do?menuCd=DOM010102`;
  }
}

// ── 라운지 데이터 (인천공항 주요 라운지) ──
const LOUNGES = [
  // T1
  { name: 'Asiana Lounge (동편)', term: 'T1', location: '면세구역 4F, 게이트 14~25 사이',
    cards: ['PP카드', '신한 The Best/THE PRIVATE', '현대 The Black/Red', '삼성 The First'],
    hours: '05:00~22:00', pp: true },
  { name: 'Asiana Business Lounge (서편)', term: 'T1', location: '면세구역 4F, 게이트 41~50 사이',
    cards: ['PP카드', '아시아나 비즈니스', '주요 프리미엄 신용카드'],
    hours: '06:00~22:00', pp: true },
  { name: 'KAL Lounge (동편)', term: 'T1', location: '면세구역 4F, 게이트 11 부근',
    cards: ['대한항공 프레스티지/퍼스트', 'PP카드 일부 허용 안 됨'],
    hours: '05:30~22:00', pp: false },
  { name: 'Matina Lounge (East)', term: 'T1', location: '면세구역 4F, 게이트 26 부근',
    cards: ['PP카드', '주요 신용카드 다수', '하나카드 Club H 시리즈'],
    hours: '07:00~21:30', pp: true },
  { name: 'SKY HUB Lounge', term: 'T1', location: '면세구역 4F, 게이트 11 부근',
    cards: ['PP카드', 'KB국민카드 프리미엄', '롯데카드 프리미엄'],
    hours: '06:30~21:30', pp: true },
  // T2
  { name: 'KAL Lounge T2 (West)', term: 'T2', location: '면세구역 4F, 게이트 250 부근',
    cards: ['대한항공 프레스티지/퍼스트', '스카이팀 엘리트 플러스'],
    hours: '06:00~22:00', pp: false },
  { name: 'KAL Lounge T2 (East)', term: 'T2', location: '면세구역 4F, 게이트 230 부근',
    cards: ['대한항공 프레스티지/퍼스트', '스카이팀 엘리트 플러스'],
    hours: '06:00~22:00', pp: false },
  { name: 'SKY HUB Lounge T2', term: 'T2', location: '면세구역 4F, 게이트 268 부근',
    cards: ['PP카드', 'KB국민·롯데·신한·현대 프리미엄'],
    hours: '06:30~21:30', pp: true },
  { name: 'Lounge L', term: 'T2', location: '면세구역 4F, 게이트 231 부근',
    cards: ['PP카드', '하나카드 Club H', '주요 프리미엄 신용카드'],
    hours: '07:00~21:30', pp: true },
];
let _loungeFilter = 'all';
function filterLounge(f, btn){
  _loungeFilter = f;
  document.querySelectorAll('#prep-lounge .sub-btn').forEach(b => b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  renderLounges();
}
function renderLounges(){
  const grid = el('lounge-grid');
  if(!grid) return;
  let list = LOUNGES;
  if(_loungeFilter === 'T1') list = list.filter(l => l.term === 'T1');
  else if(_loungeFilter === 'T2') list = list.filter(l => l.term === 'T2');
  else if(_loungeFilter === 'pp') list = list.filter(l => l.pp);
  if(!list.length){
    grid.innerHTML = '<div class="lounge-empty">해당 조건의 라운지가 없습니다.</div>';
    return;
  }
  grid.innerHTML = list.map(l => `
    <div class="lounge-card">
      <div class="lounge-card-head">
        <div class="lounge-card-title">${l.name}</div>
        <span class="lounge-tag ${l.term.toLowerCase()}">${l.term}</span>
        ${l.pp ? '<span class="lounge-tag pp">PP카드</span>' : ''}
      </div>
      <div class="lounge-loc">📍 <b>${l.location}</b></div>
      <div class="lounge-cards-line"><b>입장 가능:</b> ${l.cards.join(' · ')}</div>
      <div class="lounge-hours">🕐 ${l.hours}</div>
    </div>
  `).join('');
}

function nearTrip(){
  const T=window.TripStore; if(!T) return null;
  const d=new Date(), today=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  return T.all().filter(t=>t.end>=today).sort((a,b)=>a.start<b.start?-1:1)[0]||null;
}
/* ═══ 주차 요금 계산기 — 소형차 공식 요금(2026-10-23 airport.kr 확인). 24시간 단위로 1일 최대 적용 ═══ */
function parkFee(min, kind){
  if(min<=10) return 0;
  const full=Math.floor(min/1440), rem=min%1440;
  if(kind==='short'){
    const day=m=> m<=0?0:Math.min(24000, 1200+Math.ceil(Math.max(0,m-30)/15)*600);
    return full*24000 + (rem? (full? Math.min(24000,Math.ceil(rem/15)*600) : day(rem)) : 0);
  }
  return full*9000 + (rem? Math.min(9000, Math.ceil(rem/60)*1000) : 0);
}
function initParkCalc(){
  const i=el('pc-in'), o=el('pc-out'); if(!i||!o||i.value) { calcPark(); return; }
  const pad=n=>String(n).padStart(2,'0'), fmt=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes());
  const tr=nearTrip(); let a,b;
  if(tr){   // 다가오는 여행이 있으면 출발일 아침 ~ 귀국일 저녁으로 미리 채움
    const dep=(tr.flight&&/^\d{1,2}:\d{2}/.test(tr.flight.dep||''))?tr.flight.dep:'09:00', arr=(tr.flightBack&&/^\d{1,2}:\d{2}/.test(tr.flightBack.arr||''))?tr.flightBack.arr:'20:00';
    a=new Date(tr.start+'T'+dep.padStart(5,'0')); a.setMinutes(a.getMinutes()-150);
    b=new Date(tr.end+'T'+arr.padStart(5,'0')); b.setMinutes(b.getMinutes()+60);
  } else { a=new Date(); a.setMinutes(0,0,0); b=new Date(a.getTime()+3*864e5); }
  i.value=fmt(a); o.value=fmt(b); calcPark();
}
function calcPark(){
  const out=el('pc-out-area'), i=el('pc-in'), o=el('pc-out'); if(!out||!i||!o) return;
  const a=new Date(i.value), b=new Date(o.value), min=Math.round((b-a)/60000);
  if(!(min>0)){ out.innerHTML='<div class="pc-res" style="color:var(--muted)">출차가 입차보다 늦어야 해요</div>'; return; }
  const dc=+(el('pc-dc')?.value||0), k=v=>Math.round(v*(100-dc)/100/10)*10, won=v=>v.toLocaleString('ko-KR')+'원';
  const sh=k(parkFee(min,'short')), lo=k(parkFee(min,'long')), d=Math.floor(min/1440), h=Math.floor(min%1440/60), mm=min%60;
  out.innerHTML=`<div class="pc-res"><div class="pc-dur">주차 ${d?d+'일 ':''}${h?h+'시간 ':''}${mm?mm+'분':''}</div>
    <div class="pc-cards"><div class="pc-c${lo<=sh?' win':''}"><small>장기주차장</small><b>${won(lo)}</b></div><div class="pc-c${sh<lo?' win':''}"><small>단기주차장</small><b>${won(sh)}</b></div></div>
    ${sh>lo?`<div class="pc-tip">💡 장기주차장이 <b>${won(sh-lo)}</b> 저렴해요 (셔틀로 터미널 이동)</div>`:''}</div>`;
}

