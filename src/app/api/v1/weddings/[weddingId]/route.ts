import { handleGetWedding } from "@/modules/weddings/server/handlers";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ weddingId: string }> }) { return handleGetWedding(request, (await context.params).weddingId); }
