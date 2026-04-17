import { NextRequest, NextResponse } from "next/server";
import { requireCoach } from "@/lib/auth";
import { db, games, teams } from "@/lib/db";
import { uploadToBlob } from "@/lib/blob";
import { proposeHighlights } from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    await requireCoach();

    const form = await req.formData();
    const pdf = form.get("pdf");
    const opponent = String(form.get("opponent") ?? "Opponent");
    const playedAt = String(form.get("playedAt") ?? new Date().toISOString());
    const notes = form.get("notes") ? String(form.get("notes")) : null;

    if (!(pdf instanceof File)) {
      return NextResponse.json({ error: "pdf is required" }, { status: 400 });
    }

    const [team] = await db.select().from(teams).limit(1);
    if (!team) {
      return NextResponse.json(
        { error: "No team seeded. Run `npm run db:seed`." },
        { status: 400 }
      );
    }

    let pdfUpload;
    try {
      pdfUpload = await uploadToBlob({
        file: pdf,
        prefix: `games/${team.id}/pdf`,
      });
    } catch (err) {
      console.error("blob upload failed", err);
      return NextResponse.json(
        {
          error: `PDF upload failed: ${err instanceof Error ? err.message : String(err)}. Make sure Vercel Blob is connected to this project.`,
        },
        { status: 500 }
      );
    }

    const [game] = await db
      .insert(games)
      .values({
        teamId: team.id,
        opponent,
        playedAt: new Date(playedAt),
        boxScorePdfUrl: pdfUpload.url,
        notes,
      })
      .returning();

    try {
      await proposeHighlights(game.id);
    } catch (err) {
      console.error("propose failed", err);
      return NextResponse.json(
        {
          gameId: game.id,
          warning: "Game saved, but AI proposals failed.",
          error: `${err instanceof Error ? err.message : String(err)}. Likely cause: AI Gateway not enabled on this Vercel project.`,
        },
        { status: 202 }
      );
    }

    return NextResponse.json({ gameId: game.id });
  } catch (err) {
    console.error("unhandled error in /api/games POST", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  await requireCoach();
  const list = await db.select().from(games).orderBy(games.playedAt).limit(50);
  return NextResponse.json({ games: list });
}
