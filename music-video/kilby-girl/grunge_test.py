"""Style tests: one frame of live footage in three grunge treatments.

    python3 grunge_test.py frame.png out.png "MAY 16 2026" "9:19 PM"
"""
import sys

import numpy as np
import scipy.ndimage as nd
from PIL import Image, ImageDraw, ImageFont

src, out = sys.argv[1], sys.argv[2]
date, clock = (sys.argv[3], sys.argv[4]) if len(sys.argv) > 4 else ('MAY 16 2026', '9:19 PM')
FONTS = __file__.rsplit('/', 1)[0] + '/fonts/'
rng = np.random.default_rng(7)
img = np.asarray(Image.open(src).convert('RGB')).astype(np.float32) / 255
img = img[: int(img.shape[0] * 0.9)]
H, W, _ = img.shape


def lum(x):
    return x[..., 0] * 0.299 + x[..., 1] * 0.587 + x[..., 2] * 0.114


def noise(shape, scale, seed):
    r = np.random.default_rng(seed).random((shape[0] // scale + 2, shape[1] // scale + 2))
    return nd.zoom(r, scale, order=3)[: shape[0], : shape[1]]


def font(name, size):
    return ImageFont.truetype(FONTS + name, size)


# ---------------------------------------------------------------- A: photocopied zine
def xerox(x):
    g = lum(x)
    # local contrast first so faces and bodies survive the copier
    g = np.clip((g - nd.gaussian_filter(g, 40)) * 2.2 + nd.gaussian_filter(g, 40) * 0.6 + 0.15, 0, 1)
    g = nd.gaussian_filter(g, 0.7)
    lo, hi = np.percentile(g, 12), np.percentile(g, 96)
    g = np.clip((g - lo) / (hi - lo), 0, 1)
    thr = 0.5 + (noise(g.shape, 1, 1) - 0.5) * 0.4 + (noise(g.shape, 4, 2) - 0.5) * 0.2
    toner = (g < thr).astype(np.float32)
    # copier streaks and dust
    cols = (noise((1, W), 2, 3)[0] > 0.95).astype(np.float32)
    streak = np.broadcast_to(cols, (H, W)) * (noise(g.shape, 40, 4) > 0.5)
    toner = np.clip(toner + streak * 0.7 + (np.random.default_rng(5).random(g.shape) > 0.9985), 0, 1)
    # one spot colour, only for the lights: the brightest, most saturated specks
    mx, mn = x.max(-1), x.min(-1)
    sat = (mx - mn) / (mx + 1e-4)
    hot = (mx > np.percentile(mx, 97.5)) | ((sat > 0.6) & (mx > np.percentile(mx, 93)))
    spot = nd.gaussian_filter(hot.astype(np.float32), 3.5)
    spot = (spot > 0.18 + (noise(g.shape, 2, 6) - 0.5) * 0.2).astype(np.float32)
    paper = np.array([0.93, 0.91, 0.85]) * (0.95 + 0.05 * noise(g.shape, 60, 8))[..., None]
    orange = np.array([1.0, 0.36, 0.06])
    o = paper * (1 - spot[..., None] * (1 - orange))
    tk = np.roll(np.roll(toner, 3, 0), -2, 1)
    o = o * (1 - tk[..., None] * 0.93)
    o = Image.fromarray((np.clip(o, 0, 1) * 255).astype(np.uint8))
    d = ImageDraw.Draw(o)
    # title on a torn paper strip so it reads over the image
    strip = [(0, H * 0.035), (W * 0.9, H * 0.025), (W * 0.93, H * 0.14), (W * 0.02, H * 0.15)]
    d.polygon(strip, fill=(236, 230, 214))
    f1 = font('PermanentMarker-Regular.ttf', int(W * 0.105))
    d.text((W * 0.05, H * 0.035), 'THE BED HEADS', fill=(20, 18, 16), font=f1)
    f2 = font('SpecialElite-Regular.ttf', int(W * 0.06))
    d.rectangle([W * 0.05, H * 0.88, W * 0.52, H * 0.88 + W * 0.09], fill=(255, 92, 15))
    d.text((W * 0.07, H * 0.884), 'KILBY GIRL', fill=(20, 18, 16), font=f2)
    for (cx, cy, a) in [(W * 0.86, H * 0.03, 8), (W * 0.14, H * 0.985, -6)]:
        tape = Image.new('RGBA', (int(W * 0.3), int(W * 0.07)), (228, 214, 170, 210))
        tape = tape.rotate(a, expand=True)
        o.paste(tape, (int(cx - tape.width / 2), int(cy - tape.height / 2)), tape)
    return o


# ---------------------------------------------------------------- B: camcorder bootleg
def camcorder(x):
    h2, w2 = H // 3, W // 3
    small = np.asarray(Image.fromarray((x * 255).astype(np.uint8)).resize((w2, h2), Image.BILINEAR)).astype(np.float32) / 255
    x = np.asarray(Image.fromarray((small * 255).astype(np.uint8)).resize((W, H), Image.BILINEAR)).astype(np.float32) / 255
    # tape look: lifted blacks, hot reds, blooming highlights
    x = np.clip(x * 1.15 + 0.04, 0, 1)
    bloom = nd.gaussian_filter(np.clip(x - 0.6, 0, 1), (9, 9, 0)) * 1.4
    x = np.clip(x + bloom, 0, 1)
    Y = lum(x)
    Cb, Cr = x[..., 2] - Y, x[..., 0] - Y
    # chroma bleeds sideways and lags the luma
    Cb = np.roll(nd.gaussian_filter(Cb, (1, 7)), 6, 1) * 1.25
    Cr = np.roll(nd.gaussian_filter(Cr, (1, 7)), 8, 1) * 1.35
    Y = Y + (np.random.default_rng(3).random(Y.shape) - 0.5) * 0.07
    r = Y + Cr
    b = Y + Cb
    g = (Y - 0.299 * r - 0.114 * b) / 0.587
    o = np.clip(np.stack([r, g, b], -1), 0, 1)
    # line jitter and a tracking band near the bottom
    rows = np.arange(H)
    shift = (np.random.default_rng(4).random(H) - 0.5) * 2.5
    band = np.exp(-((rows - H * 0.9) / (H * 0.018)) ** 2)
    shift += band * 28 * (np.random.default_rng(5).random(H) - 0.3)
    shift[int(H * 0.975):] += 22
    o = np.stack([np.stack([np.roll(o[i, :, c], int(shift[i])) for c in range(3)], -1) for i in range(H)])
    o[int(H * 0.975):] = o[int(H * 0.975):] * 0.6 + np.random.default_rng(6).random((H - int(H * 0.975), W, 1)) * 0.4
    o = np.clip(o + band[:, None, None] * (np.random.default_rng(7).random((H, W, 1)) > 0.8) * 0.5, 0, 1)
    o[::2] *= 0.94
    o = Image.fromarray((o * 255).astype(np.uint8))
    d = ImageDraw.Draw(o)
    f = font('SpecialElite-Regular.ttf', int(W * 0.06))
    for dx, dy, col in [(3, 3, (0, 0, 0)), (0, 0, (255, 236, 120))]:
        d.text((W * 0.06 + dx, H * 0.83 + dy), clock, fill=col, font=f)
        d.text((W * 0.06 + dx, H * 0.87 + dy), date, fill=col, font=f)
        d.text((W * 0.06 + dx, H * 0.04 + dy), '▶ PLAY', fill=col, font=f)
    return o


# ---------------------------------------------------------------- C: Super 8
def super8(x):
    # warm, faded grade with crushed blacks
    x = np.clip(x, 0, 1) ** np.array([0.85, 0.95, 1.15])
    x = x * np.array([1.12, 1.0, 0.82]) + np.array([0.05, 0.03, 0.0])
    x = nd.gaussian_filter(x, (1.2, 1.2, 0))
    grain = nd.gaussian_filter(np.random.default_rng(9).normal(0, 1, (H, W)), 0.9) * 0.09
    x = x + grain[..., None]
    yy, xx = np.mgrid[0:H, 0:W]
    v = 1 - 0.55 * (((xx / W - 0.5) * 1.6) ** 2 + ((yy / H - 0.5) * 1.1) ** 2) ** 1.3
    x = x * np.clip(v, 0, 1)[..., None]
    # light leak from the right edge
    leak = np.clip((xx / W - 0.72) * 3.2, 0, 1) * np.clip(1 - np.abs(yy / H - 0.35) * 1.6, 0, 1)
    x = x + leak[..., None] * np.array([0.9, 0.35, 0.05])
    # dust and scratches
    dust = (np.random.default_rng(10).random((H, W)) > 0.9994).astype(np.float32)
    dust = nd.binary_dilation(dust, iterations=2).astype(np.float32)
    x = x * (1 - dust[..., None] * 0.8)
    for sx in [int(W * 0.31), int(W * 0.66)]:
        x[:, sx:sx + 2] = x[:, sx:sx + 2] * 0.5 + 0.45
    # rounded film gate
    m = ((np.abs(xx - W / 2) / (W * 0.47)) ** 8 + (np.abs(yy - H / 2) / (H * 0.475)) ** 8) < 1
    x = np.where(m[..., None], x, 0.03)
    return Image.fromarray((np.clip(x, 0, 1) * 255).astype(np.uint8))


panels = [xerox(img), camcorder(img), super8(img)]
labels = ['A  PHOTOCOPIED ZINE', 'B  CAMCORDER BOOTLEG', 'C  SUPER 8']
gap = 24
sheet = Image.new('RGB', (W * 3 + gap * 4, H + 110), (18, 16, 22))
d = ImageDraw.Draw(sheet)
lf = font('Anton-Regular.ttf', 54)
for i, (p, lab) in enumerate(zip(panels, labels)):
    sheet.paste(p, (gap + i * (W + gap), 90))
    d.text((gap + i * (W + gap), 18), lab, fill=(240, 232, 214), font=lf)
sheet.save(out)
