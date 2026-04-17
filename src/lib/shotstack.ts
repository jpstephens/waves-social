/**
 * Shotstack video render pipeline.
 * Docs: https://shotstack.io/docs/api/
 *
 * We render a 9:16 (Reels/TikTok) vertical video:
 *   - 1.5s intro card with team logo + headline
 *   - The highlight clip (trimmed to 15s max)
 *   - 1.5s outro with team handle
 *   - Persistent text overlay showing stat line across the clip
 */

const SHOTSTACK_API_KEY = process.env.SHOTSTACK_API_KEY;
const SHOTSTACK_ENV = process.env.SHOTSTACK_ENV ?? "stage";

const BASE_URL = `https://api.shotstack.io/${SHOTSTACK_ENV}`;

export type RenderInput = {
  clipUrl: string;
  headline: string;
  overlayText: string;
  playerName: string;
  teamName: string;
  brand: { primary: string; secondary: string; logoUrl?: string };
  clipDurationSeconds?: number;
};

export type RenderSubmitResult = {
  renderId: string;
};

export type RenderStatus = {
  status: "queued" | "fetching" | "rendering" | "saving" | "done" | "failed";
  url?: string;
  error?: string;
};

function requireKey() {
  if (!SHOTSTACK_API_KEY) {
    throw new Error("SHOTSTACK_API_KEY is not set");
  }
  return SHOTSTACK_API_KEY;
}

function buildTimeline(input: RenderInput) {
  const clipLen = Math.min(Math.max(input.clipDurationSeconds ?? 15, 4), 20);
  const introLen = 1.5;
  const outroLen = 1.5;

  const intro = {
    asset: {
      type: "html",
      html: `<div class="card"><div class="team">${escapeHtml(input.teamName)}</div><div class="headline">${escapeHtml(input.headline)}</div></div>`,
      css: `.card{display:flex;flex-direction:column;justify-content:center;align-items:center;width:100%;height:100%;background:${input.brand.primary};color:white;font-family:'Open Sans',sans-serif;text-align:center;padding:48px;} .team{font-size:36px;letter-spacing:6px;text-transform:uppercase;opacity:0.85;margin-bottom:24px;} .headline{font-size:72px;font-weight:800;line-height:1.1;}`,
      width: 1080,
      height: 1920,
    },
    start: 0,
    length: introLen,
    transition: { in: "fade", out: "fade" },
  };

  const clip = {
    asset: { type: "video", src: input.clipUrl, trim: 0 },
    start: introLen,
    length: clipLen,
    fit: "cover",
    transition: { in: "fade" },
  };

  const outro = {
    asset: {
      type: "html",
      html: `<div class="card"><div class="msg">Go ${escapeHtml(input.teamName)}!</div></div>`,
      css: `.card{display:flex;justify-content:center;align-items:center;width:100%;height:100%;background:${input.brand.secondary};color:white;font-family:'Open Sans',sans-serif;} .msg{font-size:96px;font-weight:800;}`,
      width: 1080,
      height: 1920,
    },
    start: introLen + clipLen,
    length: outroLen,
    transition: { in: "fade", out: "fade" },
  };

  const overlay = {
    asset: {
      type: "html",
      html: `<div class="overlay"><div class="name">${escapeHtml(input.playerName)}</div><div class="stat">${escapeHtml(input.overlayText)}</div></div>`,
      css: `.overlay{position:absolute;bottom:96px;left:48px;right:48px;background:rgba(15,23,42,0.7);color:white;padding:24px 32px;border-radius:20px;font-family:'Open Sans',sans-serif;} .name{font-size:48px;font-weight:800;margin-bottom:8px;} .stat{font-size:36px;font-weight:500;opacity:0.95;}`,
      width: 1080,
      height: 1920,
      background: "transparent",
    },
    start: introLen,
    length: clipLen,
  };

  const tracks: Record<string, unknown>[] = [
    { clips: [overlay] },
    { clips: [intro, clip, outro] },
  ];

  if (input.brand.logoUrl) {
    tracks.unshift({
      clips: [
        {
          asset: { type: "image", src: input.brand.logoUrl },
          start: 0,
          length: introLen + clipLen + outroLen,
          fit: "none",
          scale: 0.12,
          position: "topLeft",
          offset: { x: 0.04, y: -0.04 },
        },
      ],
    });
  }

  return {
    timeline: {
      background: "#000000",
      tracks,
    },
    output: {
      format: "mp4",
      resolution: "hd",
      aspectRatio: "9:16",
      fps: 30,
    },
  };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function submitRender(
  input: RenderInput
): Promise<RenderSubmitResult> {
  const body = buildTimeline(input);
  const res = await fetch(`${BASE_URL}/render`, {
    method: "POST",
    headers: {
      "x-api-key": requireKey(),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Shotstack submit failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as {
    response: { id: string; message: string };
  };
  return { renderId: json.response.id };
}

export async function getRenderStatus(renderId: string): Promise<RenderStatus> {
  const res = await fetch(`${BASE_URL}/render/${renderId}`, {
    headers: { "x-api-key": requireKey() },
  });
  if (!res.ok) {
    throw new Error(`Shotstack status failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as {
    response: { status: string; url?: string; error?: string };
  };
  return {
    status: json.response.status as RenderStatus["status"],
    url: json.response.url,
    error: json.response.error,
  };
}
