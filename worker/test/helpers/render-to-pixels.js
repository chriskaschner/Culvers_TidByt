/**
 * Shared test utilities for pixel-level cone rendering assertions.
 *
 * renderToPixels: SVG string -> Map<"x,y", "#HEXCOLOR">
 * stableHash: Map -> 8-char hex hash (djb2)
 * pixelMapToRGBA: Map -> Uint8Array RGBA buffer (for pixelmatch comparison)
 */

/**
 * Parse an SVG produced by a renderCone*SVG call at scale=1 into a sparse
 * pixel map. Keys are "col,row" strings; values are fill colors.
 * Multi-pixel rects (width > 1 or height > 1) are expanded to individual pixels.
 *
 * Attribute-order tolerant: each attribute is extracted independently so the
 * parser is robust against future reordering inside the renderer.
 * Callers must use scale=1 so that SVG coordinates equal grid coordinates.
 */
export function renderToPixels(svgStr) {
  const map = new Map();
  // Match the content of every <rect .../> element regardless of attr order.
  // [^>]+ captures everything before the closing > (including trailing /).
  const rectRe = /<rect\s+([^>]+)>/g;
  let m;
  while ((m = rectRe.exec(svgStr)) !== null) {
    const attrs = m[1];
    const getInt = (name) => {
      const am = attrs.match(new RegExp(`\\b${name}="(\\d+)"`));
      return am ? parseInt(am[1]) : 0;
    };
    const x = getInt('x');
    const y = getInt('y');
    const w = getInt('width') || 1;
    const h = getInt('height') || 1;
    const fm = attrs.match(/\bfill="([^"]+)"/);
    const fill = fm ? fm[1] : '';
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        map.set(`${x + dx},${y + dy}`, fill);
      }
    }
  }
  return map;
}

/**
 * Stable hash of a pixel map: sort entries numerically (row then col),
 * JSON.stringify, then djb2. Deterministic regardless of map insertion order.
 */
export function stableHash(map) {
  const entries = [...map.entries()].sort(([a], [b]) => {
    const [ax, ay] = a.split(',').map(Number);
    const [bx, by] = b.split(',').map(Number);
    if (ay !== by) return ay - by;
    return ax - bx;
  });
  const str = JSON.stringify(entries);
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * Convert a sparse pixel map (Map<"x,y", "#HEXCOLOR">) to a Uint8Array
 * RGBA buffer suitable for pixelmatch comparison.
 *
 * - Pixels present in the map get their RGB values + alpha=255.
 * - Empty pixels remain [0, 0, 0, 0] (transparent black).
 *
 * @param {Map<string, string>} pixelMap - Map of "col,row" -> "#RRGGBB"
 * @param {number} width - Image width in pixels
 * @param {number} height - Image height in pixels
 * @returns {Uint8Array} RGBA buffer (width * height * 4 bytes)
 */
export function pixelMapToRGBA(pixelMap, width, height) {
  const buf = new Uint8Array(width * height * 4);
  for (const [key, color] of pixelMap) {
    const [x, y] = key.split(',').map(Number);
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    const idx = (y * width + x) * 4;
    buf[idx] = parseInt(color.slice(1, 3), 16);     // R
    buf[idx + 1] = parseInt(color.slice(3, 5), 16); // G
    buf[idx + 2] = parseInt(color.slice(5, 7), 16); // B
    buf[idx + 3] = 255;                              // A
  }
  return buf;
}
