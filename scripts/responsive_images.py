"""가이드 사진을 화면 크기에 맞게 — 위키미디어 1280px 사진에 srcset/sizes 를 붙인다(다시 돌려도 안전).

    python scripts/responsive_images.py          # 가이드 23쪽 전부
    python scripts/responsive_images.py osaka    # 한 쪽만

왜: 360px 폰에서도 1280px 원본(장당 370~525KB)을 받아 가이드 한 쪽이 1.8MB, 첫 화면까지 7초였다(2026-11-06 실측).
위키미디어 썸네일은 정해진 크기만 준다 — 330·500·960·1280px 은 되고 640px 은 400(2026-11-06 확인).

sizes 는 실제 표시 폭보다 일부러 작게 잡아 폰(화면 배율 3)에서 사진 장당 500px(약 65KB)를 받게 한다
(배율 1.6 정도 — 작은 카드 사진은 눈으로 차이가 거의 없다). 맨 위 표지는 960px 까지.
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GUIDES = ["bali", "bangkok", "busan", "cebu", "changbaishan", "danang", "fukuoka", "gangneung", "guilin", "hongkong",
          "jeju", "kotakinabalu", "kyoto", "nhatrang", "okinawa", "osaka", "paris", "sapporo", "shanghai", "singapore",
          "taipei", "tokyo", "zhangjiajie"]
WIDTHS = (330, 500, 960, 1280)
# 사진을 감싼 요소 class → sizes (폰 / 넓은 화면)
SIZES = {
    "gx-slide": "(max-width:700px) 166px, 451px",
    "cover": "(max-width:700px) 320px, 100vw",
    "place-photo": "(max-width:700px) 166px, 330px",
    "food-card": "(max-width:700px) 166px, 360px",
}
DEFAULT = "(max-width:700px) 166px, 360px"
IMG = re.compile(r'<img\b[^>]*>', re.S)
SRC = re.compile(r'\bsrc="(https://upload\.wikimedia\.org/[^"]*/)1280px-([^"]+)"')
CLS = re.compile(r'class="([^"]+)"')


def convert(html):
    out, last, n = [], 0, 0
    for m in IMG.finditer(html):
        tag = m.group(0)
        s = SRC.search(tag)
        if not s or "srcset=" in tag:
            continue
        base, name = s.group(1), s.group(2)
        before = html[max(0, m.start() - 300):m.start()]
        classes = CLS.findall(before)
        ctx = next((k for c in reversed(classes) for k in SIZES if k in c.split()), None)
        sizes = SIZES.get(ctx, DEFAULT)
        srcset = ", ".join("%s%dpx-%s %dw" % (base, w, name, w) for w in WIDTHS)
        new = tag.replace(s.group(0), 'src="%s500px-%s" srcset="%s" sizes="%s"' % (base, name, srcset, sizes), 1)
        out.append(html[last:m.start()]); out.append(new); last = m.end(); n += 1
    out.append(html[last:])
    return "".join(out), n


def main():
    slugs = sys.argv[1:] or GUIDES
    total = 0
    for slug in slugs:
        p = os.path.join(ROOT, slug + ".html")
        raw = open(p, "rb").read().decode("utf-8")
        crlf = "\r\n" in raw
        html, n = convert(raw.replace("\r\n", "\n"))
        if n:
            open(p, "wb").write((html.replace("\n", "\r\n") if crlf else html).encode("utf-8"))
        total += n
        print("%-14s %d" % (slug, n))
    print("total", total)


if __name__ == "__main__":
    main()
