import { NextRequest, NextResponse } from "next/server";
import { requireCoach } from "@/lib/auth";
import { db, games, teams } from "@/lib/db";
import { eq } from "drizzle-orm";
import { uploadToBlob } from "@/lib/blob";
import { processGame } from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  await requireCoach();

  const form = await req.formData();
  const pdf = form.get("pdf");
  const clip = form.get("clip");
  const photosEntries = form.getAll("photos");
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

  const pdfUpload = await uploadToBlob({
    file: pdf,
    prefix: `games/${team.id}/pdf`,
  });

  const clipUrls: string[] = [];
  if (clip instanceof File && clip.size > 0) {
    const up = await uploadToBlob({
      file: clip,
      prefix: `games/${team.id}/clips`,
    });
    clipUrls.push(up.url);
  }

  const photoUrls: string[] = [];
  for (const entry of photosEntries) {
    if (entry instanceof File && entry.size > 0) {
      const up = await uploadToBlob({
        file: entry,
        prefix: `games/${team.id}/photos`,
      });
      photoUrls.push(up.url);
    }
  }

  const [game] = await db
    .insert(games)
    .values({
      teamId: team.id,
      opponent,
      playedAt: new Date(playedAt),
      boxScorePdfUrl: pdfUpload.url,
      clipUrls,
      photoUrls,
      notes,
    })
    .returning();

  // Kick off pipeline. Runs inline because we're on Fluid Compute (300s limit).
  try {
    await processGame(game.id);
  } catch (err) {
    console.error("pipeline failed", err);
    return NextResponse.json(
      {
        gameId: game.id,
        warning: "pipeline failed — game created but highlights not generated",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 202 }
    );
  }

  return NextResponse.json({ gameId: game.id });
}

export async function GET() {
  await requireCoach();
  const list = await db
    .select()
    .from(games)
    .orderBy(games.playedAt)
    .limit(50);
  return NextResponse.json({ games: list });
}
