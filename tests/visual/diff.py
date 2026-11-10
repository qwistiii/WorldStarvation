# Compares old-*.png and new-*.png screenshots: mean absolute error (0–255) and the share of pixels that differ by more
# than 24 levels in any channel; writes a heat map diff-*.png for each view. python tests/visual/diff.py DIR name...
import sys
from PIL import Image, ImageChops
import numpy as np
d = sys.argv[1]
worst = 0
for n in sys.argv[2:]:
    a = np.asarray(Image.open(f'{d}/old-{n}.png').convert('RGB')).astype(np.int16)
    b = np.asarray(Image.open(f'{d}/new-{n}.png').convert('RGB')).astype(np.int16)
    e = np.abs(a - b)
    mae = e.mean()
    big = (e.max(axis=2) > 24).mean() * 100
    worst = max(worst, big)
    h = np.clip(e.max(axis=2) * 4, 0, 255).astype(np.uint8)
    Image.fromarray(h).save(f'{d}/diff-{n}.png')
    print(f'{n:20s} MAE {mae:5.2f}  pixels >24: {big:5.2f} %')
print(f'worst {worst:.2f} %')
