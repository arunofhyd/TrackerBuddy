const sharp = require('sharp');
const path = require('path');

const inputPath = path.join(__dirname, 'public', 'assets', 'logo.png');
const outputPath = path.join(__dirname, 'public', 'assets', 'apple-touch-icon.png');

sharp(inputPath)
  .flatten({ background: { r: 255, g: 255, b: 255 } }) // Replaces transparency with white
  .resize(180, 180, { fit: 'contain', background: { r: 255, g: 255, b: 255 } }) // Ensures square size with white padding if needed
  .toFile(outputPath)
  .then(info => {
    console.log('Successfully created iOS-optimized apple-touch-icon.png:', info);
  })
  .catch(err => {
    console.error('Error generating icon:', err);
  });
