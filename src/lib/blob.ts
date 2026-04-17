import { put } from "@vercel/blob";

// Vercel Blob v2 supports both public and private stores. We auto-detect by
// trying public first, falling back to private if the store is configured
// that way. Private blobs return signed URLs valid for a limited time.
type BlobAccess = "public" | "private";

async function putWithFallback(
  pathname: string,
  body: File | Buffer,
  contentType?: string
): Promise<{ url: string; pathname: string }> {
  const opts: Record<string, unknown> = { addRandomSuffix: false };
  if (contentType) opts.contentType = contentType;

  for (const access of ["public", "private"] as BlobAccess[]) {
    try {
      const blob = await put(pathname, body, { ...opts, access });
      return { url: blob.url, pathname: blob.pathname };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Only fall through if the store rejected this access mode.
      if (
        msg.includes("Cannot use public access on a private store") ||
        msg.includes("Cannot use private access on a public store")
      ) {
        continue;
      }
      throw err;
    }
  }
  throw new Error("Failed to upload to Blob (neither public nor private worked)");
}

export async function uploadToBlob({
  file,
  prefix,
}: {
  file: File;
  prefix: string;
}): Promise<{ url: string; pathname: string }> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const pathname = `${prefix}/${Date.now()}-${safeName}`;
  return putWithFallback(pathname, file);
}

export async function uploadBufferToBlob({
  buffer,
  pathname,
  contentType,
}: {
  buffer: Buffer | Uint8Array;
  pathname: string;
  contentType: string;
}): Promise<{ url: string }> {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const result = await putWithFallback(pathname, buf, contentType);
  return { url: result.url };
}
