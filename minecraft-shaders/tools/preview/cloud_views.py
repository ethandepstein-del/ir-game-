#!/usr/bin/env python3
"""Uniform sets for the volumetric cloud preview (clouds.glsl).

    python3 cloud_views.py > views.json
    NODE_PATH=$(npm root -g) node render.cjs clouds.glsl clouds.png 640 360 "$(cat views.json)"

Tiles: noon, afternoon toward the sun, sunset toward the sun, sunset away
from the sun, dusk, moonlit night, rain, and looking straight up at noon.
"""
import json
import math


def sun(elevation_deg, azimuth_deg=0.0):
    e, a = math.radians(elevation_deg), math.radians(azimuth_deg)
    return [100 * math.cos(e) * math.sin(a), 100 * math.sin(e), -100 * math.cos(e) * math.cos(a)]


views = [
    # elev, exposure, rain, yaw, pitch
    (60, 1.0, 0, 120, 12),
    (25, 1.0, 0, 0, 10),
    (4, 1.4, 0, 0, 6),
    (4, 1.4, 0, 180, 10),
    (-4, 2.2, 0, 20, 8),
    (-40, 2.6, 0, 0, 20),
    (45, 1.2, 1, 90, 10),
    (60, 1.0, 0, 0, 55),
]
tiles = []
for elev, exposure, rain, yaw, pitch in views:
    s = sun(elev)
    tiles.append({
        "sunPosition": s,
        "shadowLightPosition": s if elev > 0 else [-x for x in s],
        "exposure": exposure,
        "rainStrength": rain,
        "frameTimeCounter": 100.0,
        "fogColor": [0.5, 0.6, 0.9],
        "view": 1.0,
        "yaw": yaw,
        "pitch": pitch,
    })
print(json.dumps(tiles))
