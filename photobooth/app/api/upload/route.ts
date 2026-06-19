import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

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

  const blob = await put(`photos/${crypto.randomUUID()}.jpg`, buffer, {
    access: "public",
    contentType: "image/jpeg",
  });

  return NextResponse.json({ url: blob.url });
}
