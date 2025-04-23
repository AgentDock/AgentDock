const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const toIco = require('to-ico');

const sizes = {
  'favicon-16x16.png': 16,
  'favicon-32x32.png': 32,
  'apple-touch-icon.png': 180,
  'android-chrome-192x192.png': 192,
  'android-chrome-512x512.png': 512
};

async function generateFavicons() {
  const svgBuffer = fs.readFileSync(path.join(__dirname, '../public/favicon.svg'));
  const publicDir = path.join(__dirname, '../public');
  const pngBuffers = [];

  for (const [filename, size] of Object.entries(sizes)) {
    const outputPath = path.join(publicDir, filename);
    await sharp(svgBuffer)
      .resize(size, size)
      .toFile(outputPath);
    
    console.log(`Generated ${filename}`);
    
    // Collect buffers for ICO generation (only 16x16 and 32x32)
    if (size === 16 || size === 32) {
      pngBuffers.push(fs.readFileSync(outputPath));
    }
  }

  // Generate favicon.ico from 16x16 and 32x32 PNG buffers
  if (pngBuffers.length >= 2) {
    const icoBuffer = await toIco(pngBuffers);
    const icoPath = path.join(publicDir, 'favicon.ico');
    fs.writeFileSync(icoPath, icoBuffer);
    console.log(`Generated favicon.ico`);
  } else {
    console.warn('Could not generate favicon.ico: Missing 16x16 or 32x32 PNG.');
  }
}

generateFavicons().catch(console.error); 