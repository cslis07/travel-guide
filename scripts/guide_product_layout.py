"""목적지 가이드 23곳을 '상품 상세형' 레이아웃으로 변환 (네이버 패키지 상품 페이지 구조 참고, 색은 트래블코스트 토큰).

- 그라데이션 히어로 → 사진 갤러리(구역 커버) + 정보 블록(경로·배지·제목·해시태그·항공 참고가·여행 요약 정보)
- 섹션 고정 탭(한눈에 비교 / 구역별 코스 / 여행 팁) + 하단 고정 버튼 바(홈·투어·여행 만들기)
- 기존 id(destWeather·dw*), tours.html?city= 링크(destaff.js가 읽음), TripAttach 호출은 그대로 보존
- 멱등: 이미 변환된 파일(gx-hero)은 건너뜀. 동작은 /guide-ui.js, 스타일은 style.css의 .gx-*

실행: python scripts/guide_product_layout.py   (레포 루트에서)
원래 가이드 생성기(guidegen.py)는 레포 밖이라, 히어로 재구성은 이 스크립트가 담당한다.
"""
import io
import re
import sys

GUIDES = ["osaka", "fukuoka", "tokyo", "kyoto", "sapporo", "okinawa", "shanghai", "taipei", "hongkong",
          "guilin", "zhangjiajie", "changbaishan", "bangkok", "danang", "bali", "singapore", "nhatrang",
          "cebu", "kotakinabalu", "jeju", "busan", "gangneung", "paris"]


def read(p):
    with io.open(p, encoding="utf-8", newline="") as f:
        return f.read()


def write(p, s):
    with io.open(p, "w", encoding="utf-8", newline="") as f:
        f.write(s)


def home_cards():
    """index.html 카드에서 도시별 지역 분류·기간·항공 참고가."""
    src = read("index.html")
    out = {}
    for m in re.finditer(r'<article class="dest-card" data-cat="([^"]+)" data-name="([^"]+)">(.*?)</article>', src, re.S):
        cat, _name, body = m.groups()
        href = re.search(r'href="([a-z]+)\.html" class="dest-btn"', body)
        if not href:
            continue
        tag = re.search(r'<span class="cat-tag[^"]*">([^<]+)</span>', body)
        dur = re.search(r'<span class="dest-duration">([^<]+)</span>', body)
        price = re.search(r'<span class="dest-price">([^<]+)</span>', body)
        out[href.group(1)] = {
            "region": tag.group(1) if tag else cat,
            "duration": dur.group(1) if dur else "",
            "price": price.group(1) if price else "",
        }
    return out


def thumb(src, w):
    return src.replace("/1280px-", "/%dpx-" % w)


