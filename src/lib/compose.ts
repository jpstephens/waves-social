import sharp from "sharp";
import path from "node:path";
import { promises as fs } from "node:fs";
import type { PostFormat } from "@/lib/db/schema";

/**
 * Deterministic image composition for highlight posts. Renders one of three
 * formats: Instagram feed (4:5), square (1:1), or story/reel (9:16). Layers:
 *   1. Background (AI-generated plate for this format, else static template).
 *   2. Player photo (no AI alteration).
 *   3. SVG text overlay: headline + name + stat line.
 *   4. Waves logo.
 */

type FormatSpec = {
  canvas: { width: number; height: number };
  photoZone: { x: number; y: number; width: number; height: number };
  textZone: { x: number; y: number; width: number; height: number };
  logoZone: { x: number; y: number; width: number };
  staticTemplate: string; // fallback png under public/templates/ (per kind.format)
};

// Formats tuned so the text bar occupies the bottom ~35% and the player photo
// fills the upper area above it with breathing room.
const FORMAT_SPECS: Record<PostFormat, FormatSpec> = {
  feed: {
    canvas: { width: 1080, height: 1350 },
    photoZone: { x: 180, y: 120, width: 720, height: 820 },
    textZone: { x: 40, y: 940, width: 1000, height: 390 },
    logoZone: { x: 40, y: 40, width: 100 },
    staticTemplate: "feed-default.png",
  },
  square: {
    canvas: { width: 1080, height: 1080 },
    photoZone: { x: 220, y: 80, width: 640, height: 660 },
    textZone: { x: 40, y: 750, width: 1000, height: 320 },
    logoZone: { x: 40, y: 30, width: 88 },
    staticTemplate: "square-default.png",
  },
  story: {
    canvas: { width: 1080, height: 1920 },
    photoZone: { x: 240, y: 280, width: 600, height: 800 },
    textZone: { x: 60, y: 1200, width: 960, height: 600 },
    logoZone: { x: 60, y: 60, width: 120 },
    staticTemplate: "extra-base-hit.png",
  },
};

const PUBLIC_DIR = path.join(process.cwd(), "public");
const NAVY = "#0a1929";
const CYAN = "#22d3ee";
const WHITE = "#ffffff";

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildTextSvg({
  width,
  height,
  headline,
  playerName,
  jerseyNumber,
  statLine,
}: {
  width: number;
  height: number;
  headline: string;
  playerName: string;
  jerseyNumber?: number | null;
  statLine: string;
}): Buffer {
  const headlineUpper = escapeXml(headline.toUpperCase());
  const nameLine = escapeXml(
    `${playerName.toUpperCase()}${jerseyNumber ? ` · #${jerseyNumber}` : ""}`
  );
  const stat = escapeXml(statLine);

  // Scale text sizes with panel height so it reads well on all aspect ratios.
  const headlineSize = Math.round(Math.min(width * 0.095, height * 0.22));
  const nameSize = Math.round(headlineSize * 0.58);
  const statSize = Math.round(headlineSize * 0.45);
  const headlineY = Math.round(height * 0.32);
  const nameY = headlineY + Math.round(headlineSize * 0.95);
  const statY = nameY + Math.round(nameSize * 1.1);

  const FONT_DISPLAY = "sans-serif";
  const FONT_MONO = "monospace";

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="panel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${NAVY}" stop-opacity="0"/>
      <stop offset="35%" stop-color="${NAVY}" stop-opacity="0.88"/>
      <stop offset="100%" stop-color="${NAVY}" stop-opacity="0.98"/>
    </linearGradient>
  </defs>

  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#panel)"/>
  <rect x="0" y="20" width="${width}" height="6" fill="${CYAN}"/>

  <text x="${width / 2}" y="${headlineY}" text-anchor="middle"
        font-family="${FONT_DISPLAY}" font-weight="900"
        font-size="${headlineSize}" fill="${WHITE}" letter-spacing="2">${headlineUpper}</text>

  <text x="${width / 2}" y="${nameY}" text-anchor="middle"
        font-family="${FONT_DISPLAY}" font-weight="800"
        font-size="${nameSize}" fill="${CYAN}" letter-spacing="6">${nameLine}</text>

  <text x="${width / 2}" y="${statY}" text-anchor="middle"
        font-family="${FONT_MONO}" font-weight="700"
        font-size="${statSize}" fill="${WHITE}" opacity="0.95">${stat}</text>
</svg>`;
  return Buffer.from(svg);
}

function buildCircleMaskSvg(width: number, height: number): Buffer {
  const r = Math.min(width, height) / 2;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><circle cx="${width / 2}" cy="${height / 2}" r="${r}" fill="white"/></svg>`
  );
}

