import { generateText } from "ai";

/**
 * Nano Banana = Google's Gemini image generation model family.
 *
 * In this app we use Nano Banana to generate BACKGROUND PLATES only —
 * no people, no text, no logos. The player photo and all branded text
 * are composited deterministically by lib/compose.ts so:
 *   - the kid's face is never altered by AI
 *   - brand colors / logo / text rendering are pixel-perfect every time
 *
 * Called via Vercel AI Gateway (uses AI_GATEWAY_API_KEY).
 */

const MODEL = "google/gemini-2.5-flash-image";

export type GenerateBackgroundInput = {
  /** highlight kind — drives the prompt template */
  kind: string;
};

export async function generateBackground({
  kind,
}: GenerateBackgroundInput): Promise<{
  imageBuffer: Buffer;
  mediaType: string;
  prompt: string;
}> {
  const prompt = buildBackgroundPrompt(kind);

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

/**
 * Per-highlight-kind background prompt.
 * Common rules:
 *   - 9:16 vertical, 1080x1920
 *   - Navy #0a1929 + cyan #22d3ee palette ONLY
 *   - Big empty zone in upper-center for player photo composite (do NOT fill it)
 *   - No people, no text, no logos, no HUD frames, no fake stat boxes
 *   - Modern broadcast aesthetic, kid-friendly (not aggressive)
 */
export function buildBackgroundPrompt(kind: string): string {
  const COMMON_TAIL = `

Strict requirements:
- 9:16 vertical canvas, 1080x1920.
- Use ONLY these two colors as the palette: deep navy #0a1929 (background) and electric cyan #22d3ee (accent / glow / lines). No other hues.
- Reserve a large empty rectangular zone (approximately 600x800px) in the upper-center of the canvas — leave that area pure background so a player photo can be composited there later.
- DO NOT include people, faces, silhouettes, players, hands, or any human figures.
- DO NOT add any text, numbers, letters, scoreboards, stat boxes, or HUD frames.
- DO NOT add logos, watermarks, or fake sponsor marks.
- DO NOT use baseball stitching textures or red colors.
- Modern ESPN/MLB Network broadcast graphic style. Cinematic, premium, kid-friendly.`;

  switch (kind) {
    case "extra_base_hit":
    case "rbi":
      return `Vertical 9:16 sports background. A dark baseball stadium at night seen from behind home plate. The white chalk lines of the batter's box and home plate are visible at the bottom of the frame. Electric cyan light beams shoot upward from the chalk lines into the navy night sky, with subtle particles and motion. Top half is mostly empty negative space.${COMMON_TAIL}`;

    case "pitching":
      return `Vertical 9:16 sports background. The pitcher's mound seen from behind, illuminated by a single dramatic cyan spotlight from above. Dirt mound in the lower third with the pitching rubber visible. Dark navy night sky with soft cyan light streaks descending. Large empty area in the upper-center for a player portrait.${COMMON_TAIL}`;

    case "stolen_base":
      return `Vertical 9:16 sports background. A baseball basepath seen at a dramatic low angle, with chalk-line baseline running diagonally across the lower half. Cyan motion blur streaks suggest speed. Navy field at night, soft cyan stadium lights bleeding in from the top edges. Upper-center kept empty.${COMMON_TAIL}`;

    case "milestone":
    case "teamwork":
      return `Vertical 9:16 sports background. An abstract dark navy field with a soft cyan radial glow centered slightly above middle. Subtle wave pattern (ocean theme — the team is called the Waves) in the bottom 20% only. Mostly empty negative space with a calm, celebratory mood.${COMMON_TAIL}`;

    default:
      return `Vertical 9:16 sports background. Dark navy gradient with soft cyan light streaks angling diagonally from upper-right. Subtle baseball field chalk marks at the very bottom edge. Large empty area in the upper-center for a player photo to be composited later.${COMMON_TAIL}`;
  }
}
