#!/usr/bin/env python3
"""Serve this component locally: python3 serve.py [port]  (default 8000)."""
import functools, http.server, pathlib, socketserver, sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
ROOT = pathlib.Path(__file__).resolve().parent

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

if __name__ == '__main__':
    handler = functools.partial(Handler, directory=str(ROOT))
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(('127.0.0.1', PORT), handler) as httpd:
        print(f'http://127.0.0.1:{PORT}/  ->  {ROOT}')
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
