#!/usr/bin/env node

/**
 * Performance Measurement Script
 * Measures bundle size and provides performance metrics
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('\n🚀 Performance Measurement Tool\n');
console.log('=' .repeat(60));

// 1. Measure bundle size
console.log('\n📦 Building production bundle...\n');
try {
  execSync('npm run build', { stdio: 'inherit' });
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}

// 2. Analyze dist folder
const distPath = path.join(__dirname, '..', 'dist');

function getDirectorySize(dirPath) {
  let totalSize = 0;
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    const stats = fs.statSync(filePath);

    if (stats.isDirectory()) {
      totalSize += getDirectorySize(filePath);
    } else {
      totalSize += stats.size;
    }
  });

  return totalSize;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function getJSFiles(dirPath, fileList = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    const stats = fs.statSync(filePath);

    if (stats.isDirectory()) {
      getJSFiles(filePath, fileList);
    } else if (file.endsWith('.js')) {
      fileList.push({
        name: path.relative(distPath, filePath),
        size: stats.size
      });
    }
  });

  return fileList;
}

const totalSize = getDirectorySize(distPath);
const jsFiles = getJSFiles(distPath).sort((a, b) => b.size - a.size);

console.log('\n' + '='.repeat(60));
console.log('📊 BUNDLE SIZE ANALYSIS');
console.log('='.repeat(60));

console.log(`\n📁 Total dist size: ${formatBytes(totalSize)}`);
console.log(`\n📄 JavaScript files (${jsFiles.length} files):\n`);

// Show top 10 largest JS files
jsFiles.slice(0, 10).forEach((file, index) => {
  const bar = '█'.repeat(Math.ceil(file.size / (jsFiles[0].size / 30)));
  console.log(`${(index + 1).toString().padStart(2)}. ${file.name.padEnd(40)} ${formatBytes(file.size).padStart(10)} ${bar}`);
});

// Summary metrics
const totalJSSize = jsFiles.reduce((sum, file) => sum + file.size, 0);
const mainBundles = jsFiles.filter(f => f.name.includes('index'));
const chunkBundles = jsFiles.filter(f => !f.name.includes('index'));

console.log('\n' + '='.repeat(60));
console.log('📈 PERFORMANCE METRICS');
console.log('='.repeat(60));

console.log(`\n✅ Total JS size:        ${formatBytes(totalJSSize)}`);
console.log(`✅ Main bundles:         ${formatBytes(mainBundles.reduce((s, f) => s + f.size, 0))}`);
console.log(`✅ Lazy-loaded chunks:   ${formatBytes(chunkBundles.reduce((s, f) => s + f.size, 0))}`);
console.log(`✅ Number of chunks:     ${chunkBundles.length}`);

// Calculate metrics
const chunkPercentage = ((chunkBundles.reduce((s, f) => s + f.size, 0) / totalJSSize) * 100).toFixed(1);

console.log(`\n📊 Code splitting efficiency: ${chunkPercentage}% of code is lazy-loaded`);

console.log('\n' + '='.repeat(60));
console.log('🎯 RECOMMENDATIONS');
console.log('='.repeat(60));

if (totalJSSize > 1000000) {
  console.log('\n⚠️  Bundle size is over 1MB. Consider:');
  console.log('   - Enabling more aggressive code splitting');
  console.log('   - Removing unused dependencies');
  console.log('   - Using dynamic imports for heavy components');
} else if (totalJSSize > 500000) {
  console.log('\n✅ Bundle size is reasonable (500KB - 1MB)');
  console.log('   - Code splitting is working well!');
} else {
  console.log('\n🎉 Excellent bundle size (< 500KB)!');
  console.log('   - Your optimizations are working great!');
}

if (parseFloat(chunkPercentage) < 50) {
  console.log('\n💡 Tip: More code could be lazy-loaded to improve initial load time');
} else {
  console.log('\n✅ Great job! Lazy loading is well implemented');
}

console.log('\n' + '='.repeat(60));
console.log('\n📋 Next Steps:');
console.log('   1. Open Chrome DevTools → Network tab');
console.log('   2. Load http://localhost:8080/');
console.log('   3. Count Supabase API requests (should be 1-2)');
console.log('   4. Check React Query DevTools (bottom-right corner)');
console.log('   5. Run Lighthouse audit for performance score');
console.log('\n' + '='.repeat(60) + '\n');
