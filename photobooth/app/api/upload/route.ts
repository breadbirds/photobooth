import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { storePhoto } from "@/lib/photo-store";

const JPEG_PREFIX = "data:image/jpeg;base64,";

type UploadRequest = {
  image?: unknown;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as UploadRequest | null;

  if (typeof body?.image !== "string" || !body.image.startsWith(JPEG_PREFIX)) {
    return new NextResponse(null, { status: 400 });
  }

  const base64 = body.image.slice(JPEG_PREFIX.length);
  const buffer = Buffer.from(base64, "base64");

  if (buffer.length === 0) {
    return new NextResponse(null, { status: 400 });
  }

  const hasBlobCredentials = Boolean(
    process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_OIDC_TOKEN,
  );

  if (!hasBlobCredentials) {
    const origin = new URL(request.url).origin;
    const photoId = storePhoto(buffer);

    return NextResponse.json({ url: `${origin}/api/download/${photoId}` });
  }

  const blob = await put(`photos/${crypto.randomUUID()}.jpg`, buffer, {
    access: "public",
    contentType: "image/jpeg",
  });

  return NextResponse.json({ url: blob.url });
}
