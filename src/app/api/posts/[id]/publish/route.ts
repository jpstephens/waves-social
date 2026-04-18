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

  const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : undefined;

  try {
    const { updateId } = await createBufferUpdate({
      caption: post.caption,
      mediaUrl,
      scheduledAt,
    });
    await db
      .update(posts)
      .set({
        status: scheduledAt ? "scheduled" : "published",
        scheduledAt: scheduledAt ?? null,
        publishedAt: scheduledAt ? null : new Date(),
        bufferUpdateId: updateId,
        updatedAt: new Date(),
      })
      .where(eq(posts.id, id));
    return NextResponse.json({ ok: true, updateId });
  } catch (err) {
    if (err instanceof BufferNotConfiguredError) {
      // For scheduled posts we still save the schedule locally so the calendar
      // works without Buffer — the coach can wire up Buffer later, or we can
      // add a cron/job that syncs to Buffer when the time comes.
      if (scheduledAt) {
        await db
          .update(posts)
          .set({
            status: "scheduled",
            scheduledAt,
            updatedAt: new Date(),
          })
          .where(eq(posts.id, id));
        return NextResponse.json({
          ok: true,
          scheduledLocally: true,
          warning: "buffer_not_configured",
          mediaUrl,
        });
      }
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