export type ComposeInput = {
  format: PostFormat;
  headline: string;
  playerName: string;
  jerseyNumber?: number | null;
  statLine: string;
  photoBuffer?: Buffer | null;
  /** AI-generated background plate buffer for this format. Optional — falls back
   *  to a static PNG in /public/templates named by staticTemplate. */
  backgroundBuffer?: Buffer | null;
  photoStyle?: "fit" | "circle" | "cover";
};

export async function composeHighlightImage(
  input: ComposeInput
): Promise<Buffer> {
  const spec = FORMAT_SPECS[input.format];
  const logoPath = path.join(PUBLIC_DIR, "waves-logo.png");

  // Load background: prefer AI plate, else per-format static template. If the
  // format-specific template is missing, fall back to any template that exists.
  let backgroundSource: Buffer;
  if (input.backgroundBuffer) {
    backgroundSource = input.backgroundBuffer;
  } else {
    const primaryTemplate = path.join(PUBLIC_DIR, "templates", spec.staticTemplate);
    try {
      backgroundSource = await fs.readFile(primaryTemplate);
    } catch {
      // fallback chain so we never throw on a missing template file
      const fallback = path.join(PUBLIC_DIR, "templates", "extra-base-hit.png");
      backgroundSource = await fs.readFile(fallback);
    }
  }

  const templateResized = await sharp(backgroundSource)
    .resize(spec.canvas.width, spec.canvas.height, { fit: "cover", position: "center" })
    .png()
    .toBuffer();

  const layers: sharp.OverlayOptions[] = [];

  if (input.photoBuffer) {
    const { width, height } = spec.photoZone;
    const style = input.photoStyle ?? "cover";

    let photoLayer: Buffer;
    if (style === "circle") {
      const square = await sharp(input.photoBuffer)
        .resize(width, height, { fit: "cover", position: "attention" })
        .png()
        .toBuffer();
      photoLayer = await sharp(square)
        .composite([{ input: buildCircleMaskSvg(width, height), blend: "dest-in" }])
        .png()
        .toBuffer();
    } else {
      photoLayer = await sharp(input.photoBuffer)
        .resize(width, height, {
          fit: style === "fit" ? "inside" : "cover",
          position: "attention",
        })
        .png()
        .toBuffer();
    }

    layers.push({
      input: photoLayer,
      left: spec.photoZone.x,
      top: spec.photoZone.y,
    });
  }

  const textSvg = buildTextSvg({
    width: spec.textZone.width,
    height: spec.textZone.height,
    headline: input.headline,
    playerName: input.playerName,
    jerseyNumber: input.jerseyNumber,
    statLine: input.statLine,
  });
  layers.push({
    input: textSvg,
    left: spec.textZone.x,
    top: spec.textZone.y,
  });

  try {
    await fs.access(logoPath);
    const logo = await sharp(logoPath)
      .resize({ width: spec.logoZone.width })
      .png()
      .toBuffer();
    layers.push({
      input: logo,
      left: spec.logoZone.x,
      top: spec.logoZone.y,
    });
  } catch {
    // logo missing, skip
  }

  return sharp(templateResized).composite(layers).png().toBuffer();
}
