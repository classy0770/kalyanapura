// Isolated synthetic accounts/replica set only. No .env loading or provider sends.
const assert = require("node:assert/strict");
const { Buffer } = require("node:buffer");
const { URLSearchParams } = require("node:url");
const { randomBytes, createDecipheriv, createHash } = require("node:crypto");
const { MongoClient, MongoServerError, ObjectId } = require("mongodb");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const { sourceLoader } = require("./scaffold-contract-check.cjs");
async function main() {
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 },binary: { version: "8.2.6" },instanceOpts: [{ launchTimeout: 30000 }] });
  const client = new MongoClient(replica.getUri());
  try {
    await client.connect(); const db = client.db("guests_isolated");
    process.env.NODE_ENV = "development"; process.env.APP_ORIGIN = "http://localhost:3100"; process.env.BETTER_AUTH_SECRET = randomBytes(32).toString("hex"); process.env.GUEST_MAX_PARTY_SIZE = "20";
    const key = randomBytes(32).toString("hex"), load = sourceLoader(), errors = load("src/server/http/errors.ts"), config = load("src/server/config.ts");
    const overrides = { "@/server/http/errors": errors,"./errors": errors,"@/server/config": config };
    const account = id => ({ id,name: "Synthetic member",email: id+"@example.com",emailVerified: true });
    const admin = account("admin"), other = account("other"), manager = account("manager");
    const weddings = load("src/modules/weddings/server/service.ts").createWeddingService(db,client,() => key);
    const weddingInput = { brideName: "Bride",groomName: "Groom",weddingDate: "2027-02-14",location: "Kochi" };
    const first = await weddings.create(admin,weddingInput), second = await weddings.create(other,weddingInput), weddingId = first.wedding.id;
    const member = await db.collection("wedding_members").findOne({ userId: admin.id });
    await db.collection("wedding_members").insertOne({ ...member,_id: new ObjectId(),userId: manager.id,role: "manager" });
    const events = sourceLoader(overrides)("src/modules/events/server/service.ts").createEventService(db,client,() => 25);
    const eventInput = { name: "Reception",type: "reception",startsAt: "2027-02-14T18:00:00+05:30" };
    const event = await events.create(admin,weddingId,eventInput), foreign = await events.create(other,second.wedding.id,eventInput);
    const service = sourceLoader(overrides)("src/modules/guests/server/service.ts").createGuestService(db,client,() => key);
    const handlers = sourceLoader({ ...overrides,"@/modules/accounts/server/session": { getAccount: async headers => [admin,other,manager].find(value => headers.get("cookie") === "kalyanapura.session_token="+value.id) ?? null },"./service": { getGuestService: async () => service } })("src/modules/guests/server/handlers.ts");
    const origin = process.env.APP_ORIGIN;
    const request = (who = admin,method = "GET",body,extra = {},query = "") => new globalThis.Request(origin+"/api/v1/weddings/"+weddingId+"/guests"+query,{ method,headers: { origin,"Content-Type": "application/json","X-KP-Request": "1",...(who ? { cookie: "kalyanapura.session_token="+who.id } : {}),...extra },...(body !== undefined ? { body: typeof body === "string" ? body : JSON.stringify(body) } : {}) });
    assert.equal((await handlers.handleGuests(request(null),weddingId)).status,401);
    assert.equal((await handlers.handleGuests(request(other),weddingId)).status,404);
    for (const body of [{ name: " " },{ name: "Ravi",email: "bad" },{ name: "Ravi",maxPartySize: 21 },{ name: "Ravi",maxPartySize: 1.5 },{ name: "Ravi",invitedEventIds: [event.id,event.id] },{ name: "Ravi",invitedEventIds: [foreign.id] },{ name: "Ravi",weddingId: second.wedding.id },{ name: "Ravi",rsvp: { status: "attending",partySize: 1 } }]) assert.equal((await handlers.handleGuests(request(admin,"POST",body),weddingId)).status,422);
    assert.equal((await handlers.handleGuests(request(admin,"POST",{ name: "Ravi" },{ origin: "https://foreign.example" }),weddingId)).status,403);
    assert.equal((await handlers.handleGuests(request(admin,"POST",{ name: "Ravi" },{ "Content-Type": "text/plain" }),weddingId)).status,415);
    assert.equal((await handlers.handleGuests(request(admin,"POST","x".repeat(262145)),weddingId)).status,413);
    const created = await handlers.handleGuests(request(manager,"POST",{ name: " Ravi & family ",email: "Ravi@example.com",maxPartySize: 4,invitedEventIds: [event.id],notes: "Organiser only" }),weddingId);
    assert.equal(created.status,201); const guest = (await created.json()).data;
    assert.equal(guest.name,"Ravi & family"); assert.equal(guest.email,"ravi@example.com"); assert.deepEqual(guest.rsvp,{ status: "pending",partySize: 0,respondedAt: null,updatedByKind: null,updatedByUserId: null });
    assert.equal(created.headers.get("Location"),`/api/v1/weddings/${weddingId}/guests/${guest.id}`); assert.equal(created.headers.get("Cache-Control"),"private, no-store"); assert.equal(created.headers.get("X-Resource-Version"),"1");
    assert.doesNotMatch(JSON.stringify(guest),/tokenHash|tokenCiphertext|nameNormalized|emailNormalized|createdByUserId|weddingId|schemaVersion/);
    const stored = await db.collection("guests").findOne({ _id: new ObjectId(guest.id) }), envelope = stored.invitation.tokenCiphertext;
    const decipher = createDecipheriv("aes-256-gcm",Buffer.from(key,"hex"),Buffer.from(envelope.iv,"base64url")); decipher.setAAD(Buffer.from(`guests:${guest.id}:invitation:1`)); decipher.setAuthTag(Buffer.from(envelope.tag,"base64url"));
    const token = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext,"base64url")),decipher.final()]).toString();
    assert.equal(Buffer.from(token,"base64url").length,32); assert.equal(createHash("sha256").update(token).digest("hex"),stored.invitation.tokenHash);
    const duplicate = await service.create(admin,weddingId,{ name: guest.name,email: guest.email }); assert.notEqual(duplicate.id,guest.id); assert.deepEqual(duplicate.invitedEventIds,[]); assert.equal(duplicate.maxPartySize,1);
    assert.equal((await handlers.handleGuest(request(other),weddingId,guest.id)).status,404);
    assert.equal((await handlers.handleGuest(request(admin),second.wedding.id,guest.id)).status,404);
    assert.equal((await handlers.handleGuest(request(admin,"PATCH",{ name: "Changed" }),weddingId,guest.id)).status,428);
    assert.equal((await handlers.handleGuest(request(admin,"PATCH",{ name: "Changed" },{ "X-Expected-Version": "0" }),weddingId,guest.id)).status,400);
    const concurrent = await Promise.all([admin,manager].map((who,index) => handlers.handleGuest(request(who,"PATCH",{ notes: "Edit "+index },{ "X-Expected-Version": "1" }),weddingId,guest.id)));
    assert.deepEqual(concurrent.map(value => value.status).sort(),[200,412]);
    await db.collection("guests").updateOne({ _id: stored._id },{ $set: { "rsvp.status": "attending","rsvp.partySize": 3,"rsvp.respondedAt": new Date(),"rsvp.updatedByKind": "member","rsvp.updatedByUserId": admin.id } });
    assert.equal((await handlers.handleGuest(request(admin,"PATCH",{ maxPartySize: 2 },{ "X-Expected-Version": "2" }),weddingId,guest.id)).status,409);
    await db.collection("events").updateOne({ _id: new ObjectId(event.id) },{ $set: { status: "deleting" } });
    assert.equal((await handlers.handleGuest(request(admin,"PATCH",{ notes: "Cannot reattach" },{ "X-Expected-Version": "2" }),weddingId,guest.id)).status,422);
    const detached = await service.patch(admin,weddingId,guest.id,{ invitedEventIds: [] },() => 2); assert.equal(detached.rsvp.partySize,3); assert.equal(detached.version,3);
    const loweredLimitService = sourceLoader(overrides)("src/modules/guests/server/service.ts").createGuestService(db,client,() => key,() => 2);
    const contactEdit = await loweredLimitService.patch(admin,weddingId,guest.id,{ phone: "1234567890",notes: "Preserve allocation" },() => 3);
    assert.equal(contactEdit.maxPartySize,4); assert.equal(contactEdit.rsvp.partySize,3);
    assert.equal(contactEdit.phone,"1234567890"); assert.equal(contactEdit.notes,"Preserve allocation");
    await assert.rejects(() => loweredLimitService.patch(admin,weddingId,guest.id,{ maxPartySize: 3 },() => contactEdit.version),error => error.status === 422);
    await assert.rejects(() => loweredLimitService.patch(admin,weddingId,guest.id,{ maxPartySize: 1 },() => contactEdit.version),error => error.code === "RSVP_LIMIT_CONFLICT");
    await assert.rejects(() => loweredLimitService.create(admin,weddingId,{ name: "Over new limit",maxPartySize: 3 }),error => error.status === 422);
    await service.create(admin,weddingId,{ name: "[Literal" });
    assert.equal((await service.list(admin,weddingId,new URLSearchParams({ q: "[" }))).data.length,1,"Prefix metacharacters are escaped");
    const page = await service.list(admin,weddingId,new URLSearchParams({ limit: "1",q: "RAVI" })); assert.ok(page.page.hasMore);
    const next = await service.list(admin,weddingId,new URLSearchParams({ limit: "1",q: "ravi",cursor: page.page.nextCursor })); assert.notEqual(next.data[0].id,page.data[0].id);
    await assert.rejects(() => service.list(admin,weddingId,new URLSearchParams({ q: "other",cursor: page.page.nextCursor })),error => error.code === "INVALID_CURSOR");
    await assert.rejects(() => service.list(admin,weddingId,new URLSearchParams({ cursor: page.page.nextCursor+"x" })),error => error.code === "INVALID_CURSOR");
    assert.equal((await service.list(admin,weddingId,new URLSearchParams({ rsvpStatus: "attending" }))).data.length,1);
    assert.equal(await service.count(admin,weddingId),3); assert.equal(await service.count(other,second.wedding.id),0);
    await db.collection("wedding_members").updateOne({ userId: manager.id },{ $set: { status: "removing" } });
    assert.equal((await handlers.handleGuests(request(manager,"POST",{ name: "Denied" }),weddingId)).status,404);
    // Revoke authority after initial access, just before the wedding coordination write.
    await db.collection("wedding_members").updateOne({ userId: manager.id },{ $set: { status: "active" } });
    const fenceBefore = (await db.collection("weddings").findOne({ _id: new ObjectId(weddingId) })).writeFence.toString();
    let revoked = false;
    const guardedDb = new Proxy(db,{ get(target,property) {
      if (property !== "collection") return typeof target[property] === "function" ? target[property].bind(target) : target[property];
      return name => { const collection = target.collection(name); if (name !== "weddings") return collection;
        return new Proxy(collection,{ get(value,key) {
          if (key === "findOneAndUpdate") return async (...args) => { if (!revoked) { revoked = true; await db.collection("wedding_members").updateOne({ userId: manager.id },{ $set: { status: "removing" } }); } return value.findOneAndUpdate(...args); };
          return typeof value[key] === "function" ? value[key].bind(value) : value[key];
        } });
      };
    } });
    const guardedService = sourceLoader(overrides)("src/modules/guests/server/service.ts").createGuestService(guardedDb,client,() => key);
    await assert.rejects(() => guardedService.create(manager,weddingId,{ name: "Revoked during entry" }),error => error.status === 404);
    assert.ok(revoked); assert.equal(await service.count(admin,weddingId),3);
    assert.equal((await db.collection("weddings").findOne({ _id: new ObjectId(weddingId) })).writeFence.toString(),fenceBefore,"Rejected transaction rolls back the coordination write");
    await assert.rejects(() => db.collection("guests").updateOne({ _id: stored._id },{ $set: { maxPartySize: 2 } }),error => error instanceof MongoServerError && error.code === 121);
    assert.equal(await db.collection("background_jobs").countDocuments(),0);
    // Legal raw names and searches can expand beyond both old cursor limits.
    // Traverse every page, as uncertain-save recovery does, including equal-name ties.
    for (const name of ["\uFB03".repeat(101),"\uFDFA".repeat(150)]) {
      const expectedGuests = await Promise.all([0,1].map(() => service.create(admin,weddingId,{ name })));
      const seen = [];
      let cursor;
      do {
        const params = new URLSearchParams({ limit: "1",q: name });
        if (cursor) params.set("cursor",cursor);
        const result = await service.list(admin,weddingId,params);
        seen.push(...result.data.map(value => value.id));
        cursor = result.page.nextCursor;
        assert.ok(seen.length <= expectedGuests.length,"Pagination must advance without duplicates");
      } while (cursor);
      assert.deepEqual(seen.sort(),expectedGuests.map(value => value.id).sort());
    }
    await assert.rejects(() => service.list(admin,weddingId,new URLSearchParams({ cursor: "a".repeat(64 * 1024)+".a" })),error => error.code === "INVALID_CURSOR");
    const { getGuestPartyLimit } = load("src/modules/guests/server/config.ts"); process.env.GUEST_MAX_PARTY_SIZE = "invalid"; assert.throws(getGuestPartyLimit,/configuration/);
    console.log("PASS: guest create/read/edit, Admin/Manager access, wedding isolation, encrypted tokens and safe projections, defaults/shared contacts, prefix search and signed pagination, concurrent stale-edit protection, RSVP/event constraints and database validation. No provider calls.");
  } finally { await client.close(); await replica.stop(); }
}
main().catch(error => { console.error("FAIL: guest integration check:",error.message.replace(/https?:\/\/\S+/g,"[redacted URL]")); process.exitCode = 1; });
