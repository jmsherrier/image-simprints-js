// Option (b) of the colour-profile test: the browser decodes without its own colour
// conversion, then the embedded profile is applied with littleCMS (WebAssembly), as Pillow.
import Module from "../build/out/lcms.mjs";
import { pixelsOf } from "../src/simprints.js";

const lcms = await Module();

// JPEG only (every profile in the test originals is in a JPEG): the profile from the
// APP2 ICC_PROFILE segments, in sequence order, and the frame's number of components.
function jpegProfile(b) {
  const parts = [];
  for (let i = 2; i + 4 <= b.length && b[i] === 0xff; ) {
    const m = b[i + 1], len = (b[i + 2] << 8) | b[i + 3];
    if (m === 0xe2 && String.fromCharCode(...b.subarray(i + 4, i + 16)) === "ICC_PROFILE\0")
      parts.push([b[i + 16], b.subarray(i + 18, i + 2 + len)]);
    if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) {
      if (!parts.length) return null;
      parts.sort((x, y) => x[0] - y[0]);
      const icc = new Uint8Array(parts.reduce((n, p) => n + p[1].length, 0));
      parts.reduce((o, p) => (icc.set(p[1], o), o + p[1].length), 0);
      return { icc, components: b[i + 9] };
    }
    i += 2 + len;
  }
  return null;
}

export async function pixelsLcms(blob) {
  const img = await pixelsOf(blob, "ignore");
  const b = new Uint8Array(await blob.arrayBuffer());
  const p = b[0] === 0xff && b[1] === 0xd8 ? jpegProfile(b) : null;
  // ponytail: CMYK is converted by the browser itself (canvas never gives CMYK back)
  if (!p || (p.components !== 1 && p.components !== 3)) return img;
  const n = img.width * img.height, grey = p.components === 1;
  const input = grey ? Uint8Array.from({ length: n }, (_, k) => img.data[4 * k]) : img.data;
  const [icc, inp, out] = [p.icc.length, input.length, 4 * n].map((k) => lcms._malloc(k));
  lcms.HEAPU8.set(p.icc, icc);
  lcms.HEAPU8.set(input, inp);
  lcms.HEAPU8.set(img.data, out);
  if (lcms._to_srgb(icc, p.icc.length, grey ? 1 : 0, inp, out, n) === 0) img.data.set(lcms.HEAPU8.subarray(out, out + 4 * n));
  [icc, inp, out].forEach((k) => lcms._free(k));
  return img;
}
