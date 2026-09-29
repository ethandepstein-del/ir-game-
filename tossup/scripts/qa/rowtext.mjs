// Print the text of table rows matching a pattern. node scripts/qa/rowtext.mjs <route> <regex>
import { chromium } from 'playwright-core';
const [route, pat] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
await page.goto(`http://127.0.0.1:5199/#/${route}`);
await page.waitForTimeout(3500);
const rows = await page.locator('tr').allInnerTexts();
for (const r of rows) if (new RegExp(pat, 'i').test(r)) console.log(r.replace(/\s+/g, ' '));
await browser.close();
