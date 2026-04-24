import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const imageRoot = path.join(projectRoot, 'public', 'imgs');
const allowedExtensions = new Set(['.html', '.css', '.js']);
const browserImagePattern = /\/imgs\/([A-Za-z0-9._-]+\.(?:jpg|jpeg|png|webp))/g;
const legacyAssetPattern = /\/(?:store-front|gun-room)\.jpg/g;
const invalidPublicImgsPattern = new RegExp(String.raw`\/public\/imgs\/([A-Za-z0-9._-]+\.(?:jpg|jpeg|png|webp))`, 'g');

function walk(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, results);
    } else if (allowedExtensions.has(path.extname(entry.name))) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = walk(projectRoot).filter((file) => !file.includes(`${path.sep}public${path.sep}`));
const missing = new Set();
const invalidPublicRefs = new Set();

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');

  for (const match of text.matchAll(browserImagePattern)) {
    const filename = match[1];
    const candidate = path.join(imageRoot, filename);
    if (!fs.existsSync(candidate)) {
      missing.add(`/imgs/${filename} (referenced in ${path.relative(projectRoot, file)})`);
    }
  }

  for (const match of text.matchAll(legacyAssetPattern)) {
    const filename = match[0].slice(1);
    const rootCandidate = path.join(projectRoot, filename);
    const publicCandidate = path.join(projectRoot, 'public', filename);
    if (!fs.existsSync(rootCandidate) && !fs.existsSync(publicCandidate)) {
      missing.add(`/${filename} (referenced in ${path.relative(projectRoot, file)})`);
    }
  }

  for (const match of text.matchAll(invalidPublicImgsPattern)) {
    invalidPublicRefs.add(`public${'/imgs/'}${match[1]} (referenced in ${path.relative(projectRoot, file)})`);
  }
}

if (invalidPublicRefs.size > 0 || missing.size > 0) {
  for (const ref of invalidPublicRefs) {
    console.error(`Invalid browser path: ${ref}`);
  }
  for (const ref of missing) {
    console.error(`Missing file for browser path: ${ref}`);
  }
  process.exit(1);
}

console.log(`Image path check passed: ${files.length} source files scanned, ${imageRoot} validated.`);
