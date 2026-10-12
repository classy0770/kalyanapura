import "server-only";
import { Long, ObjectId, type ClientSession, type Db, type Filter, type MongoClient } from "mongodb";
import { getDatabase, getMongoClient } from "@/server/db/connection";
import { ApiError } from "@/server/http/errors";
import { getWeddingEncryptionKey } from "@/modules/weddings/server/config";
import type { Account } from "@/modules/weddings/server/service";
import { guestCreateSchema, guestPatchSchema, memberRsvpSchema, normalizeGuestName, type Guest } from "../schemas";
import { guestProjection, guestRepository, prepareGuestStorage, type StoredGuest } from "./repository";
import { getGuestPartyLimit } from "./config";
import { decodeGuestCursor, encodeGuestCursor } from "./cursor";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { importRowSchema, type ImportPreview, type ImportResult, type ImportRow } from "../import-contract";
import { importDigest, parseGuestCsv, readImport, signImport } from "./import-codec";
import { getAppOrigin } from "@/server/config";
import { createInvitationToken, readInvitationToken } from "./invitation-token";
import type { InvitationLink } from "../invitation-contract";
import type { RsvpOverview } from "../rsvp-contract";
import { admitMemberRsvp, admitGuestImport } from "./access-limiter";

function oid(value: string) { if (!/^[0-9a-f]{24}$/i.test(value)) throw new ApiError(400,"INVALID_ID","Invalid resource ID."); return new ObjectId(value); }
function project(value: StoredGuest): Guest {
  return { id: value._id.toHexString(), name: value.name, email: value.emailNormalized, phone: value.phone, maxPartySize: value.maxPartySize, invitedEventIds: value.invitedEventIds.map(id => id.toHexString()), notes: value.notes, version: value.version, createdAt: value.createdAt.toISOString(), updatedAt: value.updatedAt.toISOString(), invitation: { enabled: value.invitation.enabled, issuedAt: value.invitation.issuedAt.toISOString(), tokenVersion: value.invitation.tokenVersion }, rsvp: { ...value.rsvp, respondedAt: value.rsvp.respondedAt?.toISOString() ?? null } };
}
function validation(error: { issues: { path: PropertyKey[]; code: string; message: string }[] }) { return new ApiError(422,"VALIDATION_FAILED","Check your guest details.",{ fields: error.issues.map(issue => ({ path: issue.path.join("."),code: issue.code,message: issue.message })) }); }
export function createGuestService(db: Db, client: MongoClient, encryptionKey = getWeddingEncryptionKey, partyLimit = getGuestPartyLimit) {
  const guests = guestRepository(db);
  let prepared: Promise<void>|undefined;
  async function access(account: Account, weddingId: string, session?: ClientSession) {
    if (!account.emailVerified) throw new ApiError(403,"EMAIL_NOT_VERIFIED","Verify your email first.");
    const wedding = oid(weddingId);
    const member = await db.collection("wedding_members").findOne({ userId: account.id, weddingId: wedding, status: "active", role: { $in: ["admin","manager"] } }, { session,projection: { _id: 1 } });
    if (!member || !await db.collection("weddings").findOne({ _id: wedding,status: "active" }, { session,projection: { _id: 1 } })) throw new ApiError(404,"NOT_FOUND","Wedding not found.");
    return wedding;
  }
  async function target(account: Account, weddingId: string, guestId: string, session?: ClientSession) {
    const wedding = await access(account,weddingId,session);
    const guest = await guests.findOne({ _id: oid(guestId),weddingId: wedding }, { session,projection: guestProjection });
    if (!guest) throw new ApiError(404,"NOT_FOUND","Guest not found."); return guest;
  }
  async function transaction<T>(account: Account, weddingId: string, work: (wedding: ObjectId, session: ClientSession) => Promise<T>) {
    const wedding = await access(account,weddingId), session = client.startSession();
    try { return await session.withTransaction(async () => {
      const fenced = await db.collection("weddings").findOneAndUpdate({ _id: wedding,status: "active" }, { $inc: { writeFence: Long.ONE } }, { session,projection: { _id: 1 } });
      if (!fenced) throw new ApiError(404,"NOT_FOUND","Wedding not found.");
      await access(account,weddingId,session);
      return work(wedding,session);
    }, { readPreference: "primary",readConcern: { level: "snapshot" },writeConcern: { w: "majority" },maxCommitTimeMS: 5000,timeoutMS: 10000 }); } finally { await session.endSession(); }
  }
  async function validateEvents(ids: string[], wedding: ObjectId, session: ClientSession) {
    const values = ids.map(oid);
    if (values.length && await db.collection("events").countDocuments({ _id: { $in: values },weddingId: wedding,status: "active" }, { session }) !== values.length) throw new ApiError(422,"VALIDATION_FAILED","Choose active events from this wedding.",{ fields: [{ path: "invitedEventIds",code: "invalid_reference",message: "An event is unavailable or belongs to another wedding." }] });
    return values;
  }
  function limit(size: number) { if (size > partyLimit()) throw new ApiError(422,"VALIDATION_FAILED",`Maximum party size is ${partyLimit()}.`,{ fields: [{ path: "maxPartySize",code: "too_big",message: "Party size exceeds the configured limit." }] }); }
  function link(guest: StoredGuest): InvitationLink {
    const token = readInvitationToken(guest._id.toHexString(),guest.invitation,encryptionKey());
    const url = `${getAppOrigin()}/invite/${token}`;
    return { url,shareText: `${guest.name}, you’re invited to celebrate with us! View your personal invitation: ${url}`,enabled: guest.invitation.enabled,guestVersion: guest.version };
  }
  return {
    async previewImport(account: Account,weddingId: string,input: unknown,csv?: string): Promise<ImportPreview> {
      const wedding=await access(account,weddingId); await admitGuestImport(db,account.id,wedding.toHexString());
      const schema=z.strictObject({rows:z.array(z.record(z.string(),z.unknown())).min(1).max(1000),defaultInvitedEventIds:guestCreateSchema.shape.invitedEventIds.default([]),previousPreviewToken:z.string().max(200000).optional()});
      const supplied=csv===undefined?input:{...(input as object),rows:parseGuestCsv(csv)};
      const parsed=schema.safeParse(supplied);if(!parsed.success)throw validation(parsed.error);
      const previous=parsed.data.previousPreviewToken?readImport(parsed.data.previousPreviewToken,account.id,wedding.toHexString(),true):null;
      const requested=[...new Set(parsed.data.rows.flatMap(r=>Array.isArray(r.invitedEventIds)?r.invitedEventIds:parsed.data.defaultInvitedEventIds).filter((id):id is string=>typeof id==="string"&&/^[0-9a-f]{24}$/i.test(id)).map(id=>id.toLowerCase()))];
      const active=await db.collection("events").find({_id:{$in:requested.map(oid)},weddingId:wedding,status:"active"},{projection:{_id:1}}).toArray(); const activeIds=new Set(active.map(e=>e._id.toHexString()));
      const seen=new Set<number>(), digests:Record<string,string>={...previous?.digests}, rows:ImportPreview["rows"]=[];
      for(const [index,raw] of parsed.data.rows.entries()) {
        const rowNumber=raw.rowNumber??index+1;
        if(typeof rowNumber!=="number"||!Number.isInteger(rowNumber)||rowNumber<1||rowNumber>1000||seen.has(rowNumber))throw new ApiError(422,"VALIDATION_FAILED","Use unique source row numbers from 1 through 1000.");seen.add(rowNumber);
        const value={...raw,rowNumber,invitedEventIds:raw.invitedEventIds??parsed.data.defaultInvitedEventIds}, check=importRowSchema.safeParse(value);
        const errors=check.success?[]:check.error.issues.map(i=>({path:i.path.join("."),message:i.message}));
        if(check.success){if(check.data.maxPartySize>partyLimit())errors.push({path:"maxPartySize",message:`Maximum party size is ${partyLimit()}.`});if(check.data.invitedEventIds.some(id=>!activeIds.has(id)))errors.push({path:"invitedEventIds",message:"Choose active events from this wedding."});}
        const {rowNumber: ignored,...values}=check.success?check.data:value; void ignored;
        delete digests[String(rowNumber)];if(check.success&&!errors.length)digests[String(rowNumber)]=importDigest(check.data);
        rows.push({rowNumber,values,errors,warnings:[],imported:false,changed:!!previous?.digests[String(rowNumber)]&&previous.digests[String(rowNumber)]!==digests[String(rowNumber)]});
      }
      const valid=rows.filter(r=>!r.errors.length), names=valid.map(r=>normalizeGuestName(String(r.values.name))), emails=valid.map(r=>r.values.email).filter((x):x is string=>typeof x==="string"&&!!x), phones=valid.map(r=>r.values.phone).filter((x):x is string=>typeof x==="string"&&!!x);
      const existingNames=new Set(await guests.distinct("nameNormalized",{weddingId:wedding,nameNormalized:{$in:names}})), existingEmails=new Set(await guests.distinct("emailNormalized",{weddingId:wedding,emailNormalized:{$in:emails}})), existingPhones=new Set(await guests.distinct("phone",{weddingId:wedding,phone:{$in:phones}}));
      const requestId=previous?.requestId??randomUUID();const imported=new Set((await guests.find({weddingId:wedding,importRequestId:requestId},{projection:{importRowNumber:1}}).limit(1000).toArray()).map(g=>g.importRowNumber));
      const frequencies=(values:string[])=>{const counts=new Map<string,number>();for(const value of values)counts.set(value,(counts.get(value)??0)+1);return counts;};const nameCounts=frequencies(names),emailCounts=frequencies(emails),phoneCounts=frequencies(phones);
      for(const row of rows){row.imported=imported.has(row.rowNumber);const v=row.values;if(!row.errors.length){const name=normalizeGuestName(String(v.name)),email=v.email as string,phone=v.phone as string;if(existingNames.has(name)||existingEmails.has(email)||existingPhones.has(phone)||(nameCounts.get(name)??0)>1||(emailCounts.get(email)??0)>1||(phoneCounts.get(phone)??0)>1)row.warnings.push("Similar name or contact found. Rows are not merged automatically.");}if(row.changed&&row.imported)row.warnings.push("Already imported: changes here will not update the saved guest.");}
      const expires=Date.now()+30*60*1000;return {importRequestId:requestId,previewToken:signImport({v:1,actor:account.id,wedding:wedding.toHexString(),requestId,expires,digests}),expiresAt:new Date(expires).toISOString(),rows};
    },
    async commitImport(account:Account,weddingId:string,input:unknown):Promise<ImportResult> {
      const wedding=await access(account,weddingId);await admitGuestImport(db,account.id,wedding.toHexString());
      const parsed=z.strictObject({importRequestId:z.uuid(),previewToken:z.string().max(200000),rows:z.array(importRowSchema).min(1).max(200)}).safeParse(input);if(!parsed.success)throw validation(parsed.error);
      const manifest=readImport(parsed.data.previewToken,account.id,wedding.toHexString());
      if(manifest.requestId!==parsed.data.importRequestId||new Set(parsed.data.rows.map(r=>r.rowNumber)).size!==parsed.data.rows.length||parsed.data.rows.some(r=>manifest.digests[String(r.rowNumber)]!==importDigest(r)))throw new ApiError(422,"IMPORT_PREVIEW_CHANGED","Revalidate the exact reviewed rows before importing.");
      const key=encryptionKey();prepared??=prepareGuestStorage(db).catch(e=>{prepared=undefined;throw e;});await prepared;
      return transaction(account,weddingId,async(wedding,session)=>{
        readImport(parsed.data.previewToken,account.id,wedding.toHexString());
        const pending:ImportRow[]=[];const results:ImportResult["rows"]=[];
        const existingRows=await guests.find({weddingId:wedding,importRequestId:manifest.requestId,importRowNumber:{$in:parsed.data.rows.map(r=>r.rowNumber)}},{session,projection:{_id:1,importRowNumber:1}}).toArray();const byRow=new Map(existingRows.map(g=>[g.importRowNumber,g._id]));
        for(const row of parsed.data.rows){const existing=byRow.get(row.rowNumber);if(existing)results.push({rowNumber:row.rowNumber,status:"already_imported",guestId:existing.toHexString()});else{limit(row.maxPartySize);pending.push(row);}}
        await validateEvents([...new Set(pending.flatMap(r=>r.invitedEventIds))],wedding,session);
        const now=new Date();const documents:StoredGuest[]=pending.map(row=>{const {rowNumber,email,invitedEventIds,...fields}=row,id=new ObjectId();results.push({rowNumber,status:"created",guestId:id.toHexString()});return{...fields,_id:id,weddingId:wedding,emailNormalized:email,nameNormalized:normalizeGuestName(fields.name),invitedEventIds:invitedEventIds.map(oid),schemaVersion:1,version:1,createdByUserId:account.id,createdAt:now,updatedAt:now,importRequestId:manifest.requestId,importRowNumber:rowNumber,invitation:{enabled:true,issuedAt:now,tokenVersion:1,...createInvitationToken(id.toHexString(),1,key)},rsvp:{status:"pending",partySize:0,respondedAt:null,updatedByKind:null,updatedByUserId:null}};});
        if(documents.length)await guests.insertMany(documents,{session,ordered:true});
        return {rows:results.sort((a,b)=>a.rowNumber-b.rowNumber)};
      });
    },
    async correctRsvp(account: Account, weddingId: string, guestId: string, input: unknown, version: () => number) {
      await target(account,weddingId,guestId);
      await admitMemberRsvp(db,account.id,oid(weddingId).toHexString());
      const expected = version(), parsed = memberRsvpSchema.safeParse(input);
      if (!parsed.success) throw validation(parsed.error);
      return transaction(account,weddingId,async (wedding,session) => {
        const current = await target(account,weddingId,guestId,session), answer = parsed.data;
        if (current.rsvp.status === answer.status && current.rsvp.partySize === answer.partySize) return { version: current.version,rsvp: project(current).rsvp };
        if (current.version !== expected) throw new ApiError(412,"VERSION_CONFLICT","This response changed. Reload before correcting it.",{ currentVersion: current.version });
        if (answer.partySize > current.maxPartySize) throw new ApiError(422,"VALIDATION_FAILED","Attendance exceeds the current party allocation.");
        const now = new Date(), rsvp = { ...answer,respondedAt: now,updatedByKind: "member" as const,updatedByUserId: account.id };
        const updated = await guests.findOneAndUpdate({ _id: current._id,weddingId: wedding,version: expected },{ $set: { rsvp,updatedAt: now },$inc: { version: 1 } },{ session,returnDocument: "after",projection: guestProjection });
        if (!updated) throw new ApiError(412,"VERSION_CONFLICT","Reload the latest response.");
        return { version: updated.version,rsvp: project(updated).rsvp };
      });
    },
    async invitationLink(account: Account, weddingId: string, guestId: string) {
      await target(account,weddingId,guestId);
      const guest = await guests.findOne({ _id: oid(guestId),weddingId: oid(weddingId) },{ projection: { _id: 1,name: 1,version: 1,invitation: 1 } });
      if (!guest) throw new ApiError(404,"NOT_FOUND","Guest not found.");
      return link(guest);
    },
    async changeInvitation(account: Account, weddingId: string, guestId: string, input: unknown, version: () => number, replace = false) {
      await target(account,weddingId,guestId);
      let enabled: boolean | undefined;
      if (replace) { const parsed = z.strictObject({}).safeParse(input); if (!parsed.success) throw validation(parsed.error); }
      else { const parsed = z.strictObject({ enabled: z.boolean() }).safeParse(input); if (!parsed.success) throw validation(parsed.error); enabled = parsed.data.enabled; }
      const expected = version();
      const origin = replace ? getAppOrigin() : undefined, key = replace ? encryptionKey() : undefined;
      return transaction(account,weddingId,async (wedding,session) => {
        const current = await target(account,weddingId,guestId,session);
        if (current.version !== expected) throw new ApiError(412,"VERSION_CONFLICT","This guest changed. Reload the invitation controls.",{ currentVersion: current.version });
        const now = new Date();
        const fields = replace ? { ...Object.fromEntries(Object.entries(createInvitationToken(current._id.toHexString(),current.invitation.tokenVersion+1,key!)).map(([name,value]) => [`invitation.${name}`,value])),"invitation.tokenVersion": current.invitation.tokenVersion+1,"invitation.issuedAt": now } : { "invitation.enabled": enabled! };
        const updated = await guests.findOneAndUpdate({ _id: current._id,weddingId: wedding,version: expected },{ $set: { ...fields,updatedAt: now },$inc: { version: 1 } },{ session,returnDocument: "after",projection: replace ? { _id: 1,name: 1,version: 1,invitation: 1 } : guestProjection });
        if (!updated) throw new ApiError(412,"VERSION_CONFLICT","Reload the invitation controls.");
        if (replace) {
          const token = readInvitationToken(updated._id.toHexString(),updated.invitation,key!);
          const url = `${origin}/invite/${token}`;
          return { url,shareText: `${updated.name}, you’re invited to celebrate with us! View your personal invitation: ${url}`,enabled: updated.invitation.enabled,guestVersion: updated.version };
        }
        return project(updated);
      });
    },
    async count(account: Account, weddingId: string) { return guests.countDocuments({ weddingId: await access(account,weddingId) }); },
    async overview(account: Account, weddingId: string): Promise<RsvpOverview> {
      const wedding = await access(account,weddingId);
      const rows = await guests.aggregate<{ _id: StoredGuest["rsvp"]["status"]; count: number; people: number }>([
        { $match: { weddingId: wedding } },
        { $group: { _id: "$rsvp.status",count: { $sum: 1 },people: { $sum: "$rsvp.partySize" } } },
      ]).toArray();
      const count = (status: StoredGuest["rsvp"]["status"]) => rows.find(row => row._id === status)?.count ?? 0;
      const attending = count("attending"), notAttending = count("not_attending"), pending = count("pending");
      return { guestCount: attending+notAttending+pending,respondedGuestCount: attending+notAttending,attending,notAttending,pending,expectedAttendees: rows.find(row => row._id === "attending")?.people ?? 0 };
    },
    async read(account: Account, weddingId: string, guestId: string) { return project(await target(account,weddingId,guestId)); },
    async list(account: Account, weddingId: string, params = new URLSearchParams()) {
      const wedding = await access(account,weddingId);
      for (const key of params.keys()) if (!["limit","cursor","q","rsvpStatus","eventId"].includes(key) || params.getAll(key).length !== 1) throw new ApiError(400,"INVALID_QUERY","Use supported guest filters once.");
      const size = params.get("limit") ?? "25", q = normalizeGuestName(params.get("q") ?? ""), status = params.get("rsvpStatus"), eventId = params.get("eventId");
      if (!/^[1-9]\d*$/.test(size) || Number(size) > 100 || (params.get("q")?.length ?? 0) > 150 || (status !== null && !["pending","attending","not_attending"].includes(status))) throw new ApiError(400,"INVALID_QUERY","Invalid guest filters.");
      const filter: Filter<StoredGuest> = { weddingId: wedding, ...(status ? { "rsvp.status": status as StoredGuest["rsvp"]["status"] } : {}), ...(eventId ? { invitedEventIds: oid(eventId) } : {}) };
      if (q) filter.nameNormalized = { $regex: "^"+q.replace(/[.*+?^${}()|[\]\\]/g,"\\$&") };
      const filters = JSON.stringify([q,status,eventId ? oid(eventId).toHexString() : null]);
      if (params.has("cursor")) { const cursor = decodeGuestCursor(params.get("cursor")!,wedding.toHexString(),filters); filter.$or = [{ nameNormalized: { $gt: cursor.name } }, { nameNormalized: cursor.name,_id: { $gt: oid(cursor.id) } }]; }
      const records = await guests.find(filter,{ projection: { ...guestProjection,nameNormalized: 1 } }).sort({ nameNormalized: 1,_id: 1 }).limit(Number(size)+1).toArray();
      const shown = records.slice(0,Number(size)), hasMore = records.length > Number(size), last = shown.at(-1);
      return { data: shown.map(project),page: { limit: Number(size),hasMore,nextCursor: hasMore && last ? encodeGuestCursor({ weddingId: wedding.toHexString(),filters,name: last.nameNormalized,id: last._id.toHexString() }) : null } };
    },
    async create(account: Account, weddingId: string, input: unknown) {
      await access(account,weddingId);
      const parsed = guestCreateSchema.safeParse(input); if (!parsed.success) throw validation(parsed.error); limit(parsed.data.maxPartySize);
      const key = encryptionKey();
      prepared ??= prepareGuestStorage(db).catch(error => { prepared = undefined; throw error; }); await prepared;
      return transaction(account,weddingId,async (wedding,session) => {
        const id = new ObjectId(), now = new Date(), token = createInvitationToken(id.toHexString(),1,key);
        const { email,invitedEventIds,...fields } = parsed.data;
        const guest: StoredGuest = { ...fields,_id: id,weddingId: wedding,emailNormalized: email,nameNormalized: normalizeGuestName(fields.name),invitedEventIds: await validateEvents(invitedEventIds,wedding,session),schemaVersion: 1,version: 1,createdByUserId: account.id,createdAt: now,updatedAt: now,invitation: { enabled: true,issuedAt: now,tokenVersion: 1,...token },rsvp: { status: "pending",partySize: 0,respondedAt: null,updatedByKind: null,updatedByUserId: null } };
        await guests.insertOne(guest,{ session }); return project(guest);
      });
    },
    async patch(account: Account, weddingId: string, guestId: string, input: unknown, version: () => number) {
      await target(account,weddingId,guestId);
      const expected = version(), parsed = guestPatchSchema.safeParse(input); if (!parsed.success) throw validation(parsed.error);
      if (parsed.data.rsvp !== undefined) await admitMemberRsvp(db,account.id,oid(weddingId).toHexString());
      return transaction(account,weddingId,async (wedding,session) => {
        const current = await target(account,weddingId,guestId,session);
        if (current.version !== expected) throw new ApiError(412,"VERSION_CONFLICT","This guest changed. Reload the latest details before editing.",{ currentVersion: current.version });
        const { name,email,phone,maxPartySize,invitedEventIds,notes } = { ...project(current),...parsed.data };
        if (parsed.data.maxPartySize !== undefined) limit(maxPartySize);
        const correction = parsed.data.rsvp;
        if (correction && (parsed.data.maxPartySize === undefined || maxPartySize >= current.maxPartySize)) throw new ApiError(422,"VALIDATION_FAILED","Use the RSVP endpoint unless correcting attendance while lowering the allocation.");
        if (maxPartySize < (correction?.partySize ?? current.rsvp.partySize)) throw new ApiError(409,"RSVP_LIMIT_CONFLICT","The allocation cannot be below the saved attendance. Supply an explicit correction when lowering it.");
        const now = new Date();
        const rsvp = correction && (correction.status !== current.rsvp.status || correction.partySize !== current.rsvp.partySize) ? { ...correction,respondedAt: now,updatedByKind: "member" as const,updatedByUserId: account.id } : current.rsvp;
        const ids = correction && parsed.data.invitedEventIds === undefined ? current.invitedEventIds : await validateEvents(invitedEventIds,wedding,session);
        const updated = await guests.findOneAndUpdate({ _id: current._id,weddingId: wedding,version: expected }, { $set: { name,nameNormalized: normalizeGuestName(name),emailNormalized: email,phone,maxPartySize,invitedEventIds: ids,notes,rsvp,updatedAt: now },$inc: { version: 1 } }, { session,returnDocument: "after",projection: guestProjection });
        if (!updated) throw new ApiError(412,"VERSION_CONFLICT","Reload the latest guest details."); return project(updated);
      });
    },
  };
}
let instance: Promise<ReturnType<typeof createGuestService>>|undefined;
export function getGuestService() { instance ??= (async () => createGuestService(await getDatabase(),await getMongoClient()))().catch(error => { instance = undefined; throw error; }); return instance; }
