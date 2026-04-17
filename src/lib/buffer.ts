/**
 * Buffer API publish integration.
 * Docs: https://buffer.com/developers/api
 *
 * NOTE: Buffer's classic publish API is accessed via https://api.bufferapp.com/1/updates/create.json
 * with an OAuth access token. To connect an Instagram Business/Creator profile, link it in the
 * Buffer dashboard once — then use BUFFER_INSTAGRAM_PROFILE_ID here.
 *
 * If BUFFER_ACCESS_TOKEN is unset, createBufferUpdate throws — callers should catch and fall back
 * to a manual-download flow (user posts to IG themselves).
 */

const BUFFER_API = "https://api.bufferapp.com/1";

export class BufferNotConfiguredError extends Error {
  constructor() {
    super("Buffer is not configured (set BUFFER_ACCESS_TOKEN and BUFFER_INSTAGRAM_PROFILE_ID)");
    this.name = "BufferNotConfiguredError";
  }
}

export async function createBufferUpdate({
  caption,
  mediaUrl,
  scheduledAt,
}: {
  caption: string;
  mediaUrl: string;
  scheduledAt?: Date;
}): Promise<{ updateId: string }> {
  const token = process.env.BUFFER_ACCESS_TOKEN;
  const profileId = process.env.BUFFER_INSTAGRAM_PROFILE_ID;
  if (!token || !profileId) throw new BufferNotConfiguredError();

  const isVideo = /\.(mp4|mov|webm)(\?|$)/i.test(mediaUrl);
  const body = new URLSearchParams();
  body.set("profile_ids[]", profileId);
  body.set("text", caption);
  body.set("access_token", token);
  if (scheduledAt) {
    body.set("scheduled_at", Math.floor(scheduledAt.getTime() / 1000).toString());
  } else {
    body.set("now", "true");
  }
  if (isVideo) {
    body.set("media[video]", mediaUrl);
  } else {
    body.set("media[photo]", mediaUrl);
    body.set("media[picture]", mediaUrl);
  }

  const res = await fetch(`${BUFFER_API}/updates/create.json`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`Buffer create failed: ${res.status} ${await res.text()}`);
  }

  const json = (await res.json()) as {
    success: boolean;
    updates?: Array<{ id: string }>;
    message?: string;
  };

  if (!json.success || !json.updates?.[0]?.id) {
    throw new Error(`Buffer returned no update id: ${JSON.stringify(json)}`);
  }
  return { updateId: json.updates[0].id };
}
