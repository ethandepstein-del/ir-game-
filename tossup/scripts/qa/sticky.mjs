import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
await page.goto('http://127.0.0.1:5199/#/house');
await page.waitForTimeout(3000);
for (const y of [0, 800, 2200]) {
  await page.evaluate((yy) => window.scrollTo(0, yy), y);
  await page.waitForTimeout(400);
  console.log(y, await page.evaluate(() => JSON.stringify(document.querySelector('.topbar').getBoundingClientRect().top)));
}
await browser.close();
