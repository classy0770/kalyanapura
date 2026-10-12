// Runs a disposable copy of this application with an isolated local replica set.
// No .env files are copied; credentials/providers are synthetic. Requires existing Playwright.
const assert = require("node:assert/strict");
const { Buffer } = require("node:buffer");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const net = require("node:net");
const { spawn, execFileSync } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const { MongoClient, ObjectId } = require("mongodb");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const { sourceLoader } = require("./scaffold-contract-check.cjs");

async function runCsvImport(page,context,guestBase,origin,invitationShots,width) {
        const beforeImport=(await(await context.request.get(guestBase+"?limit=100")).json()).data.length;
        await page.getByText("Import guests from CSV",{exact:true}).click();
        const importPanel=page.locator("details").filter({has:page.getByRole("heading",{name:"Preview before importing",exact:true})});
        await importPanel.getByLabel("Guest CSV file").setInputFiles({name:"guests.csv",mimeType:"text/csv",buffer:Buffer.from('name,email,phone,max_party_size,notes\n"Imported first family",shared-csv@example.com,00123,4,"Quoted, notes"\nImported second family,shared-csv@example.com,,2,\n,bad,,0,\n')});
        await importPanel.getByRole("group",{name:"Default invited events"}).getByLabel("Updated Sangeet",{exact:true}).check();
        await importPanel.getByRole("button",{name:"Preview CSV",exact:true}).click();
        await importPanel.getByLabel("Row 3 name").waitFor();assert.ok(await importPanel.getByLabel("Select source row 3").isDisabled());
        assert.equal((await(await context.request.get(guestBase+"?limit=100")).json()).data.length,beforeImport);
        await importPanel.getByLabel("Row 3 name").fill("Imported third family");await importPanel.getByLabel("Row 3 email").fill("third-csv@example.com");await importPanel.getByLabel("Row 3 maxPartySize").fill("2");
        await importPanel.getByRole("button",{name:"Revalidate or refresh same import",exact:true}).click();
        await importPanel.getByText("Preview validated. Review warnings before confirming. Imported-row edits never update saved guests.",{exact:true}).waitFor();
        const importUrl=guestBase+"/import";let importRequests=0;
        await page.route(importUrl,async route=>{importRequests++;await route.fetch();await route.abort();});
        await importPanel.getByLabel("I reviewed the selected rows. No invitations will be sent.",{exact:true}).check();await importPanel.getByRole("button",{name:"Import selected batch",exact:true}).click();
        await importPanel.getByRole("button",{name:"Retry same import batch",exact:true}).waitFor();assert.ok(await importPanel.getByLabel("Row 1 name").isDisabled());
        await page.unroute(importUrl);await importPanel.getByLabel("I reviewed the selected rows. No invitations will be sent.",{exact:true}).check();await importPanel.getByRole("button",{name:"Retry same import batch",exact:true}).click();
        await importPanel.getByText("0 created; 3 already imported. Review the remaining batch.",{exact:true}).waitFor();assert.equal(importRequests,1);
        const importedRows=(await(await context.request.get(guestBase+"?limit=100")).json()).data;assert.equal(importedRows.length,beforeImport+3);assert.ok(importedRows.filter(g=>g.name.startsWith("Imported ")).every(g=>g.rsvp.status==="pending"&&g.rsvp.partySize===0));
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));await page.screenshot({path:path.join(invitationShots,`csv-import-${width}.png`),fullPage:true});
        console.log(`PASS: ${width}px CSV upload preview without writes, row correction/revalidation, reviewed batch, lost-response explicit retry without duplicates, Pending guests and refreshed directory.`);
}
async function main() {
  const importsOnly=process.argv.includes("--imports-only");
  const invitationsOnly = process.argv.includes("--invitations-only");
  const withGuests = process.argv.includes("--guests") || invitationsOnly || importsOnly;
  const withEvents = (process.argv.includes("--events") || withGuests) && !invitationsOnly && !importsOnly;
  const playwright = require(process.env.PLAYWRIGHT_MODULE_PATH ? path.resolve(process.env.PLAYWRIGHT_MODULE_PATH) : "playwright");
  const root = path.resolve(__dirname, "..");
  const project = fs.mkdtempSync(path.join(os.tmpdir(), "kalyanapura-browser-"));
  // Generated temporary test checkout. Retain it for diagnostics; no recursive deletion.
  for (const file of ["src", "public", "package.json", "package-lock.json", "tsconfig.json", "next-env.d.ts", "next.config.ts"]) fs.cpSync(path.join(root, file), path.join(project, file), { recursive: true });
  fs.symlinkSync(path.join(root, "node_modules"), path.join(project, "node_modules"), process.platform === "win32" ? "junction" : "dir");
  const port = await new Promise(resolve => { const socket = net.createServer(); socket.listen(0, "127.0.0.1", () => { const value = socket.address().port; socket.close(() => resolve(value)); }); });
  const origin = "http://localhost:" + port;
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: "8.2.6" }, instanceOpts: [{ launchTimeout: 60000 }] });
  const client = new MongoClient(replica.getUri()), secret = randomBytes(32).toString("hex");
  let server, browser;
  const watchedTokens = []; let leakedInvitationToken = false;
  try {
    await client.connect();
    const db = client.db("wedding_browser_isolated"), load = sourceLoader();
    const { createAccountAuth, prepareAccountIndexes } = load("src/modules/accounts/server/auth.ts");
    await prepareAccountIndexes(db);
    const queue = [];
    const auth = createAccountAuth(db, client, { origin, secret }, async item => queue.push(item));
    const headers = { origin, "content-type": "application/json", "x-kalyanapura-client-ip": "127.0.0.1" };
    for (const email of ["desktop@example.com", "mobile@example.com"]) {
      const response = await auth.handler(new globalThis.Request(origin + "/api/auth/sign-up/email", { method: "POST", headers, body: JSON.stringify({ name: "Synthetic Planner", email, password: "Synthetic-password-123" }) }));
      assert.equal(response.status, 200);
      await auth.handler(new globalThis.Request(queue.find(item => item.email === email).url));
    }
    const { getWeddingEncryptionKey } = load("src/modules/weddings/server/config.ts");
    const { CapabilityConfigurationError } = load("src/server/config.ts");
    process.env.WEDDING_GALLERY_ENCRYPTION_KEY = "";
    assert.throws(getWeddingEncryptionKey, CapabilityConfigurationError);
    const childEnv = { ...process.env, NODE_ENV: "development", NEXT_TELEMETRY_DISABLED: "1", APP_ORIGIN: origin, MONGODB_URI: replica.getUri(), MONGODB_DB_NAME: db.databaseName, BETTER_AUTH_SECRET: secret, AUTH_EMAIL_ENCRYPTION_KEY: randomBytes(32).toString("hex"), WEDDING_GALLERY_ENCRYPTION_KEY: randomBytes(32).toString("hex"), WEDDING_EVENT_LIMIT: "25", RESEND_API_KEY: "re_synthetic_no_provider", AUTH_EMAIL_FROM: "onboarding@resend.dev", INNGEST_DEV: "1", INNGEST_EVENT_KEY: "", INNGEST_SIGNING_KEY: "", AUTH_TRUSTED_IP_HEADER: "" };
    childEnv.GUEST_MAX_PARTY_SIZE = "20";
    server = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "dev", "--webpack", "--port", String(port), "--hostname", "127.0.0.1"], { cwd: project, env: childEnv, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    // Drain child logs without printing request headers or bodies.
    const inspectLog = data => { if (watchedTokens.some(token => data.toString().includes(token))) leakedInvitationToken = true; };
    server.stdout.on("data", inspectLog); server.stderr.on("data", inspectLog);
    let ready = false;
    for (let attempt = 0; attempt < 90; attempt++) {
      if (server.exitCode !== null) throw new Error("Isolated application server exited before readiness.");
      try { const response = await fetch(origin + "/api/v1/me", { signal: globalThis.AbortSignal.timeout(2000) }); if (response.status === 401) { ready = true; break; } } catch { /* Readiness or cleanup may race process shutdown. */ }
      await new Promise(resolve => globalThis.setTimeout(resolve, 1000));
    }
    assert.ok(ready, "Isolated application becomes ready");
    // Warm shared invitation chunks before opening stateful member dialogs in dev.
    if (withGuests) {
      await fetch(origin+"/invite/synthetic-entry"); await fetch(origin+"/invitation");
      const emptyGuestPath = "/api/v1/weddings/000000000000000000000000/guests/000000000000000000000000";
      const emptyEventPath = "/api/v1/weddings/000000000000000000000000/events";
      const emptyGuestListPath = "/api/v1/weddings/000000000000000000000000/guests";
      // Unauthenticated/CSRF-rejected requests compile handlers without product writes.
      for (const [route,method] of [[emptyEventPath,"GET"],[emptyEventPath,"POST"],[emptyGuestListPath,"GET"],[emptyGuestListPath,"POST"],[emptyGuestListPath+"/import-preview","POST"],[emptyGuestListPath+"/import","POST"],[emptyGuestPath,"GET"],[emptyGuestPath,"PATCH"],[emptyGuestPath+"/rsvp","PUT"],[emptyGuestPath+"/invitation-link","GET"],[emptyGuestPath+"/invitation","PATCH"],[emptyGuestPath+"/invitation/replace","POST"],["/api/v1/guest/access","POST"],["/api/v1/guest/access","DELETE"],["/api/v1/guest/rsvp","PUT"],["/api/v1/guest/invitation","GET"]]) await fetch(origin+route,{ method });
    }
    browser = await playwright.chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
    for (const [width, email] of [[1280, "desktop@example.com"], [390, "mobile@example.com"]]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage(), errors = [];
      page.setDefaultTimeout(60000); page.setDefaultNavigationTimeout(90000);
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(origin + "/dashboard", { waitUntil: "domcontentloaded" });
      await page.waitForURL(origin + "/login");
      await page.getByLabel("Email address").fill(email);
      await page.getByLabel("Password", { exact: true }).fill("Synthetic-password-123");
      await page.getByRole("button", { name: "Log in", exact: true }).click();
      await page.waitForURL(origin + "/create-wedding");
      await page.getByLabel("Bride name", { exact: true }).fill("Saved Bride");
      await page.getByLabel("Groom name", { exact: true }).fill("Saved Groom");
      await page.getByLabel("Wedding date", { exact: true }).fill("2027-02-14");
      await page.getByLabel("Wedding location", { exact: true }).fill("Kochi");
      await page.getByLabel(/Wedding title/).fill("Our saved celebration");
      await page.getByRole("button", { name: "Create wedding", exact: true }).click();
      await page.waitForURL(origin + "/dashboard");
      await page.getByRole("region", { name: "Wedding details preview" }).getByRole("heading", { name: "Saved Groom & Saved Bride", exact: true }).waitFor();
      assert.ok((await page.locator("main").innerText()).includes("Your wedding details and countdown are real"));
      assert.ok(await page.getByText("Admin", { exact: true }).isVisible());
      assert.equal(await page.getByText("Sample countdown", { exact: true }).count(), 0);
      const me = await (await context.request.get(origin + "/api/v1/me")).json();
      assert.equal(me.data.nextAction, "dashboard");
      const own = await context.request.get(origin + "/api/v1/weddings/" + me.data.membership.weddingId);
      assert.equal(own.status(), 200);
      await page.reload();
      await page.getByRole("heading", { name: "Saved Groom & Saved Bride", exact: true }).waitFor();
      await page.goto(origin + "/create-wedding");
      await page.waitForURL(origin + "/dashboard");
      if (withEvents) {
        assert.ok(await page.getByText("Saved itinerary", { exact: true }).isVisible());
        assert.equal(await page.getByText("Sample itinerary", { exact: true }).count(), 0);
        if (width < 900) {
          await page.getByRole("button", { name: "Open workspace navigation" }).click();
          await page.getByRole("dialog", { name: "Workspace navigation" }).getByRole("link", { name: "Events", exact: true }).click();
        } else await page.getByRole("complementary", { name: "Preview workspace" }).getByRole("link", { name: "Events", exact: true }).click();
        await page.waitForURL(origin + "/dashboard/events");
        await page.getByRole("heading", { name: "Your celebrations begin here." }).waitFor();
        await page.getByRole("button", { name: "+ Add event", exact: true }).click();
        const drawer = page.getByRole("dialog", { name: "Add event", exact: true });
        await drawer.getByLabel("Event name", { exact: true }).fill("Saved Sangeet");
        await drawer.getByLabel(/^Event type/).selectOption("sangeet");
        await drawer.getByLabel("Start date and time", { exact: true }).fill("2027-02-13T23:30");
        assert.equal(await drawer.getByLabel("Start date and time", { exact: true }).getAttribute("step"),"60");
        await drawer.getByLabel("End date and time (optional)", { exact: true }).fill("2027-02-14T01:00");
        await drawer.getByLabel("Venue name (optional)", { exact: true }).fill("Family courtyard");
        await drawer.getByLabel("Address (optional)", { exact: true }).fill("Kochi, Kerala");
        await drawer.getByLabel("Dress code (optional)", { exact: true }).fill("Festive colours");
        await drawer.getByLabel("Description (optional)", { exact: true }).fill("An evening together.");
        const eventBase = origin + "/api/v1/weddings/" + me.data.membership.weddingId + "/events";
        let createRequests = 0;
        const loseCreateResponse = async route => {
          if (route.request().method() !== "POST") return route.continue();
          createRequests++;
          const committed = await route.fetch();
          assert.equal(committed.status(), 201);
          // The real handler commits; only the browser's response is lost.
          await route.abort("failed");
        };
        await page.route(eventBase, loseCreateResponse);
        await drawer.getByRole("button", { name: "Create event", exact: true }).click();
        await drawer.getByRole("alert").waitFor();
        assert.ok(await drawer.getByRole("button", { name: "Create event", exact: true }).isDisabled());
        assert.equal(await page.getByRole("heading", { name: "Saved Sangeet", exact: true }).count(), 0);
        assert.equal((await (await context.request.get(eventBase)).json()).data.length, 1);
        const failedReload = route => route.abort("failed");
        await page.route(eventBase, failedReload);
        await drawer.getByRole("button", { name: "Check saved events", exact: true }).click();
        await drawer.getByText("Couldn’t reload saved events.", { exact: false }).waitFor();
        assert.ok(await drawer.getByRole("button", { name: "Create event", exact: true }).isDisabled());
        await page.unroute(eventBase, failedReload);
        let releaseReload, startedReload;
        const reloadGate = new Promise(resolve => { releaseReload = resolve; });
        const reloadStarted = new Promise(resolve => { startedReload = resolve; });
        const delayedReload = async route => { startedReload(); await reloadGate; await route.continue(); };
        await page.route(eventBase, delayedReload);
        await drawer.getByRole("button", { name: "Check saved events", exact: true }).click();
        await reloadStarted;
        assert.ok(await drawer.getByRole("button", { name: "Create event", exact: true }).isDisabled());
        assert.ok(await drawer.getByRole("button", { name: "Checking…", exact: true }).isDisabled());
        releaseReload();
        await page.getByRole("heading", { name: "Saved Sangeet", exact: true }).waitFor();
        await page.waitForFunction(() => !document.querySelector('dialog[open]'));
        await page.unroute(eventBase, delayedReload);
        await page.unroute(eventBase, loseCreateResponse);
        assert.equal(createRequests, 1, "Recovery must not replay the committed creation");
        assert.equal((await (await context.request.get(eventBase)).json()).data.length, 1);
        assert.ok(await page.getByRole("button", { name: "+ Add event", exact: true }).isEnabled());
        await page.reload();
        const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Saved Sangeet", exact: true }) });
        await card.getByRole("button", { name: "View details" }).click();
        const detail = page.getByRole("dialog", { name: "Saved Sangeet", exact: true });
        await detail.waitFor(); assert.ok((await detail.innerText()).includes("Kochi, Kerala"));
        await detail.getByRole("button", { name: "Edit event", exact: true }).click();
        const edit = page.getByRole("dialog", { name: "Edit event", exact: true });
        const list = await (await context.request.get(eventBase)).json(), saved = list.data[0];
        assert.equal(saved.startsAt, "2027-02-13T18:00:00.000Z"); assert.equal(saved.endsAt, "2027-02-13T19:30:00.000Z");
        const changed = await context.request.patch(eventBase + "/" + saved.id, { headers: { Origin: origin, "X-KP-Request": "1", "X-Expected-Version": String(saved.version) }, data: { name: "Changed elsewhere", startsAt: "2027-02-13T18:00:12.123Z", endsAt: "2027-02-13T19:30:45.456Z" } }); assert.equal(changed.status(),200);
        await edit.getByLabel("Event name", { exact: true }).fill("Old form name");
        await edit.getByRole("button", { name: "Save changes", exact: true }).click();
        await edit.getByRole("alert").waitFor(); assert.ok(await edit.getByRole("button", { name: "Save changes" }).isDisabled());
        await edit.getByRole("button", { name: "Reload latest details" }).click();
        await page.waitForFunction(() => document.querySelector('input[name="name"]')?.value === "Changed elsewhere");
        assert.equal(await edit.getByLabel("Start date and time", { exact: true }).inputValue(),"2027-02-13T23:30");
        assert.equal(await edit.getByLabel("End date and time (optional)", { exact: true }).inputValue(),"2027-02-14T01:00");
        await edit.getByLabel("Event name", { exact: true }).fill("Updated Sangeet");
        await edit.getByRole("button", { name: "Save changes", exact: true }).click();
        await page.getByRole("heading", { name: "Updated Sangeet", exact: true }).waitFor();
        const precise = await (await context.request.get(eventBase + "/" + saved.id)).json();
        assert.equal(precise.data.startsAt,"2027-02-13T18:00:12.123Z"); assert.equal(precise.data.endsAt,"2027-02-13T19:30:45.456Z");
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
        if (process.env.SMOKE_SCREENSHOT_DIR) { const output = path.resolve(process.env.SMOKE_SCREENSHOT_DIR); fs.mkdirSync(output,{ recursive: true }); await page.screenshot({ path: path.join(output,`events-${width}.png`),fullPage: true }); }
        await page.goto(origin + "/dashboard");
        await page.getByRole("heading", { name: "Updated Sangeet", exact: true }).waitFor();
        const summary = page.getByRole("article").filter({ has: page.getByText("Wedding events", { exact: true }) }); assert.ok((await summary.innerText()).includes("1"));
        console.log("PASS: " + width + "px real event create → cross-midnight persistence → view → stale edit conflict/reload → save → live dashboard itinerary/count.");
      }
      if (importsOnly) {
        const guestBase=origin+"/api/v1/weddings/"+me.data.membership.weddingId+"/guests";
        const seeded=await context.request.post(origin+"/api/v1/weddings/"+me.data.membership.weddingId+"/events",{headers:{Origin:origin,"X-KP-Request":"1"},data:{name:"Updated Sangeet",type:"sangeet",startsAt:"2027-02-14T10:00:00+05:30"}}); assert.equal(seeded.status(),201);
        await page.goto(origin+"/dashboard/guests");
        const shots=path.join(root,"node_modules/.cache/kalyanapura-checks/screenshots");fs.mkdirSync(shots,{recursive:true});
        await runCsvImport(page,context,guestBase,origin,shots,width);
      }
      if (withGuests && !importsOnly) {
        if (invitationsOnly) {
          const seededEvent = await context.request.post(origin+"/api/v1/weddings/"+me.data.membership.weddingId+"/events",{ headers: { Origin: origin,"X-KP-Request": "1" },data: { name: "Updated Sangeet",type: "sangeet",startsAt: "2027-02-13T23:30:00+05:30",endsAt: "2027-02-14T01:00:00+05:30",venueName: "Family courtyard",address: "Kochi, Kerala",description: "An evening together",dressCode: "Festive colours" } });
          assert.equal(seededEvent.status(),201);
        }
        await page.goto(origin + "/dashboard/guests");
        await page.getByRole("heading", { name: "Your guest list starts here" }).waitFor();
        assert.equal(await page.getByText("Interactive design preview", { exact: true }).count(),0);
        await page.getByRole("button", { name: "+ Add guest", exact: true }).click();
        const add = page.getByRole("dialog", { name: "Add a guest", exact: true });
        await add.getByLabel("Guest / family name").fill("Saved guest family");
        await add.getByLabel("Email (optional)").fill("family@example.com");
        await add.getByLabel("Maximum party size").fill("4");
        await add.getByLabel("Updated Sangeet", { exact: true }).check();
        await add.getByLabel("Organiser notes (optional)").fill("Arrange transport");
        await add.getByRole("button", { name: "Save guest", exact: true }).click();
        await page.waitForFunction(() => !document.querySelector('dialog[open]'));
        await page.getByRole("button", { name: "Saved guest family", exact: true }).waitFor();
        await page.reload();
        await page.getByRole("button", { name: "Saved guest family", exact: true }).click();
        const details = page.getByRole("dialog", { name: "Guest details", exact: true });
        await details.waitFor(); assert.ok((await details.innerText()).includes("Arrange transport")); assert.ok((await details.innerText()).includes("Updated Sangeet"));
        await details.getByRole("button", { name: "Edit guest", exact: true }).click();
        const editing = page.getByRole("dialog", { name: "Edit guest", exact: true });
        const guestBase = origin + "/api/v1/weddings/" + me.data.membership.weddingId + "/guests";
        const savedGuest = (await (await context.request.get(guestBase)).json()).data[0];
        const changedGuest = await context.request.patch(guestBase+"/"+savedGuest.id,{ headers: { Origin: origin,"X-KP-Request": "1","X-Expected-Version": String(savedGuest.version) },data: { notes: "Changed elsewhere" } }); assert.equal(changedGuest.status(),200);
        await editing.getByLabel("Guest / family name").fill("Old guest form");
        await editing.getByRole("button", { name: "Save changes", exact: true }).click();
        await editing.getByRole("alert").waitFor(); assert.ok(await editing.getByRole("button", { name: "Save changes", exact: true }).isDisabled());
        await editing.getByRole("button", { name: "Reload latest details", exact: true }).click();
        await page.waitForFunction(() => document.querySelector('dialog textarea')?.value === "Changed elsewhere");
        await editing.getByLabel("Guest / family name").fill("Updated guest family");
        await editing.getByLabel("Maximum party size").fill("3");
        await editing.getByRole("button", { name: "Save changes", exact: true }).click();
        await page.waitForFunction(() => !document.querySelector('dialog[open]'));
        await page.getByRole("button", { name: "Updated guest family", exact: true }).waitFor();
        await page.getByLabel("Search guest names").fill("updated");
        await page.getByRole("button", { name: "Apply", exact: true }).click();
        await page.getByRole("button", { name: "Updated guest family", exact: true }).waitFor();
        await page.getByRole("combobox", { name: /^RSVP status/ }).selectOption("attending");
        await page.getByRole("button", { name: "Apply", exact: true }).click();
        await page.getByRole("heading", { name: "No guests match these filters" }).waitFor();
        await page.getByRole("button", { name: "Clear filters", exact: true }).click();
        await page.getByRole("button", { name: "Updated guest family", exact: true }).waitFor();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
        // Simulate an allocation made before the current deployment's lower limit.
        await db.collection("guests").updateOne({ _id: new ObjectId(savedGuest.id) },{ $set: { maxPartySize: 25 } });
        await page.reload();
        await page.getByRole("button", { name: "Edit Updated guest family", exact: true }).click();
        await editing.getByLabel("Phone (optional)").fill("1234567890");
        await editing.getByLabel("Organiser notes (optional)").fill("Unrelated edit preserves allocation");
        const patchRequest = page.waitForRequest(request => request.method() === "PATCH" && request.url() === guestBase+"/"+savedGuest.id);
        await editing.getByRole("button", { name: "Save changes", exact: true }).click();
        assert.deepEqual((await patchRequest).postDataJSON(),{ phone: "1234567890",notes: "Unrelated edit preserves allocation" });
        await page.waitForFunction(() => !document.querySelector('dialog[open]'));
        const preservedGuest = (await (await context.request.get(guestBase+"/"+savedGuest.id)).json()).data;
        assert.equal(preservedGuest.maxPartySize,25); assert.equal(preservedGuest.phone,"1234567890");
        await page.getByRole("button", { name: "Edit Updated guest family", exact: true }).click();
        await editing.getByLabel("Maximum party size").fill("24");
        await editing.getByRole("button", { name: "Save changes", exact: true }).click();
        await editing.getByText("Maximum party size is 20.", { exact: true }).waitFor();
        await editing.getByLabel("Maximum party size").fill("20");
        await editing.getByRole("button", { name: "Save changes", exact: true }).click();
        await page.waitForFunction(() => !document.querySelector('dialog[open]'));
        assert.equal((await (await context.request.get(guestBase+"/"+savedGuest.id)).json()).data.maxPartySize,20);
        await page.getByRole("button", { name: "Updated guest family",exact: true }).click();
        await details.getByRole("button", { name: "Load invitation link",exact: true }).click();
        const invitationUrl = await details.getByLabel("Personal invitation URL").inputValue();
        async function returnToMemberControls() {
          await page.bringToFront();
          if (!await details.isVisible()) await page.getByRole("button",{ name: "Updated guest family",exact: true }).click();
          await details.getByRole("button",{ name: await details.getByLabel("Personal invitation URL").isVisible() ? "Reload current link and status" : "Load invitation link",exact: true }).click();
          await details.getByLabel("Personal invitation URL").waitFor();
        }
        watchedTokens.push(invitationUrl.split("/").at(-1));
        const guestContext = await browser.newContext({ viewport: { width,height: 900 } });
        const guestPage = await guestContext.newPage();
        guestPage.setDefaultTimeout(60000);
        async function assertGuestUnavailable(stage) {
          try { await guestPage.getByRole("heading",{ name: "Let’s help you find your invitation." }).waitFor({ timeout: 15000 }); }
          catch { throw new Error(`Guest unavailable UI after ${stage}: headings=${JSON.stringify(await guestPage.getByRole("heading").allTextContents())}; API status=${(await guestContext.request.get(origin+"/api/v1/guest/invitation")).status()}`); }
        }
        guestPage.on("pageerror",error => errors.push(error.message));
        const entryResponse = await guestPage.goto(invitationUrl);
        assert.equal(entryResponse.headers()["referrer-policy"],"no-referrer");
        assert.ok(entryResponse.headers()["cache-control"].includes("no-store"));
        await guestPage.waitForURL(origin+"/invitation");
        await guestPage.getByRole("button",{ name: "Open my invitation",exact: true }).click();
        await guestPage.getByRole("heading",{ name: "Saved Bride & Saved Groom",level: 1 }).waitFor();
        assert.ok(await guestPage.getByRole("heading",{ name: "Updated Sangeet",exact: true }).isVisible());
        assert.equal(await guestPage.getByRole("button",{ name: "Save response",exact: true }).count(),1);
        assert.doesNotMatch(await guestPage.locator("body").innerText(),/family@example|1234567890|Unrelated edit preserves allocation/);
        assert.equal((await guestContext.request.get(guestBase)).status(),401);
        assert.ok((await guestContext.cookies()).some(cookie => cookie.name === "kp-guest" && cookie.httpOnly && cookie.sameSite === "Lax"));
        assert.ok(await guestPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
        const invitationShots = path.join(root,"node_modules/.cache/kalyanapura-checks/screenshots"); fs.mkdirSync(invitationShots,{ recursive: true });
        await guestPage.screenshot({ path: path.join(invitationShots,`invitation-live-${width}.png`),fullPage: true });
        console.log(`PASS: ${width}px real guest invitation and private-data projection.`);
        await guestPage.getByRole("radio",{ name: /Yes, I’ll be there/ }).check();
        await guestPage.getByLabel("How many people will attend?").selectOption("3");
        await guestPage.getByRole("button",{ name: "Save response",exact: true }).click();
        await guestPage.getByRole("button",{ name: "Change response",exact: true }).waitFor();
        await guestPage.reload();
        await guestPage.getByText("Attending · 3 people",{ exact: true }).waitFor();
        await guestPage.getByRole("button",{ name: "Change response",exact: true }).click();
        const beforeStaleRsvp = (await (await context.request.get(guestBase+"/"+savedGuest.id)).json()).data;
        assert.equal((await context.request.patch(guestBase+"/"+savedGuest.id,{ headers: { Origin: origin,"X-KP-Request": "1","X-Expected-Version": String(beforeStaleRsvp.version) },data: { notes: "Organiser changed invitation while guest was editing" } })).status(),200);
        await guestPage.getByLabel("How many people will attend?").selectOption("4");
        await guestPage.getByRole("button",{ name: "Save response",exact: true }).click();
        await guestPage.getByRole("button",{ name: "Load latest response",exact: true }).waitFor();
        assert.ok(await guestPage.getByRole("button",{ name: "Save response",exact: true }).isDisabled());
        await guestPage.getByRole("button",{ name: "Load latest response",exact: true }).click();
        await guestPage.getByText("Latest response and invitation loaded. Check these before saving another change.",{ exact: true }).waitFor();
        assert.equal(await guestPage.getByLabel("How many people will attend?").inputValue(),"3");
        // Commit once but lose the response. Recovery must explicitly fetch saved state.
        let rsvpRequests = 0;
        const rsvpUrl = origin+"/api/v1/guest/rsvp";
        await guestPage.route(rsvpUrl,async route => { rsvpRequests++; await route.fetch(); await route.abort(); });
        await guestPage.getByLabel("How many people will attend?").selectOption("2");
        await guestPage.getByRole("button",{ name: "Save response",exact: true }).click();
        await guestPage.getByRole("alert").waitFor();
        assert.ok(await guestPage.getByRole("button",{ name: "Save response",exact: true }).isDisabled());
        await guestPage.unroute(rsvpUrl);
        await guestPage.getByRole("button",{ name: "Load latest response",exact: true }).click();
        await guestPage.getByText("Attending · 2 people",{ exact: true }).waitFor();
        assert.equal(rsvpRequests,1,"An uncertain response is not automatically replayed");
        await guestPage.getByRole("radio",{ name: /Sorry, I can’t attend/ }).check();
        await guestPage.getByRole("button",{ name: "Save response",exact: true }).click();
        await guestPage.getByRole("button",{ name: "Change response",exact: true }).waitFor();
        assert.equal((await (await context.request.get(guestBase+"/"+savedGuest.id)).json()).data.rsvp.partySize,0);
        await guestPage.getByRole("button",{ name: "Change response",exact: true }).click();
        await guestPage.getByRole("radio",{ name: /Yes, I’ll be there/ }).check();
        await guestPage.getByLabel("How many people will attend?").selectOption("3");
        await guestPage.getByRole("button",{ name: "Save response",exact: true }).click();
        await guestPage.getByRole("button",{ name: "Change response",exact: true }).waitFor();
        await guestPage.screenshot({ path: path.join(invitationShots,`rsvp-saved-${width}.png`),fullPage: true });
        console.log(`PASS: ${width}px saved RSVP, reload, stale edit recovery, uncertain save recovery and attending/declining changes.`);
        await returnToMemberControls();
        await details.getByRole("button",{ name: "Disable invitation",exact: true }).click();
        await details.getByRole("button",{ name: "Confirm disable",exact: true }).click();
        await details.getByRole("button",{ name: "Load invitation link",exact: true }).click();
        await details.getByText("Link disabled — guests cannot open it",{ exact: true }).waitFor();
        await guestPage.reload();
        await assertGuestUnavailable("disable");
        await returnToMemberControls();
        await details.getByRole("button",{ name: "Enable invitation",exact: true }).click();
        await details.getByRole("button",{ name: "Confirm enable",exact: true }).click();
        await details.getByRole("button",{ name: "Load invitation link",exact: true }).click();
        await details.getByText("Link enabled",{ exact: true }).waitFor();
        await guestPage.goto(invitationUrl); await guestPage.getByRole("button",{ name: "Open my invitation",exact: true }).click();
        await guestPage.getByRole("heading",{ name: "Saved Bride & Saved Groom",level: 1 }).waitFor();
        await returnToMemberControls();
        await details.getByRole("button",{ name: "Replace invitation link",exact: true }).click();
        await details.getByRole("button",{ name: "Confirm replacement",exact: true }).click();
        await details.getByRole("button",{ name: "Load invitation link",exact: true }).click();
        const newInvitationUrl = await details.getByLabel("Personal invitation URL").inputValue();
        watchedTokens.push(newInvitationUrl.split("/").at(-1)); assert.notEqual(newInvitationUrl,invitationUrl);
        await guestPage.reload(); await assertGuestUnavailable("replacement");
        await guestPage.goto(invitationUrl); await guestPage.getByRole("button",{ name: "Open my invitation",exact: true }).click();
        await guestPage.getByRole("alert").waitFor();
        await guestPage.goto(newInvitationUrl); await guestPage.getByRole("button",{ name: "Open my invitation",exact: true }).click();
        await guestPage.getByRole("heading",{ name: "Saved Bride & Saved Groom",level: 1 }).waitFor();
        const closeResponse = guestPage.waitForResponse(response => response.request().method() === "DELETE" && response.url() === origin+"/api/v1/guest/access");
        await guestPage.getByRole("button",{ name: "Close guest access",exact: true }).click();
        assert.equal((await closeResponse).status(),204);
        await assertGuestUnavailable("guest logout");
        assert.ok(!(await guestContext.cookies()).some(cookie => cookie.name === "kp-guest"));
        console.log(`PASS: ${width}px disable, replacement and guest logout invalidate access.`);
        assert.equal((await context.request.get(origin+"/api/v1/me")).status(),200,"Guest logout does not affect the member session");
        await guestContext.close();
        await returnToMemberControls();
        // Commit a replacement but lose its response: block a repeat until explicit reload.
        const beforeLost = (await (await context.request.get(guestBase+"/"+savedGuest.id)).json()).data;
        const replaceUrl = guestBase+"/"+savedGuest.id+"/invitation/replace";
        await page.route(replaceUrl,async route => { await route.fetch(); await route.abort(); });
        await details.getByRole("button",{ name: "Replace invitation link",exact: true }).click();
        await details.getByRole("button",{ name: "Confirm replacement",exact: true }).click();
        await details.getByText(/We couldn’t confirm the change/).waitFor();
        assert.ok(await details.getByRole("button",{ name: "Replace invitation link",exact: true }).isDisabled());
        await page.unroute(replaceUrl);
        await details.getByRole("button",{ name: "Reload current link and status",exact: true }).click();
        await details.getByText("Current link and status loaded. Check these before another change.",{ exact: true }).waitFor();
        const afterLost = (await (await context.request.get(guestBase+"/"+savedGuest.id)).json()).data;
        assert.equal(afterLost.invitation.tokenVersion,beforeLost.invitation.tokenVersion+1);
        assert.ok(await details.getByRole("button",{ name: "Replace invitation link",exact: true }).isEnabled());
        assert.equal(leakedInvitationToken,false,"Bearer tokens must not appear in application logs");
        await details.getByRole("button",{ name: "Close guest panel",exact: true }).click();
        console.log("PASS: " + width + "px secure invitation controls, clean guest URL and scoped page, disable/enable/replace invalidation, guest-only logout, lost-response recovery and token log redaction.");
        if (process.env.SMOKE_SCREENSHOT_DIR) { const output = path.resolve(process.env.SMOKE_SCREENSHOT_DIR); fs.mkdirSync(output,{ recursive: true }); await page.screenshot({ path: path.join(output,`guests-saved-${width}.png`),fullPage: true }); }
        await page.goto(origin + "/dashboard");
        await page.getByText("Saved RSVPs",{ exact: true }).waitFor();
        await page.getByText("1 of 1 guest groups have responded.",{ exact: true }).waitFor();
        assert.ok((await page.locator("body").innerText()).includes("Expected attendees: 3"));
        const guestSummary = page.getByRole("article").filter({ has: page.getByText("Guest groups", { exact: true }) });
        await guestSummary.getByText("Saved", { exact: true }).waitFor(); assert.equal(await guestSummary.locator("strong").innerText(),"1");
        console.log("PASS: " + width + "px saved guest create → reload → detail/event assignment → stale edit/reload → save → prefix/status filters → real dashboard count.");
        // Two tabs share a cookie, but a form must stay bound to its displayed guest.
        const eventId = (await (await context.request.get(origin+"/api/v1/weddings/"+me.data.membership.weddingId+"/events")).json()).data[0].id;
        async function freshInvitation(name) {
          const created = await context.request.post(guestBase,{ headers: { Origin: origin,"X-KP-Request": "1" },data: { name,maxPartySize: 4,invitedEventIds: [eventId] } });
          assert.equal(created.status(),201); const value = (await created.json()).data;
          const link = (await (await context.request.get(guestBase+"/"+value.id+"/invitation-link")).json()).data.url;
          watchedTokens.push(link.split("/").at(-1)); return { ...value,link };
        }
        const a = await freshInvitation("Invitation A family"), b = await freshInvitation("Invitation B family");
        assert.equal(a.version,b.version);
        const sharedGuestContext = await browser.newContext({ viewport: { width,height: 900 } });
        const tabA = await sharedGuestContext.newPage(), tabB = await sharedGuestContext.newPage();
        for (const tab of [tabA,tabB]) { tab.setDefaultTimeout(60000); tab.on("pageerror",error => errors.push(error.message)); }
        await tabA.goto(a.link); await tabA.waitForURL(origin+"/invitation");
        await tabA.getByRole("button",{ name: "Open my invitation",exact: true }).click();
        await tabA.getByText("Dear Invitation A family,",{ exact: true }).waitFor();
        await tabA.getByRole("radio",{ name: /Yes, I’ll be there/ }).check();
        await tabA.getByLabel("How many people will attend?").selectOption("2");
        await tabB.goto(b.link); await tabB.waitForURL(origin+"/invitation");
        await tabB.getByRole("button",{ name: "Open my invitation",exact: true }).click();
        await tabB.getByText("Dear Invitation B family,",{ exact: true }).waitFor();
        const rejectedSave = tabA.waitForResponse(response => response.url() === origin+"/api/v1/guest/rsvp" && response.request().method() === "PUT");
        await tabA.getByRole("button",{ name: "Save response",exact: true }).click();
        const rejection = await rejectedSave; assert.equal(rejection.status(),409); assert.equal((await rejection.json()).error.code,"INVITATION_CONTEXT_CHANGED");
        await tabA.getByRole("button",{ name: "Load latest response",exact: true }).waitFor();
        assert.ok(await tabA.getByRole("button",{ name: "Save response",exact: true }).isDisabled());
        assert.equal(await tabA.getByRole("heading",{ name: "Your response is saved",exact: true }).count(),0);
        for (const guest of [a,b]) { const record = (await (await context.request.get(guestBase+"/"+guest.id)).json()).data; assert.equal(record.version,guest.version); assert.equal(record.rsvp.status,"pending"); }
        await tabA.getByRole("button",{ name: "Load latest response",exact: true }).click();
        await tabA.getByText("Dear Invitation B family,",{ exact: true }).waitFor();
        assert.equal(await tabA.getByText("Dear Invitation A family,",{ exact: true }).count(),0);
        await tabA.getByRole("radio",{ name: /Sorry, I can’t attend/ }).check();
        await tabA.getByRole("button",{ name: "Save response",exact: true }).click();
        await tabA.getByRole("button",{ name: "Change response",exact: true }).waitFor();
        assert.equal((await (await context.request.get(guestBase+"/"+a.id)).json()).data.rsvp.status,"pending");
        assert.equal((await (await context.request.get(guestBase+"/"+b.id)).json()).data.rsvp.status,"not_attending");
        await sharedGuestContext.close();
        console.log(`PASS: ${width}px equal-version invitations in shared-cookie tabs reject a mismatched RSVP without writes; explicit reload replaces the displayed identity and allows the correct save.`);
        await page.goto(origin+"/dashboard/guests");
        await page.getByRole("button",{name:a.name,exact:true}).click();
        const correction = page.getByRole("region",{name:"Organiser RSVP correction"});
        async function openCorrection() { await correction.getByRole("button",{name:"Record or correct RSVP",exact:true}).click(); await correction.getByLabel("Corrected RSVP status").waitFor(); }
        async function confirmCorrection() { await correction.getByLabel("I confirm this organiser correction.",{exact:true}).check(); await correction.getByRole("button",{name:"Save RSVP correction",exact:true}).click(); await correction.getByText("Organiser RSVP correction saved.",{exact:true}).waitFor(); }
        await openCorrection(); await correction.getByLabel("Corrected RSVP status").selectOption("attending"); await correction.getByLabel("Corrected attending people").fill("4"); await confirmCorrection();
        await openCorrection(); await correction.getByLabel("Lower allocation with this correction").check(); await correction.getByLabel("New maximum party size").fill("2"); await correction.getByLabel("Corrected attending people").fill("2"); await confirmCorrection();
        let corrected = (await (await context.request.get(guestBase+"/"+a.id)).json()).data; assert.equal(corrected.maxPartySize,2); assert.equal(corrected.rsvp.partySize,2); assert.equal(corrected.rsvp.updatedByKind,"member");
        await openCorrection(); await correction.getByLabel("Corrected RSVP status").selectOption("pending"); await confirmCorrection();
        await openCorrection(); corrected = (await (await context.request.get(guestBase+"/"+a.id)).json()).data;
        assert.equal((await context.request.patch(guestBase+"/"+a.id,{headers:{Origin:origin,"X-KP-Request":"1","X-Expected-Version":String(corrected.version)},data:{notes:"Changed while organiser was correcting RSVP"}})).status(),200);
        await correction.getByLabel("Corrected RSVP status").selectOption("not_attending"); await correction.getByLabel("I confirm this organiser correction.",{exact:true}).check(); await correction.getByRole("button",{name:"Save RSVP correction",exact:true}).click();
        await correction.getByRole("button",{name:"Reload saved RSVP",exact:true}).waitFor(); assert.ok(await correction.getByRole("button",{name:"Save RSVP correction",exact:true}).isDisabled());
        await correction.getByRole("button",{name:"Reload saved RSVP",exact:true}).click(); await correction.getByText("Latest RSVP and allocation loaded. Review and confirm before saving.",{exact:true}).waitFor();
        await correction.getByLabel("Corrected RSVP status").selectOption("not_attending"); await confirmCorrection();
        await openCorrection(); let correctionsSent=0; const correctionUrl=guestBase+"/"+a.id+"/rsvp";
        await page.route(correctionUrl,async route=>{correctionsSent++;await route.fetch();await route.abort();});
        await correction.getByLabel("Corrected RSVP status").selectOption("attending"); await correction.getByLabel("Corrected attending people").fill("1"); await correction.getByLabel("I confirm this organiser correction.",{exact:true}).check(); await correction.getByRole("button",{name:"Save RSVP correction",exact:true}).click();
        await correction.getByRole("button",{name:"Reload saved RSVP",exact:true}).waitFor(); await page.unroute(correctionUrl);
        await correction.getByRole("button",{name:"Reload saved RSVP",exact:true}).click(); await correction.getByText("Latest RSVP and allocation loaded. Review and confirm before saving.",{exact:true}).waitFor(); assert.equal(await correction.getByLabel("Corrected attending people").inputValue(),"1"); assert.equal(correctionsSent,1);
        await page.route(correctionUrl,route=>route.fulfill({status:429,headers:{"Content-Type":"application/json","Retry-After":"3"},body:JSON.stringify({error:{code:"RATE_LIMITED",message:"Too many attempts. Please wait before trying again.",requestId:"synthetic-limit"}})}));
        await correction.getByLabel("Corrected RSVP status").selectOption("not_attending"); await correction.getByLabel("I confirm this organiser correction.",{exact:true}).check(); await correction.getByRole("button",{name:"Save RSVP correction",exact:true}).click();
        await correction.getByRole("button",{name:"Please wait before reloading",exact:true}).waitFor(); assert.ok(await correction.getByRole("button",{name:"Save RSVP correction",exact:true}).isDisabled());
        await page.unroute(correctionUrl); await correction.getByRole("button",{name:"Reload saved RSVP",exact:true}).click();
        await correction.getByText("Latest RSVP and allocation loaded. Review and confirm before saving.",{exact:true}).waitFor(); assert.ok(!await correction.getByLabel("I confirm this organiser correction.",{exact:true}).isChecked());
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
        await page.screenshot({path:path.join(invitationShots,`member-rsvp-${width}.png`),fullPage:true});
        await page.getByRole("button",{name:"Close guest panel",exact:true}).click();
        console.log(`PASS: ${width}px organiser RSVP record, atomic allocation correction, Pending reset, stale conflict and uncertain-save recovery.`);
        await runCsvImport(page,context,guestBase,origin,invitationShots,width);
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
      await page.getByRole("button", { name: "Log out", exact: true }).click();
      await page.waitForURL(origin + "/login");
      await page.goto(origin + "/dashboard");
      await page.waitForURL(origin + "/login");
      if (withEvents) { await page.goto(origin + "/dashboard/events"); await page.waitForURL(origin + "/login"); }
      if (withGuests) { await page.goto(origin + "/dashboard/guests"); await page.waitForURL(origin + "/login"); }
      assert.equal((await context.request.get(origin + "/api/v1/me")).status(), 401);
      assert.deepEqual(errors, [], "No browser runtime errors");
      await context.close();
      console.log("PASS: " + width + "px real login → setup → persisted wedding/Admin membership → reload → existing-member redirect → logout → denied dashboard.");
    }
    assert.equal(await db.collection("weddings").countDocuments(), 2);
    assert.equal(await db.collection("background_jobs").countDocuments(), 0, "No real email/provider jobs are sent by this workflow.");
    console.log("PASS: isolated browser workflow; no Atlas/provider requests or live account changes.");
  } finally {
    await browser?.close();
    if (server?.pid) {
      if (process.platform === "win32") { try { execFileSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true }); } catch { /* Readiness or cleanup may race process shutdown. */ } }
      else server.kill("SIGTERM");
    }
    await client.close(); await replica.stop();
  }
}
main().catch(error => { console.error("FAIL: isolated wedding browser check:", error.message.split("\n")[0].replace(/https?:\/\/\S+/g, "[redacted URL]")); const frame=error.stack?.split("\n").find(line=>line.includes("weddings-browser-check.cjs:"));if(frame)console.error(frame);process.exitCode = 1; });