def transform(slug, card):
    path = slug + ".html"
    s = read(path)
    if 'class="gx-hero"' in s:
        return "skip"

    hero = re.search(r'<section class="dest-hero".*?</section>\n', s, re.S)
    h = hero.group(0)
    badge = re.search(r'<span class="dest-hero-badge">(.*?)</span>', h).group(1)
    title = re.search(r"<h1>(.*?)</h1>", h, re.S).group(1)
    desc = re.search(r"<p>(.*?)</p>", h, re.S).group(1)
    stats = re.findall(r'<div class="hero-stat"><strong>(.*?)</strong><small>(.*?)</small></div>', h)
    weather = re.search(r'(<div class="dest-weather" id="destWeather" hidden>.*?</div>)', h, re.S).group(1)
    tours = re.search(r'<a href="(tours\.html\?city=[^"]+)"', h).group(1)
    attach = re.search(r'onclick="(TripAttach\.open\(.*?\);return false;)"', h).group(1)
    city = re.search(r"city:'([^']+)'", attach).group(1)

    covers = re.findall(r'<article class="destination" id="([^"]+)">\s*<div class="cover"><img alt="([^"]*)"[^>]*?src="([^"]+)"/>'
                        r'<div class="cover-text"><span class="badge">.*?</span><h2>(.*?)</h2>', s, re.S)
    zones = re.findall(r'<div class="summary"><div class="rank">.*?</div><h3>(.*?)</h3>', s, re.S)

    zone_label = badge.split(" · ", 1)[1] if " · " in badge else badge
    slides = "".join(
        '<a class="gx-slide" href="#%s"><img src="%s" alt="%s" %s referrerpolicy="no-referrer" onerror="this.parentNode.style.display=\'none\'"><span class="gx-cap">%s</span></a>'
        % (zid, src, alt, 'fetchpriority="high"' if i == 0 else 'loading="lazy"', cap)
        for i, (zid, alt, src, cap) in enumerate(covers))
    cells = "".join('<div class="gx-cell"><b>%s</b><span>%s</span></div>' % (k, v) for k, v in stats)
    tags = "".join('<span>#%s</span>' % z.replace(" ", "") for z in zones)
    price = ""
    label, _, amount = card.get("price", "").partition(" ")
    if amount.endswith("원~"):
        price = ('<div class="gx-price"><span class="gx-plabel">%s 참고가</span><b>%s</b>'
                 '<small>시기·노선별로 달라요 — 예약 전 확인</small></div>' % (label, amount))
    elif card.get("price"):
        price = '<div class="gx-price gx-pnote">🚆 %s</div>' % card["price"]

    new_hero = (
        '<section class="gx-hero">\n'
        '    <div class="gx-gallery"><div class="gx-track" id="gxTrack">%s</div>'
        '<span class="gx-count"><b id="gxIdx">1</b> / %d</span></div>\n'
        '    <div class="gx-info">\n'
        '      <div class="gx-crumb"><span>📍 %s</span><span class="gx-sep">›</span><span>%s</span>'
        '<button class="gx-share" type="button" onclick="gxShare()" aria-label="공유"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/></svg></button></div>\n'
        '      <div class="gx-badges"><span class="gx-b gx-b1">%s</span>%s</div>\n'
        '      <h1>%s</h1>\n'
        '      <p class="gx-desc">%s</p>\n'
        '      <div class="gx-tags">%s</div>\n'
        '      %s\n'
        '      <div class="gx-sum"><h2>여행 요약 정보</h2><div class="gx-grid">%s</div>\n'
        '      %s\n'
        '      </div>\n'
        '    </div>\n'
        '  </section>\n'
        '  <nav class="gx-tabs" id="gxTabs" aria-label="가이드 섹션"><a href="#compare" class="on">한눈에 비교</a><a href="#zones">구역별 코스</a><a href="#tips">여행 팁</a></nav>\n'
        '  <div class="gx-cta"><a class="gx-btn gx-home" href="/" aria-label="홈"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg></a>'
        '<a class="gx-btn" href="%s">🎟 투어·티켓</a>'
        '<a class="gx-btn gx-primary" href="#" onclick="%s">🧳 %s 여행 만들기</a></div>\n'
    ) % (slides, len(covers), card.get("region", ""), city, zone_label,
         ('<span class="gx-b gx-b2">%s</span>' % card["duration"]) if card.get("duration") else "",
         title, desc, tags, price, cells, weather, tours, attach, city)

    s = s.replace(h, new_hero, 1)
    s = s.replace('<section style="padding-top:12px"><div class="wrap">', '<section id="zones" style="padding-top:12px"><div class="wrap">', 1)
    s = s.replace('<div class="note">', '<div class="note" id="tips">', 1)
    s = s.replace("<body>", '<body class="gx-product">', 1)
    s = s.replace("</body>", '<script src="/guide-ui.js" defer></script>\n</body>', 1)
    write(path, s)
    return "ok %d slides" % len(covers)


def main():
    cards = home_cards()
    for slug in (sys.argv[1:] or GUIDES):
        print(slug, transform(slug, cards.get(slug, {})))


if __name__ == "__main__":
    main()
