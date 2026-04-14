const fs = require('fs');
const path = require('path');

function replaceBackticks(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('\\\`')) {
    content = content.replace(/\\\`/g, '\`');
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Fixed: " + filePath);
  }
}

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      scanDir(p);
    } else if (p.endsWith('.tsx') || p.endsWith('.ts')) {
      replaceBackticks(p);
    }
  }
}

scanDir('./app');
scanDir('./src');
console.log("Done fixing.");
