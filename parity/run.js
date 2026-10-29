// Parity run in the browser: the test vectors, then every image dumped by dump.py.
// Posts one result per original to the server (serve.py); compare.py reads them.
// ?build=out or out-simd; ?run=<results folder>.
import { load, pixelsOf } from "../src/simprints.js";

const post = (path, body) => fetch(path, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) });
const log = (m) => {
  document.getElementById("log").textContent += m + "\n";
  return post("/log", m);
};
const blob = async (url) => (await fetch(url)).blob();

async function opencv() {
  let cv = window.cv;
  if (cv instanceof Promise) cv = await cv;
  else if (!cv.Mat) await new Promise((r) => (cv.onRuntimeInitialized = r));
  return cv;
}

async function main() {
  const t0 = performance.now();
  const cv = await opencv();
  const loadMs = performance.now() - t0;
  const S = await load(cv, "data/projection_v2.f32");
  const params = new URLSearchParams(location.search);
  const limit = Number(params.get("limit") || 1e9);
  const build = params.get("build") || "out", run = params.get("run") || build;

  // Test vectors: creator output at default settings.
  const expected = await (await fetch("data/vectors/expected_v2.json")).json();
  const vectors = {};
  for (const name of Object.keys(expected))
    vectors[name] = S.generate(await pixelsOf(await blob(`data/vectors/${name}`)), "creator");
  await post(`/result/${run}/vectors`, { expected, build, browser: vectors, opencv_load_ms: loadMs, userAgent: navigator.userAgent });
  await log(`vectors done, OpenCV.js ready in ${loadMs.toFixed(0)} ms`);

  const rows = await (await fetch("data/python.json")).json();
  for (const [i, row] of rows.slice(0, limit).entries()) {
    const codes = {}, ms = {};
    for (const [name, file] of Object.entries(row.files)) {
      const b = await blob(`data/${file}`);
      const a = performance.now();
      const px = await pixelsOf(b);
      const d = performance.now();
      codes[name] = S.generate(px, "verifier", { verifier_codes: 64 });
      ms[name] = { decode: d - a, generate: performance.now() - d };
    }
    // The original as Python decoded it (lossless PNG): OpenCV.js alone, no browser decoder.
    const pixels = S.generate(await pixelsOf(await blob(`data/pixels/${String(i).padStart(3, "0")}.png`)), "verifier", { verifier_codes: 64 });
    const a = performance.now();
    S.generate(await pixelsOf(await blob(`data/${row.files.original}`)), "creator");
    const creatorMs = performance.now() - a;
    const first = (r, n) => ({ ...r, codes: r.codes.slice(0, n) });
    const browser = {}, matcher = {};
    let matchMs = 0;
    for (const [manip, v, c] of row.pairs) {
      const m0 = performance.now();
      browser[manip] = S.match(codes[v], first(codes[c], 20)).relationship;
      matchMs += performance.now() - m0;
      matcher[manip] = S.match(row.codes[v], first(row.codes[c], 20)).relationship; // the JS matcher on Python's codes
    }
    await post(`/result/${run}/${String(i).padStart(3, "0")}`, { name: row.name, codes, pixels, ms, creator_ms: creatorMs,
      match_ms: matchMs / row.pairs.length, browser, matcher });
    if (i % 10 === 0) await log(`${i + 1}/${Math.min(rows.length, limit)} ${row.name} ${((performance.now() - t0) / 1000).toFixed(0)} s`);
  }
  await log("done");
  await post("/done", "");
}

main().catch(async (e) => {
  await log(`ERROR ${e && e.stack ? e.stack : e}`);
  await post("/done", "");
});
