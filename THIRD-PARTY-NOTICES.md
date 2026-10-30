# Third-party notices

image-simprints-js is Apache-2.0. This repository does not contain OpenCV,
Emscripten or a built `opencv.js`: `vendor/` and `build/out*/` are gitignored and
made locally with [`build/`](build/). Licences are read from the source and
packages used for the build.

## In the built opencv.js

| component | version | licence | link |
| --- | --- | --- | --- |
| OpenCV (custom build) | 5.0.0 | Apache-2.0 | [github.com/opencv/opencv](https://github.com/opencv/opencv) |
| SIFT in OpenCV, based on Rob Hess's code | | BSD-3-Clause-style notice in the source file | [`sift.dispatch.cpp`](https://github.com/opencv/opencv/blob/5.0.0/modules/features/src/sift.dispatch.cpp) |
| Protobuf (`3rdparty/protobuf`) | 3.19.1 | BSD-3-Clause | [github.com/protocolbuffers/protobuf](https://github.com/protocolbuffers/protobuf) |
| zlib (`3rdparty/zlib`) | 1.3.2 | Zlib | [zlib.net](https://zlib.net) |
| FlatBuffers (`3rdparty/flatbuffers`, headers) | 25.9.23 | Apache-2.0 | [github.com/google/flatbuffers](https://github.com/google/flatbuffers) |
| Emscripten runtime | 6.0.13 | MIT or University of Illinois/NCSA | [github.com/emscripten-core/emscripten](https://github.com/emscripten-core/emscripten) |
| musl libc (in Emscripten) | 1.2.6 | MIT | [musl.libc.org](https://musl.libc.org) |
| libc++, libc++abi, compiler-rt (in Emscripten) | | Apache-2.0 WITH LLVM-exception | [github.com/llvm/llvm-project](https://github.com/llvm/llvm-project) |
| dlmalloc (in Emscripten) | | CC0-1.0 | [`dlmalloc.c`](https://github.com/emscripten-core/emscripten/blob/main/system/lib/dlmalloc.c) |

The OpenCV modules compiled in, and the third-party libraries linked, are listed
in the build's `build/out/version_string.tmp` (`libprotobuf zlib` here). Some
OpenCV source files also carry their own notices; the table names the one the
recipe depends on, not all of them.

**Anyone shipping the built opencv.js must include OpenCV's
[`LICENSE`](https://github.com/opencv/opencv/blob/5.0.0/LICENSE) and
[`COPYRIGHT`](https://github.com/opencv/opencv/blob/5.0.0/COPYRIGHT), and the
notices of the components above.**

## Build and test only (not shipped)

| tool | version | licence | link |
| --- | --- | --- | --- |
| emsdk | latest at build time | MIT | [github.com/emscripten-core/emsdk](https://github.com/emscripten-core/emsdk) |
| CMake (from pip) | 4.4.4 | BSD-3-Clause; the pip packaging is Apache-2.0 | [cmake.org](https://cmake.org) |
| Ninja (from pip) | 1.13.2 | Apache-2.0 | [ninja-build.org](https://ninja-build.org) |
| Node.js (in emsdk) | 24.19.0 | MIT, with its bundled components' licences | [nodejs.org](https://nodejs.org) |
| Python (in emsdk) | 3.13.3 | PSF-2.0 | [python.org](https://www.python.org) |
| [image-simprints](https://github.com/jmsherrier/image-simprints) and its dependencies (parity test) | 0.2.0 | Apache-2.0; see its [notices](https://github.com/jmsherrier/image-simprints/blob/main/THIRD-PARTY-NOTICES.md) | |

The parity test's images are the image-simprints test corpus, downloaded locally
and not in this repository.

## Patent

SIFT's US patent ([US 6,711,293](https://patents.google.com/patent/US6711293B1/en)) expired in March 2020.
