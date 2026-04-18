import { NextRequest, NextResponse } from "next/server";
import { requireCoach } from "@/lib/auth";
import { db, posts } from "@/lib/db";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireCoach();
  const { id } = await params;

  const [p] = await db.select().from(posts).where(eq(posts.id, id));
  if (!p) return NextResponse.json({ error: "post not found" }, { status: 404 });
  if (p.status !== "scheduled") {
    return NextResponse.json(
      { error: `cannot unschedule a ${p.status} post` },
      { status: 400 }
    );
  }

  await db
    .update(posts)
    .set({
      status: "approved",
      scheduledAt: null,
      bufferUpdateId: null,
      updatedAt: new Date(),
    })
    .where(eq(posts.id, id));

  return NextResponse.json({ ok: true });
}
