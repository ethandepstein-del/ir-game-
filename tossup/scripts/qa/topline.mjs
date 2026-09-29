import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
await page.goto('http://127.0.0.1:5199/#/');
await page.waitForTimeout(3500);
const t = await page.locator('.hero').first().innerText();
console.log(t.replace(/\s+/g, ' ').match(/HOUSE.*$/)?.[0]);
await browser.close();
