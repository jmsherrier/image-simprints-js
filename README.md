# image-simprints-js

[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)
[![OpenCV.js 5.0.0](https://img.shields.io/badge/OpenCV.js-5.0.0-5C3EE8)](build/)
[![WebAssembly](https://img.shields.io/badge/WebAssembly-654FF0)](build/)
[![Parity with Python: 99.8% of match decisions, 99.9% with SIMD](https://img.shields.io/badge/parity%20with%20Python-99.8%25%20(SIMD%2099.9%25)%20of%20matches-green)](parity/summary-simd.md)
[![Status: proof of concept](https://img.shields.io/badge/status-proof%20of%20concept-orange)](https://github.com/jmsherrier/image-simprints#status)

[image-simprints](https://github.com/jmsherrier/image-simprints) recipe 2.1 in the
browser: `generate` and `match` in JavaScript on a custom OpenCV.js build. A proof
of concept for Liccium. [RECIPE.md](https://github.com/jmsherrier/image-simprints/blob/main/RECIPE.md)
in the Python package is the specification.

- [`src/simprints.js`](src/simprints.js): the port. `load(cv, constantsUrl)` returns
  `{generate, match}`; `pixelsOf(blob)` decodes a file with the browser, ignoring
  colour profiles as the recipe does.
- [`build/`](build/): OpenCV.js 5.0.0 (the package's version) with `SIFT` and
  `estimateAffinePartial2D` added to the export whitelist, built with OpenCV's own
  `build_js.py`, with or without WebAssembly SIMD.
- [`parity/`](parity/): runs the test vectors and the Python package's 150 test
  originals, with their manipulations, through Python and headless Chromium.
  Results: [`parity/summary-simd.md`](parity/summary-simd.md) (SIMD),
  [`parity/summary.md`](parity/summary.md) (no SIMD).

Recipe 2.1, 3,750 test pairs, headless Edge 156 on a desktop CPU:

| | no SIMD | SIMD |
| --- | --- | --- |
| opencv.js | 13.3 MB, 3.8 MB gzipped | 16.3 MB, 4.3 MB gzipped |
| codes bit-identical to Python's | 93.4% | 97.5% |
| same match decision as Python (found / not found) | 99.87% | 99.97% |
| found (Python: 67.9%) | 67.9% | 67.9% |
| `generate`, verifier, median / p95 | 126 / 216 ms | 60 / 102 ms |
| creator codes, decoding included, median | 148 ms | 79 ms |

Use the SIMD build: it is twice as fast and closer to Python (current Chrome,
Edge, Firefox and Safari support WebAssembly SIMD). Codes are not always
bit-identical to Python's, because SIFT's floating point rounds differently in
WebAssembly; codes that differ are mostly one or two bits apart, within `t`.
Decoding (`createImageBitmap`) takes about 7 ms and `match` 0.1 ms per pair.

Colour profiles: with the browser's own colour conversion, 7% of the keypoints
of the test originals moved. Two fixes were tested with recipe 2: ignoring
profiles, and converting with littleCMS compiled to WebAssembly. Both closed the
gap ([`summary-ignore.md`](parity/summary-ignore.md),
[`summary-lcms.md`](parity/summary-lcms.md); before:
[`summary-convert.md`](parity/summary-convert.md)), and ignoring cost 0.2 points
of matches, so recipe 2.1 ignores profiles. The littleCMS runner is in commit
29994c7.

```js
import { load, pixelsOf } from "./src/simprints.js";

const S = await load(cv, "projection_v2.f32");   // cv: the custom opencv.js, initialised
const query = S.generate(await pixelsOf(file), "verifier");
const result = S.match(query, storedCreatorCodes);
```

## Build OpenCV.js (Windows)

```bat
git clone --depth 1 --branch 5.0.0 https://github.com/opencv/opencv.git vendor\opencv
git clone --depth 1 https://github.com/emscripten-core/emsdk.git vendor\emsdk
vendor\emsdk\emsdk install latest && vendor\emsdk\emsdk activate latest
python -m venv vendor\tools && vendor\tools\Scripts\pip install cmake ninja
build\build.bat              & rem add --simd for the SIMD build
```

The output is `build/out/bin/opencv.js` (with `--simd`: `build/out-simd/bin/opencv.js`). On Linux or macOS, with emsdk active,
OpenCV's documented command works as is:
`emcmake python vendor/opencv/platforms/js/build_js.py build/out --build_wasm --config build/opencv_js.config.py`
(add `--simd` for SIMD).

## Parity test

```sh
<image-simprints venv>/python parity/dump.py <image-simprints>/.cache/corpus
python parity/browser.py --build out-simd     # headless Edge or Chrome; --build out: no SIMD
python parity/compare.py out-simd > parity/summary-simd.md
```

Apache-2.0. © 2026 Joseph Sherrier.
