import { crc32, deflateSync } from "node:zlib";
import type { Corners, Frame } from "../src/types.ts";

export const fixtureCorners: Corners = [
  { x: 0.13, y: 0.13 },
  { x: 0.87, y: 0.16 },
  { x: 0.83, y: 0.85 },
  { x: 0.1, y: 0.78 },
];

export function pageFixture(): Frame {
  const width = 240;
  const height = 180;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const shadow = Math.round((55 * x) / width + (16 * y) / height);
      const text =
        x > 56 &&
        x < 174 &&
        y > 46 &&
        y < 125 &&
        y % 15 < 3 &&
        (x + y) % 23 < 17;
      const mark = x > 53 && x < 115 && y > 42 && y < 50;
      const tone = text ? 85 : mark ? 114 : 224;
      data.set(
        [
          tone + (mark ? 47 : 6) - shadow,
          tone - shadow,
          tone + (mark ? 16 : -17) - shadow,
          255,
        ],
        (y * width + x) * 4,
      );
    }
  }
  return { width, height, data };
}

function chunk(type: string, data: Buffer): Buffer {
  const size = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const check = Buffer.alloc(4);
  check.writeUInt32BE(crc32(body));
  return Buffer.concat([size, body, check]);
}

export function png(frame: Frame): Buffer {
  const format = Buffer.alloc(13);
  format.writeUInt32BE(frame.width);
  format.writeUInt32BE(frame.height, 4);
  format[8] = 8;
  format[9] = 6;
  const rowSize = frame.width * 4;
  const rows = Buffer.alloc(frame.height * (rowSize + 1));
  for (let row = 0; row < frame.height; row++) {
    rows.set(
      frame.data.subarray(row * rowSize, (row + 1) * rowSize),
      row * (rowSize + 1) + 1,
    );
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", format),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
