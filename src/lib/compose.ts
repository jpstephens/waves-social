import sharp from "sharp";
import path from "node:path";
import { promises as fs } from "node:fs";

/**
 * Deterministic image composition for highlight posts.
 *
 * The pipeline:
 *   1. Load the brand template (a hand-designed PNG with a designated photo zone).
 *   2. Crop + position the player photo onto the photo zone (no AI alteration).
 *   3. Render text overlays as SVG (player name, stat line, optional headline).
 *   4. Composite the Waves logo from /public/waves-logo.png.
 *   5. Output a 1080x1920 PNG buffer.
 *
 * Templates live in /public/templates and ship with the build. Per-template
 * layout zones are defined in TEMPLATE_LAYOUTS below.
 */

const CANVAS = { width: 1080, height: 1920 };

type Layout = {
  templateFile: string;
  photoZone: { x: number; y: number; width: number; height: number };
  // Text rendered as a single SVG overlay covering the bottom portion
  textZone: { x: number; y: number; width: number; height: number };
  logoZone: { x: number; y: number; width: number };
};

// All zones expressed in 1080x1920 coords. Tweak per template as you add more.
const TEMPLATE_LAYOUTS: Record<string, Layout> = {
  default: {
    templateFile: "extra-base-hit.png",
    photoZone: { x: 240, y: 280, width: 600, height: 800 },
    textZone: { x: 60, y: 1200, width: 960, height: 600 },
    logoZone: { x: 60, y: 60, width: 120 },
  },
  extra_base_hit: {
    templateFile: "extra-base-hit.png",
    photoZone: { x: 240, y: 280, width: 600, height: 800 },
    textZone: { x: 60, y: 1200, width: 960, height: 600 },
    logoZone: { x: 60, y: 60, width: 120 },
  },
  rbi: {
    templateFile: "extra-base-hit.png",
    photoZone: { x: 240, y: 280, width: 600, height: 800 },
    textZone: { x: 60, y: 1200, width: 960, height: 600 },
    logoZone: { x: 60, y: 60, width: 120 },
  },
  pitching: {
    templateFile: "pitching.png",
    photoZone: { x: 240, y: 320, width: 600, height: 800 },
    textZone: { x: 60, y: 1300, width: 960, height: 480 },
    logoZone: { x: 60, y: 60, width: 120 },
  },
  stolen_base: {
    templateFile: "extra-base-hit.png",
    photoZone: { x: 240, y: 280, width: 600, height: 800 },
    textZone: { x: 60, y: 1200, width: 960, height: 600 },
    logoZone: { x: 60, y: 60, width: 120 },
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

  // Background panel with cyan top border for readability over busy templates
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="panel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${NAVY}" stop-opacity="0"/>
      <stop offset="40%" stop-color="${NAVY}" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="${NAVY}" stop-opacity="0.95"/>
    </linearGradient>
  </defs>

  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#panel)"/>
  <rect x="0" y="0" width="${width}" height="6" fill="${CYAN}"/>

  <text x="${width / 2}" y="160" text-anchor="middle"
        font-family="Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif"
        font-size="92" fill="${WHITE}" letter-spacing="2">
    ${headlineUpper}
  </text>

  <text x="${width / 2}" y="290" text-anchor="middle"
        font-family="Impact, Haettenschweiler, sans-serif"
        font-size="56" fill="${CYAN}" letter-spacing="6">
    ${nameLine}
  </text>

  <text x="${width / 2}" y="380" text-anchor="middle"
        font-family="ui-monospace, 'SF Mono', Menlo, monospace"
        font-size="44" fill="${WHITE}" opacity="0.95">
    ${stat}
  </text>
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
  kind: string;
  headline: string;
  playerName: string;
  jerseyNumber?: number | null;
  statLine: string;
  photoBuffer?: Buffer | null;
  /**
   * If provided, used as the background. Should be a Buffer of the AI-generated
   * Nano Banana plate. If absent, falls back to the static template PNG for
   * the highlight kind.
   */
  backgroundBuffer?: Buffer | null;
  /**
   * Crop style for the player photo:
   *  - "fit": preserve aspect, fit within zone (letterbox on background)
   *  - "circle": center-crop into a circle (best for headshots)
   *  - "cover": fill the zone, may crop edges
   */
  photoStyle?: "fit" | "circle" | "cover";
};

export async function composeHighlightImage(
  input: ComposeInput
): Promise<Buffer> {
  const layout = TEMPLATE_LAYOUTS[input.kind] ?? TEMPLATE_LAYOUTS.default;
  const logoPath = path.join(PUBLIC_DIR, "waves-logo.png");

  // Load background: prefer AI-generated plate, else static template fallback
  const backgroundSource =
    input.backgroundBuffer ??
    (await fs.readFile(path.join(PUBLIC_DIR, "templates", layout.templateFile)));

  const templateResized = await sharp(backgroundSource)
    .resize(CANVAS.width, CANVAS.height, { fit: "cover", position: "center" })
    .png()
    .toBuffer();

  const layers: sharp.OverlayOptions[] = [];

  // 1. Player photo (if provided), processed but never AI-altered
  if (input.photoBuffer) {
    const { width, height } = layout.photoZone;
    const style = input.photoStyle ?? "cover";

    let photoLayer: Buffer;
    if (style === "circle") {
      const square = await sharp(input.photoBuffer)
        .resize(width, height, { fit: "cover", position: "attention" })
        .png()
        .toBuffer();
      photoLayer = await sharp(square)
        .composite([
          { input: buildCircleMaskSvg(width, height), blend: "dest-in" },
        ])
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
      left: layout.photoZone.x,
      top: layout.photoZone.y,
    });
  }

  // 2. Text overlay
  const textSvg = buildTextSvg({
    width: layout.textZone.width,
    height: layout.textZone.height,
    headline: input.headline,
    playerName: input.playerName,
    jerseyNumber: input.jerseyNumber,
    statLine: input.statLine,
  });
  layers.push({
    input: textSvg,
    left: layout.textZone.x,
    top: layout.textZone.y,
  });

  // 3. Waves logo (if file exists — fail soft if missing)
  try {
    await fs.access(logoPath);
    const logo = await sharp(logoPath)
      .resize({ width: layout.logoZone.width })
      .png()
      .toBuffer();
    layers.push({
      input: logo,
      left: layout.logoZone.x,
      top: layout.logoZone.y,
    });
  } catch {
    // logo missing, skip
  }

  return sharp(templateResized).composite(layers).png().toBuffer();
}
