import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const file = pathToFileURL(path.resolve('dist-single/index.html')).href;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('console', (m) => console.log('CONSOLE', m.type(), m.text().slice(0, 300)));
await page.goto(file + '#/');
for (const ms of [1000, 3000, 6000, 10000]) {
  await page.waitForTimeout(ms === 1000 ? 1000 : ms - (ms === 3000 ? 1000 : ms === 6000 ? 3000 : 6000));
  const t = await page.locator('.hero').first().innerText();
  console.log(ms, JSON.stringify(t.replace(/\s+/g, ' ').slice(0, 260)));
}
await browser.close();
