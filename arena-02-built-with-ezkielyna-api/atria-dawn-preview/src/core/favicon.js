// Generates a small pixel-art favicon at runtime so no external file is
// fetched. Drawn once on load into a 16x16 canvas and linked via blob URL.
import { PAL } from './Renderer.js';

export function installFavicon() {
  try {
    const cv = document.createElement('canvas');
    cv.width = 16; cv.height = 16;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    // PIP face: cream body, teal visor, orange antenna dot
    const px = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
    px(0, 0, 16, 16, PAL.navy);
    px(4, 3, 8, 1, PAL.cream);
    px(3, 4, 10, 9, PAL.cream);
    px(4, 13, 8, 1, PAL.cream);
    px(5, 5, 6, 3, PAL.deep);
    px(6, 6, 4, 1, PAL.teal);
    px(8, 6, 2, 1, PAL.cream);
    px(7, 1, 2, 2, PAL.creamDim);
    px(7, 0, 2, 1, PAL.orange);
    px(11, 5, 3, 6, PAL.blue);
    px(12, 6, 1, 4, PAL.tealDim);
    px(4, 13, 3, 2, PAL.blue);
    px(9, 13, 3, 2, PAL.blue);
    cv.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      let link = document.querySelector('link[rel="icon"]');
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.type = 'image/png';
      link.href = url;
    }, 'image/png');
  } catch (e) {
    // favicon is cosmetic; ignore failures
  }
}
