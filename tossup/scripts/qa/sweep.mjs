// QA sweep: every route at phone width (light) and desktop (dark). Reports horizontal overflow and console errors.
// node scripts/qa/sweep.mjs [--w=400] [--dark] [--routes=a,b] [--shots]
import { chromium } from 'playwright-core';
const args = process.argv.slice(2);
const flag = (n, d) => (args.find((a) => a.startsWith(`--${n}=`)) ?? '').split('=')[1] ?? d;
const w = +flag('w', 400);
const dark = args.includes('--dark');
const shots = args.includes('--shots');
const routes = (flag('routes', '') || 'home,generic,approval,senate,governors,house,forecast,lab,polls,night,methods,race/senate-nc,race/house-pa-07,race/governor-az,state/NC,state/PA').split(',');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, colorScheme: dark ? 'dark' : 'light', deviceScaleFactor: 1 });
for (const r of routes) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
  await page.goto(`http://127.0.0.1:5199/#/${r === 'home' ? '' : r}`);
  await page.waitForTimeout(2800);
  const over = await page.evaluate(() => {
    const W = window.innerWidth;
    const sw = document.documentElement.scrollWidth;
    const bad = [];
    if (sw > W + 1) {
      for (const el of document.querySelectorAll('body *')) {
        const b = el.getBoundingClientRect();
        if (b.width === 0 || b.right <= W + 1) continue;
        // ignore anything inside a scroll container
        let p = el.parentElement, inScroll = false;
        while (p && p !== document.body) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') { inScroll = true; break; } p = p.parentElement; }
        if (!inScroll) bad.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} right=${Math.round(b.right)}`);
      }
    }
    return { sw, W, bad: bad.slice(0, 5) };
  });
  console.log(`${r.padEnd(18)} scrollW=${over.sw}/${over.W} ${over.sw > over.W + 1 ? 'OVERFLOW ' + over.bad.join(' | ') : 'ok'}${errors.length ? '\n   ' + errors.slice(0, 3).join('\n   ') : ''}`);
  if (shots) await page.screenshot({ path: `/tmp/qa-${r.replace(/\W+/g, '_')}-${w}${dark ? '-dark' : ''}.png`, fullPage: true });
  await page.close();
}
await browser.close();
