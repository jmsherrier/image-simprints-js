"""Python reference for the parity test: the test-mode manipulations of the corpus
originals, written as the same encoded files, with Python's codes and match results.

    <image-simprints venv>/python parity/dump.py <corpus dir> [limit]

Writes parity/data/: images/<n>/<name>.<ext>, pixels/<n>.png (the original as Python
decoded it, lossless), vectors/*, and python.json. The copies are made from the original
with its colour profile applied, as now; codes and results are also written with
profiles ignored (pixels taken as sRGB): pixels/<n>-ignore.png, "codes_ignore",
"python_ignore".
"""

import io

import json
import random
import shutil
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

from PIL import Image

from image_simprints import recipe as R
from image_simprints import testmode as T

OUT = Path(__file__).parent / "data"
EXT = {b"\xff\xd8": "jpg", b"RI": "webp", b"\x89P": "png"}


def ext(data: bytes) -> str:
    return EXT.get(data[:2], "avif")


def decoded(data: bytes, profiles: str):
    with Image.open(io.BytesIO(data)) as im:
        im.load()
        if profiles == "ignore":
            im.info.pop("icc_profile", None)
        return R._to_srgb(im)


def one(job):
    i, path, bg = job
    src = Image.fromarray(R.decode(path))
    imgs, pairs = T.derive(src, Image.fromarray(R.decode(bg)), random.Random(i))
    imgs["original"] = path.read_bytes()
    d = OUT / "images" / f"{i:03d}"
    d.mkdir(parents=True, exist_ok=True)
    files, codes, codes_ignore = {}, {}, {}
    for name, data in imgs.items():
        f = f"{name.replace(' ', '_')}.{ext(data) if name != 'original' else path.suffix[1:]}"
        (d / f).write_bytes(data)
        files[name] = f"images/{i:03d}/{f}"
        codes[name] = R.generate(decoded(data, "convert"), "verifier", {"verifier_codes": 64})
        codes_ignore[name] = R.generate(decoded(data, "ignore"), "verifier", {"verifier_codes": 64})
    data = path.read_bytes()
    Image.fromarray(decoded(data, "convert")).save(OUT / "pixels" / f"{i:03d}.png")
    Image.fromarray(decoded(data, "ignore")).save(OUT / "pixels" / f"{i:03d}-ignore.png")

    def found(cs):
        return {manip: R.match(cs[v], T.first(cs[c], 20))["relationship"] for manip, v, c in pairs}

    return {"name": path.name, "files": files, "codes": codes, "pairs": pairs, "python": found(codes),
            "codes_ignore": codes_ignore, "python_ignore": found(codes_ignore)}


def main():
    corpus = Path(sys.argv[1])
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else None
    originals = T.images_in(corpus / "originals")[:limit]
    unrelated = T.images_in(corpus / "unrelated")
    shutil.rmtree(OUT, ignore_errors=True)
    (OUT / "pixels").mkdir(parents=True)
    vec = Path(R.__file__).parents[2] / "tests" / "vectors"
    shutil.copytree(vec, OUT / "vectors")
    for f in ("projection.f32", "projection_v2.f32"):
        shutil.copy(Path(R.__file__).parent / f, OUT / f)
    jobs = [(i, p, unrelated[i % len(unrelated)]) for i, p in enumerate(originals)]
    with ProcessPoolExecutor() as ex:
        rows = list(ex.map(one, jobs))
    (OUT / "python.json").write_text(json.dumps(rows), encoding="utf-8")
    print(len(rows), "originals,", sum(len(r["files"]) for r in rows), "images,", sum(len(r["pairs"]) for r in rows), "pairs")


if __name__ == "__main__":
    main()
