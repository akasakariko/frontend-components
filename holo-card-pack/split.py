#!/usr/bin/env python3
"""Split a captured page into the editable sources under src/.

    python3 split.py [captured.html]      # default: original/index.html

The split is byte-exact and reversible: build.py concatenates the parts back
into index.html and refuses to succeed unless the SHA-256 matches provenance.json.
Re-capture the page first if original/index.html is missing:

    curl -o original/index.html https://holo.yashb.xyz/
"""
import hashlib, json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent
SRC = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'original' / 'index.html'
PARTS = [
    'src/index.head.html',   # doctype .. <style>
    'src/styles.css',        # inside <style>
    'src/index.mid.html',    # </style> .. <script id="art">
    'src/art-data.js',       # the inline ART data
    'src/index.bridge.html', # </script><script>
    'src/app.js',            # the app logic
    'src/index.tail.html',   # </script> .. </html>
]

def span(text: str, open_tag: str, close_tag: str, start: int = 0) -> tuple[int, int]:
    i = text.index(open_tag, start) + len(open_tag)
    j = text.index(close_tag, i)
    return i, j

def main() -> int:
    text = SRC.read_text(encoding='utf-8')
    i_css, j_css = span(text, '<style>', '</style>')
    i_art, j_art = span(text, '<script id="art">', '</script>')
    i_main, j_main = span(text, '<script>', '</script>', j_art)
    cuts = [
        text[:i_css], text[i_css:j_css], text[j_css:i_art], text[i_art:j_art],
        text[j_art:i_main], text[i_main:j_main], text[j_main:],
    ]
    for name, body in zip(PARTS, cuts):
        (ROOT / name).write_bytes(body.encode('utf-8'))
        print(f'{name:24s} {len(body.encode()):>8d} bytes')

    rebuilt = ''.join(cuts).encode('utf-8')
    digest = hashlib.sha256(rebuilt).hexdigest()
    print('rebuilt sha256:', digest)
    print('matches source:', digest == hashlib.sha256(text.encode('utf-8')).hexdigest())
    prov = json.loads((ROOT / 'provenance.json').read_text())
    prov['parts'] = {name: len(body.encode()) for name, body in zip(PARTS, cuts)}
    (ROOT / 'provenance.json').write_text(json.dumps(prov, indent=2) + chr(10))
    return 0

if __name__ == '__main__':
    sys.exit(main())
