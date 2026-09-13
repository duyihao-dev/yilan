// Convert the landing-page screenshot PNGs referenced by index.html into
// WebP (quality 82) using Chromium's canvas encoder, so the landing page
// keeps loading the fresh captures without adding an image dependency.
// Usage: node scripts/screens-to-webp.js
const fs = require('fs/promises');
const path = require('path');
const { chromium } = require('@playwright/test');

const root = path.resolve(__dirname, '..');
const screenDir = path.join(root, 'landing-page', 'assets', 'screens');
const WEBP_QUALITY = 82;

const FILES = [
  'hero-main-light.png',
  'hero-main-dark.png',
  'workflow-summary-light.png',
  'workflow-summary-dark.png',
  'history-reader-light.png',
  'history-reader-dark.png',
  'settings-panel-light.png',
  'settings-panel-dark.png'
];

async function main() {
  const browser = await chromium.launch({ channel: 'chromium', headless: true });
  try {
    const page = await browser.newPage();
    for (const fileName of FILES) {
      const inputPath = path.join(screenDir, fileName);
      const outputPath = inputPath.replace(/\.png$/i, '.webp');
      const dataUri = 'data:image/png;base64,' + (await fs.readFile(inputPath)).toString('base64');
      const webpBase64 = await page.evaluate(async ({ dataUri, quality }) => {
        const image = new Image();
        await new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = () => reject(new Error('Failed to decode ' + dataUri.slice(0, 64)));
          image.src = dataUri;
        });
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        canvas.getContext('2d').drawImage(image, 0, 0);
        return canvas.toDataURL('image/webp', quality).replace(/^data:image\/webp;base64,/, '');
      }, { dataUri, quality: WEBP_QUALITY });

      await fs.writeFile(outputPath, Buffer.from(webpBase64, 'base64'));
      console.log('Wrote ' + path.relative(root, outputPath));
    }
    await page.close();
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
