import { NextResponse } from "next/server";
import { getPhoto } from "@/lib/photo-store";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const photo = getPhoto(id);

  if (!photo) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(new Blob([photo.buffer.buffer as ArrayBuffer], { type: photo.contentType }), {
    headers: {
      "Content-Type": photo.contentType,
      "Cache-Control": "no-store",
    },
  });
}