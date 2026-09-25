#!/usr/bin/env python3
"""Print the uniform sets for a six-tile time-of-day sky preview.

    python3 sky_times.py > tiles.json
    node render.cjs sky.glsl sky.png 640 300 "$(cat tiles.json)"
"""
import json
import math


def sun(elevation_deg):
    e = math.radians(elevation_deg)
    return [0.0, 100 * math.sin(e), -100 * math.cos(e)]


tiles = []
for elev, exposure, rain in [(60, 1.0, 0), (20, 1.0, 0), (3, 1.4, 0), (-4, 2.2, 0), (-40, 2.6, 0), (45, 1.2, 1)]:
    s = sun(elev)
    tiles.append({
        "sunPosition": s,
        "shadowLightPosition": s if elev > 0 else [-x for x in s],
        "exposure": exposure,
        "rainStrength": rain,
        "frameTimeCounter": 100.0,
        "fogColor": [0.5, 0.6, 0.9],
    })
print(json.dumps(tiles))
