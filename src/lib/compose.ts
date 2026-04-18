import sharp from "sharp";
import path from "node:path";
import { promises as fs } from "node:fs";
import type { PostFormat } from "@/lib/db/schema";

/**
 * Deterministic image composition for highlight posts. Renders one of three
 * formats: Instagram feed (4:5), square (1:1), or story/reel (9:16).
 *
 * Layout:
 *   - Photo hero fills the upper ~65% of the canvas (full-bleed, no side padding)
 *   - Cyan accent bar divides photo from the stats panel
 *   - Solid navy stats panel on the lower ~35% carries headline / name / stats
 *   - Waves logo top-left
 *
 * Fonts: Anton (bundled under /public/fonts) is embedded as a base64 data URI
 * inside the SVG so resvg in the Vercel runtime always renders, regardless of
 * what's installed on the host. No system-font dependency.
 */

type FormatSpec = {
  canvas: { width: number; height: number };
  photoZone: { x: number; y: number; width: number; height: number };
  // The stat panel is drawn as a solid navy rect; text is rendered on top.
  panelY: number; // Y where panel starts (photo ends)
  panelHeight: number;
  logoZone: { x: number; y: number; width: number };
  staticTemplate: string;
  // Text sizing that suits this format
  headlineSize: number;
  nameSize: number;
  statSize: number;
};

const FORMAT_SPECS: Record<PostFormat, FormatSpec> = {
  feed: {
    canvas: { width: 1080, height: 1350 },
    photoZone: { x: 0, y: 0, width: 1080, height: 880 },
    panelY: 880,
    panelHeight: 470,
    logoZone: { x: 40, y: 40, width: 96 },
    staticTemplate: "feed-default.png",
    headlineSize: 92,
    nameSize: 54,
    statSize: 40,
  },
  square: {
    canvas: { width: 1080, height: 1080 },
    photoZone: { x: 0, y: 0, width: 1080, height: 700 },
    panelY: 700,
    panelHeight: 380,
    logoZone: { x: 40, y: 40, width: 88 },
    staticTemplate: "square-default.png",
    headlineSize: 78,
    nameSize: 46,
    statSize: 36,
  },
  story: {
    canvas: { width: 1080, height: 1920 },
    photoZone: { x: 0, y: 0, width: 1080, height: 1280 },
    panelY: 1280,
    panelHeight: 640,
    logoZone: { x: 60, y: 60, width: 120 },
    staticTemplate: "extra-base-hit.png",
    headlineSize: 120,
    nameSize: 68,
    statSize: 48,
  },
};

const PUBLIC_DIR = path.join(process.cwd(), "public");
const NAVY = "#0a1929";
const CYAN = "#22d3ee";
const WHITE = "#ffffff";

