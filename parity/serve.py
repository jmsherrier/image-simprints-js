"""Serve this repository to the headless browser and collect what it posts.

    python parity/serve.py [port]

GET serves files from the repository root. POST /result/<name> writes the body to
parity/results/<name>.json; POST /done stops the server.
"""

import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).parents[1]
OUT = ROOT / "parity" / "results"


class Handler(SimpleHTTPRequestHandler):
    extensions_map = SimpleHTTPRequestHandler.extensions_map | {".js": "text/javascript", ".mjs": "text/javascript",
                                                                ".wasm": "application/wasm", ".avif": "image/avif"}

    def do_POST(self):
        body = self.rfile.read(int(self.headers["Content-Length"]))
        name = self.path.strip("/").split("/", 1)
        self.send_response(204)
        self.end_headers()
        if name[0] == "result":
            (OUT / f"{Path(name[1]).name}.json").write_bytes(body)
        elif name[0] == "log":
            print(body.decode(), flush=True)
        elif name[0] == "done":
            self.server.shutdown_requested = True

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    srv = ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1]) if len(sys.argv) > 1 else 8765),
                              partial(Handler, directory=str(ROOT)))
    srv.shutdown_requested = False
    srv.timeout = 1
    while not srv.shutdown_requested:
        srv.handle_request()
