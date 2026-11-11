#!/usr/bin/env python3
"""Assemble index.html from the split sources in src/.

The parts are a byte-exact split of the captured page, so a clean build
reproduces the deployed artifact's SHA-256 exactly.
"""
import hashlib, json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent
PARTS = [
    'src/index.head.html',
    'src/styles.css',
    'src/index.mid.html',
    'src/art-data.js',
    'src/index.bridge.html',
    'src/app.js',
    'src/index.tail.html',
]

def build() -> pathlib.Path:
    # read and write bytes: text mode would translate line endings and could
    # silently change the artifact
    data = b''.join((ROOT / part).read_bytes() for part in PARTS)
    out = ROOT / 'index.html'
    out.write_bytes(data)
    return out

if __name__ == '__main__':
    out = build()
    data = out.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    expected = json.loads((ROOT / 'provenance.json').read_text())['sha256']
    print(f'built {out.name}  {len(data)} bytes')
    print(f'sha256 {digest}')
    print('byte-identical to deployed page:', digest == expected)
    sys.exit(0 if digest == expected else 1)
