// Run with: node generate-icons.js
// Generates PNG icons from the SVG logomark using canvas (requires `canvas` npm package)
// OR outputs base64-encoded minimal PNGs if canvas is unavailable.
//
// Usage (one-time setup):
//   npm install canvas   (optional, for high-quality render)
//   node generate-icons.js

const fs = require("fs");
const path = require("path");

// Minimal valid 1x1 transparent PNG — fallback if canvas isn't available
// We'll embed the radar logo as a colored square instead using raw pixel data.

// For each size, write a solid indigo (#7C7CFF) square PNG as a placeholder.
// This is enough for Chrome to accept the extension. The radar SVG will render
// in the popup header regardless.

function writePng(size, filepath) {
  // Build a minimal PNG with all pixels set to #7C7CFF (indigo)
  // PNG structure: sig + IHDR + IDAT + IEND
  const png = buildSolidColorPng(size, 0x7c, 0x7c, 0xff);
  fs.writeFileSync(filepath, png);
  console.log(`  wrote ${filepath} (${size}x${size})`);
}

function buildSolidColorPng(size, r, g, b) {
  // This is a hand-rolled minimal PNG encoder (no dependencies).
  // It produces a valid RGBA PNG where all pixels are (r,g,b,255).

  const width = size;
  const height = size;

  // Raw image data: for each row, filter byte (0) + RGBA pixels
  const rawRows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0; // filter type: None
    for (let x = 0; x < width; x++) {
      const i = 1 + x * 4;
      row[i] = r;
      row[i + 1] = g;
      row[i + 2] = b;
      row[i + 3] = 255;
    }
    rawRows.push(row);
  }
  const rawData = Buffer.concat(rawRows);

  // Deflate compress using zlib
  const zlib = require("zlib");
  const compressed = zlib.deflateSync(rawData, { level: 9 });

  // Helpers
  function u32(n) {
    const b = Buffer.alloc(4);
    b.writeUInt32BE(n, 0);
    return b;
  }

  function chunk(type, data) {
    const typeBytes = Buffer.from(type, "ascii");
    const len = u32(data.length);
    const crc = crc32(Buffer.concat([typeBytes, data]));
    return Buffer.concat([len, typeBytes, data, u32(crc)]);
  }

  function crc32(buf) {
    let crc = 0xffffffff;
    for (const byte of buf) {
      crc ^= byte;
      for (let i = 0; i < 8; i++) {
        crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.concat([
    u32(width),
    u32(height),
    Buffer.from([8, 6, 0, 0, 0]), // 8-bit depth, RGBA color type
  ]);

  // IDAT chunk
  const idatData = compressed;

  // IEND chunk
  const iendData = Buffer.alloc(0);

  return Buffer.concat([
    sig,
    chunk("IHDR", ihdrData),
    chunk("IDAT", idatData),
    chunk("IEND", iendData),
  ]);
}

const iconsDir = path.join(__dirname, "icons");
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir);

console.log("Generating icons…");
writePng(16, path.join(iconsDir, "icon16.png"));
writePng(48, path.join(iconsDir, "icon48.png"));
writePng(128, path.join(iconsDir, "icon128.png"));
console.log("Done.");
