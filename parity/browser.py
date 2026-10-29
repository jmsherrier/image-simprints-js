"""Run parity/run.html in headless Chromium (Edge or Chrome) and wait until it is done.

    python parity/browser.py [--build out|out-simd] [--limit N] [--browser PATH]

Results go to parity/results/<build>.
"""

import argparse
import shutil
import subprocess
import tempfile
from pathlib import Path

HERE = Path(__file__).parent
CANDIDATES = [r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
              r"C:\Program Files\Google\Chrome\Application\chrome.exe", "chromium", "google-chrome", "msedge"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--build", default="out")
    ap.add_argument("--limit", default="")
    ap.add_argument("--browser")
    ap.add_argument("--port", default="8765")
    a = ap.parse_args()
    exe = a.browser or next(c for c in CANDIDATES if Path(c).exists() or shutil.which(c))
    shutil.rmtree(HERE / "results" / a.build, ignore_errors=True)
    server = subprocess.Popen(["python", str(HERE / "serve.py"), a.port])
    url = f"http://127.0.0.1:{a.port}/parity/run.html?build={a.build}&limit={a.limit or 10**9}"
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as profile:
        browser = subprocess.Popen([exe, "--headless=new", f"--user-data-dir={profile}", "--no-first-run",
                                    "--disable-extensions", "--disable-background-timer-throttling", url],
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            server.wait()  # serve.py exits when the page posts /done
        finally:
            browser.kill()
            browser.wait()


if __name__ == "__main__":
    main()
