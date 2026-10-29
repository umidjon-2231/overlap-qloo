// Scripted screen recording of the live demo, one clip per scene.
// Usage: node record.mjs [sceneName ...]   (no args = all scenes)
import { chromium } from "playwright-core";
import { existsSync, mkdirSync, readFileSync, renameSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SITE = "https://overlap.u.co.uz";
const RUN = "2dc248b1-4786-477c-bbb2-c2558b95964e"; // Phoebe Bridgers example
const VIEW = { width: 1536, height: 864 };
const OUT = "../recordings";
mkdirSync(OUT, { recursive: true });

// A visible cursor (headless video has none) with a pulse on click.
const CURSOR = () => {
  const add = () => {
    if (document.getElementById("__cur")) return;
    const c = document.createElement("div");
    c.id = "__cur";
    c.innerHTML =
      '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2l15 11-6.5 1.2L16 21l-3 1.4-3.4-6.9L4 20z" fill="#111" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, { position: "fixed", left: "0", top: "0", zIndex: 2147483647, pointerEvents: "none", transform: "translate(-200px,-200px)", filter: "drop-shadow(0 1px 2px rgba(0,0,0,.35))" });
    document.documentElement.appendChild(c);
    const ring = document.createElement("div");
    Object.assign(ring.style, { position: "fixed", width: "36px", height: "36px", marginLeft: "-18px", marginTop: "-18px", borderRadius: "50%", border: "3px solid #ff5a36", zIndex: 2147483646, pointerEvents: "none", opacity: "0" });
    document.documentElement.appendChild(ring);
    addEventListener("mousemove", (e) => (c.style.transform = `translate(${e.clientX - 3}px,${e.clientY - 2}px)`), true);
    addEventListener("mousedown", (e) => {
      ring.style.left = e.clientX + "px";
      ring.style.top = e.clientY + "px";
      ring.animate([{ opacity: 0.9, transform: "scale(.4)" }, { opacity: 0, transform: "scale(1.6)" }], { duration: 450, easing: "ease-out" });
    }, true);
  };
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", add);
  else add();
};

const browser = await chromium.launch({ headless: true, channel: "chromium", args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--hide-scrollbars"] });

async function scene(name, fn) {
  const dir = join(OUT, `_${name}`);
  rmSync(dir, { recursive: true, force: true });
  const ctx = await browser.newContext({ viewport: VIEW, recordVideo: { dir, size: { width: 1920, height: 1080 } }, colorScheme: "light" });
  await ctx.addInitScript(CURSOR);
  const page = await ctx.newPage();
  const t0 = Date.now();
  const marks = [];
  const h = {
    page,
    mark: (label) => marks.push({ label, t: (Date.now() - t0) / 1000 }),
    wait: (ms) => page.waitForTimeout(ms),
    async move(loc, opts = {}) {
      await loc.scrollIntoViewIfNeeded();
      const b = await loc.boundingBox();
      await page.mouse.move(b.x + b.width * (opts.fx ?? 0.5), b.y + b.height * (opts.fy ?? 0.5), { steps: opts.steps ?? 28 });
    },
    async click(loc, opts = {}) {
      await h.move(loc, opts);
      await page.waitForTimeout(opts.pause ?? 280);
      await page.mouse.down();
      await page.mouse.up();
    },
    async scroll(dy, ms = 1200) {
      await page.evaluate(
        ([dy, ms]) =>
          new Promise((done) => {
            const y0 = scrollY, t0 = performance.now();
            const step = (t) => {
              const k = Math.min(1, (t - t0) / ms), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
              scrollTo(0, y0 + dy * e);
              k < 1 ? requestAnimationFrame(step) : done();
            };
            requestAnimationFrame(step);
          }),
        [dy, ms],
      );
    },
    async scrollTo(loc, offset = 120, ms = 1200) {
      const y = await loc.evaluate((el) => el.getBoundingClientRect().top);
      await h.scroll(y - offset, ms);
    },
  };
  await page.mouse.move(VIEW.width * 0.62, VIEW.height * 0.55);
  await fn(h);
  await page.waitForTimeout(400);
  const video = page.video();
  await ctx.close();
  const src = await video.path();
  renameSync(src, join(OUT, `${name}.webm`));
  rmSync(dir, { recursive: true, force: true });
  console.log(name, ((Date.now() - t0) / 1000).toFixed(1) + "s", JSON.stringify(marks));
  const file = join(OUT, "marks.json");
  const all = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  all[name] = marks;
  writeFileSync(file, JSON.stringify(all, null, 1));
}

const scenes = {
  // s1: the home page and opening the example
  async home(h) {
    const { page } = h;
    await page.goto(SITE, { waitUntil: "networkidle" });
    await h.wait(400);
    h.mark("start");
    await h.wait(2600);
    await h.move(page.getByText("See an example", { exact: false }).first(), { steps: 30 });
    await h.scrollTo(page.getByText("See an example").first(), 140, 1400);
    await h.wait(800);
    const card = page.getByRole("button", { name: /Phoebe Bridgers Tour/ }).first();
    await h.move(card, { fx: 0.3, fy: 0.4, steps: 35 });
    await h.wait(2200);
    await h.move(card.getByText("Open example"), { steps: 18 });
    await h.wait(500);
    await page.mouse.down();
    await page.mouse.up();
    h.mark("click");
    await h.wait(1500);
  },

  // s2: the replay of the agent's route
  async replay(h) {
    const { page } = h;
    await page.goto(`${SITE}/run/${RUN}?watch=1`, { waitUntil: "domcontentloaded" });
    h.mark("start");
    await page.getByText("The short answer").waitFor({ timeout: 120000 });
    h.mark("results");
    await h.wait(1500);
  },

  // s3: short answer, the #1 card, and the data behind it
  async results(h) {
    const { page } = h;
    await page.goto(`${SITE}/run/${RUN}`, { waitUntil: "networkidle" });
    await page.getByText("The short answer").waitFor();
    await h.wait(500);
    h.mark("start");
    await h.move(page.getByRole("button", { name: "Dr. Martens" }).first(), { steps: 30 });
    await h.wait(2200);
    await h.move(page.getByRole("button", { name: "Polaroid" }).first(), { steps: 22 });
    await h.wait(900);
    await h.move(page.getByRole("button", { name: "Airbnb" }).first(), { steps: 22 });
    await h.wait(1200);
    const show = page.getByRole("button", { name: "Show the data" }).first();
    await h.scrollTo(page.getByText("Brands to pitch", { exact: false }).first(), 40, 1400);
    await h.wait(600);
    await h.click(show);
    h.mark("data");
    await h.wait(1800);
    const lookup = page.getByRole("button", { name: "See the Qloo lookup" }).first();
    await h.click(lookup);
    h.mark("drawer");
    await h.wait(4500);
  },

  // s4: with Qloo vs without
  async compare(h) {
    const { page } = h;
    await page.goto(`${SITE}/run/${RUN}`, { waitUntil: "networkidle" });
    await page.getByText("The short answer").waitFor();
    await h.wait(500);
    h.mark("start");
    const link = page.getByRole("button", { name: /See the comparison/ });
    await h.move(link, { steps: 30 });
    await h.wait(1200);
    await page.mouse.down();
    await page.mouse.up();
    h.mark("click");
    await h.wait(1800);
    const summary = page.getByText(/Scored against the same fans/).first();
    await h.scrollTo(summary, 150, 900);
    await h.move(summary, { fx: 0.35, fy: 0.5, steps: 30 });
    await h.wait(1500);
    await h.move(summary, { fx: 0.75, fy: 0.5, steps: 25 });
    h.mark("averages");
    await h.wait(3600);
    await h.move(page.getByText("Modelo", { exact: true }).first(), { steps: 30 });
    h.mark("modelo");
    await h.wait(1600);
    const amtrak = page.getByText("Amtrak", { exact: true }).first();
    await h.scrollTo(amtrak, 520, 1400);
    await h.move(amtrak, { steps: 25 });
    await h.wait(1400);
    // Scope to the comparison: the brand-by-city grid below repeats these names.
    const ww = page.locator("#with-without");
    await h.scrollTo(ww.getByText("Qloo found, the model missed", { exact: false }).first(), 150, 1400);
    await h.move(ww.getByText("Polaroid", { exact: true }).last(), { steps: 25 });
    await h.wait(1300);
    await h.move(ww.getByText("Boxed Water Is Better", { exact: true }).last(), { steps: 20 });
    await h.wait(2500);
  },

  // s5: one city in detail
  async cities(h) {
    const { page } = h;
    await page.goto(`${SITE}/run/${RUN}`, { waitUntil: "networkidle" });
    await page.getByText("The short answer").waitFor();
    await h.scrollTo(page.getByRole("tab", { name: "Brands" }), 160, 10);
    await h.wait(400);
    h.mark("start");
    await h.click(page.getByRole("tab", { name: "Cities" }));
    await h.wait(900);
    await h.click(page.getByRole("button", { name: "Austin", exact: true }));
    h.mark("austin");
    await h.wait(900);
    await h.scrollTo(page.getByText("The crowd", { exact: false }).first(), 90, 1500);
    await h.move(page.getByText("Music they like").first(), { steps: 30 });
    await h.wait(2600);
    await h.scrollTo(page.getByText("Local partners", { exact: false }).first(), 90, 1500);
    await h.move(page.getByText("Overlap suggests", { exact: false }).last(), { steps: 30, fx: 2 });
    await h.wait(3500);
  },

  // s6: write, check and approve a pitch
  async pitch(h) {
    const { page } = h;
    await page.goto(`${SITE}/run/${RUN}`, { waitUntil: "networkidle" });
    await page.getByText("The short answer").waitFor();
    const card = page.locator('[id^="brand-"]').filter({ hasText: "Polaroid" }).first();
    await h.scrollTo(card, 140, 10);
    await h.wait(400);
    h.mark("start");
    await h.click(card.getByRole("button", { name: /Write the pitch|Open pitch draft/ }));
    await h.wait(1300);
    // The brand's pitch view has its own "Write the pitch" when no draft exists yet.
    const write = page.getByRole("button", { name: "Write the pitch" }).first();
    if (await write.isVisible().catch(() => false)) await h.click(write);
    h.mark("writing");
    await page.getByRole("button", { name: "Approve" }).first().waitFor({ timeout: 180000 });
    h.mark("written");
    await h.wait(1200);
    await h.scroll(520, 2200);
    await h.wait(1200);
    await h.scroll(700, 2200);
    await h.wait(1000);
    await h.scroll(-1220, 1600);
    await h.wait(500);
    await h.click(page.getByRole("button", { name: "Approve" }).first());
    h.mark("approve");
    await h.wait(3500);
  },

  // s7: try your own tour
  async own(h) {
    const { page } = h;
    await page.goto(SITE, { waitUntil: "networkidle" });
    await h.scrollTo(page.getByText("Or try your own tour", { exact: false }).first(), 120, 10);
    await h.wait(400);
    h.mark("start");
    await h.click(page.getByLabel("Artist"));
    await page.keyboard.type("Mitski", { delay: 85 });
    await h.click(page.getByLabel("Cities"));
    await page.keyboard.type("Denver, Portland, Toronto", { delay: 60 });
    await h.wait(400);
    await h.move(page.getByRole("button", { name: "Find sponsors" }), { steps: 25 });
    h.mark("typed");
    await h.wait(2500);
  },
};

const pick = process.argv.slice(2);
for (const [name, fn] of Object.entries(scenes)) {
  if (pick.length && !pick.includes(name)) continue;
  try {
    await scene(name, fn);
  } catch (e) {
    console.error(name, "FAILED:", e.message.split("\n")[0]);
  }
}
await browser.close();
console.log("files:", readdirSync(OUT).join(" "));
