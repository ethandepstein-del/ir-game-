// Turns dist-single/index.html into the fragment form the Artifact publisher expects (no <html>/<head>/<body>).
// Usage: npm run build:single && node scripts/make-artifact.mjs   ->  dist-single/artifact.html
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync('dist-single/index.html', 'utf8');
const title = src.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? 'Tossup';
const style = src.match(/<style[^>]*>([\s\S]*?)<\/style>/)?.[1];
const script = src.match(/<script type="module"[^>]*>([\s\S]*?)<\/script>/)?.[1];
if (!style || !script) throw new Error('Could not find the inlined style and script in dist-single/index.html');

const out = `<title>${title}</title>
<style>${style}</style>
<div id="root"></div>
<script type="module">${script}</script>
`;
writeFileSync('dist-single/artifact.html', out);
console.log(`dist-single/artifact.html  ${(out.length / 1024).toFixed(0)} kB`);
