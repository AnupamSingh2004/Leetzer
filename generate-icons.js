const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function convertSvgToPng() {
  const svgPath = path.join(__dirname, 'assets/icons/icon.svg');
  const iconsDir = path.join(__dirname, 'assets/icons');
  
  // Ensure the icons directory exists
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }
  
  // Read the SVG file
  const svgBuffer = fs.readFileSync(svgPath);
  
  // Sizes required by Chrome extensions
  const sizes = [16, 32, 48, 128];
  
  try {
    for (const size of sizes) {
      const outputPath = path.join(iconsDir, `icon${size}.png`);
      
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(outputPath);
      
      console.log(`✓ Created icon${size}.png`);
    }
    
    console.log('\n🎉 All icons generated successfully!');
  } catch (error) {
    console.error('❌ Error generating icons:', error);
  }
}

convertSvgToPng();
