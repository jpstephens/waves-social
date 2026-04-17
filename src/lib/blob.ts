import { put } from "@vercel/blob";

export async function uploadToBlob({
  file,
  prefix,
}: {
  file: File;
  prefix: string;
}): Promise<{ url: string; pathname: string }> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const pathname = `${prefix}/${Date.now()}-${safeName}`;
  const blob = await put(pathname, file, {
    access: "public",
    addRandomSuffix: false,
  });
  return { url: blob.url, pathname: blob.pathname };
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
  const blob = await put(pathname, buf, {
    access: "public",
    addRandomSuffix: false,
    contentType,
  });
  return { url: blob.url };
}
