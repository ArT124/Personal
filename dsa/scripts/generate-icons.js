// Draws the app icon ("</>" on a teal tile) as PNG files without any image library.
// Run: npm run icons
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
fs.mkdirSync(OUT, { recursive: true });

const BG = [15, 118, 110]; // #0f766e
const FG = [255, 255, 255];

// "</>" strokes in a 0..1 box
const SEGMENTS = [
  [0.36, 0.32, 0.2, 0.5],
  [0.2, 0.5, 0.36, 0.68],
  [0.64, 0.32, 0.8, 0.5],
  [0.8, 0.5, 0.64, 0.68],
  [0.56, 0.28, 0.44, 0.72],
];
const STROKE = 0.055;

function distToSegment(px, py, [x1, y1, x2, y2]) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function insideRoundedRect(x, y, r) {
  const cx = Math.min(Math.max(x, r), 1 - r);
  const cy = Math.min(Math.max(y, r), 1 - r);
  return Math.hypot(x - cx, y - cy) <= r;
}

function draw(size, { maskable = false } = {}) {
  const ss = 4; // 4x4 supersampling for smooth edges
  const glyphScale = maskable ? 0.72 : 1; // keep the glyph in the maskable safe zone
  const radius = maskable ? 0 : 0.22;
  const px = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let bg = 0;
      let fg = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const u = (x + (sx + 0.5) / ss) / size;
          const v = (y + (sy + 0.5) / ss) / size;
          if (!insideRoundedRect(u, v, radius)) continue;
          bg++;
          const gu = (u - 0.5) / glyphScale + 0.5;
          const gv = (v - 0.5) / glyphScale + 0.5;
          if (SEGMENTS.some((s) => distToSegment(gu, gv, s) <= STROKE)) fg++;
        }
      }
      const n = ss * ss;
      const a = bg / n;
      const f = bg ? fg / bg : 0;
      const i = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) px[i + c] = Math.round(BG[c] * (1 - f) + FG[c] * f);
      px[i + 3] = Math.round(a * 255);
    }
  }
  return encodePng(size, size, px);
}

function crc32(buf) {
  let c;
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const files = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['maskable-512.png', 512, { maskable: true }],
  ['apple-touch-icon.png', 180, { maskable: true }],
  ['badge-96.png', 96, {}],
  ['favicon-32.png', 32, {}],
];
for (const [name, size, opts] of files) {
  fs.writeFileSync(path.join(OUT, name), draw(size, opts));
  console.log('wrote', name);
}

const svgPath = SEGMENTS.map(([x1, y1, x2, y2]) => `M${x1 * 100} ${y1 * 100}L${x2 * 100} ${y2 * 100}`).join('');
fs.writeFileSync(
  path.join(OUT, 'icon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#0f766e"/><path d="${svgPath}" stroke="#fff" stroke-width="${STROKE * 200}" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>\n`,
);
console.log('wrote icon.svg');
