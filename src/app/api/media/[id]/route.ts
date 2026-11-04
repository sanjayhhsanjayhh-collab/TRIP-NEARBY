import { eq } from "drizzle-orm";
import { db } from "@/db";
import { mediaAssets } from "@/db/schema";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  const [asset] = await db.select({ data: mediaAssets.data, mimeType: mediaAssets.mimeType }).from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
  if (!asset) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(asset.data, "base64"), { headers: { "Content-Type": asset.mimeType,
    "X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=3600" } });
}
