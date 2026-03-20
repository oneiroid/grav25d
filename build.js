const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');

let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// Inline CSS: replace <link rel="stylesheet" href="src/style.css"> with <style>...</style>
html = html.replace(
  /<link\s+rel="stylesheet"\s+href="src\/style\.css"\s*\/?>/,
  '<style>\n' + fs.readFileSync(path.join(SRC, 'style.css'), 'utf8') + '</style>'
);

// Inline JS: collect all <script src="src/..."> tags, replace with single <script>
const scripts = [...html.matchAll(/<script\s+src="src\/([^"]+)"><\/script>/g)].map(m => m[1]);

if (scripts.length > 0) {
  const combined = scripts
    .map(name => fs.readFileSync(path.join(SRC, name), 'utf8'))
    .join('\n\n');

  // Replace first script tag with combined, remove the rest
  let first = true;
  html = html.replace(/<script\s+src="src\/[^"]+"><\/script>/g, () => {
    if (first) { first = false; return '<script>\n' + combined + '\n</script>'; }
    return '';
  });

  // Clean up blank lines left by removed tags
  html = html.replace(/\n{3,}/g, '\n\n');
}

const dist = path.join(ROOT, 'dist');
if (!fs.existsSync(dist)) fs.mkdirSync(dist);
fs.writeFileSync(path.join(dist, 'index.html'), html, 'utf8');

console.log('Built dist/index.html (' + Math.round(html.length / 1024) + ' KB)');
