const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const base = new URL(process.argv[2] || "http://localhost:3100");
const pages = [
  ["/", "Your wedding, beautifully organised."],
  ["/login", "Welcome back."],
  ["/signup", "Start your wedding journey."],
  ["/verify-email", "Verify your email."],
  ["/forgot-password", "Forgot your password?"],
  ["/reset-password", "Choose a new password."],
  ["/preview/create-wedding", "A place for your celebration."],
];

async function main() {
  for (const [pathname, title] of pages) {
    const response = await fetch(new URL(pathname, base));
    assert.equal(response.status, 200, pathname);
    const text = (await response.text()).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
    assert.ok(text.includes(title), pathname);
  }
  for (const pathname of ["/missing-scaffold-page", "/api/auth/not-implemented"]) {
    assert.equal((await fetch(new URL(pathname, base))).status, 404, pathname);
  }
  for (const [pathname, method] of [["/api/v1/me", "GET"], ["/api/v1/weddings", "POST"], ["/api/v1/weddings/000000000000000000000001/events", "GET"], ["/api/v1/weddings/000000000000000000000001/events", "POST"], ["/api/v1/weddings/000000000000000000000001/events/000000000000000000000002", "GET"], ["/api/v1/weddings/000000000000000000000001/events/000000000000000000000002", "PATCH"]]) {
    const denied = await fetch(new URL(pathname, base), { method });
    assert.equal(denied.status, 401);
    assert.equal((await denied.json()).error.code, "AUTH_REQUIRED");
  }
  const sessionResponse = await fetch(new URL("/api/auth/get-session", base));
  assert.ok([200, 503].includes(sessionResponse.status), "Session lookup must succeed or report unavailable configuration");
  if (sessionResponse.status === 503) assert.deepEqual(await sessionResponse.json(), { code: "TEMPORARILY_UNAVAILABLE", message: "This capability is not configured." });
  for (const pathname of ["/account", "/dashboard", "/dashboard/events", "/create-wedding"]) {
    const privatePage = await fetch(new URL(pathname, base), { redirect: "manual" });
    assert.equal(privatePage.status, 307, pathname);
    assert.equal(new URL(privatePage.headers.get("location"), base).pathname, "/login");
  }
  console.log("PASS: HTTP pages and deferred endpoints.");
  let playwright;
  try {
    playwright = require(process.env.PLAYWRIGHT_MODULE_PATH
      ? path.resolve(process.env.PLAYWRIGHT_MODULE_PATH) : "playwright");
  } catch (error) {
    if (error.code !== "MODULE_NOT_FOUND") throw error;
    console.log("NOT RUN: browser smoke; supply PLAYWRIGHT_MODULE_PATH to existing Playwright tooling.");
    return;
  }
  let browser;
  try {
    browser = await playwright.chromium.launch({
      headless: true,
      ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
    });
  } catch (error) {
    if (!error.message.includes("Executable doesn't exist")) throw error;
    console.log("NOT RUN: browser smoke; selected browser executable is unavailable. Use an installed PLAYWRIGHT_CHANNEL, such as msedge.");
    return;
  }
  try {
    for (const width of [1280, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        const location = message.location().url;
        // No favicon is implemented by the scaffold; Edge requests one implicitly.
        if (location === new URL("/favicon.ico", base).href && message.text().includes("404")) return;
        if (sessionResponse.status === 503 && location === new URL("/api/auth/sign-up/email", base).href && message.text().includes("503")) return;
        if (sessionResponse.status === 503 && location === new URL("/api/auth/get-session", base).href && message.text().includes("503")) return;
        if (message.type() === "error") errors.push(`${message.text()} (${location})`);
      });
      for (const [pathname, title] of pages) {
        const response = await page.goto(new URL(pathname, base).href);
        assert.equal(response.status(), 200);
        await page.getByRole("heading", { name: title, exact: true }).waitFor();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${pathname} overflow at ${width}px`);
        if (pathname === "/preview/create-wedding") {
          const writes = [];
          const recordWrite = (request) => { if (request.method() === "POST" && new URL(request.url()).pathname.startsWith("/api/")) writes.push(request.url()); };
          page.on("request", recordWrite);
          if (process.env.SMOKE_SCREENSHOT_DIR) await page.screenshot({ path: path.join(path.resolve(process.env.SMOKE_SCREENSHOT_DIR), `create-wedding-${width}.png`), fullPage: true });
          await page.getByLabel("Bride name", { exact: true }).fill("Synthetic Bride");
          await page.getByLabel("Groom name", { exact: true }).fill("Synthetic Groom");
          await page.getByLabel("Wedding date", { exact: true }).fill("2027-02-14");
          await page.getByLabel("Wedding location", { exact: true }).fill("Kozhikode, Kerala");
          await page.getByLabel(/Wedding title/).fill("Our preview celebration");
          await page.getByRole("button", { name: "Preview wedding dashboard" }).click();
          await page.getByRole("heading", { name: "Your wedding workspace.", exact: true }).waitFor();
          await page.getByRole("region", { name: "Wedding details preview" }).getByRole("heading", { name: "Synthetic Groom & Synthetic Bride", exact: true }).waitFor();
          assert.ok((await page.locator("main").innerText()).includes("Our preview celebration"));
          assert.ok((await page.locator("main").innerText()).includes("No wedding has been created or saved"));
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
          const mobileDrawer = page.getByRole("dialog", { name: "Workspace navigation", exact: true });
          let previewNavigation;
          if (width < 850) {
            await page.getByRole("button", { name: "Open workspace navigation", exact: true }).click();
            await mobileDrawer.waitFor();
            previewNavigation = mobileDrawer.getByRole("navigation", { name: "Wedding preview navigation" });
          } else {
            previewNavigation = page.getByRole("complementary", { name: "Preview workspace" }).getByRole("navigation", { name: "Wedding preview navigation" });
            await page.evaluate(() => window.scrollTo(0, 350));
            assert.ok(Math.abs((await page.getByRole("complementary", { name: "Preview workspace" }).boundingBox()).y) < 1, "Sidebar stays in place while dashboard scrolls");
            await page.evaluate(() => window.scrollTo(0, 0));
          }
          await previewNavigation.getByRole("button", { name: "Expenses Soon", exact: true }).click();
          const featureDialog = page.getByRole("dialog", { name: "Expenses", exact: true });
          await featureDialog.waitFor();
          assert.equal(await mobileDrawer.isVisible(), false, "Mobile drawer closes before opening the feature panel");
          assert.ok((await featureDialog.innerText()).includes("Nothing is created, changed, or sent"));
          await page.keyboard.press("Escape");
          await featureDialog.waitFor({ state: "hidden" });
          if (width < 850) {
            await page.getByRole("button", { name: "Open workspace navigation", exact: true }).click();
            await mobileDrawer.getByRole("button", { name: "Close workspace navigation", exact: true }).click();
            await mobileDrawer.waitFor({ state: "hidden" });
          }
          await page.getByRole("region", { name: "A celebration worth sharing", exact: true }).getByRole("button", { name: "Guest QR Soon", exact: true }).click();
          const qrDialog = page.getByRole("dialog", { name: "Guest QR", exact: true });
          await qrDialog.waitFor();
          await qrDialog.getByRole("button", { name: "Back to workspace", exact: true }).click();
          await qrDialog.waitFor({ state: "hidden" });
          await page.evaluate(() => window.scrollTo(0, 0));
          if (process.env.SMOKE_SCREENSHOT_DIR) await page.screenshot({ path: path.join(path.resolve(process.env.SMOKE_SCREENSHOT_DIR), `dashboard-design-${width}.png`), fullPage: true });
          await page.getByRole("button", { name: "Edit preview details" }).click();
          assert.equal(await page.getByLabel("Bride name", { exact: true }).inputValue(), "Synthetic Bride");
          await page.reload();
          await page.getByLabel("Bride name", { exact: true }).waitFor();
          assert.equal(await page.getByLabel("Bride name", { exact: true }).inputValue(), "");
          assert.deepEqual(writes, [], "Design previews never POST wedding data");
          page.off("request", recordWrite);
        }
        if (pathname === "/dashboard" && process.env.SMOKE_SCREENSHOT_DIR) await page.screenshot({ path: path.join(path.resolve(process.env.SMOKE_SCREENSHOT_DIR), `dashboard-${width}.png`), fullPage: true });
        if (pathname === "/signup") {
          const password = page.getByLabel("Password", { exact: true });
          await password.fill("Synthetic-password-123");
          const toggle = page.getByRole("button", { name: "Show password", exact: true });
          await toggle.focus();
          await page.keyboard.press("Space");
          assert.equal(await password.getAttribute("type"), "text");
          assert.equal(await password.inputValue(), "Synthetic-password-123");
          await page.getByRole("button", { name: "Hide password", exact: true }).click();
          assert.equal(await password.getAttribute("type"), "password");
          await password.fill("");
          const signupImage = page.locator('img[alt^="Illustrative wedding ritual"]');
          if (await signupImage.isVisible()) assert.ok(await signupImage.evaluate(async (image) => { await image.decode(); return image.naturalWidth > 0; }));
          if (process.env.SMOKE_SCREENSHOT_DIR) {
            fs.mkdirSync(path.resolve(process.env.SMOKE_SCREENSHOT_DIR), { recursive: true });
            await page.evaluate(() => document.fonts.ready);
            await page.screenshot({ path: path.join(path.resolve(process.env.SMOKE_SCREENSHOT_DIR), `signup-${width}.png`), fullPage: true });
          }
        }
        if (pathname === "/signup" && sessionResponse.status === 503) {
          await page.getByLabel("Your name").fill("Synthetic browser check");
          await page.getByLabel("Email address").fill("synthetic@example.com");
          await page.getByLabel(/^Password/).fill("Synthetic-password-123");
          await page.getByRole("button", { name: "Create account" }).click();
          await page.getByRole("alert").filter({ hasText: "Account services are unavailable" }).waitFor();
          assert.ok(await page.getByRole("button", { name: "Create account" }).isEnabled(), "Failed signup can be retried");
          assert.equal(new URL(page.url()).pathname, "/signup", "Unavailable service must not fabricate success");
          if (process.env.SMOKE_SCREENSHOT_DIR) await page.screenshot({ path: path.join(path.resolve(process.env.SMOKE_SCREENSHOT_DIR), `signup-error-${width}.png`), fullPage: true });
        }
        if (pathname === "/") {
          const themeTabs = page.getByRole("tablist", { name: "Wedding website themes" });
          const minimal = themeTabs.getByRole("tab", { name: /Minimal Elegant/ });
          const classic = themeTabs.getByRole("tab", { name: /Classic Indian/ });
          const modern = themeTabs.getByRole("tab", { name: /Modern Celebration/ });
          assert.equal(await minimal.getAttribute("aria-selected"), "true", "Minimal theme is the default");
          for (const tab of [classic, modern, minimal]) {
            await tab.click();
            assert.equal(await tab.getAttribute("aria-selected"), "true");
            const panel = page.getByRole("tabpanel");
            assert.equal(await panel.count(), 1, "Exactly one theme must be visible");
            await panel.getByRole("heading", { name: /Rajesh.*Kavitha/ }).waitFor();
            assert.ok((await panel.innerText()).includes("Kadavu Resort, Kozhikode"));
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `Theme overflow at ${width}px`);
            if (process.env.SMOKE_SCREENSHOT_DIR) {
              const directory = path.resolve(process.env.SMOKE_SCREENSHOT_DIR);
              fs.mkdirSync(directory, { recursive: true });
              await page.locator("#wedding-website").screenshot({ path: path.join(directory, `${await tab.getAttribute("id")}-${width}.png`) });
            }
          }
          await minimal.focus();
          await page.keyboard.press("ArrowRight");
          assert.equal(await modern.getAttribute("aria-selected"), "true");
          assert.ok(await modern.evaluate((element) => element === document.activeElement));
          await page.keyboard.press("Home");
          assert.equal(await classic.getAttribute("aria-selected"), "true");
          await page.keyboard.press("End");
          assert.equal(await modern.getAttribute("aria-selected"), "true");
          await page.keyboard.press("ArrowRight");
          assert.equal(await classic.getAttribute("aria-selected"), "true", "Theme keyboard navigation wraps");
          await minimal.click();
          const guestFaq = page.locator("summary").filter({ hasText: "Will my guests need an account?" });
          await guestFaq.click();
          assert.ok(await page.locator("details").filter({ hasText: "Will my guests need an account?" }).evaluate((element) => element.open), "FAQ must expand");
          await guestFaq.click();
          if (width < 1150) {
            await page.getByRole("button", { name: /Menu/ }).click();
            await page.getByRole("navigation", { name: "Mobile homepage navigation" }).getByRole("link", { name: "Features", exact: true }).click();
            assert.equal(await page.getByRole("button", { name: /Menu/ }).getAttribute("aria-expanded"), "false");
          }
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.evaluate(() => document.fonts.ready);
          const brokenImages = await page.locator("img").evaluateAll(async (images) => {
            images.forEach((image) => { image.loading = "eager"; });
            await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
            return images.filter((image) => !image.complete || image.naturalWidth === 0).length;
          });
          assert.equal(brokenImages, 0, "Homepage images must load");
          if (process.env.SMOKE_SCREENSHOT_DIR) {
            const directory = path.resolve(process.env.SMOKE_SCREENSHOT_DIR);
            fs.mkdirSync(directory, { recursive: true });
            await page.screenshot({ path: path.join(directory, `homepage-${width}.png`), fullPage: true });
            await page.screenshot({ path: path.join(directory, `homepage-${width}-viewport.png`) });
          }
        }
      }
      const sessionEndpoint = new URL("/api/auth/get-session", base).href;
      let memberSession = null;
      await page.route(sessionEndpoint, route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(memberSession) }));
      await page.goto(base.href);
      await page.locator("header").getByRole("link", { name: "Log in", exact: true, includeHidden: true }).waitFor({ state: "attached" });
      assert.equal(await page.locator("header").getByRole("link", { name: /profile, open dashboard/ }).count(), 0);
      memberSession = { session: { id: "synthetic-session", userId: "67f100000000000000000001", expiresAt: new Date(Date.now() + 60000).toISOString() }, user: { id: "67f100000000000000000001", name: "  Ananya Sharma  ", email: "synthetic@example.com", emailVerified: true } };
      await page.reload();
      const profile = page.locator("header").getByRole("link", { name: "Ananya Sharma profile, open dashboard", exact: true });
      await profile.waitFor();
      assert.equal(await profile.innerText(), "A");
      assert.equal(await page.locator("header").getByRole("link", { name: "Log in", exact: true }).count(), 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
      await profile.click();
      // A mocked browser session cannot bypass the server's live session check.
      await page.waitForURL(new URL("/login", base).href);
      memberSession = null;
      await page.goto(base.href);
      await page.locator("header").getByRole("link", { name: "Log in", exact: true, includeHidden: true }).waitFor({ state: "attached" });
      assert.equal(await page.locator("header").getByRole("link", { name: /profile, open dashboard/ }).count(), 0);
      await page.unroute(sessionEndpoint);
      for (const [label, pathname] of [["Log in", "/login"], ["Dashboard preview", "/dashboard"]]) {
        await page.goto(base.href);
        await page.getByRole("navigation", { name: "Preview navigation" }).getByRole("link", { name: label, exact: true }).click();
        await page.waitForURL(new URL(pathname === "/dashboard" ? "/login" : pathname, base).href);
      }
      assert.deepEqual(errors, [], `Browser runtime errors at ${width}px`);
      await page.close();
    }
    console.log("PASS: desktop/mobile rendering, theme switching and keyboard controls, navigation, overflow, and browser runtime checks.");
    console.log("NOTE: automatic favicon 404 and the expected unconfigured-signup 503 are excluded; other console errors fail the check.");
  } finally { await browser.close(); }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
