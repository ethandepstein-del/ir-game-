// Screenshot each Election night tab. node scripts/qa/night.mjs [--w=1280] [--dark]
import { chromium } from 'playwright-core';
const args = process.argv.slice(2);
const flag = (n, d) => (args.find((a) => a.startsWith(`--${n}=`)) ?? '').split('=')[1] ?? d;
const w = +flag('w', 1280);
const dark = args.includes('--dark');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, colorScheme: dark ? 'dark' : 'light' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
await page.goto('http://127.0.0.1:5199/#/night');
await page.waitForTimeout(2500);
const tabs = await page.locator('.night-tabs button').allInnerTexts();
console.log('tabs:', tabs);
for (const t of tabs) {
  await page.locator('.night-tabs button', { hasText: t }).first().click();
  await page.waitForTimeout(1800);
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  console.log(t, 'scrollW', sw, w);
  await page.screenshot({ path: `/tmp/n-${t.replace(/\W+/g, '_')}-${w}${dark ? '-dark' : ''}.png`, fullPage: true });
}
console.log(errors.join('\n') || 'no errors');
await browser.close();
