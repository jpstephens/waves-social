import { NextRequest, NextResponse } from "next/server";
import { head, list } from "@vercel/blob";
import { requireCoach } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Proxy private Blob content through the server so it's viewable in the browser.
 *
 * Usage from client:
 *   <img src={`/api/blob/${encodeURIComponent(blobPathname)}`} />
 *
 * The /api/blob path segment is for routing only — the rest of the URL is
 * the blob's pathname. We re-fetch the blob from Vercel Blob server-side
 * (which automatically uses BLOB_READ_WRITE_TOKEN) and stream the response.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  await requireCoach();

  const { path } = await params;
  const pathname = path.join("/");

  try {
    // head() returns the blob's downloadUrl which the server can fetch with auth
    const blob = await head(pathname);
    const res = await fetch(blob.downloadUrl);
    if (!res.ok) {
      return NextResponse.json(
        { error: `blob fetch failed: ${res.status}` },
        { status: res.status }
      );
    }
    const contentType = blob.contentType || res.headers.get("content-type") || "application/octet-stream";
    return new NextResponse(res.body, {
      status: 200,
      headers: {
        "content-type": contentType,
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
