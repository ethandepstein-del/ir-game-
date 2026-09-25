// Bundles the animation into one self-contained HTML file (code + fonts inlined): out/ball-test.html
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const res = await build({
  entryPoints: [path.join(ROOT, 'src/main.js')],
  bundle: true, minify: true, format: 'iife', write: false, target: 'es2020',
});
const js = res.outputFiles[0].text;
const fonts = {};
for (const f of fs.readdirSync(path.join(ROOT, 'fonts'))) {
  fonts[path.basename(f, '.woff2')] = `data:font/woff2;base64,${fs.readFileSync(path.join(ROOT, 'fonts', f)).toString('base64')}`;
}
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
html = html.replace("<script type=\"module\">\n  import './src/main.js';",
  `<script>window.__FONT_DATA__ = ${JSON.stringify(fonts)};</script>\n<script>${js.replace(/<\/script/g, '<\\/script')}</script>\n<script type="module">`);
fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'out/ball-test.html'), html);
console.log('out/ball-test.html', (html.length / 1024).toFixed(0) + ' KB');
// Fragment variant (title + style + body content) for hosts that supply their own document skeleton.
const pick = (re) => (html.match(re) || [, ''])[1];
const fragment = `<title>${pick(/<title>([\s\S]*?)<\/title>/)}</title>\n<style>${pick(/<style>([\s\S]*?)<\/style>/)}</style>\n${pick(/<body>([\s\S]*?)<\/body>/)}`;
fs.mkdirSync(path.join(ROOT, '.publish'), { recursive: true });
fs.writeFileSync(path.join(ROOT, '.publish/ball-test.html'), fragment);
