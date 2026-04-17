import { NextRequest, NextResponse } from "next/server";
import { requireCoach } from "@/lib/auth";
import { db, posts } from "@/lib/db";
import { eq } from "drizzle-orm";
import { createBufferUpdate, BufferNotConfiguredError } from "@/lib/buffer";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireCoach();
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    scheduledAt?: string;
  };

  const [post] = await db.select().from(posts).where(eq(posts.id, id));
  if (!post) {
    return NextResponse.json({ error: "post not found" }, { status: 404 });
  }
  const mediaUrl = post.outputVideoUrl ?? post.outputImageUrl;
  if (!mediaUrl) {
    return NextResponse.json(
      { error: "post has no rendered media yet" },
      { status: 400 }
    );
  }

  try {
    const { updateId } = await createBufferUpdate({
      caption: post.caption,
      mediaUrl,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
    });
    await db
      .update(posts)
      .set({
        status: body.scheduledAt ? "scheduled" : "published",
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
        publishedAt: body.scheduledAt ? null : new Date(),
        bufferUpdateId: updateId,
      })
      .where(eq(posts.id, id));
    return NextResponse.json({ ok: true, updateId });
  } catch (err) {
    if (err instanceof BufferNotConfiguredError) {
      return NextResponse.json(
        {
          error: "buffer_not_configured",
          hint: "Download the media and post manually while Buffer is being set up.",
          mediaUrl,
        },
        { status: 501 }
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
