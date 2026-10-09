"""
The static server behind `npm run dev`. Every response says `no-store`, so a page always loads
the latest `dist-elements/` build instead of a module the browser kept from an earlier one.
"""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoStoreHandler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


ThreadingHTTPServer(("", 5180), partial(NoStoreHandler, directory=".")).serve_forever()
