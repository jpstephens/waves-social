import { generateText } from "ai";
import type { PostFormat } from "@/lib/db/schema";

/**
 * Nano Banana = Google's Gemini image generation model family.
 *
 * Generates BACKGROUND PLATES only — no people, no text, no logos. The player
 * photo and all branded text are composited deterministically by lib/compose.ts
 * so the kid's face is never altered by AI.
 */

const MODEL = "google/gemini-2.5-flash-image";

export type GenerateBackgroundInput = {
  kind: string;
  format: PostFormat;
};

const FORMAT_DIMS: Record<PostFormat, { w: number; h: number; aspect: string; zone: string }> = {
  feed: {
    w: 1080,
    h: 1350,
    aspect: "4:5 portrait",
    zone: "a large empty rectangular zone (~720x820px) in the upper-center — leave that area pure background so a player photo can be composited there later. Reserve the bottom ~30% for a dark panel overlay we'll add in code",
  },
  square: {
    w: 1080,
    h: 1080,
    aspect: "1:1 square",
    zone: "a large empty rectangular zone (~640x660px) in the upper-center — leave that area pure background. Reserve the bottom ~30% for a dark panel we'll add in code",
  },
  story: {
    w: 1080,
    h: 1920,
    aspect: "9:16 vertical",
    zone: "a large empty rectangular zone (~600x800px) in the upper-center. Reserve the bottom ~35% for a dark panel we'll add in code",
  },
};

export async function generateBackground({
  kind,
  format,
}: GenerateBackgroundInput): Promise<{
  imageBuffer: Buffer;
  mediaType: string;
  prompt: string;
}> {
  const prompt = buildBackgroundPrompt(kind, format);

  const result = await generateText({
    model: MODEL,
    messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
    providerOptions: {
      google: {
        responseModalities: ["IMAGE"],
      },
    },
  });

  const file = result.files?.find((f) => f.mediaType.startsWith("image/"));
  if (!file) {
    const txt = result.text || "(no text response)";
    throw new Error(
      `Nano Banana returned no image. Model said: ${txt.slice(0, 200)}`
    );
  }

  return {
    imageBuffer: Buffer.from(file.uint8Array),
    mediaType: file.mediaType,
    prompt,
  };
}

export function buildBackgroundPrompt(kind: string, format: PostFormat): string {
  const dims = FORMAT_DIMS[format];
  const COMMON_TAIL = `

Strict requirements:
- ${dims.aspect} canvas, ${dims.w}x${dims.h}.
- Use ONLY these two colors: deep navy #0a1929 (background) and electric cyan #22d3ee (accent / glow / lines). No other hues.
- Reserve ${dims.zone}.
- DO NOT include people, faces, silhouettes, players, hands, or any human figures.
- DO NOT add text, numbers, letters, scoreboards, stat boxes, or HUD frames.
- DO NOT add logos, watermarks, or fake sponsor marks.
- DO NOT use baseball stitching textures or red colors.
- Modern ESPN/MLB Network broadcast graphic style. Cinematic, premium, kid-friendly.`;

  switch (kind) {
    case "extra_base_hit":
    case "rbi":
      return `${dims.aspect} sports background. A dark baseball stadium at night seen from behind home plate. The white chalk lines of the batter's box and home plate are visible at the bottom of the frame. Electric cyan light beams shoot upward from the chalk lines into the navy night sky, with subtle particles and motion. Top half is mostly empty negative space.${COMMON_TAIL}`;

    case "pitching":
      return `${dims.aspect} sports background. The pitcher's mound seen from behind, illuminated by a single dramatic cyan spotlight from above. Dirt mound in the lower third with the pitching rubber visible. Dark navy night sky with soft cyan light streaks descending. Large empty area in the upper-center for a player portrait.${COMMON_TAIL}`;

    case "stolen_base":
      return `${dims.aspect} sports background. A baseball basepath seen at a dramatic low angle, with chalk-line baseline running diagonally across the lower half. Cyan motion blur streaks suggest speed. Navy field at night, soft cyan stadium lights bleeding in from the top edges. Upper-center kept empty.${COMMON_TAIL}`;

    case "milestone":
    case "teamwork":
      return `${dims.aspect} sports background. An abstract dark navy field with a soft cyan radial glow centered slightly above middle. Subtle wave pattern (ocean theme — the team is called the Waves) in the bottom 20% only. Mostly empty negative space with a calm, celebratory mood.${COMMON_TAIL}`;

    default:
      return `${dims.aspect} sports background. Dark navy gradient with soft cyan light streaks angling diagonally from upper-right. Subtle baseball field chalk marks at the very bottom edge. Large empty area in the upper-center for a player photo to be composited later.${COMMON_TAIL}`;
  }
}
