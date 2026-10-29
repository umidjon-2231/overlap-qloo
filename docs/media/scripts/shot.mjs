// README hero: the results page of the Phoebe Bridgers example at 1440 wide, 2x.
import { chromium } from "playwright-core";

const browser = await chromium.launch({ headless: true, channel: "chromium", args: ["--hide-scrollbars"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await page.goto("https://overlap.u.co.uz/run/2dc248b1-4786-477c-bbb2-c2558b95964e", { waitUntil: "networkidle" });
await page.getByText("The short answer").waitFor();
await page.waitForTimeout(800);
await page.screenshot({ path: process.argv[2] });
await browser.close();
console.log("shot ok");
