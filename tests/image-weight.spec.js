const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// W3.5 — image weight guardrail. Catches the exact regression this fixed
// (apple-touch-icon.png was a byte-identical 512x512 copy of icon-512.png,
// 185KB, instead of a properly-sized ~180x180 icon) and keeps total icon/
// screenshot payload from silently creeping back up.

// Reads width/height straight from a PNG's IHDR chunk — no image library
// needed for 8 bytes of well-known, fixed-position header data.
function pngDimensions(filePath) {
  const buf = fs.readFileSync(filePath);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

const ROOT = path.resolve(__dirname, '..');

test.describe('image weight', () => {
  test('apple-touch-icon.png is a properly-sized 180x180 icon, not a duplicate of icon-512.png', () => {
    const ati = path.join(ROOT, 'apple-touch-icon.png');
    const icon512 = path.join(ROOT, 'icon-512.png');
    expect(pngDimensions(ati)).toEqual({ width: 180, height: 180 });
    expect(sha256(ati)).not.toBe(sha256(icon512));
    expect(fs.statSync(ati).size).toBeLessThan(50 * 1024); // was 185KB
  });

  test('manifest icon files match their declared sizes', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
    for (const icon of manifest.icons) {
      const [w, h] = icon.sizes.split('x').map(Number);
      const file = path.join(ROOT, path.basename(icon.src));
      expect(pngDimensions(file), icon.src).toEqual({ width: w, height: h });
    }
  });

  test('total icon + screenshot payload stays well under 1MB', () => {
    const files = [
      'apple-touch-icon.png', 'favicon-96x96.png', 'icon-192.png', 'icon-512.png',
      'icon-maskable-192.png', 'icon-maskable-512.png', 'og-image.png',
      'screenshot-home.png', 'screenshot-schedule.png',
    ];
    const total = files.reduce((sum, f) => sum + fs.statSync(path.join(ROOT, f)).size, 0);
    expect(total).toBeLessThan(600 * 1024); // was ~1MB before optimization
  });
});
