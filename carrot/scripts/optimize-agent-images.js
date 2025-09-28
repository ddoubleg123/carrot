const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const AGENTS_DIR = path.join(__dirname, '../public/agents');
const OUTPUT_DIR = path.join(__dirname, '../public/agents-optimized');

// Create output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function optimizeImage(inputPath, outputPath) {
  try {
    const stats = fs.statSync(inputPath);
    const originalSize = (stats.size / 1024 / 1024).toFixed(2);
    
    await sharp(inputPath)
      .resize(400, 400, { 
        fit: 'cover',
        position: 'top'
      })
      .jpeg({ 
        quality: 85,
        progressive: true
      })
      .toFile(outputPath);
    
    const newStats = fs.statSync(outputPath);
    const newSize = (newStats.size / 1024 / 1024).toFixed(2);
    const compression = ((1 - newStats.size / stats.size) * 100).toFixed(1);
    
    console.log(`✅ ${path.basename(inputPath)}: ${originalSize}MB → ${newSize}MB (${compression}% smaller)`);
    
    return {
      original: originalSize,
      optimized: newSize,
      compression: compression
    };
  } catch (error) {
    console.error(`❌ Error optimizing ${inputPath}:`, error.message);
    return null;
  }
}

async function optimizeAllImages() {
  console.log('🖼️  Optimizing agent images...\n');
  
  const files = fs.readdirSync(AGENTS_DIR);
  const pngFiles = files.filter(file => file.toLowerCase().endsWith('.png'));
  
  let totalOriginal = 0;
  let totalOptimized = 0;
  let successCount = 0;
  
  for (const file of pngFiles) {
    const inputPath = path.join(AGENTS_DIR, file);
    const outputPath = path.join(OUTPUT_DIR, file.replace('.png', '.jpg'));
    
    const result = await optimizeImage(inputPath, outputPath);
    if (result) {
      totalOriginal += parseFloat(result.original);
      totalOptimized += parseFloat(result.optimized);
      successCount++;
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   Files processed: ${successCount}/${pngFiles.length}`);
  console.log(`   Total size: ${totalOriginal.toFixed(2)}MB → ${totalOptimized.toFixed(2)}MB`);
  console.log(`   Space saved: ${(totalOriginal - totalOptimized).toFixed(2)}MB (${(((totalOriginal - totalOptimized) / totalOriginal) * 100).toFixed(1)}%)`);
  console.log(`\n✨ Optimized images saved to: ${OUTPUT_DIR}`);
  console.log(`\n📝 Next steps:`);
  console.log(`   1. Review optimized images in /public/agents-optimized/`);
  console.log(`   2. Replace original images if satisfied`);
  console.log(`   3. Update code to use Next.js Image component`);
}

// Run optimization
optimizeAllImages().catch(console.error);
