# image-simprints-js

[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)
[![OpenCV.js 5.0.0](https://img.shields.io/badge/OpenCV.js-5.0.0-5C3EE8)](build/)
[![WebAssembly](https://img.shields.io/badge/WebAssembly-654FF0)](build/)
[![Parity with Python: 99.8% of match decisions](https://img.shields.io/badge/parity%20with%20Python-99.8%25%20of%20matches-green)](parity/summary-convert.md)
[![Status: proof of concept](https://img.shields.io/badge/status-proof%20of%20concept-orange)](https://github.com/jmsherrier/image-simprints#status)

[image-simprints](https://github.com/jmsherrier/image-simprints) recipe 2 in the
browser: `generate` and `match` in JavaScript on a custom OpenCV.js build. A proof
of concept for Liccium. [RECIPE.md](https://github.com/jmsherrier/image-simprints/blob/main/RECIPE.md)
in the Python package is the specification.

- [`src/simprints.js`](src/simprints.js): the port. `load(cv, constantsUrl)` returns
  `{generate, match}`; `pixelsOf(blob)` decodes a file with the browser.
- [`build/`](build/): OpenCV.js 5.0.0 (the package's version) with `SIFT` and
  `estimateAffinePartial2D` added to the export whitelist, built with OpenCV's own
  `build_js.py`.
- [`parity/`](parity/): runs the test vectors and the Python package's 150 test
  originals, with their manipulations, through Python and headless Chromium.
  Results: [`parity/summary.md`](parity/summary.md).

Codes from the browser are not always bit-identical to Python's: the WebAssembly
build has no SIMD, so SIFT's floating point rounds differently, and Chromium
converts embedded colour profiles with its own colour engine rather than
littleCMS. Codes that differ are mostly a few bits apart, within `t`, and match
decisions agree on 99.8% of the test pairs.

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
build\build.bat
```

The output is `build/out/bin/opencv.js`. On Linux or macOS, with emsdk active,
OpenCV's documented command works as is:
`emcmake python vendor/opencv/platforms/js/build_js.py build/out --build_wasm --config build/opencv_js.config.py`.

## Parity test

```sh
<image-simprints venv>/python parity/dump.py <image-simprints>/.cache/corpus
python parity/browser.py          # headless Edge or Chrome
python parity/compare.py > parity/summary.md
```

Apache-2.0. © 2026 Joseph Sherrier.
