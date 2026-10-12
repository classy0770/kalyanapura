import { handleGuestImport } from "@/modules/guests/server/import-handler";
export const runtime="nodejs";
export async function POST(request:Request,context:{params:Promise<{weddingId:string}>}){return handleGuestImport(request,(await context.params).weddingId,true);}
