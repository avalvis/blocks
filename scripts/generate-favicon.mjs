import { mkdir, writeFile } from 'node:fs/promises';

const width = 32;
const height = 32;
const pixels = Buffer.alloc(width * height * 4);
const maskStride = Math.ceil(width / 32) * 4;
const mask = Buffer.alloc(maskStride * height);

function insideRoundedSquare(x, y, inset, size, radius) {
  if (x < inset || y < inset || x >= inset + size || y >= inset + size) return false;
  const nearestX = Math.max(inset + radius, Math.min(x, inset + size - radius - 1));
  const nearestY = Math.max(inset + radius, Math.min(y, inset + size - radius - 1));
  return Math.hypot(x - nearestX, y - nearestY) <= radius;
}

const cells = new Set(['0,0', '0,1', '1,1', '2,1']);
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const row = height - 1 - y;
    const offset = (row * width + x) * 4;
    let red = 0;
    let green = 0;
    let blue = 0;
    let alpha = 0;

    if (insideRoundedSquare(x, y, 1, 30, 7)) {
      red = 14;
      green = 9;
      blue = 30;
      alpha = 255;
    }

    const block = 7;
    const gap = 1;
    const originX = 4;
    const originY = 8;
    for (let cellY = 0; cellY < 2; cellY += 1) {
      for (let cellX = 0; cellX < 3; cellX += 1) {
        if (!cells.has(`${cellX},${cellY}`)) continue;
        const left = originX + cellX * (block + gap);
        const top = originY + cellY * (block + gap);
        if (x >= left && x < left + block && y >= top && y < top + block) {
          const highlight = x === left || y === top;
          red = highlight ? 112 : 34;
          green = highlight ? 255 : 230;
          blue = highlight ? 252 : 227;
          alpha = 255;
        }
      }
    }

    pixels[offset] = blue;
    pixels[offset + 1] = green;
    pixels[offset + 2] = red;
    pixels[offset + 3] = alpha;
  }
}

const dib = Buffer.alloc(40);
dib.writeUInt32LE(40, 0);
dib.writeInt32LE(width, 4);
dib.writeInt32LE(height * 2, 8);
dib.writeUInt16LE(1, 12);
dib.writeUInt16LE(32, 14);
dib.writeUInt32LE(0, 16);
dib.writeUInt32LE(pixels.length, 20);

const image = Buffer.concat([dib, pixels, mask]);
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);

const entry = Buffer.alloc(16);
entry.writeUInt8(width, 0);
entry.writeUInt8(height, 1);
entry.writeUInt8(0, 2);
entry.writeUInt8(0, 3);
entry.writeUInt16LE(1, 4);
entry.writeUInt16LE(32, 6);
entry.writeUInt32LE(image.length, 8);
entry.writeUInt32LE(header.length + entry.length, 12);

await mkdir(new URL('../public/', import.meta.url), { recursive: true });
await writeFile(new URL('../public/favicon.ico', import.meta.url), Buffer.concat([header, entry, image]));
