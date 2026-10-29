"""Compare a browser run (parity/results/<run>) with Python (parity/data/python.json).

    python parity/compare.py <run> > parity/summary-<run>.md
"""

import collections
import gzip
import json
import statistics
import sys
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent
T = 24
EXPECTED = {
    "identical": "identical", "resize50": "identical", "resize25": "identical",
    "jpeg60": "identical", "webp60": "identical", "avif50": "identical",
    "bright_contrast": "identical", "greyscale": "identical", "rotate90": "identical",
    "rotate15": "contained_in",
    **{f"crop{a}": "contained_in" for a in (90, 70, 50, 30, 20, 10)},
    **{f"collage{a}": "contains" for a in (50, 30, 15)},
    **{f"collage{a} reversed": "contained_in" for a in (50, 30, 15)},
    **{f"overlap{a}": "overlapping" for a in (50, 30, 15)},
}  # fmt: skip


def dist(a: str, b: str) -> int:
    return (int(a, 16) ^ int(b, 16)).bit_count()


class Codes:
    """Browser codes against Python codes of the same images."""

    def __init__(self):
        self.images = self.same_count = self.codes = self.exact = self.near = self.anynear = 0
        self.same_xy = 0
        self.bits = collections.Counter()

    def add(self, py, br):
        self.images += 1
        a, b = py["codes"], br["codes"]
        self.same_count += len(a) == len(b)
        for n, c in enumerate(b):
            self.codes += 1
            if n < len(a):
                d = dist(c["code"], a[n]["code"])
                self.bits[min(d, 99)] += 1
                self.exact += d == 0
                self.near += d <= T
                self.same_xy += abs(c["x"] - a[n]["x"]) < 1e-5 and abs(c["y"] - a[n]["y"]) < 1e-5
            self.anynear += any(dist(c["code"], x["code"]) <= T for x in a)

    def row(self, label):
        p = lambda x: f"{x / max(self.codes, 1):.2%}"  # noqa: E731
        return (f"| {label} | {self.images} | {self.same_count / max(self.images, 1):.1%} | {self.codes} | {p(self.same_xy)} | "
                f"{p(self.exact)} | {p(self.near)} | {p(self.anynear)} |")


def stats(v):
    v = sorted(v)
    return f"{statistics.median(v):.0f} / {v[int(0.95 * (len(v) - 1))]:.0f}"


