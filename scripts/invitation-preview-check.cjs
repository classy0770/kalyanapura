// UI preview only. Starts the existing production build; no account/provider/product writes.
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const net = require("node:net");
const { spawn } = require("node:child_process");

async function main() {
  const playwright = require(process.env.PLAYWRIGHT_MODULE_PATH ? path.resolve(process.env.PLAYWRIGHT_MODULE_PATH) : "playwright");
  const root = path.resolve(__dirname,"..");
  const port = await new Promise(resolve => { const socket = net.createServer(); socket.listen(0,"127.0.0.1",() => { const port = socket.address().port; socket.close(() => resolve(port)); }); });
  const origin = "http://localhost:"+port;
  const server = spawn(process.execPath,[path.join(root,"node_modules/next/dist/bin/next"),"start","--port",String(port),"--hostname","127.0.0.1"],{ cwd: root,env: { ...process.env,NEXT_TELEMETRY_DISABLED: "1" },stdio: ["ignore","pipe","pipe"],windowsHide: true });
  server.stdout.on("data",() => {}); server.stderr.on("data",() => {});
  let browser;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 45; attempt++) {
      if (server.exitCode !== null) throw new Error("Preview server exited before readiness");
      try { const response = await fetch(origin+"/preview/invitation",{ signal: globalThis.AbortSignal.timeout(2000) }); if (response.ok) { ready = true; break; } } catch { /* Wait for the server to start. */ }
      await new Promise(resolve => globalThis.setTimeout(resolve,1000));
    }
    assert.ok(ready,"Production invitation preview renders");
    browser = await playwright.chromium.launch({ headless: true,channel: process.env.PLAYWRIGHT_CHANNEL || "msedge" });
    for (const width of [1280,390]) {
      const context = await browser.newContext({ viewport: { width,height: 900 } });
      const page = await context.newPage(), errors = [], productRequests = [];
      page.on("pageerror",error => errors.push(error.message));
      page.on("request",request => { if (/\/api\/(v1|auth)\//.test(request.url())) productRequests.push(request.url()); });
      await page.goto(origin+"/preview/invitation");
      await page.getByRole("heading",{ name: "Anjali & Arjun",level: 1,exact: true }).waitFor();
      await page.keyboard.press("Tab");
      assert.equal(await page.locator(":focus").innerText(),"Skip to invitation");
      await page.keyboard.press("Enter");
      assert.ok(await page.getByRole("button",{ name: "Preview response",exact: true }).isDisabled());
      await page.getByRole("radio",{ name: /^Joyfully accept/ }).check();
      await page.getByLabel("How many people will attend?").selectOption("4");
      assert.equal(await page.getByLabel("How many people will attend?").locator("option").count(),4);
      await page.getByRole("button",{ name: "Preview response",exact: true }).click();
      await page.getByText("Preview response: attending with 4 people.",{ exact: true }).waitFor();
      await page.getByRole("button",{ name: "Change preview response" }).click();
      await page.getByRole("radio",{ name: /^Regretfully decline/ }).check();
      assert.equal(await page.getByLabel("How many people will attend?").count(),0);
      await page.getByRole("button",{ name: "Preview response",exact: true }).click();
      await page.getByText("Preview response: not attending.",{ exact: true }).waitFor();
      await page.getByLabel("Preview scenario").selectOption("no-events");
      await page.getByRole("heading",{ name: "No active invited events" }).waitFor();
      assert.ok(await page.getByRole("radio",{ name: /^Joyfully accept/ }).isDisabled());
      await page.getByRole("radio",{ name: /^Regretfully decline/ }).check();
      await page.getByRole("button",{ name: "Preview response",exact: true }).click();
      await page.getByText("Preview response: not attending.",{ exact: true }).waitFor();
      await page.getByLabel("Preview scenario").selectOption("unavailable");
      await page.getByRole("heading",{ name: "Let’s help you find your invitation." }).waitFor();
      assert.equal(await page.getByRole("radio").count(),0);
      await page.getByRole("button",{ name: "Reset preview" }).click();
      assert.ok(await page.getByRole("button",{ name: "Preview response",exact: true }).isDisabled());
      for (const link of await page.getByRole("link",{ name: /^View directions/ }).all()) { assert.ok((await link.getAttribute("href")).startsWith("https://www.google.com/maps/search/?api=1&query=")); assert.equal(await link.getAttribute("rel"),"noopener noreferrer"); }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
      assert.deepEqual(errors,[]); assert.deepEqual(productRequests,[]);
      const output = path.join(root,"node_modules/.cache/kalyanapura-checks/screenshots"); fs.mkdirSync(output,{ recursive: true });
      await page.screenshot({ path: path.join(output,`invitation-${width}.png`),fullPage: true });
      await context.close();
      console.log(`PASS: ${width}px invitation preview: attend/decline, bounded party size, change response, no-events/unavailable/reset, keyboard access, directions, no overflow/runtime errors/product requests.`);
    }
  } finally { if (browser) await browser.close(); server.kill(); }
}
main().catch(error => { console.error("FAIL: invitation preview check:",error.message); process.exitCode = 1; });
