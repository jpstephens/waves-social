import { NextRequest, NextResponse } from "next/server";
import { requireCoach } from "@/lib/auth";
import { db, posts } from "@/lib/db";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireCoach();
  const { id } = await params;
  const { caption } = (await req.json()) as { caption: string };
  await db.update(posts).set({ caption }).where(eq(posts.id, id));
  return NextResponse.json({ ok: true });
}
