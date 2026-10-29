// Devpost gallery: 3:2 screenshots of the live site (1500x1000 CSS px at 2x).
// Usage (from this folder, with playwright-core installed): node gallery.mjs <outDir>
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const SITE = "https://overlap.u.co.uz";
const RUN = "2dc248b1-4786-477c-bbb2-c2558b95964e"; // Phoebe Bridgers example
const out = process.argv[2] ?? "gallery";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: "chromium", args: ["--hide-scrollbars"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 });
const shot = (name) => page.screenshot({ path: join(out, name) });
const results = async () => {
  await page.goto(`${SITE}/run/${RUN}`, { waitUntil: "networkidle" });
  await page.getByText("The short answer").waitFor();
  await page.waitForTimeout(600);
};
const toTop = (loc, offset) => loc.evaluate((el, o) => scrollTo(0, scrollY + el.getBoundingClientRect().top - o), offset);

await page.goto(SITE, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await shot("1-home.png");

await page.goto(`${SITE}/run/${RUN}?watch=1`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(17000);
await shot("2-agent-route.png");

await results();
await shot("3-short-answer.png");

await page.getByRole("button", { name: "Show the data" }).first().click();
await toTop(page.getByText("Brands to pitch", { exact: false }).first(), 30);
await page.getByRole("button", { name: "See the Qloo lookup" }).first().click();
await page.waitForTimeout(1200);
await shot("4-qloo-evidence.png");

await results();
await page.getByRole("button", { name: /See the comparison/ }).click();
await page.waitForTimeout(800);
await toTop(page.locator("#with-without"), 20);
await page.waitForTimeout(400);
await shot("5-with-qloo-vs-without.png");

await results();
await page.getByRole("tab", { name: "Cities" }).click();
await page.getByRole("button", { name: "Austin", exact: true }).click();
await page.waitForTimeout(600);
await toTop(page.getByText("The crowd", { exact: false }).first(), 30);
await shot("6-city-austin.png");

await results();
await page.locator('[id^="brand-"]').filter({ hasText: "Polaroid" }).first().getByRole("button", { name: /pitch/i }).click();
await page.waitForTimeout(1500);
await toTop(page.getByText("Pitch for", { exact: false }).first(), 20);
await shot("7-pitch.png");

await browser.close();
console.log("gallery ok");
