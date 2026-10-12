const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { MongoClient,ObjectId } = require("mongodb");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const { sourceLoader } = require("./scaffold-contract-check.cjs");
async function main() {
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 },binary: { version: "8.2.6" } }), client = new MongoClient(replica.getUri());
  try {
    await client.connect(); const db = client.db("member_rsvp_isolated"), key = randomBytes(32).toString("hex");
    process.env.NODE_ENV="development"; process.env.APP_ORIGIN="http://localhost:3100";
    const load=sourceLoader(), errors=load("src/server/http/errors.ts"), overrides={ "@/server/http/errors": errors,"./errors": errors };
    const account=id=>({ id,name:id,email:id+"@example.com",emailVerified:true }), admin=account("admin"), manager=account("manager"), other=account("other");
    const weddings=load("src/modules/weddings/server/service.ts").createWeddingService(db,client,()=>key), input={brideName:"Bride",groomName:"Groom",weddingDate:"2027-02-14",location:"Kochi"};
    const first=await weddings.create(admin,input), second=await weddings.create(other,input), wid=first.wedding.id;
    const membership=await db.collection("wedding_members").findOne({userId:admin.id}); await db.collection("wedding_members").insertOne({...membership,_id:new ObjectId(),userId:manager.id,role:"manager"});
    const service=sourceLoader(overrides)("src/modules/guests/server/service.ts").createGuestService(db,client,()=>key,()=>20);
    const handlers=sourceLoader({...overrides,"./service":{getGuestService:async()=>service},"@/modules/accounts/server/session":{getAccount:async headers=>[admin,manager,other].find(a=>headers.get("cookie")==="kalyanapura.session_token="+a.id)??null}})("src/modules/guests/server/handlers.ts");
    const guest=await service.create(admin,wid,{name:"Family",maxPartySize:4});
    const req=(who,body,v,extra={})=>new globalThis.Request(process.env.APP_ORIGIN+"/api/v1/weddings/"+wid+"/guests/"+guest.id+"/rsvp",{method:"PUT",headers:{origin:process.env.APP_ORIGIN,"Content-Type":"application/json","X-KP-Request":"1",cookie:who?"kalyanapura.session_token="+who.id:"kp-guest=synthetic",...(v===undefined?{}:{"X-Expected-Version":String(v)}),...extra},body:JSON.stringify(body)});
    const save=(who,body,v,extra)=>handlers.handleMemberRsvp(req(who,body,v,extra),wid,guest.id), yes=n=>({status:"attending",partySize:n}), pending={status:"pending",partySize:0};
    assert.equal((await save(null,yes(2),1)).status,401); assert.equal((await save(other,yes(2),1)).status,404);
    assert.equal((await save(admin,yes(2),1,{origin:"https://evil.example"})).status,403);
    assert.equal((await save(admin,yes(2),undefined)).status,428);
    for(const answer of [yes(0),yes(5),yes(1.5),{status:"pending",partySize:1},{...yes(2),updatedByUserId:"other"}]) assert.equal((await save(admin,answer,1)).status,422);
    let response=await save(manager,yes(4),1); assert.equal(response.status,200); const saved=(await response.json()).data; assert.equal(saved.rsvp.updatedByKind,"member"); assert.equal(saved.rsvp.updatedByUserId,manager.id);
    assert.equal(response.headers.get("X-Resource-Version"),"2"); assert.doesNotMatch(JSON.stringify(saved),/tokenHash|tokenCiphertext|notes/);
    const before=await service.read(admin,wid,guest.id); assert.equal((await save(admin,yes(4),1)).status,200); assert.deepEqual(await service.read(admin,wid,guest.id),before,"Identical replay preserves attribution, timestamp and revision");
    assert.equal((await save(admin,pending,1)).status,412);
    await assert.rejects(()=>service.patch(admin,wid,guest.id,{maxPartySize:2},()=>2),e=>e.code==="RSVP_LIMIT_CONFLICT");
    await assert.rejects(()=>service.patch(admin,wid,guest.id,{rsvp:pending},()=>2),e=>e.status===422);
    const reduced=await service.patch(manager,wid,guest.id,{maxPartySize:2,rsvp:yes(2)},()=>2); assert.equal(reduced.maxPartySize,2); assert.equal(reduced.rsvp.partySize,2); assert.equal(reduced.version,3);
    assert.equal((await service.overview(admin,wid)).expectedAttendees,2);
    const concurrent=await Promise.all([save(admin,pending,3),save(manager,{status:"not_attending",partySize:0},3)]); assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,412]);
    let current=await service.read(admin,wid,guest.id); response=await save(admin,pending,current.version); assert.equal(response.status,200); current=await service.read(admin,wid,guest.id); assert.equal(current.rsvp.partySize,0); assert.ok(current.rsvp.respondedAt);
    assert.equal((await service.overview(admin,wid)).expectedAttendees,0);
    assert.equal((await service.overview(other,second.wedding.id)).guestCount,0);
    // Existing allocation above a subsequently lowered deployment cap remains valid.
    await db.collection("guests").updateOne({_id:new ObjectId(guest.id)},{$set:{maxPartySize:25}});
    response=await save(manager,yes(25),current.version); assert.equal(response.status,200);
    const last=await service.read(admin,wid,guest.id); await db.collection("wedding_members").updateOne({userId:manager.id},{$set:{status:"removing"}});
    assert.equal((await save(manager,yes(25),last.version)).status,404,"Replay cannot bypass live membership");
    // PUT replays and PATCH corrections share atomic admission before transactions.
    await db.collection("rate_limits").deleteMany({action:/^member_rsvp/});
    const realNow=Date.now, fixedNow=realNow(), originalSession=client.startSession.bind(client); let starts=0, burst;
    client.startSession=(...args)=>{const session=originalSession(...args), originalTransaction=session.withTransaction.bind(session);session.withTransaction=(...work)=>{starts++;return originalTransaction(...work);};return session;};
    try {
      Date.now=()=>fixedNow;
      burst=await Promise.all(Array.from({length:30},(_,i)=> i%2 ? handlers.handleGuest(new globalThis.Request(req(admin,{maxPartySize:24,rsvp:yes(24)},1).url,{method:"PATCH",headers:req(admin,{},1).headers,body:JSON.stringify({maxPartySize:24,rsvp:yes(24)})}),wid,guest.id) : save(admin,yes(25),1)));
      assert.equal(burst.filter(r=>r.status===429).length,10);
      assert.equal(burst.filter(r=>[200,412].includes(r.status)).length,20); assert.equal(starts,20,"Rejected attempts never start a transaction");
      for(const r of burst.filter(r=>r.status===429)) {assert.ok(Number(r.headers.get("Retry-After"))>0);assert.equal((await r.json()).error.code,"RATE_LIMITED");}
      const fence=await db.collection("weddings").findOne({_id:new ObjectId(wid)}), record=await service.read(admin,wid,guest.id);
      assert.equal((await save(admin,yes(25),1)).status,429);
      await assert.rejects(()=>service.patch(admin,wid.toUpperCase(),guest.id,{maxPartySize:24,rsvp:yes(24)},()=>1),e=>e.status===429);
      assert.equal(starts,20); assert.deepEqual(await db.collection("weddings").findOne({_id:fence._id}),fence); assert.deepEqual(await service.read(admin,wid,guest.id),record);
      // A different guest cannot create a new account/wedding budget.
      const another=await service.create(admin,wid,{name:"Another family"}); const beforeTarget=starts;
      await assert.rejects(()=>service.correctRsvp(admin,wid,another.id,pending,()=>1),e=>e.status===429); assert.equal(starts,beforeTarget);
      Date.now=()=>Math.floor(fixedNow/60000)*60000+60000;
      assert.equal((await save(admin,yes(25),1)).status,200,"Admission resumes in the next server window");
    } finally {Date.now=realNow;client.startSession=originalSession;}
    const {admitMemberRsvp}=sourceLoader(overrides)("src/modules/guests/server/access-limiter.ts");
    const limitDb=client.db("member_rsvp_wedding_limits"); let weddingBurst;
    try {Date.now=()=>fixedNow;weddingBurst=await Promise.allSettled(Array.from({length:70},(_,i)=>admitMemberRsvp(limitDb,"synthetic-actor-"+i,wid)));} finally {Date.now=realNow;}
    assert.equal(weddingBurst.filter(r=>r.status==="fulfilled").length,60); assert.ok(weddingBurst.filter(r=>r.status==="rejected").every(r=>r.reason.status===429));
    assert.doesNotMatch(JSON.stringify(await limitDb.collection("rate_limits").find().toArray()),/synthetic-actor/);
    assert.equal(await db.collection("background_jobs").countDocuments(),0);
    console.log("PASS: organiser auth/isolation, CSRF, validation, attribution, no-event corrections, identical replay, concurrent conflicts, atomic allocation correction, Pending reset, totals and legacy allocations. No provider calls.");
  } finally {await client.close(); await replica.stop();}
}
main().catch(e=>{console.error("FAIL: organiser RSVP:",e.message.split("\n")[0]);process.exitCode=1;});
