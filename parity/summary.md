# Browser parity, recipe 2

Browser: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0`. OpenCV.js 5.0.0 (WebAssembly, single file, no SIMD, no threads), 13.3 MB, 3.8 MB gzipped; ready in 34 ms.

## Test vectors (creator, default settings)

| image | codes (Python / browser) | same keypoints | identical codes | within t |
| --- | --- | --- | --- | --- |
| shapes.png | 20 / 20 | 20 | 19 | 20 |
| portrait.png | 20 / 20 | 20 | 20 | 20 |
| small.png | 0 / 0 | 0 | 0 | 0 |

## Codes, verifier at 512 px (up to 64 per image)

Codes are compared at the same rank. "Any within t" also accepts any Python code of that image.

| images | n | same number of codes | codes | same keypoint (x, y within 1e-5) | identical | within t = 24 | any within t |
| --- | --- | --- | --- | --- | --- | --- | --- |
| originals, Python's decoded pixels (OpenCV.js alone) | 150 | 98.0% | 6950 | 99.64% | 93.60% | 97.93% | 99.97% |
| originals, browser-decoded files | 150 | 93.3% | 6952 | 92.55% | 87.44% | 95.22% | 99.77% |
| manipulated copies, browser-decoded | 3750 | 98.8% | 168589 | 98.90% | 93.25% | 97.29% | 99.96% |

Bits differing between same-rank codes (originals and copies, browser-decoded): 0: 93.0%, 1: 2.4%, 2: 1.0%, 3: 0.4%, 4: 0.2%, 99: 2.2%.

## Matches (creator 20, verifier 64, 512 px, t = 24)

3750 pairs from 150 originals. Python and the browser agree on found / not found for 99.79% of pairs and on the relationship for 99.76%. The JS matcher on Python's codes gives Python's relationship for 100.00%.

| manipulation | pairs | Python found | browser found | Python label right | browser label right | same found | same label |
| --- | --- | --- | --- | --- | --- | --- | --- |
| identical | 150 | 97.3% | 97.3% | 97.3% | 97.3% | 100.0% | 100.0% |
| resize50 | 150 | 97.3% | 97.3% | 97.3% | 97.3% | 100.0% | 100.0% |
| resize25 | 150 | 96.7% | 96.7% | 96.7% | 96.7% | 100.0% | 100.0% |
| jpeg60 | 150 | 97.3% | 97.3% | 97.3% | 97.3% | 100.0% | 100.0% |
| webp60 | 150 | 97.3% | 97.3% | 97.3% | 97.3% | 100.0% | 100.0% |
| avif50 | 150 | 97.3% | 97.3% | 97.3% | 97.3% | 100.0% | 100.0% |
| bright_contrast | 150 | 97.3% | 97.3% | 97.3% | 97.3% | 100.0% | 100.0% |
| greyscale | 150 | 97.3% | 97.3% | 97.3% | 97.3% | 100.0% | 100.0% |
| rotate90 | 150 | 96.7% | 96.7% | 96.7% | 96.7% | 100.0% | 100.0% |
| rotate15 | 150 | 80.7% | 80.7% | 80.7% | 80.7% | 98.7% | 98.7% |
| crop90 | 150 | 96.0% | 96.0% | 96.0% | 95.3% | 100.0% | 99.3% |
| crop70 | 150 | 86.7% | 86.0% | 86.7% | 86.0% | 99.3% | 99.3% |
| crop50 | 150 | 78.7% | 78.7% | 78.7% | 78.7% | 100.0% | 100.0% |
| crop30 | 150 | 42.7% | 42.7% | 42.7% | 42.7% | 100.0% | 100.0% |
| crop20 | 150 | 20.0% | 20.0% | 20.0% | 20.0% | 98.7% | 98.7% |
| crop10 | 150 | 4.7% | 4.7% | 4.7% | 4.7% | 100.0% | 100.0% |
| collage50 | 150 | 77.3% | 76.0% | 77.3% | 76.0% | 98.7% | 98.7% |
| collage30 | 150 | 59.3% | 59.3% | 59.3% | 59.3% | 100.0% | 100.0% |
| collage15 | 150 | 27.3% | 27.3% | 27.3% | 27.3% | 100.0% | 100.0% |
| collage50 reversed | 150 | 62.7% | 62.7% | 62.7% | 62.7% | 100.0% | 100.0% |
| collage30 reversed | 150 | 37.3% | 37.3% | 37.3% | 37.3% | 100.0% | 100.0% |
| collage15 reversed | 150 | 14.7% | 14.7% | 14.7% | 14.7% | 100.0% | 100.0% |
| overlap50 | 150 | 79.3% | 79.3% | 79.3% | 79.3% | 100.0% | 100.0% |
| overlap30 | 150 | 48.0% | 48.7% | 48.0% | 48.7% | 99.3% | 99.3% |
| overlap15 | 150 | 10.0% | 10.0% | 10.0% | 10.0% | 100.0% | 100.0% |
| all | 3750 | 68.0% | 67.9% | 68.0% | 67.9% | 99.8% | 99.8% |

## Timing in the browser, one tab, median / p95 ms

| | originals | all images |
| --- | --- | --- |
| decode (createImageBitmap + canvas) | 10 / 23 | 7 / 18 |
| generate, verifier 64 codes at 512 px (after decoding) | 134 / 218 | 126 / 216 |
| creator 20 codes at 512 px, decoding included | 149 / 234 | |

`match`: 0.10 ms per pair on average.
