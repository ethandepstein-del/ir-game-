import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
for (const scheme of ['light', 'dark']) {
  const page = await (await browser.newContext({ viewport: { width: 1200, height: 800 }, colorScheme: scheme })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:5302/');
  await page.waitForTimeout(3500);
  const t = (await page.locator('.hero').first().innerText()).replace(/\s+/g, ' ');
  console.log(scheme, '| title:', await page.title(), '| forecast:', /Crunching/.test(t) ? 'STILL CRUNCHING' : 'ok', '| bg:', await page.evaluate(() => getComputedStyle(document.body).backgroundColor), '|', errors.join(';') || 'no errors');
  if (scheme === 'dark') await page.screenshot({ path: '/tmp/wrapped-dark.png' });
}
await browser.close();
