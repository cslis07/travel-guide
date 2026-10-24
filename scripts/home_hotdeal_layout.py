"""홈(index.html)을 '여행핫딜'형 레이아웃으로 (네이버 여행 이벤트 페이지 구조 참고, 광고 요소 제외, 색은 트래블코스트 토큰).

- 헤더 아래 고정 카테고리 탭(추천·항공권·숙소·여행지·필수템)
- 바로가기 칩 밴드 + 사진 카드 가로 캐러셀(인기·휴양) + '전체 보기' 버튼
- 여행지 목록 카드에 실사진 썸네일(가이드 첫 구역 커버, Wikimedia 500px) + 필터 칩 개수
- 마커(<!-- hx:... -->) 사이를 갈아끼우므로 다시 실행해도 안전. 동작은 /home-ui.js, 스타일은 style.css의 .hx-*

실행: python scripts/home_hotdeal_layout.py          (레포 루트에서)
      python scripts/home_hotdeal_layout.py --urls   (썸네일 URL만 출력 — 200 검증용)
"""
import io
import re
import sys

PICKS = ["osaka", "fukuoka", "tokyo", "danang", "bangkok", "taipei", "singapore", "jeju"]
RESORTS = ["okinawa", "bali", "nhatrang", "cebu", "kotakinabalu", "danang"]


def read(p):
    with io.open(p, encoding="utf-8", newline="") as f:
        return f.read()


def write(p, s):
    with io.open(p, "w", encoding="utf-8", newline="") as f:
        f.write(s)


def guide_info(slug):
    s = read(slug + ".html")
    cover = re.search(r'<div class="cover"><img alt="([^"]*)"[^>]*?src="([^"]+)"', s)
    zones = re.findall(r'<div class="summary"><div class="rank">.*?</div><h3>(.*?)</h3>', s, re.S)
    alt, src = cover.groups()
    return {"alt": alt, "img": re.sub(r"/\d+px-", "/500px-", src), "zones": zones}


def cards(src):
    out = []
    for m in re.finditer(r'<article class="dest-card" data-cat="([^"]+)" data-name="([^"]+)">(.*?)</article>', src, re.S):
        cat, name, body = m.groups()
        slug = re.search(r'href="([a-z]+)\.html" class="dest-btn"', body).group(1)
        tag = re.search(r'<span class="cat-tag[^"]*">([^<]+)</span>', body).group(1)
        dur = re.search(r'<span class="dest-duration">([^<]+)</span>', body)
        price = re.search(r'<span class="dest-price">([^<]+)</span>', body)
        out.append({"cat": cat, "name": name, "slug": slug, "tag": tag, "dur": dur.group(1) if dur else "",
                    "price": price.group(1) if price else ""})
    return out


def card_html(c, g):
    tags = "".join("<span>#%s</span>" % z.replace(" ", "") for z in g["zones"][:3])
    price = ""
    if c["price"]:
        label, _, amt = c["price"].partition(" ")
        price = ('<div class="hx-price">%s <b>%s</b> <small class="hx-asof">5월 기준</small></div>' % (label, amt)) if amt.endswith("원~") \
            else '<div class="hx-price">%s</div>' % c["price"]
    return ('<a class="hx-card" href="%s.html"><div class="hx-ph"><img src="%s" alt="%s" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">'
            '<span class="hx-badge">%s</span><div class="hx-txt"><h3>%s <small>%s</small></h3>%s<div class="hx-tags">%s</div></div></div>'
            '<div class="hx-strip">가이드 보기 →</div></a>') % (
        c["slug"], g["img"], g["alt"], c["tag"], c["name"], c["dur"], price, tags)


def rail(title, slugs, by, info):
    items = "".join(card_html(by[s], info[s]) for s in slugs if s in by)
    return ('<section class="hx-sec"><div class="container"><h2 class="hx-h">%s</h2></div>'
            '<div class="hx-rail">%s</div>'
            '<div class="container"><a class="hx-more" href="#destinations">여행지 가이드 전체 보기 <span>›</span></a></div></section>') % (title, items)


