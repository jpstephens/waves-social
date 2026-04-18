import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireCoach } from "@/lib/auth";
import {
  db,
  highlights,
  players,
  posts,
  teams,
  POST_FORMATS,
  type PostFormat,
} from "@/lib/db";
import { uploadToBlob, uploadBufferToBlob } from "@/lib/blob";
import { generateBackground } from "@/lib/nano-banana";
import { composeHighlightImage } from "@/lib/compose";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Coach uploads a player photo for a single highlight. We generate all three
 * Instagram formats (feed 4:5, square 1:1, story 9:16) in parallel:
 *   1. Save the photo to Blob once.
 *   2. For each format: generate a Nano Banana bg plate → composite photo +
 *      stats + logo → upload the final PNG.
 *   3. Persist per-format URLs in highlights.generatedImages and posts.outputImages.
 *
 * Pass `regenerateBackground=true` in the form to force fresh bg plates.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireCoach();
  const { id } = await params;

  try {
    const [highlight] = await db
      .select()
      .from(highlights)
      .where(eq(highlights.id, id));
    if (!highlight) {
      return NextResponse.json({ error: "highlight not found" }, { status: 404 });
    }

    const [team] = await db.select().from(teams).limit(1);
    if (!team) {
      return NextResponse.json({ error: "no team" }, { status: 400 });
    }

    let player = null;
    if (highlight.playerId) {
      [player] = await db
        .select()
        .from(players)
        .where(eq(players.id, highlight.playerId));
    }

    const form = await req.formData();
    const photoFile = form.get("photo");
    const regenerateBackground = form.get("regenerateBackground") === "true";

    let photoUrl = highlight.photoUrl;
    let photoBuffer: Buffer | null = null;

    if (photoFile instanceof File && photoFile.size > 0) {
      const upload = await uploadToBlob({
        file: photoFile,
        prefix: `highlights/${highlight.id}/photo`,
      });
      photoUrl = upload.url;
      photoBuffer = Buffer.from(await photoFile.arrayBuffer());
    }

    if (!photoBuffer) {
      return NextResponse.json(
        { error: "photo file is required — re-drop to regenerate" },
        { status: 400 }
      );
    }

    const playerName =
      player?.firstName && player?.lastName
        ? `${player.firstName} ${player.lastName}`
        : (player?.firstName ?? highlight.playerNameRaw ?? "Player");
    const jersey = player?.jerseyNumber ?? highlight.jerseyNumber;

    // Fan out: for each format, get a bg plate (AI or cached) then composite +
    // upload the final image. All three formats run concurrently.
    const existingBackgrounds = highlight.backgrounds ?? {};
    const existingOutputs = highlight.generatedImages ?? {};

    const formatResults = await Promise.all(
      POST_FORMATS.map(async (format) => {
        let backgroundBuffer: Buffer | null = null;
        let backgroundUrl: string | null = existingBackgrounds[format] ?? null;
        let backgroundSource: "ai" | "template" | "cached" = "cached";
        let backgroundError: string | null = null;

        if (!backgroundUrl || regenerateBackground) {
          try {
            const bg = await generateBackground({
              kind: highlight.kind,
              format,
            });
            const bgUpload = await uploadBufferToBlob({
              buffer: bg.imageBuffer,
              pathname: `highlights/${highlight.id}/bg-${format}-${Date.now()}.png`,
              contentType: bg.mediaType,
            });
            backgroundUrl = bgUpload.url;
            backgroundBuffer = bg.imageBuffer;
            backgroundSource = "ai";
          } catch (err) {
            backgroundSource = "template";
            backgroundError = err instanceof Error ? err.message : String(err);
            console.error("[nano-banana] bg failed", {
              highlightId: id,
              format,
              kind: highlight.kind,
              error: backgroundError,
            });
          }
        }

        const finalPng = await composeHighlightImage({
          format,
          headline: highlight.headline,
          playerName,
          jerseyNumber: jersey,
          statLine: highlight.statLine ?? "",
          photoBuffer,
          backgroundBuffer,
        });

        const finalUpload = await uploadBufferToBlob({
          buffer: finalPng,
          pathname: `highlights/${highlight.id}/post-${format}-${Date.now()}.png`,
          contentType: "image/png",
        });

        return {
          format,
          backgroundUrl,
          outputUrl: finalUpload.url,
          backgroundSource,
          backgroundError,
        };
      })
    );

    const backgroundsMap: Partial<Record<PostFormat, string>> = {
      ...existingBackgrounds,
    };
    const outputsMap: Partial<Record<PostFormat, string>> = {
      ...existingOutputs,
    };
    const sources: Partial<Record<PostFormat, "ai" | "template" | "cached">> = {};
    const errors: Partial<Record<PostFormat, string>> = {};

    for (const r of formatResults) {
      if (r.backgroundUrl) backgroundsMap[r.format] = r.backgroundUrl;
      outputsMap[r.format] = r.outputUrl;
      sources[r.format] = r.backgroundSource;
      if (r.backgroundError) errors[r.format] = r.backgroundError;
    }

    const feedUrl = outputsMap.feed ?? outputsMap.square ?? outputsMap.story ?? null;

    await db
      .update(highlights)
      .set({
        photoUrl,
        backgrounds: backgroundsMap,
        generatedImages: outputsMap,
        // Keep legacy single-URL fields populated with the feed format.
        backgroundUrl: backgroundsMap.feed ?? backgroundsMap.square ?? backgroundsMap.story ?? null,
        generatedImageUrl: feedUrl,
      })
      .where(eq(highlights.id, id));

    const [existingPost] = await db
      .select()
      .from(posts)
      .where(eq(posts.highlightId, highlight.id));

    let postId: string;
    if (existingPost) {
      await db
        .update(posts)
        .set({
          outputImages: outputsMap,
          outputImageUrl: feedUrl,
          renderStatus: "ready",
          ...(existingPost.status === "approved" ||
          existingPost.status === "scheduled" ||
          existingPost.status === "published"
            ? {}
            : { status: "draft" }),
          updatedAt: new Date(),
        })
        .where(eq(posts.id, existingPost.id));
      postId = existingPost.id;
    } else {
      const [created] = await db
        .insert(posts)
        .values({
          gameId: highlight.gameId,
          highlightId: highlight.id,
          kind: "spotlight",
          caption: highlight.caption,
          outputImages: outputsMap,
          outputImageUrl: feedUrl,
          publishFormat: "feed",
          status: "draft",
          renderStatus: "ready",
        })
        .returning();
      postId = created.id;
    }

    return NextResponse.json({
      postId,
      photoUrl,
      generatedImages: outputsMap,
      backgrounds: backgroundsMap,
      backgroundSources: sources,
      backgroundErrors: errors,
    });
  } catch (err) {
    console.error("media generation failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
