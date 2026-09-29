// Screenshot helper: node scripts/shoot.mjs <route> [--w=1280] [--h=900] [--dark] [--full] [--out=/tmp/x.png] [--wait=2500]
import { chromium } from 'playwright-core';
const args = process.argv.slice(2);
const route = args.find((a) => !a.startsWith('--')) ?? '';
const flag = (n, d) => (args.find((a) => a.startsWith(`--${n}=`)) ?? '').split('=')[1] ?? d;
const w = +flag('w', 1280);
const h = +flag('h', 900);
const dark = args.includes('--dark');
const full = args.includes('--full');
const out = flag('out', `/tmp/shot-${route.replace(/\W+/g, '_') || 'home'}${dark ? '-dark' : ''}-${w}.png`);
const wait = +flag('wait', 2500);
const base = flag('base', 'http://127.0.0.1:5199/');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: dark ? 'dark' : 'light', deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
await page.goto(`${base}#/${route}`);
await page.waitForTimeout(wait);
const sy = +flag('y', 0);
if (sy) { await page.evaluate((y) => window.scrollTo(0, y), sy); await page.waitForTimeout(300); }
await page.screenshot({ path: out, fullPage: full });
console.log(out);
if (errors.length) console.log(errors.slice(0, 8).join('\n'));
await browser.close();
