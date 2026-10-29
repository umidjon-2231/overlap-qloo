// Renders the video's title and end cards (1920x1080) and the Devpost thumbnail (1620x1080) into ../cards.
import { chromium } from "playwright-core";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const browser = await chromium.launch({ headless: true, channel: "chromium", args: ["--allow-file-access-from-files"] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(pathToFileURL(resolve("../cards/cards.html")).href);
await page.evaluate(() => document.fonts.ready);
for (const id of ["title", "end", "thumb"]) await page.locator(`#${id}`).screenshot({ path: `../cards/card-${id}.png` });
await browser.close();
console.log("cards ok");