def put(src, name, block, anchor):
    """<!-- hx:name --> 블록을 갈아끼우거나, 없으면 anchor 앞에 삽입."""
    start, end = "<!-- hx:%s -->" % name, "<!-- /hx:%s -->" % name
    wrapped = "%s\n%s\n  %s\n" % (start, block, end)
    if start in src:
        return re.sub(re.escape(start) + r".*?" + re.escape(end) + r"\n", lambda _: wrapped, src, flags=re.S)
    i = src.index(anchor)
    return src[:i] + wrapped + "  " + src[i:]


def main():
    src = read("index.html")
    cs = cards(src)
    by = {c["slug"]: c for c in cs}
    info = {c["slug"]: guide_info(c["slug"]) for c in cs}
    if "--urls" in sys.argv:
        print("\n".join(sorted(set(i["img"] for i in info.values()))))
        return

    tabs = ('  <nav class="hx-tabs" id="hxTabs" aria-label="홈 메뉴">'
            '<a href="#hxTop" class="on">추천</a><a href="#hero" data-sw="flight">항공권</a><a href="#hero" data-sw="hotel">숙소</a>'
            '<a href="#destinations">여행지</a><a href="#essentials">필수템</a></nav>')
    chips = ('  <div class="hx-band" id="hxTop"><div class="container"><div id="hxNext"></div></div><div class="container hx-chips">'
             '<a href="/trips">🧳 내 여행 만들기</a><a href="airport.html">✈ 인천공항 <b class="hx-live">LIVE</b></a>'
             '<a href="#" onclick="return hxFx()">💱 환율 계산기</a><a href="#" onclick="return hxFxAlert()">🔔 환율 알림</a><a href="estimate.html">🧮 경비 계산</a><a href="prepare.html">✅ 출국 준비</a><a href="tours.html">🎟 투어·티켓</a></div></div>\n'
             + rail("🔥 지금 많이 찾는 여행지", PICKS, by, info) + "\n"
             + rail("🌴 따뜻한 휴양지 가이드", RESORTS, by, info))

    src = put(src, "tabs", tabs, "<!-- ── 환율 바 ── -->")
    src = put(src, "top", chips, '<section class="hero">')
    if 'id="hero"' not in src:
        src = src.replace('<section class="hero">', '<section class="hero" id="hero">', 1)

    # 목록 카드: 실사진 썸네일(이모지는 이미지 실패 시 폴백으로 남김)
    def thumb(m):
        block = m.group(0)
        if 'class="dest-img"' in block:
            return block
        slug = re.search(r'href="([a-z]+)\.html" class="dest-btn"', block).group(1)
        g = info[slug]
        img = '<img class="dest-img" src="%s" alt="%s" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">' % (g["img"], g["alt"])
        return re.sub(r'(<div class="dest-thumb"[^>]*>)', lambda x: x.group(1) + img, block, count=1)
    src = re.sub(r'<article class="dest-card".*?</article>', thumb, src, flags=re.S)

    # 필터 칩 개수
    counts = {}
    for c in cs:
        counts[c["cat"]] = counts.get(c["cat"], 0) + 1
    def fcount(m):
        on, cat, label = m.groups()
        label = re.sub(r' <span class="fc">\d+</span>$', "", label)
        n = len(cs) if cat == "전체" else counts.get(cat, 0)
        return '<button class="filter-btn%s" data-cat="%s" onclick="filterDest(\'%s\')">%s <span class="fc">%d</span></button>' % (
            on, cat, cat, label, n)
    src = re.sub(r'<button class="filter-btn([^"]*)" data-cat="([^"]+)" onclick="filterDest\(\'[^\']+\'\)">(.*?)</button>', fcount, src)

    if "/home-ui.js" not in src:
        src = src.replace('<script src="/nav.js" defer></script>', '<script src="/home-ui.js" defer></script>\n<script src="/nav.js" defer></script>', 1)
    if "/trips.js" not in src:   # '내 다음 여행' 카드가 TripStore를 읽음
        src = src.replace('<script src="/home-ui.js" defer></script>', '<script src="/trips.js"></script>\n<script src="/home-ui.js" defer></script>', 1)
    write("index.html", src)
    print("index.html updated:", len(cs), "cards")


if __name__ == "__main__":
    main()
