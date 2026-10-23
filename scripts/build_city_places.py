"""가이드 23곳 → city-places.js (도시별 구역·추천 장소·음식). 내 여행의 '장소 추천 칩'과 '가이드 연결 카드'가 읽는다.
가이드 내용이 바뀌면 다시 실행: python scripts/build_city_places.py   (레포 루트에서)
"""
import io
import json
import re

GUIDES = ["osaka", "fukuoka", "tokyo", "kyoto", "sapporo", "okinawa", "shanghai", "taipei", "hongkong",
          "guilin", "zhangjiajie", "changbaishan", "bangkok", "danang", "bali", "singapore", "nhatrang",
          "cebu", "kotakinabalu", "jeju", "busan", "gangneung", "paris"]


def text(s):
    return re.sub(r"<[^>]+>", "", s).replace("&amp;", "&").strip()


def main():
    out = {}
    for slug in GUIDES:
        s = io.open(slug + ".html", encoding="utf-8").read()
        city = re.search(r"city:'([^']+)'", s).group(1)
        zones = []
        for art in re.findall(r'<article class="destination" id="[^"]+">(.*?)</article>', s, re.S):
            name = re.sub(r"^[①-⑩]\s*", "", text(re.search(r'<div class="cover-text">.*?<h2>(.*?)</h2>', art, re.S).group(1)))
            places = [text(p) for p in re.findall(r'<div class="place-content">\s*<b>(.*?)</b>', art, re.S)]
            foods = [text(f) for f in re.findall(r'<div class="food-pill">\s*<b>(.*?)</b>', art, re.S)]
            zones.append({"name": name, "places": places, "foods": foods})
        out[city] = {"slug": slug, "zones": zones}
    body = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
    js = ("/* 자동 생성 — scripts/build_city_places.py (가이드 23곳의 구역·추천 장소·음식). 직접 고치지 말 것 */\n"
          "window.CITY_PLACES=" + body + ";\n"
          "window.cityPlaces=function(c){c=String(c||'');var P=window.CITY_PLACES;if(P[c])return P[c];"
          "for(var k in P){if(c.indexOf(k)>-1)return P[k];}return null;};\n")
    io.open("city-places.js", "w", encoding="utf-8", newline="\n").write(js)
    n = sum(len(z["places"]) + len(z["foods"]) for v in out.values() for z in v["zones"])
    print("city-places.js:", len(out), "cities,", n, "names,", len(js.encode()), "bytes")


if __name__ == "__main__":
    main()
