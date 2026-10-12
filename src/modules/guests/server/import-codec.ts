import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { ApiError } from "@/server/http/errors";
import { getWeddingEncryptionKey } from "@/modules/weddings/server/config";
import type { ImportRow } from "../import-contract";
const manifestSchema=z.strictObject({v:z.literal(1),actor:z.string().min(1).max(128),wedding:z.string().regex(/^[0-9a-f]{24}$/),requestId:z.uuid(),expires:z.number().int().positive(),digests:z.record(z.string().regex(/^[1-9]\d{0,3}$/),z.string().regex(/^[0-9a-f]{64}$/))});
export type ImportManifest=z.infer<typeof manifestSchema>;
function signature(value:string){return createHmac("sha256",Buffer.from(getWeddingEncryptionKey(),"hex")).update("kalyanapura:csv-import:v1:"+value).digest("base64url");}
export function signImport(value:ImportManifest){const data=Buffer.from(JSON.stringify(value)).toString("base64url");return data+"."+signature(data);}
export function readImport(token:unknown,actor:string,wedding:string,allowExpired=false):ImportManifest {
  if(typeof token!=="string"||token.length>200000)throw new ApiError(422,"INVALID_IMPORT_PREVIEW","Use a valid import preview.");
  const parts=token.split(".");if(parts.length!==2||!/^[A-Za-z0-9_-]+$/.test(parts[0])||!/^[A-Za-z0-9_-]{43}$/.test(parts[1])||!timingSafeEqual(Buffer.from(parts[1]),Buffer.from(signature(parts[0]))))throw new ApiError(422,"INVALID_IMPORT_PREVIEW","Use a valid import preview.");
  let manifest:ImportManifest;try{manifest=manifestSchema.parse(JSON.parse(Buffer.from(parts[0],"base64url").toString("utf8")));if(Object.keys(manifest.digests).length>1000||Object.keys(manifest.digests).some(n=>Number(n)>1000))throw new Error();}catch{throw new ApiError(422,"INVALID_IMPORT_PREVIEW","Use a valid import preview.");}
  if(manifest.actor!==actor||manifest.wedding!==wedding)throw new ApiError(404,"NOT_FOUND","Import preview not found.");
  if(!allowExpired&&manifest.expires<=Date.now())throw new ApiError(409,"IMPORT_PREVIEW_EXPIRED","Refresh this preview before continuing with the same import.");return manifest;
}
export function importDigest(row:ImportRow){return createHash("sha256").update(JSON.stringify([row.rowNumber,row.name,row.email,row.phone,row.maxPartySize,[...row.invitedEventIds].sort(),row.notes])).digest("hex");}
export function parseGuestCsv(text:string):Record<string,unknown>[] {
  if(Buffer.byteLength(text,"utf8")>1000000)throw new ApiError(413,"PAYLOAD_TOO_LARGE","Use a CSV file up to 1,000,000 bytes.");
  const invalid=()=>new ApiError(422,"INVALID_CSV","Use the CSV template with valid quoting and supported headers.");text=text.replace(/^\uFEFF/,"");if(text.includes("\0"))throw invalid();
  const records:string[][]=[];let row:string[]=[],cell="",quoted=false,closed=false,started=false;
  function endCell(){row.push(cell);cell="";closed=false;started=false;}
  function endRow(){endCell();if(row.length!==1||row[0]!=="")records.push(row);row=[];if(records.length>1001)throw new ApiError(413,"PAYLOAD_TOO_LARGE","CSV supports up to 1,000 data rows.");}
  for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}if(c===','){endCell();continue;}if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;endRow();continue;}if(closed)throw invalid();if(c==='"'){if(started||cell)throw invalid();quoted=true;started=true;}else{cell+=c;started=true;}}
  if(quoted)throw invalid();if(cell||row.length||closed)endRow();const headers=records.shift()?.map(h=>h.trim()),allowed=["name","email","phone","max_party_size","notes"];
  if(!headers||!headers.includes("name")||headers.some(h=>!allowed.includes(h))||new Set(headers).size!==headers.length||!records.length)throw invalid();
  return records.map((cells,index)=>{if(cells.length!==headers.length)throw invalid();const fields=Object.fromEntries(headers.map((h,i)=>[h,cells[i].trim()]));return{rowNumber:index+1,name:fields.name,email:fields.email||null,phone:fields.phone||null,notes:fields.notes||null,maxPartySize:fields.max_party_size?(/^[1-9]\d*$/.test(fields.max_party_size)?Number(fields.max_party_size):fields.max_party_size):1};});
}
