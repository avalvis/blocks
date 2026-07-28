import { writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type);
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  name.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([name, data])), 8 + data.length);
  return chunk;
}

function insideRoundedSquare(x, y, size) {
  const inset = size / 32;
  const extent = size - inset * 2;
  const radius = size * 0.22;
  if (x < inset || y < inset || x >= inset + extent || y >= inset + extent) return false;
  const nearestX = Math.max(inset + radius, Math.min(x, inset + extent - radius));
  const nearestY = Math.max(inset + radius, Math.min(y, inset + extent - radius));
  return Math.hypot(x - nearestX, y - nearestY) <= radius;
}

function renderIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const cells = new Set(['0,0', '0,1', '1,1', '2,1']);
  const block = size * 0.21875;
  const gap = size * 0.03125;
  const originX = size * 0.125;
  const originY = size * 0.25;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      let red = 0;
      let green = 0;
      let blue = 0;
      let alpha = 0;

      if (insideRoundedSquare(x + 0.5, y + 0.5, size)) {
        red = 14;
        green = 9;
        blue = 30;
        alpha = 255;
      }

      for (let cellY = 0; cellY < 2; cellY += 1) {
        for (let cellX = 0; cellX < 3; cellX += 1) {
          if (!cells.has(`${cellX},${cellY}`)) continue;
          const left = originX + cellX * (block + gap);
          const top = originY + cellY * (block + gap);
          if (x + 0.5 >= left && x + 0.5 < left + block && y + 0.5 >= top && y + 0.5 < top + block) {
            const highlight = x + 0.5 < left + Math.max(1, size / 32)
              || y + 0.5 < top + Math.max(1, size / 32);
            red = highlight ? 112 : 34;
            green = highlight ? 255 : 230;
            blue = highlight ? 252 : 227;
            alpha = 255;
          }
        }
      }

      rgba[offset] = red;
      rgba[offset + 1] = green;
      rgba[offset + 2] = blue;
      rgba[offset + 3] = alpha;
    }
  }
  return rgba;
}

function encodePng(size) {
  const rgba = renderIcon(size);
  const scanlines = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const rowOffset = y * (size * 4 + 1);
    scanlines[rowOffset] = 0;
    rgba.copy(scanlines, rowOffset + 1, y * size * 4, (y + 1) * size * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(scanlines, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const sizes = [16, 32, 48];
const images = sizes.map(encodePng);
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);

let offset = header.length + images.length * 16;
const entries = images.map((image, index) => {
  const entry = Buffer.alloc(16);
  entry.writeUInt8(sizes[index], 0);
  entry.writeUInt8(sizes[index], 1);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(image.length, 8);
  entry.writeUInt32LE(offset, 12);
  offset += image.length;
  return entry;
});

await Promise.all([
  writeFile(new URL('../public/favicon.ico', import.meta.url), Buffer.concat([header, ...entries, ...images])),
  writeFile(new URL('../public/favicon-16.png', import.meta.url), images[0]),
  writeFile(new URL('../public/favicon-32.png', import.meta.url), images[1]),
]);
