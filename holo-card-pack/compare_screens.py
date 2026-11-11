#!/usr/bin/env python3
"""Compare the screenshot pairs written by verify.mjs.

Exact byte equality is not expected: the page animates continuously and a few
sub-pixel values differ between any two runs, including two runs of the
deployed page itself. What is expected is that the two sides agree to within
antialiasing noise.

    python3 compare_screens.py [verify-out]
"""
import sys, pathlib

import numpy as np
from PIL import Image

OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'verify-out')
PHASES = ['idle', 'open', 'replay', 'open2']
# mean absolute channel difference and the share of pixels that differ visibly
MAX_MEAN = 0.10
MAX_LOUD = 0.20  # percent of pixels whose worst channel differs by more than 8/255

def main() -> int:
    ok = True
    for phase in PHASES:
        a_path, b_path = OUT / f'local_{phase}.png', OUT / f'live_{phase}.png'
        if not (a_path.exists() and b_path.exists()):
            print(f'{phase:7s} SKIP (missing screenshot)')
            continue
        a = np.asarray(Image.open(a_path).convert('RGB')).astype(int)
        b = np.asarray(Image.open(b_path).convert('RGB')).astype(int)
        if a.shape != b.shape:
            print(f'{phase:7s} FAIL size {a.shape} vs {b.shape}')
            ok = False
            continue
        diff = np.abs(a - b)
        mean = diff.mean()
        loud = (diff.max(axis=2) > 8).mean() * 100
        good = mean <= MAX_MEAN and loud <= MAX_LOUD
        ok &= good
        print(f'{phase:7s} {"ok  " if good else "FAIL"} mean {mean:.4f}  visible-diff pixels {loud:.3f}%  max {diff.max()}')
    print('PASS: screenshots agree within antialiasing noise' if ok else 'FAIL: screenshots differ')
    return 0 if ok else 1

if __name__ == '__main__':
    sys.exit(main())
