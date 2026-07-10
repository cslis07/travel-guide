#!/usr/bin/env python3
"""PWA 아이콘 PNG 생성 (폰트 비의존 — 비행기 도형을 직접 그림).

생성물:
  icons/icon-192.png          일반 아이콘
  icons/icon-512.png          일반 아이콘
  icons/icon-maskable-512.png 마스커블 (안전영역 80% 안쪽에 로고)
  icons/apple-touch-icon.png  iOS 홈화면 (180x180, 투명 배경 X)

실행: py scripts/make_icons.py
"""
from __future__ import annotations

import math
import pathlib

from PIL import Image, ImageDraw

BRAND_BG = (27, 79, 216)     # #1B4FD8 primary
GLYPH = (255, 255, 255)      # 흰 비행기
SS = 4                       # 슈퍼샘플링 배율 (안티에일리어싱)

OUT = pathlib.Path(__file__).resolve().parent.parent / "icons"


def plane_polygon(cx: float, cy: float, r: float, angle_deg: float = -45.0):
    """반지름 r 기준 종이비행기 실루엣 좌표. (cx,cy) 중심, angle만큼 회전."""
    # 위쪽을 향하는 비행기 (정규화 좌표, -1..1)
    pts = [
        (0.00, -1.00),   # 기수
        (0.14, -0.30),
        (0.95,  0.32),   # 오른쪽 날개 끝
        (0.95,  0.52),
        (0.16,  0.26),
        (0.13,  0.72),   # 오른쪽 꼬리
        (0.42,  0.94),
        (0.42,  1.00),
        (0.00,  0.82),   # 꼬리 중앙
        (-0.42, 1.00),
        (-0.42, 0.94),
        (-0.13, 0.72),
        (-0.16, 0.26),
        (-0.95, 0.52),
        (-0.95, 0.32),   # 왼쪽 날개 끝
        (-0.14, -0.30),
    ]
    a = math.radians(angle_deg)
    ca, sa = math.cos(a), math.sin(a)
    out = []
    for x, y in pts:
        rx = x * ca - y * sa
        ry = x * sa + y * ca
        out.append((cx + rx * r, cy + ry * r))
    return out


def render(size: int, *, radius_ratio: float, glyph_ratio: float) -> Image.Image:
    """size x size 아이콘 생성."""
    S = size * SS
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 라운드 사각 배경
    r = int(S * radius_ratio)
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=r, fill=BRAND_BG)

    # 비행기 글리프
    d.polygon(plane_polygon(S / 2, S / 2, S * glyph_ratio), fill=GLYPH)

    return img.resize((size, size), Image.LANCZOS)


def save(img: Image.Image, name: str, *, flatten: bool = False) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    if flatten:  # iOS는 투명도 없는 사각 아이콘 선호
        bg = Image.new("RGB", img.size, BRAND_BG)
        bg.paste(img, mask=img.split()[3])
        img = bg
    path = OUT / name
    img.save(path, "PNG", optimize=True)
    print(f"  {path.name:26s} {path.stat().st_size:>7,} bytes")


def main() -> None:
    print("PWA 아이콘 생성:")
    # 일반 아이콘: 라운드 코너, 글리프 큼
    save(render(192, radius_ratio=0.18, glyph_ratio=0.34), "icon-192.png")
    save(render(512, radius_ratio=0.18, glyph_ratio=0.34), "icon-512.png")
    # 마스커블: 전체가 배경(코너 라운딩 X), 글리프는 안전영역(중앙 80%) 안쪽 → 작게
    save(render(512, radius_ratio=0.00, glyph_ratio=0.26), "icon-maskable-512.png")
    # iOS 홈화면
    save(render(180, radius_ratio=0.18, glyph_ratio=0.34), "apple-touch-icon.png", flatten=True)
    print("완료 → icons/")


if __name__ == "__main__":
    main()
