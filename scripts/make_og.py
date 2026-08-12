#!/usr/bin/env python3
"""OG 소셜 공유 이미지 생성 (1200x630).

폰트가 있으면 텍스트를, 없으면 도형 위주로 안전하게 렌더한다.
실행: py scripts/make_og.py
"""
from __future__ import annotations

import math
import pathlib

from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
SS = 2  # 슈퍼샘플링

OUT = pathlib.Path(__file__).resolve().parent.parent / "og-image.png"

# 브랜드 색
C_TOP = (22, 64, 176)     # #1640B0
C_MID = (27, 79, 216)     # #1B4FD8
C_ACC = (249, 115, 22)    # #F97316
WHITE = (255, 255, 255)


def find_font(size: int):
    """한글 지원 폰트를 찾는다. 없으면 기본 폰트."""
    candidates = [
        r"C:\Windows\Fonts\malgunbd.ttf",   # 맑은 고딕 Bold
        r"C:\Windows\Fonts\malgun.ttf",     # 맑은 고딕
        r"C:\Windows\Fonts\NanumGothicBold.ttf",
        "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf",
    ]
    for c in candidates:
        if pathlib.Path(c).exists():
            try:
                return ImageFont.truetype(c, size)
            except OSError:
                pass
    return ImageFont.load_default()


def gradient(w: int, h: int) -> Image.Image:
    """대각선 그라데이션 (C_TOP → C_MID → C_ACC 살짝)."""
    base = Image.new("RGB", (w, h), C_MID)
    top = Image.new("RGB", (w, h), C_TOP)
    mask = Image.new("L", (w, h))
    md = mask.load()
    for y in range(h):
        for x in range(0, w, 4):  # 4px 스텝(속도)
            t = (x / w * 0.6 + y / h * 0.4)
            v = int(max(0, min(255, 255 * (1 - t))))
            for dx in range(4):
                if x + dx < w:
                    md[x + dx, y] = v
    base.paste(top, (0, 0), mask)
    return base


def plane(cx, cy, r, angle_deg=-40):
    pts = [
        (0.00, -1.00), (0.14, -0.30), (0.95, 0.32), (0.95, 0.52),
        (0.16, 0.26), (0.13, 0.72), (0.42, 0.94), (0.42, 1.00),
        (0.00, 0.82), (-0.42, 1.00), (-0.42, 0.94), (-0.13, 0.72),
        (-0.16, 0.26), (-0.95, 0.52), (-0.95, 0.32), (-0.14, -0.30),
    ]
    a = math.radians(angle_deg)
    ca, sa = math.cos(a), math.sin(a)
    return [(cx + (x*ca - y*sa)*r, cy + (x*sa + y*ca)*r) for x, y in pts]


def main():
    w, h = W*SS, H*SS
    img = gradient(w, h).convert("RGBA")
    d = ImageDraw.Draw(img)

    # 우측 큰 비행기 워터마크 (반투명)
    wm = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    wd = ImageDraw.Draw(wm)
    wd.polygon(plane(w*0.80, h*0.42, w*0.26), fill=(255, 255, 255, 28))
    img = Image.alpha_composite(img, wm)
    d = ImageDraw.Draw(img)

    # 작은 비행기 + 로고 텍스트
    d.polygon(plane(90*SS, 92*SS, 34*SS, angle_deg=-40), fill=WHITE)

    f_logo = find_font(34*SS)
    f_title = find_font(76*SS)
    f_sub = find_font(38*SS)
    f_chip = find_font(28*SS)

    d.text((140*SS, 70*SS), "트래블코스트", font=f_logo, fill=WHITE)

    # 메인 타이틀 (2줄) — 제품 축이 '가이드·메타서치'에서 '견적·출국준비'로 바뀌었다
    d.text((90*SS, 210*SS), "다 합쳐서", font=f_title, fill=WHITE)
    d.text((90*SS, 305*SS), "얼마 드는데?", font=f_title, fill=(255, 220, 190))

    # 서브
    d.text((92*SS, 420*SS), "항공·숙소·식비·투어까지 한 번에 · 언제 뭘 준비할지까지",
           font=f_sub, fill=(220, 230, 255))

    # 하단 칩 (불투명 흰 알약 + 파란 글자로 대비 확보)
    chips = ["예산 견적", "출국 준비", "인천공항 실시간", "가격 비교"]
    x = 92*SS
    y = 498*SS
    for c in chips:
        bbox = d.textbbox((0, 0), c, font=f_chip)
        tw = bbox[2] - bbox[0]
        pad = 24*SS
        d.rounded_rectangle([x, y, x + tw + pad*2, y + 60*SS],
                            radius=30*SS, fill=(255, 255, 255, 235))
        d.text((x + pad, y + 13*SS), c, font=f_chip, fill=C_MID)
        x += tw + pad*2 + 16*SS

    # 다운샘플 저장
    img.convert("RGB").resize((W, H), Image.LANCZOS).save(OUT, "PNG", optimize=True)
    print(f"OG 이미지 생성: {OUT.name} {OUT.stat().st_size:,} bytes ({W}x{H})")


if __name__ == "__main__":
    main()
