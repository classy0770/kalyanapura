// Presentation smoke check only. Uses fictional preview state; no account creation or product writes.
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

async function main() {
  const playwright = require(process.env.PLAYWRIGHT_MODULE_PATH ? path.resolve(process.env.PLAYWRIGHT_MODULE_PATH) : "playwright");
  const base = process.argv[2] || "http://localhost:3100";
  const browser = await playwright.chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "msedge", headless: true });
  try {
    for (const width of [1280, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(base + "/preview/guests");
      await page.getByRole("heading", { name: "Guest list", exact: true }).waitFor();
      assert.equal(await page.locator("tbody tr").count(), 6);
      await page.getByLabel("Search guests").fill("Suresh");
      assert.equal(await page.locator("tbody tr").count(), 1);
      await page.getByLabel("Search guests").fill("");
      await page.getByRole("combobox", { name: /^RSVP status/ }).selectOption("Pending");
      assert.equal(await page.locator("tbody tr").count(), 2);
      await page.getByRole("combobox", { name: /^Invited event/ }).selectOption("Muhurtham");
      assert.equal(await page.locator("tbody tr").count(), 1);
      await page.getByLabel("Search guests").fill("no such guest");
      await page.getByRole("heading", { name: "No guests found" }).waitFor();
      await page.getByRole("button", { name: "Clear filters" }).click();
      await page.getByRole("button", { name: "+ Add guest", exact: true }).click();
      await page.getByLabel("Guest / family name").fill("Preview family");
      await page.getByLabel("Maximum party size").fill("3");
      await page.getByLabel("Muhurtham", { exact: true }).check();
      await page.getByRole("button", { name: "Add to preview" }).click();
      assert.equal(await page.locator("tbody tr").count(), 7);
      await page.getByRole("button", { name: "Preview family", exact: true }).click();
      await page.getByRole("heading", { name: "Guest details", exact: true }).waitFor();
      await page.getByRole("button", { name: "Edit sample guest" }).click();
      await page.getByLabel("Guest / family name").fill("Updated preview family");
      await page.getByRole("button", { name: "Update preview" }).click();
      await page.getByRole("button", { name: "Updated preview family", exact: true }).waitFor();
      await page.getByRole("button", { name: "Edit Suresh & Lakshmi Menon", exact: true }).click();
      assert.equal(await page.getByLabel("Maximum party size").getAttribute("min"), "3");
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("dialog[open]").count(), 0);
      await page.getByRole("button", { name: "Reset samples" }).click();
      assert.equal(await page.locator("tbody tr").count(), 6);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
      const output = path.resolve("node_modules/.cache/kalyanapura-checks/screenshots");
      fs.mkdirSync(output, { recursive: true });
      await page.screenshot({ path: path.join(output, `guests-${width}.png`), fullPage: true });
      if (width === 390) {
        await page.getByRole("button", { name: "Open workspace navigation" }).click();
        await page.getByRole("dialog", { name: "Workspace navigation" }).getByRole("link", { name: /Guest list/ }).click();
        assert.equal(await page.locator("dialog[open]").count(), 0);
      }
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`PASS: ${width}px guest preview search/filter → details → add/edit → party limit → reset, dialog dismissal, no horizontal overflow or runtime errors.`);
    }
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
