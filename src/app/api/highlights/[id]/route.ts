import { NextRequest, NextResponse } from "next/server";
import { requireCoach } from "@/lib/auth";
import { db, highlights } from "@/lib/db";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireCoach();
  const { id } = await params;
  const body = (await req.json()) as Partial<{
    status: "proposed" | "selected" | "rejected";
    headline: string;
    caption: string;
    statLine: string;
    overlayText: string;
  }>;

  const update: Record<string, unknown> = {};
  if (body.status) update.status = body.status;
  if (body.headline != null) update.headline = body.headline;
  if (body.caption != null) update.caption = body.caption;
  if (body.statLine != null) update.statLine = body.statLine;
  if (body.overlayText != null) update.overlayText = body.overlayText;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true });
  }

  await db.update(highlights).set(update).where(eq(highlights.id, id));
  return NextResponse.json({ ok: true });
}
