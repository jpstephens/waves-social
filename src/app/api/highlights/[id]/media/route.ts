import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireCoach } from "@/lib/auth";
import { db, highlights, players, posts, teams } from "@/lib/db";
import { uploadToBlob, uploadBufferToBlob } from "@/lib/blob";
import { generateBackground } from "@/lib/nano-banana";
import { composeHighlightImage } from "@/lib/compose";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Coach uploads a player photo for a single highlight. We:
 *   1. Save the photo to Blob (untouched by AI).
 *   2. Generate (or reuse) a Nano Banana background plate for this highlight.
 *   3. Code-composite: AI background + player photo + brand text + logo.
 *   4. Save the final image to Blob, return its URL.
 *
 * If the photo is already attached and no new file is sent, this just
 * regenerates the composition (background + overlay) using the existing photo.
 * Pass `regenerateBackground=true` in the form to force a new bg gen.
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

    // 2. Background — reuse if cached unless regenerate requested
    let backgroundUrl = highlight.backgroundUrl;
    let backgroundBuffer: Buffer | null = null;
    let backgroundSource: "ai" | "template" | "cached" = "cached";
    let backgroundError: string | null = null;

    if (!backgroundUrl || regenerateBackground) {
      try {
        const bg = await generateBackground({ kind: highlight.kind });
        const bgUpload = await uploadBufferToBlob({
          buffer: bg.imageBuffer,
          pathname: `highlights/${highlight.id}/bg-${Date.now()}.png`,
          contentType: bg.mediaType,
        });
        backgroundUrl = bgUpload.url;
        backgroundBuffer = bg.imageBuffer;
        backgroundSource = "ai";

        await db
          .update(highlights)
          .set({ backgroundUrl, imagePrompt: bg.prompt })
          .where(eq(highlights.id, id));
      } catch (err) {
        backgroundSource = "template";
        backgroundError = err instanceof Error ? err.message : String(err);
        console.error("[nano-banana] bg generation failed", {
          highlightId: id,
          kind: highlight.kind,
          error: backgroundError,
        });
      }
    }

    // If we still don't have a buffer (cached URL), let the compositor read
    // from the static template by leaving backgroundBuffer null.

    if (!photoBuffer && photoUrl) {
      // Re-render path: we have a photo URL on the highlight but no fresh buffer.
      // For a private Blob, we can't easily re-fetch — require new upload for now.
      // (Future: use @vercel/blob's head() to download with auth.)
      return NextResponse.json(
        {
          error:
            "Photo not provided in this request. Re-upload to regenerate. (Re-fetching from private Blob will be added later.)",
        },
        { status: 400 }
      );
    }

    if (!photoBuffer) {
      return NextResponse.json(
        { error: "photo file is required" },
        { status: 400 }
      );
    }

    // 3. Composite
    const playerName =
      player?.firstName && player?.lastName
        ? `${player.firstName} ${player.lastName}`
        : (player?.firstName ??
          highlight.playerNameRaw ??
          "Player");
    const jersey = player?.jerseyNumber ?? highlight.jerseyNumber;

    const finalPng = await composeHighlightImage({
      kind: highlight.kind,
      headline: highlight.headline,
      playerName,
      jerseyNumber: jersey,
      statLine: highlight.statLine ?? "",
      photoBuffer,
      backgroundBuffer,
    });

    const finalUpload = await uploadBufferToBlob({
      buffer: finalPng,
      pathname: `highlights/${highlight.id}/post-${Date.now()}.png`,
      contentType: "image/png",
    });

    await db
      .update(highlights)
      .set({
        photoUrl,
        generatedImageUrl: finalUpload.url,
      })
      .where(eq(highlights.id, id));

    // Materialize / update a Post row so this highlight can be approved + scheduled.
    const [existingPost] = await db
      .select()
      .from(posts)
      .where(eq(posts.highlightId, highlight.id));

    let postId: string;
    if (existingPost) {
      await db
        .update(posts)
        .set({
          outputImageUrl: finalUpload.url,
          renderStatus: "ready",
          // If the post was already approved/scheduled, leave status alone.
          // If it was draft, keep it as draft (coach still needs to approve the new render).
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
          outputImageUrl: finalUpload.url,
          status: "draft",
          renderStatus: "ready",
        })
        .returning();
      postId = created.id;
    }

    return NextResponse.json({
      postId,
      generatedImageUrl: finalUpload.url,
      backgroundUrl,
      photoUrl,
      backgroundSource,
      backgroundError,
    });
  } catch (err) {
    console.error("media generation failed", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
