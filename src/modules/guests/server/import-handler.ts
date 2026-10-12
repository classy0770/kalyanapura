import "server-only";
import { getAppOrigin } from "@/server/config";
import { ApiError,errorResponse } from "@/server/http/errors";
import { requireRequestAccount,readProductJson } from "@/server/http/member-request";
import { createRequestId,resourceResponse } from "@/server/http/responses";
import { getGuestService } from "./service";
export async function handleGuestImport(request:Request,weddingId:string,preview:boolean){
  const id=createRequestId();try{
    const account=await requireRequestAccount(request);
    if(preview&&request.headers.get("content-type")?.split(";")[0].trim().toLowerCase()==="multipart/form-data"){
      if(request.headers.get("origin")!==getAppOrigin()||request.headers.get("x-kp-request")!=="1"||request.headers.get("sec-fetch-site")==="cross-site")throw new ApiError(403,"ORIGIN_REJECTED","This request origin is not allowed.");
      const reader=request.body?.getReader(),chunks:Uint8Array[]=[];let bytes=0;if(reader)while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>1015000){await reader.cancel();throw new ApiError(413,"PAYLOAD_TOO_LARGE","Use a CSV file up to 1,000,000 bytes.");}chunks.push(value);}
      let form:FormData;try{form=await new Request(request.url,{method:"POST",headers:{"Content-Type":request.headers.get("content-type")!},body:Buffer.concat(chunks)}).formData();}catch{throw new ApiError(400,"INVALID_CSV","Use a valid CSV multipart upload.");}
      if([...form.keys()].some(k=>!["file","defaultInvitedEventIds"].includes(k))||form.getAll("file").length!==1||form.getAll("defaultInvitedEventIds").length>1)throw new ApiError(422,"VALIDATION_FAILED","Use one CSV file and one default event selection.");
      const file=form.get("file");if(!file||typeof file==="string"||file.size>1000000)throw new ApiError(413,"PAYLOAD_TOO_LARGE","Use a CSV file up to 1,000,000 bytes.");
      let text:string,events:unknown;try{text=new TextDecoder("utf-8",{fatal:true}).decode(await file.arrayBuffer());events=JSON.parse(String(form.get("defaultInvitedEventIds")??"[]"));}catch{throw new ApiError(422,"INVALID_CSV","Use UTF-8 CSV and a valid event selection.");}
      return resourceResponse(await(await getGuestService()).previewImport(account,weddingId,{defaultInvitedEventIds:events},text),id);
    }
    const input=await readProductJson(request),service=await getGuestService();return resourceResponse(preview?await service.previewImport(account,weddingId,input):await service.commitImport(account,weddingId,input),id);
  }catch(error){return errorResponse(error,id);}
}
