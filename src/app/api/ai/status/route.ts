import { publicAiStatus } from "@/lib/ai/config";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(publicAiStatus());
}
