/* 나라별 비상·분실 연락처 · 콘센트 · 팁 · 수돗물 / 항공사 온라인 체크인 — 내 여행 '여행 도구'·공항 탭이 읽는다.
   확인일 2026-10-23.
   - 비상 연락처: 외교부 0404 나라 페이지·각 공관 홈페이지(overseas.mofa.go.kr)를 직접 열어 확인한 번호만.
   - 콘센트: IEC World Plugs 기준(검색 인덱스로 확인 — 현지 콘센트는 섞여 있을 수 있음).
   - 체크인: 항공사 공식 페이지 기준(대부분 검색 인덱스로 확인, 바뀔 수 있음) — 화면에도 '항공사 안내 기준'으로 표시.
   - 팁·수돗물: 공식 기준이 아닌 일반 안내(보수적으로). */
(function () {
  'use strict';
  var CALL = '+82-2-3210-0404';   // 영사안전콜센터(2025-12 영사콜센터에서 이름 변경) · 24시간 · 유료(무료전화 앱·카톡 상담 가능)
  var I = {
    jp: { sos: [['경찰', '110'], ['구급·화재', '119']], plug: 'A·B (11자 납작 2핀)', volt: '100V', adapter: true,
          tip: '팁 문화 없어요', water: '수돗물 마셔도 된다고 안내되는 편이에요',
          mission: { '도쿄': ['주일본대사관', '+81-3-3452-7611', '+81-70-2153-5454'], '오사카': ['주오사카총영사관', '+81-6-4256-2345', '+81-90-3050-0746'], '교토': ['주오사카총영사관', '+81-6-4256-2345', '+81-90-3050-0746'],
            '후쿠오카': ['주후쿠오카총영사관', '+81-92-771-0461', '+81-80-8588-2806'], '오키나와': ['주후쿠오카총영사관(오키나와 관할)', '+81-92-771-0461', '+81-80-8588-2806'], '나하': ['주후쿠오카총영사관(오키나와 관할)', '+81-92-771-0461', '+81-80-8588-2806'],
            '삿포로': ['주삿포로총영사관', '+81-11-218-0288', ''] } },
    tw: { sos: [['경찰', '110'], ['구급·화재', '119'], ['관광 안내(한국어 통역·무료)', '0800-011-765']], plug: 'A·B (11자 납작 2핀)', volt: '110V', adapter: true,
          tip: '식당은 보통 봉사료 10% 포함 — 따로 팁 안 해도 돼요', water: '생수나 끓인 물 권장',
          mission: { '타이베이': ['주타이베이대한민국대표부', '+886-2-2758-8320', '+886-912-069-230'] } },
    hk: { sos: [['경찰·구급·화재', '999']], plug: 'G (영국형 3핀)', volt: '220V', adapter: true,
          tip: '식당은 보통 봉사료 10% 포함', water: '생수 권장',
          mission: { '홍콩': ['주홍콩총영사관', '+852-2529-4141', '+852-9731-0092'] } },
    cn: { sos: [['경찰', '110'], ['구급', '120'], ['화재', '119']], plug: 'A·C·I (섞여 있음)', volt: '220V', adapter: false,
          tip: '팁 문화 없어요', water: '수돗물 마시지 마세요 — 생수',
          mission: { '상하이': ['주상하이총영사관', '+86-21-6295-5000', '+86-138-1650-9503'], '장자제': ['주우한총영사관(후난성 관할)', '+86-27-8556-1085', ''], '장가계': ['주우한총영사관(후난성 관할)', '+86-27-8556-1085', ''],
            '구이린': ['주광저우총영사관(광시 관할)', '+86-20-2919-2999', '+86-139-2247-3457'], '계림': ['주광저우총영사관(광시 관할)', '+86-20-2919-2999', '+86-139-2247-3457'] } },
    th: { sos: [['관광경찰(한국어 가능)', '1155'], ['경찰', '191'], ['구급', '1669'], ['화재', '199']], plug: 'A·B·C (섞여 있음)', volt: '220V', adapter: false,
          tip: '작은 팁(잔돈·20~50바트)을 주면 좋아해요', water: '수돗물 마시지 마세요 — 생수',
          mission: { '방콕': ['주태국대사관', '+66-2-481-6000', '+66-81-914-5803'] } },
    vn: { sos: [['경찰', '113'], ['화재', '114'], ['구급(유료일 수 있음)', '115']], sosNote: '긴급번호는 대부분 베트남어로만 응대해요 — 영사안전콜센터·공관에 먼저 연락하세요',
          plug: 'A·C·F (섞여 있음)', volt: '220V', adapter: false, tip: '필수는 아니에요', water: '수돗물 마시지 마세요 — 생수',
          mission: { '다낭': ['주다낭총영사관', '+84-23-6356-6100', ''], '나트랑': ['주호치민총영사관(칸호아성 관할)', '+84-28-3822-5757', '+84-93-850-0238'] } },
    id: { sos: [['경찰', '110'], ['구급', '118'], ['화재', '113']], plug: 'C·F (한국과 같아요)', volt: '220V', adapter: false,
          tip: '필수는 아니지만 잔돈 팁을 주기도 해요', water: '수돗물 마시지 마세요 — 생수',
          mission: { '발리': ['주인도네시아대사관 발리 분관', '+62-361-9588-040', ''], '자카르타': ['주인도네시아대사관', '+62-21-2967-2555', '+62-811-852-446'] } },
    sg: { sos: [['경찰', '999'], ['구급·화재', '995']], plug: 'G (영국형 3핀)', volt: '230V', adapter: true,
          tip: '보통 봉사료 포함 — 팁 안 해도 돼요', water: '수돗물 마셔도 된다고 안내되는 편이에요',
          mission: { '싱가포르': ['주싱가포르대사관', '+65-6256-1188', '+65-9654-3528'] } },
    ph: { sos: [['경찰·구급·화재', '911']], plug: 'A·B·C (11자 납작 2핀이 흔함)', volt: '220V', adapter: true,
          tip: '봉사료가 없으면 10% 정도', water: '수돗물 마시지 마세요 — 생수',
          mission: { '세부': ['주세부분관', '+63-32-231-1516', ''], '마닐라': ['주필리핀대사관', '+63-2-8856-9210', '+63-917-817-5703'] } },
    my: { sos: [['경찰·구급·화재', '999'], ['사바주 경찰', '+60-88-454-222']], sosNote: '999 구급차는 공립병원으로만 가요',
          plug: 'G (영국형 3핀)', volt: '240V', adapter: true, tip: '팁 문화는 거의 없어요', water: '생수 권장',
          mission: { '코타키나발루': ['주말레이시아대사관 코타키나발루 분관', '+60-88-206-110', ''], '쿠알라룸푸르': ['주말레이시아대사관', '+60-3-4251-2336', '+60-17-623-8343'] } },
    fr: { sos: [['경찰', '17'], ['유럽 공통 긴급', '112'], ['구급(SAMU)', '15'], ['화재', '18']], plug: 'C·E (한국 플러그 대부분 꽂혀요)', volt: '230V', adapter: false,
          tip: '봉사료 포함(service compris) — 잔돈 팁은 선택', water: '수돗물 마셔도 된다고 안내되는 편이에요',
          mission: { '파리': ['주프랑스대사관', '+33-1-4753-0101', '+33-6-8028-5396'] } }
  };
  var PASSPORT = ['현지 경찰서에 신고하고 분실 확인서(원본)를 받아요', '여권 사진 2장(3.5×4.5cm, 흰 배경)·분실 확인서·수수료를 챙겨 공관에 직접 가요', '단수(긴급)여권이나 여행증명서를 받아요 — 신고한 여권은 나중에 찾아도 바로 못 써요', '공관 근무시간이 아니면 영사안전콜센터(24시간)로 먼저 연락해요'];

  /* 항공사 온라인 체크인 — 열리는 시각(출발 기준), 공식 페이지 */
  var CK = {
    KE: ['대한항공', 48, 'https://www.koreanair.com/', '미주·캐나다는 24시간 전'],
    OZ: ['아시아나항공', 48, 'https://flyasiana.com/C/KR/KO/contents/online-check-in', '미주·사이판은 24시간 전 · 다른 항공사 운항 공동운항편 제외'],
    '7C': ['제주항공', 24, 'https://www.jejuair.net/ko/linkService/fastProcedure/guide.do', '일부 노선 제한'],
    LJ: ['진에어', 24, 'https://www.jinair.com/ready/checkin/webMobile?snsLang=ko_KR&ctrCd=KOR', ''],
    TW: ['티웨이항공', 24, 'https://www.twayair.com/app/serviceInfo/contents/1121', '해외 출발은 일부 공항만'],
    BX: ['에어부산', 48, 'https://www.airbusan.com/content/common/service/airport/autoIssue', '해외 출발편은 모바일 탑승권 불가'],
    RS: ['에어서울', 24, 'https://flyairseoul.com/CW/ko/online-check-in.do', ''],
    ZE: ['이스타항공', 24, 'https://www.eastarjet.com/newstar/PGWII00001', '베트남·중국 출발 등 제한'],
    YP: ['에어프레미아', 24, 'https://www.airpremia.com/checkin/online', '일부 노선만'],
    JL: ['일본항공', 24, 'https://www.jal.co.jp/jp/en/inter/boarding/online-checkin/', ''],
    NH: ['ANA', 24, 'https://www.ana.co.jp/en/jp/guide/boarding-procedures/checkin/international/online-checkin/', ''],
    MM: ['피치항공', 0, 'https://www.flypeach.com/', '국제선은 온라인 체크인이 없어요 — 공항 카운터(출발 50분 전 마감)'],
    CI: ['중화항공', 48, 'https://www.china-airlines.com/us/en/prepare-for-the-fly/information/check-in/online-check-in', ''],
    BR: ['에바항공', 48, 'https://www.evaair.com/en-global/fly-prepare/at-the-airport/check-in/online-check-in/', ''],
    CX: ['캐세이퍼시픽', 48, 'https://www.cathaypacific.com/', ''],
    TG: ['타이항공', 24, 'https://www.thaiairways.com/en-th/content/check-in/', ''],
    VJ: ['비엣젯', 24, 'https://www.vietjetair.com/en/checkin', ''],
    VN: ['베트남항공', 24, 'https://www.vietnamairlines.com/vn/en/travel-information/check-in/online-check-in', '일부 공항만'],
    SQ: ['싱가포르항공', 48, 'https://www.singaporeair.com/en_UK/us/travel-info/check-in/online-mobile-checkin/', ''],
    TR: ['스쿠트', 48, 'https://www.flyscoot.com/en/plan/before-you-fly/checking-in', '유아 동반 예약은 카운터'],
    PR: ['필리핀항공', 24, 'https://www.philippineairlines.com/us/en/check-in-online.html', ''],
    '5J': ['세부퍼시픽', 48, 'https://help.cebupacificair.com/article/check-in-and-boarding-122499', '출발 2시간 전 마감'],
    MH: ['말레이시아항공', 48, 'https://www.malaysiaairlines.com/us/en/travel-info/check-in.html', ''],
    AK: ['에어아시아', 336, 'https://www.airasia.com/aa/mobile-check-in/index.html', '출발 14일 전부터'],
    D7: ['에어아시아X', 336, 'https://www.airasia.com/aa/mobile-check-in/index.html', '출발 14일 전부터'],
    AF: ['에어프랑스', 30, 'https://wwws.airfrance.fr/en/information/aeroport/enregistrement', ''],
    MU: ['중국동방항공', 48, 'https://www.ceair.com/', ''],
    CZ: ['중국남방항공', 0, 'https://www.csair.com/', '보통 출발 전날 14시부터 — 일부 노선 제외']
  };
  window.LOCAL_INFO = I;
  window.LOCAL_INFO_META = { call: CALL, passport: PASSPORT, checked: '2026-10-23', checkin: CK };
})();
