import { db } from "@/db";
import { mediaAssets } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { guardMutation } from "@/lib/security";

export async function POST(request: Request) {
  const blocked = guardMutation(request, "media-upload", 12);
  if (blocked) return blocked;
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Please log in to upload a photograph." }, { status: 401 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size < 10 || file.size > 2 * 1024 * 1024) {
      return Response.json({ error: "Choose a JPEG, PNG or WebP image smaller than 2 MB." }, { status: 400 });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    const webp = String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    const mimeType = jpeg ? "image/jpeg" : png ? "image/png" : webp ? "image/webp" : null;
    if (!mimeType) return Response.json({ error: "Unsupported or invalid image format." }, { status: 400 });
    const [asset] = await db.insert(mediaAssets).values({ ownerId: user.id, mimeType, data: Buffer.from(bytes).toString("base64"), sizeBytes: bytes.length }).returning({ id: mediaAssets.id });
    return Response.json({ url: `/api/media/${asset.id}` }, { status: 201 });
  } catch {
    return Response.json({ error: "Could not upload image. Please try again." }, { status: 500 });
  }
}