def main():
    py = json.loads((HERE / "data" / "python.json").read_text(encoding="utf-8"))
    run = sys.argv[1] if len(sys.argv) > 1 else "convert"
    res = {p.stem: json.loads(p.read_text(encoding="utf-8")) for p in (HERE / "results" / run).glob("*.json")}
    vec = res.pop("vectors")
    sfx = "_ignore" if vec["profiles"] == "ignore" else ""
    out = []
    size = (ROOT / "build" / vec["build"] / "bin" / "opencv.js").read_bytes()
    simd = "SIMD" if vec["build"] == "out-simd" else "no SIMD"
    out.append(f"# Browser parity, recipe 2, colour profiles: {vec['profiles']}\n")
    out.append(f"Browser: `{vec['userAgent']}`. OpenCV.js 5.0.0 (WebAssembly, single file, {simd}, no threads), "
               f"{len(size) / 1e6:.1f} MB, {len(gzip.compress(size, 9)) / 1e6:.1f} MB gzipped; ready in "
               f"{vec['opencv_load_ms']:.0f} ms.\n")

    out.append("## Test vectors (creator, default settings)\n")
    out.append("| image | codes (Python / browser) | same keypoints | identical codes | within t |\n| --- | --- | --- | --- | --- |")
    for name, e in vec["expected"].items():
        b = vec["browser"][name]
        pairs = list(zip(e["codes"], b["codes"]))
        same = sum(abs(x["x"] - y["x"]) < 1e-5 and abs(x["y"] - y["y"]) < 1e-5 for x, y in pairs)
        ident = sum(x["code"] == y["code"] for x, y in pairs)
        near = sum(dist(x["code"], y["code"]) <= T for x, y in pairs)
        out.append(f"| {name} | {len(e['codes'])} / {len(b['codes'])} | {same} | {ident} | {near} |"
                   + ("" if e["prepared_size"] == b["prepared_size"] else f" prepared {e['prepared_size']} vs {b['prepared_size']}"))

    rows = [(r, res[f"{i:03d}"]) for i, r in enumerate(py) if f"{i:03d}" in res]
    orig, pix, derived = Codes(), Codes(), Codes()
    for r, b in rows:
        for name, c in b["codes"].items():
            (orig if name == "original" else derived).add(r["codes" + sfx][name], c)
        pix.add(r["codes" + sfx]["original"], b["pixels"])
    out.append("\n## Codes, verifier at 512 px (up to 64 per image)\n")
    out.append("Codes are compared at the same rank. \"Any within t\" also accepts any Python code of that image.\n")
    out.append("| images | n | same number of codes | codes | same keypoint (x, y within 1e-5) | identical | within t = 24 | any within t |")
    out.append("| --- | --- | --- | --- | --- | --- | --- | --- |")
    out.append(pix.row("originals, Python's decoded pixels (OpenCV.js alone)"))
    out.append(orig.row("originals, browser-decoded files"))
    out.append(derived.row("manipulated copies, browser-decoded"))
    bits = derived.bits + orig.bits
    total = sum(bits.values())
    out.append("\nBits differing between same-rank codes (originals and copies, browser-decoded): "
               + ", ".join(f"{k}: {v / total:.1%}" for k, v in sorted(bits.items()) if v / total >= 0.001 or k == 0) + ".\n")

    per = collections.defaultdict(lambda: collections.Counter())
    for r, b in rows:
        for manip, _, _ in r["pairs"]:
            p, q, m = r["python" + sfx][manip], b["browser"][manip], b["matcher"][manip]
            c = per[manip]
            c["pairs"] += 1
            c["py found"] += p != "none"
            c["br found"] += q != "none"
            c["py right"] += p == EXPECTED[manip]
            c["br right"] += q == EXPECTED[manip]
            c["same found"] += (p != "none") == (q != "none")
            c["same label"] += p == q
            c["matcher same"] += p == m
    tot = sum(per.values(), collections.Counter())
    n = tot["pairs"]
    out.append("## Matches (creator 20, verifier 64, 512 px, t = 24)\n")
    out.append(f"{n} pairs from {len(rows)} originals. Python and the browser agree on found / not found for "
               f"{tot['same found'] / n:.2%} of pairs and on the relationship for {tot['same label'] / n:.2%}. "
               f"The JS matcher on Python's codes gives Python's relationship for {tot['matcher same'] / n:.2%}.\n")
    out.append("| manipulation | pairs | Python found | browser found | Python label right | browser label right | same found | same label |")
    out.append("| --- | --- | --- | --- | --- | --- | --- | --- |")
    for manip in [*EXPECTED, "all"]:
        c = tot if manip == "all" else per.get(manip)
        if not c:
            continue
        k = c["pairs"]
        out.append(f"| {manip} | {k} | {c['py found'] / k:.1%} | {c['br found'] / k:.1%} | {c['py right'] / k:.1%} | "
                   f"{c['br right'] / k:.1%} | {c['same found'] / k:.1%} | {c['same label'] / k:.1%} |")

    dec = [m["decode"] for _, b in rows for m in b["ms"].values()]
    gen = [m["generate"] for _, b in rows for m in b["ms"].values()]
    odec = [b["ms"]["original"]["decode"] for _, b in rows]
    ogen = [b["ms"]["original"]["generate"] for _, b in rows]
    out.append("\n## Timing in the browser, one tab, median / p95 ms\n")
    out.append("| | originals | all images |\n| --- | --- | --- |")
    out.append(f"| decode (createImageBitmap + canvas) | {stats(odec)} | {stats(dec)} |")
    out.append(f"| generate, verifier 64 codes at 512 px (after decoding) | {stats(ogen)} | {stats(gen)} |")
    out.append(f"| creator 20 codes at 512 px, decoding included | {stats([b['creator_ms'] for _, b in rows])} | |")
    out.append(f"\n`match`: {statistics.mean(b['match_ms'] for _, b in rows):.2f} ms per pair on average.")
    print("\n".join(out))


if __name__ == "__main__":
    main()
