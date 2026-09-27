#!/usr/bin/env python3
"""
run_dashboard.py — Launch local HTTP server for WIUT 2026 CV Hackathon Dashboard.
Serves the web/ directory and videos/ directory with full HTTP 206 Partial Content (Range) support.
"""
import os
import sys
import re
import mimetypes
import webbrowser
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

PORT = int(os.environ.get("PORT", 8080))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_DIR = os.path.join(BASE_DIR, "web")
VIDEOS_DIR = os.path.join(BASE_DIR, "videos")


class DashboardHandler(SimpleHTTPRequestHandler):
    """
    HTTP Handler supporting:
    - Web assets from web/
    - Video assets from videos/
    - HTTP 206 Partial Content Range streaming (essential for HTML5 video playback & seeking)
    - CORS and no-cache development headers
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)

    def resolve_local_path(self):
        clean_path = self.path.split("?", 1)[0].split("#", 1)[0]
        
        # Route /videos/ to VIDEOS_DIR
        if clean_path.startswith("/videos/"):
            rel_name = clean_path[len("/videos/"):]
            candidate = os.path.join(VIDEOS_DIR, rel_name)
            if os.path.exists(candidate):
                return candidate
            # Check web/videos as fallback
            candidate2 = os.path.join(WEB_DIR, "videos", rel_name)
            if os.path.exists(candidate2):
                return candidate2

        # Direct root or web files
        if clean_path == "/" or clean_path == "":
            return os.path.join(WEB_DIR, "index.html")

        # Standard web asset
        norm = os.path.normpath(clean_path.lstrip("/"))
        candidate = os.path.join(WEB_DIR, norm)
        if os.path.exists(candidate):
            return candidate

        # Fallback check in videos
        candidate_vid = os.path.join(VIDEOS_DIR, norm)
        if os.path.exists(candidate_vid):
            return candidate_vid

        return None

    def guess_file_type(self, filepath):
        ctype, _ = mimetypes.guess_type(filepath)
        if ctype is None:
            if filepath.endswith(".mp4") or filepath.endswith(".MP4"):
                ctype = "video/mp4"
            elif filepath.endswith(".webm"):
                ctype = "video/webm"
            elif filepath.endswith(".jpg") or filepath.endswith(".jpeg"):
                ctype = "image/jpeg"
            elif filepath.endswith(".png"):
                ctype = "image/png"
            elif filepath.endswith(".js"):
                ctype = "application/javascript"
            elif filepath.endswith(".css"):
                ctype = "text/css"
            elif filepath.endswith(".html"):
                ctype = "text/html"
            elif filepath.endswith(".json"):
                ctype = "application/json"
            else:
                ctype = "application/octet-stream"
        return ctype

    def do_HEAD(self):
        filepath = self.resolve_local_path()
        if not filepath or not os.path.isfile(filepath):
            self.send_error(404, "File not found")
            return

        total_size = os.path.getsize(filepath)
        ctype = self.guess_file_type(filepath)
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(total_size))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

    def do_GET(self):
        filepath = self.resolve_local_path()
        if not filepath or not os.path.isfile(filepath):
            # Let default handler handle or return 404
            return super().do_GET()

        total_size = os.path.getsize(filepath)
        ctype = self.guess_file_type(filepath)
        range_header = self.headers.get("Range")

        # If no Range header, stream standard 200 OK
        if not range_header:
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(total_size))
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()

            with open(filepath, "rb") as f:
                self.copy_chunks(f, self.wfile, total_size)
            return

        # Parse HTTP Range Header: e.g. bytes=0-1048575, bytes=1024-, bytes=-500
        m = re.match(r"bytes=(\d*)-(\d*)", range_header)
        if not m:
            self.send_error(416, "Requested Range Not Satisfiable")
            return

        start_str, end_str = m.groups()
        if start_str and end_str:
            start = int(start_str)
            end = int(end_str)
        elif start_str:
            start = int(start_str)
            end = total_size - 1
        elif end_str:
            start = max(0, total_size - int(end_str))
            end = total_size - 1
        else:
            self.send_error(416, "Requested Range Not Satisfiable")
            return

        if start >= total_size or end >= total_size or start > end:
            self.send_error(416, "Requested Range Not Satisfiable")
            return

        length = end - start + 1
        self.send_response(206)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Range", f"bytes {start}-{end}/{total_size}")
        self.send_header("Content-Length", str(length))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Range")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()

        with open(filepath, "rb") as f:
            f.seek(start)
            self.copy_chunks(f, self.wfile, length)

    def copy_chunks(self, source, dest, length, buf_size=64 * 1024):
        remaining = length
        while remaining > 0:
            read_size = min(buf_size, remaining)
            chunk = source.read(read_size)
            if not chunk:
                break
            try:
                dest.write(chunk)
                remaining -= len(chunk)
            except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, OSError):
                break


def main():
    server_address = ("", PORT)
    try:
        httpd = ThreadingHTTPServer(server_address, DashboardHandler)
    except OSError:
        httpd = ThreadingHTTPServer(("", PORT + 1), DashboardHandler)
        print(f"Port {PORT} busy, using {PORT + 1}")

    actual_port = httpd.server_address[1]
    url = f"http://localhost:{actual_port}/index.html"
    print(f"=======================================================")
    print(f"[RUNNING] WIUT 2026 CV Hackathon Dashboard at: {url}")
    print(f"Video Streaming & Partial Content (HTTP 206) Enabled.")
    print(f"Press Ctrl+C to stop the server.")
    print(f"=======================================================")
    try:
        webbrowser.open(url)
    except Exception:
        pass
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping dashboard server...")
        httpd.server_close()


if __name__ == "__main__":
    main()
