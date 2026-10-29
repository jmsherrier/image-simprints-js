// image-simprints recipe 2 in the browser: generate() and match(), ported from
// src/image_simprints/recipe.py. Needs an OpenCV.js build with SIFT and
// estimateAffinePartial2D exported (see build/). RECIPE.md is the specification.

export const DEFAULTS = {
  recipe: 2, creator_codes: 20, verifier_codes: 64, tolerance_t: 24, min_votes: 2,
  prepared_size: 512, span_check: 0.05, sift_features: 1500, candidates: 512,
};
const SHA256 = "eb70f802f0ec95e1b177abc3da4438144af276a0b34c2deed0ecf09ff8f96921";
const MIN_SIDE = 32, SIZE_FLOOR = 0.02, DETAIL_FLOOR = 200, PATCH_SIDE = 32, PATCH_FACTOR = 2;
const SCALE_RANGE = [0.1, 10], CONTAINED = 0.95, BACKGROUND = 255;
const DCT8 = Array.from({ length: 8 }, (_, k) =>
  Float64Array.from({ length: PATCH_SIDE }, (_, n) => 2 * Math.cos((Math.PI * k * (2 * n + 1)) / (2 * PATCH_SIDE))));

// numpy's round: half to even
const rint = (x) => {
  const r = Math.round(x);
  return r - x === 0.5 && r % 2 !== 0 ? r - 1 : r;
};
// ponytail: toFixed rounds an exact decimal tie up where Python rounds it to even; only
// geometry at a 1e-6 tie is affected, never a code
const round = (x, d) => Number(x.toFixed(d));

export async function load(cv, constantsUrl) {
  const raw = await (await fetch(constantsUrl)).arrayBuffer();
  const hex = [...new Uint8Array(await crypto.subtle.digest("SHA-256", raw))].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (hex !== SHA256) throw new Error("projection_v2.f32 does not match its checksum");
  const v = new Float32Array(raw);
  const P = Float64Array.from(v.subarray(0, 128 * 256)); // row-major (128, 256)
  const T = Float64Array.from(v.subarray(128 * 256));
  // Exact form, x 2^40 as BigInt, for the rare sum within rounding error of T.
  const big = (x) => BigInt(x * 2 ** 40);
  const sift = new cv.SIFT(DEFAULTS.sift_features);
  return {
    generate: (img, role, settings) => generate(cv, sift, P, T, big, img, role, settings),
    match: (q, r, settings) => match(cv, q, r, settings),
  };
}

// --- decoding (browser pixels) ----------------------------------------------------------

// RGB uint8 from an ImageData-like {data (RGBA), width, height}: alpha flattened onto
// white exactly as recipe.py does. The browser has already decoded the file, applied
// EXIF orientation and converted embedded colour profiles to sRGB.
export function rgbOf(img) {
  const { data, width, height } = img;
  const out = new Uint8Array(width * height * 3);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    const a = data[i + 3];
    for (let c = 0; c < 3; c++)
      out[j + c] = a === 255 ? data[i + c] : Math.floor((data[i + c] * a + BACKGROUND * (255 - a) + 127) / 255);
  }
  return { rgb: out, width, height };
}