// Load and base64-encode the Anton font once so every SVG can reference it
// via a data URI. Avoids runtime font-discovery issues in resvg.
let FONT_DATA_URI_PROMISE: Promise<string> | null = null;
async function getFontDataUri(): Promise<string> {
  if (!FONT_DATA_URI_PROMISE) {
    FONT_DATA_URI_PROMISE = (async () => {
      try {
        const buf = await fs.readFile(
          path.join(PUBLIC_DIR, "fonts", "Anton-Regular.ttf")
        );
        return `data:font/ttf;base64,${buf.toString("base64")}`;
      } catch {
        return "";
      }
    })();
  }
  return FONT_DATA_URI_PROMISE;
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function buildPanelSvg({
  canvasWidth,
  panelY,
  panelHeight,
  canvasHeight,
  headline,
  playerName,
  jerseyNumber,
  statLine,
  sizes,
}: {
  canvasWidth: number;
  panelY: number;
  panelHeight: number;
  canvasHeight: number;
  headline: string;
  playerName: string;
  jerseyNumber?: number | null;
  statLine: string;
  sizes: { headline: number; name: number; stat: number };
}): Promise<Buffer> {
  const fontUri = await getFontDataUri();
  const headlineUpper = escapeXml(headline.toUpperCase());
  const nameLine = escapeXml(
    `${playerName.toUpperCase()}${jerseyNumber ? ` · #${jerseyNumber}` : ""}`
  );
  const stat = escapeXml(statLine.toUpperCase());

  // Line positions relative to the panel top.
  const cyanBarY = panelY;
  const cyanBarHeight = 8;
  const panelRectY = panelY + cyanBarHeight;
  const panelRectHeight = panelHeight - cyanBarHeight;

  const innerTop = panelRectY + Math.round(panelRectHeight * 0.18);
  const headlineY = innerTop + sizes.headline;
  const nameY = headlineY + Math.round(sizes.headline * 0.9);
  const statY = nameY + Math.round(sizes.name * 1.1);

  const fontFace = fontUri
    ? `@font-face { font-family: "Display"; src: url("${fontUri}") format("truetype"); font-weight: 400; font-style: normal; }`
    : "";

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}">
  <defs>
    <style>${fontFace}</style>
  </defs>

  <rect x="0" y="${cyanBarY}" width="${canvasWidth}" height="${cyanBarHeight}" fill="${CYAN}"/>
  <rect x="0" y="${panelRectY}" width="${canvasWidth}" height="${panelRectHeight}" fill="${NAVY}"/>

  <text x="${canvasWidth / 2}" y="${headlineY}" text-anchor="middle"
        font-family="Display, sans-serif"
        font-size="${sizes.headline}" fill="${WHITE}" letter-spacing="2">${headlineUpper}</text>

  <text x="${canvasWidth / 2}" y="${nameY}" text-anchor="middle"
        font-family="Display, sans-serif"
        font-size="${sizes.name}" fill="${CYAN}" letter-spacing="6">${nameLine}</text>

  <text x="${canvasWidth / 2}" y="${statY}" text-anchor="middle"
        font-family="Display, sans-serif"
        font-size="${sizes.stat}" fill="${WHITE}" letter-spacing="3" opacity="0.92">${stat}</text>
</svg>`;
  return Buffer.from(svg);
}

export type ComposeInput = {
  format: PostFormat;
  headline: string;
  playerName: string;
  jerseyNumber?: number | null;
  statLine: string;
  photoBuffer?: Buffer | null;
  backgroundBuffer?: Buffer | null;
};

export async function composeHighlightImage(
  input: ComposeInput
): Promise<Buffer> {
  const spec = FORMAT_SPECS[input.format];
  const logoPath = path.join(PUBLIC_DIR, "waves-logo.png");

  // Base layer: solid navy canvas. AI/template background is only shown behind
  // the photo zone; the stat panel draws on top with its own fill.
  const baseCanvas = await sharp({
    create: {
      width: spec.canvas.width,
      height: spec.canvas.height,
      channels: 4,
      background: NAVY,
    },
  })
    .png()
    .toBuffer();

  const layers: sharp.OverlayOptions[] = [];

  // Background plate sized to the photo zone (full-bleed). Lets the AI plate
  // act as decorative context around/behind the player photo.
  let backgroundBuf: Buffer;
  if (input.backgroundBuffer) {
    backgroundBuf = input.backgroundBuffer;
  } else {
    const primary = path.join(PUBLIC_DIR, "templates", spec.staticTemplate);
    try {
      backgroundBuf = await fs.readFile(primary);
    } catch {
      backgroundBuf = await fs.readFile(
        path.join(PUBLIC_DIR, "templates", "extra-base-hit.png")
      );
    }
  }
  const backgroundResized = await sharp(backgroundBuf)
    .resize(spec.photoZone.width, spec.photoZone.height, {
      fit: "cover",
      position: "center",
    })
    .png()
    .toBuffer();
  layers.push({
    input: backgroundResized,
    left: spec.photoZone.x,
    top: spec.photoZone.y,
  });

  // Player photo — full-bleed in the photo zone (covers the background).
  if (input.photoBuffer) {
    const photoLayer = await sharp(input.photoBuffer)
      .resize(spec.photoZone.width, spec.photoZone.height, {
        fit: "cover",
        position: "attention",
      })
      .png()
      .toBuffer();
    layers.push({
      input: photoLayer,
      left: spec.photoZone.x,
      top: spec.photoZone.y,
    });
  }

  // Stat panel (cyan bar + navy panel + text), covering the full canvas width
  // below the photo zone. Drawn as a single SVG so text anti-aliasing is clean.
  const panelSvg = await buildPanelSvg({
    canvasWidth: spec.canvas.width,
    canvasHeight: spec.canvas.height,
    panelY: spec.panelY,
    panelHeight: spec.panelHeight,
    headline: input.headline,
    playerName: input.playerName,
    jerseyNumber: input.jerseyNumber,
    statLine: input.statLine,
    sizes: {
      headline: spec.headlineSize,
      name: spec.nameSize,
      stat: spec.statSize,
    },
  });
  layers.push({ input: panelSvg, left: 0, top: 0 });

  // Waves logo on top of the hero photo.
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

  return sharp(baseCanvas).composite(layers).png().toBuffer();
}
