import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { requireCoach } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Auth-gated blob reader for private blobs (e.g. uploaded PDFs).
 * Public composites are served directly from their Blob URL and never hit this route.
 *
 * Usage:  <img src={`/api/blob/${pathname}`} />
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  await requireCoach();

  const { path } = await params;
  const pathname = path.join("/");

  try {
    const result = await get(pathname, { access: "private" });
    if (!result) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    if (result.statusCode === 304 || !result.stream) {
      return new NextResponse(null, { status: 304 });
    }
    return new NextResponse(result.stream, {
      status: 200,
      headers: {
        "content-type": result.blob.contentType,
        "cache-control": "private, max-age=300",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
