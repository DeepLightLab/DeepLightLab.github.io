"""Serve the presentation with live, read-only results from the running benchmark."""
import argparse
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

from build_data import SITE, collect_results, export_snapshot, utc_now


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    snapshot = export_snapshot()

    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=str(SITE), **kw)

        def do_GET(self):
            if urlsplit(self.path).path == "/api/results":
                rows, warnings = collect_results({d["id"] for d in snapshot["datasets"]})
                body = json.dumps({**snapshot, "results": rows, "warnings": warnings,
                                   "generatedAt": utc_now()}, ensure_ascii=False, allow_nan=False).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            super().do_GET()

    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"NIRBENCH presentation: http://127.0.0.1:{args.port}/", flush=True)
    print("Results refresh in the browser every 30 seconds. Ctrl+C stops only this web server.", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
