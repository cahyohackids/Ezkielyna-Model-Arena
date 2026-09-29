// Sprite factory: builds pixel-art sprites as offscreen canvases.
// Each sprite is defined by a pixel string grid, with a palette mapping
// characters to colors. This keeps art coherent, crisp, and original.

const PALETTE = {
  // core
  navy: '#0a0e1a',
  navy2: '#141b30',
  navy3: '#1d2a45',
  blue: '#2a4a7f',
  steel: '#4a6a9a',
  teal: '#3fb8a8',
  cream: '#f2e8d5',
  orange: '#ff8c42',
  orangeDark: '#c65a20',
  neon: '#7fe7ff',
  danger: '#ff5a6e',
  white: '#ffffff',
  dark: '#0b0f1c',
  green: '#58c46a',
};

export function makeSprite(pixelGrid, palette = PALETTE, scale = 1) {
  const rows = pixelGrid.trim().split('\n').map(r => r.trim());
  const h = rows.length;
  const w = rows[0].length;
  const c = document.createElement('canvas');
  c.width = w * scale;
  c.height = h * scale;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (ch === '.' || ch === ' ') continue;
      const col = palette[ch] || palette[ch.toLowerCase()];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  return c;
}

// Simple helper to tint an existing sprite
export function tintSprite(src, color, alpha = 1) {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.globalAlpha = 1;
  return c;
}

export { PALETTE };