export async function pixelsOf(blob) {
  const bmp = await createImageBitmap(blob, { imageOrientation: "from-image", premultiplyAlpha: "none", colorSpaceConversion: "default" });
  const c = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = c.getContext("2d", { colorSpace: "srgb", willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  return ctx.getImageData(0, 0, c.width, c.height, { colorSpace: "srgb" });
}

// --- codes -------------------------------------------------------------------------------

function settingsOf(settings) {
  const s = { ...DEFAULTS, ...(settings || {}) };
  if (s.recipe !== 2) throw new Error("this port implements recipe 2 only");
  return s;
}

function versionOf(s) {
  return ["image-simprints/2", ...Object.keys(DEFAULTS).filter((k) => s[k] !== DEFAULTS[k]).map((k) => `${k}=${s[k]}`)].join(";");
}

function prepare(cv, img, size) {
  const { rgb, width, height } = img.rgb ? img : rgbOf(img);
  const m = cv.matFromArray(height, width, cv.CV_8UC3, rgb);
  const g = new cv.Mat();
  cv.cvtColor(m, g, cv.COLOR_RGB2GRAY);
  m.delete();
  const f = size / Math.max(height, width);
  if (f < 1) {
    const r = new cv.Mat();
    cv.resize(g, r, new cv.Size(Math.max(1, rint(width * f)), Math.max(1, rint(height * f))), 0, 0, cv.INTER_AREA);
    g.delete();
    return r;
  }
  return g;
}

function generate(cv, sift, P, T, big, img, role, settings) {
  if (role !== "creator" && role !== "verifier") throw new Error(`role must be "creator" or "verifier"`);
  const s = settingsOf(settings);
  if (s.sift_features !== DEFAULTS.sift_features) sift = new cv.SIFT(s.sift_features);
  const g = prepare(cv, img, s.prepared_size);
  const w = g.cols, h = g.rows;
  const out = { recipe_version: versionOf(s), prepared_size: [w, h], codes: [], reason: null };
  try {
    if (Math.min(h, w) < MIN_SIDE) {
      out.reason = `too small: prepared image is ${w}x${h}, needs ${MIN_SIDE} px on each side`;
      return out;
    }
    const k = role === "creator" ? s.creator_codes : s.verifier_codes;
    const { rows, desc } = select(cv, sift, g, k, s.candidates);
    if (!rows.length) {
      out.reason = "no keypoints with enough detail";
      return out;
    }
    const short = Math.min(w, h);
    rows.forEach(([x, y, size, angle], n) => {
      out.codes.push({ chunk_idx: n, code: codeOf(desc[n], P, T, big), x: round(x / w, 6), y: round(y / h, 6),
        scale: round(size / short, 6), angle: round(angle, 3) });
    });
    return out;
  } finally {
    g.delete();
  }
}

function select(cv, sift, g, k, candidates) {
  const kps = new cv.KeyPointVector(), desc = new cv.Mat(), mask = new cv.Mat();
  sift.detectAndCompute(g, mask, kps, desc);
  const all = [];
  for (let i = 0; i < kps.size(); i++) {
    const p = kps.get(i);
    all.push([p.pt.x, p.pt.y, p.size, p.angle, p.response, i]);
  }
  all.sort((a, b) => b[4] - a[4] || a[1] - b[1] || a[0] - b[0]);
  const cand = all.slice(0, candidates);
  const detail = detailOf(cv, g, cand);
  const minSize = SIZE_FLOOR * Math.min(g.rows, g.cols);
  const rows = cand.filter((r, n) => detail[n] >= DETAIL_FLOOR && r[2] >= minSize).slice(0, k);
  const d = desc.data32F;
  const out = { rows, desc: rows.map((r) => d.subarray(r[5] * 128, r[5] * 128 + 128)) };
  out.desc = out.desc.map((x) => Float32Array.from(x)); // copy out of the WASM heap before delete
  kps.delete(); desc.delete(); mask.delete();
  return out;
}

const median = (a) => {
  const s = Float64Array.from(a).sort(), n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
};

function detailOf(cv, g, rows) {
  const pyramid = [new cv.Mat()];
  g.convertTo(pyramid[0], cv.CV_32F);
  while (Math.min(pyramid.at(-1).rows, pyramid.at(-1).cols) > PATCH_SIDE * 2) {
    const d = new cv.Mat();
    cv.pyrDown(pyramid.at(-1), d);
    pyramid.push(d);
  }
  const side = PATCH_SIDE, p = new cv.Mat(), dsize = new cv.Size(side, side), border = new cv.Scalar();
  const out = new Float64Array(rows.length), tmp = new Float64Array(8 * side), ac = new Float64Array(63);
  for (let n = 0; n < rows.length; n++) {
    const [x, y, size, angle] = rows[n];
    const extent = PATCH_FACTOR * size;
    const level = Math.min(pyramid.length - 1, Math.max(0, Math.floor(Math.log2(Math.max(extent, 1) / side))));
    const f = 2 ** level, sc = extent / f / side, a = angle * (Math.PI / 180);
    const cos = Math.cos(a) * sc, sin = Math.sin(a) * sc, cx = x / f, cy = y / f;
    const m = cv.matFromArray(2, 3, cv.CV_64F, [cos, -sin, cx - (cos * side) / 2 + (sin * side) / 2,
      sin, cos, cy - (sin * side) / 2 - (cos * side) / 2]);
    cv.warpAffine(pyramid[level], p, m, dsize, cv.INTER_LINEAR | cv.WARP_INVERSE_MAP, cv.BORDER_REFLECT, border);
    m.delete();
    const v = p.data32F; // L = D . patch . D^T in float64, as numpy's matmul
    for (let k = 0; k < 8; k++)
      for (let c = 0; c < side; c++) {
        let t = 0;
        for (let r = 0; r < side; r++) t += DCT8[k][r] * v[r * side + c];
        tmp[k * side + c] = t;
      }
    for (let k = 0, i = 0; k < 8; k++)
      for (let l = 0; l < 8; l++, i++) {
        let t = 0;
        for (let c = 0; c < side; c++) t += tmp[k * side + c] * DCT8[l][c];
        if (i) ac[i - 1] = t;
      }
    const md = median(ac);
    out[n] = median(ac.map((z) => Math.abs(z - md)));
  }
  pyramid.forEach((x) => x.delete());
  p.delete();
  return out;
}

// RootSIFT in float32, projected exactly, thresholded: 64 hex chars.
function codeOf(d, P, T, big) {
  const f = Math.fround;
  let sum = 0;
  for (let i = 0; i < 128; i++) sum = f(sum + d[i]); // descriptor values are whole numbers: exact
  sum = f(sum + f(1e-7));
  const r = new Float64Array(128);
  for (let i = 0; i < 128; i++) r[i] = Math.min(255, Math.max(0, Math.trunc(f(f(Math.sqrt(f(d[i] / sum))) * 255))));
  const bytes = new Uint8Array(32);
  for (let j = 0; j < 256; j++) {
    let s = 0, bound = 0;
    for (let i = 0; i < 128; i++) {
      const t = r[i] * P[i * 256 + j]; // exact: 8 bits x 24 bits
      s += t;
      bound += Math.abs(t);
    }
    let bit = s > T[j];
    if (Math.abs(s - T[j]) <= bound * 2 ** -45) { // within float64 rounding error: recompute exactly
      let e = 0n;
      for (let i = 0; i < 128; i++) e += BigInt(r[i]) * big(P[i * 256 + j]);
      bit = e > big(T[j]);
    }
    if (bit) bytes[j >> 3] |= 0x80 >> (j & 7);
  }
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// --- matching ----------------------------------------------------------------------------

function parse(r) {
  if (!/^image-simprints\/2(;|$)/.test(r.recipe_version || "")) throw new Error(`codes are not recipe 2: ${r.recipe_version}`);
  const [w, h] = r.prepared_size, short = Math.min(w, h);
  const c = r.codes.filter((x) => !x.stop);
  const codes = new Uint32Array(c.length * 8);
  c.forEach((x, n) => {
    for (let i = 0; i < 8; i++) codes[n * 8 + i] = parseInt(x.code.slice(i * 8, i * 8 + 8), 16);
  });
  const geo = c.map((x) => [(x.x * w) / short, (x.y * h) / short, x.scale, x.angle]);
  return { codes, geo, size: [w / short, h / short] };
}

const popcount = (x) => {
  x -= (x >>> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
};

function transformOf(q, r) {
  const s = q[2] / Math.max(r[2], 1e-9);
  const da = ((((q[3] - r[3] + 180) % 360) + 360) % 360 - 180) * (Math.PI / 180); // Python's % is a floor modulo
  const c = Math.cos(da), sn = Math.sin(da);
  return [s, da, q[0] - s * (c * r[0] - sn * r[1]), q[1] - s * (sn * r[0] + c * r[1])];
}

function match(cv, verifier, candidate, settings) {
  const s = settingsOf(settings);
  const Q = parse(verifier), R = parse(candidate);
  const pairs = []; // (verifier index, candidate index, bin key), in numpy's nonzero order
  for (let i = 0; i < Q.geo.length; i++)
    for (let j = 0; j < R.geo.length; j++) {
      let d = 0;
      for (let b = 0; b < 8; b++) d += popcount(Q.codes[i * 8 + b] ^ R.codes[j * 8 + b]);
      if (d > s.tolerance_t) continue;
      const [sc, da, tx, ty] = transformOf(Q.geo[i], R.geo[j]);
      if (!(sc >= SCALE_RANGE[0] && sc <= SCALE_RANGE[1])) continue;
      const ls = rint(Math.log2(Math.max(sc, 1e-9)) / 0.5), ab = (((rint((da * (180 / Math.PI)) / 30)) % 12) + 12) % 12;
      pairs.push([i, j, (((ls + 32) * 16 + ab) * 2000 + rint(tx / 0.15) + 1000) * 2000 + rint(ty / 0.15) + 1000]);
    }
  pairs.sort((a, b) => a[2] - b[2] || a[0] - b[0] || a[1] - b[1]);
  let best = 0, members = null;
  for (let a = 0; a < pairs.length; ) {
    let b = a;
    while (b < pairs.length && pairs[b][2] === pairs[a][2]) b++;
    const g = pairs.slice(a, b);
    const count = Math.min(new Set(g.map((p) => p[0])).size, new Set(g.map((p) => p[1])).size);
    if (count > best) [best, members] = [count, g]; // the smallest key wins a tie
    a = b;
  }
  return judge(cv, best, members, Q, R, s);
}

function estimate(cv, gq, gr) {
  if (gq.length === 1) {
    const [s, da, tx, ty] = transformOf(gq[0], gr[0]);
    const c = s * Math.cos(da), sn = s * Math.sin(da);
    return [c, -sn, tx, sn, c, ty];
  }
  const from = cv.matFromArray(gr.length, 1, cv.CV_32FC2, gr.flatMap((g) => [g[0], g[1]]));
  const to = cv.matFromArray(gq.length, 1, cv.CV_32FC2, gq.flatMap((g) => [g[0], g[1]]));
  const inliers = new cv.Mat();
  const m = cv.estimateAffinePartial2D(from, to, inliers, cv.LMEDS);
  const t = m.empty() ? null : Array.from(m.data64F);
  [from, to, inliers, m].forEach((x) => x.delete());
  return t || estimate(cv, gq.slice(0, 1), gr.slice(0, 1));
}

function clippedArea(poly, w, h) {
  let pts = poly;
  for (const [axis, bound, sign] of [[0, 0, 1], [0, w, -1], [1, 0, 1], [1, h, -1]]) {
    const inside = pts.map((p) => sign * (p[axis] - bound) >= 0), out = [];
    pts.forEach((q, i) => {
      const k = (i - 1 + pts.length) % pts.length, p = pts[k];
      if (inside[i] !== inside[k]) {
        const u = (bound - p[axis]) / (q[axis] - p[axis]);
        out.push([p[0] + u * (q[0] - p[0]), p[1] + u * (q[1] - p[1])]);
      }
      if (inside[i]) out.push(q);
    });
    pts = out;
    if (!pts.length) return 0;
  }
  let a = 0;
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - p[1] * q[0];
  });
  return Math.abs(a) / 2;
}

function footprint(t, [rw, rh], [qw, qh]) {
  const poly = [[0, 0], [rw, 0], [rw, rh], [0, rh]].map(([x, y]) => [t[0] * x + t[1] * y + t[2], t[3] * x + t[4] * y + t[5]]);
  const area = clippedArea(poly, qw, qh), det = Math.abs(t[0] * t[4] - t[1] * t[3]);
  if (area <= 0 || det <= 0) return [0, 0];
  return [Math.min(1, area / det / (rw * rh)), Math.min(1, area / (qw * qh))];
}

function judge(cv, count, mem, Q, R, s) {
  const out = { relationship: "none", overlap_fraction: { verifier: 0, candidate: 0 }, agreeing_codes: count };
  if (count < s.min_votes || !mem) return out;
  const gq = mem.map((p) => Q.geo[p[0]]), gr = mem.map((p) => R.geo[p[1]]);
  let t = estimate(cv, gq, gr);
  if (!t.every(Number.isFinite)) t = estimate(cv, gq.slice(0, 1), gr.slice(0, 1));
  const [shareR, shareQ] = footprint(t, R.size, Q.size);
  const region = Math.max(shareQ * Q.size[0] * Q.size[1], 1e-9);
  let span = 0;
  for (const a of gq) for (const b of gq) span = Math.max(span, Math.hypot(a[0] - b[0], a[1] - b[1]));
  if (!(span / Math.sqrt(region) >= s.span_check)) return out;
  let rel;
  if (shareR >= CONTAINED && shareQ >= CONTAINED) rel = "identical";
  else if (shareR >= CONTAINED) rel = "contains";
  else if (shareQ >= CONTAINED) rel = "contained_in";
  else rel = shareR > 0.01 && shareQ > 0.01 ? "overlapping" : "none";
  if (rel !== "none") out.overlap_fraction = { verifier: round(shareQ, 4), candidate: round(shareR, 4) };
  out.relationship = rel;
  return out;
}
