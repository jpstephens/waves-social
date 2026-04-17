import { notFound } from "next/navigation";
import { eq, asc, and } from "drizzle-orm";
import { db, games, highlights, players } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { requireCoach } from "@/lib/auth";
import { MediaUploader } from "./media-uploader";

export const dynamic = "force-dynamic";

export default async function GameMediaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCoach();
  const { id } = await params;

  const [game] = await db.select().from(games).where(eq(games.id, id));
  if (!game) notFound();

  const rows = await db
    .select({ highlight: highlights, player: players })
    .from(highlights)
    .leftJoin(players, eq(highlights.playerId, players.id))
    .where(
      and(eq(highlights.gameId, id), eq(highlights.status, "selected"))
    )
    .orderBy(asc(highlights.createdAt));

  return (
    <AppShell subtitle={`Media · vs ${game.opponent}`}>
      <div className="mx-auto max-w-4xl p-8">
        <h1 className="font-heading text-4xl text-white tracking-tight mb-1">
          ATTACH MEDIA
        </h1>
        <p className="text-navy-400 text-sm mb-8">
          Drop a photo of each player. We&apos;ll generate a branded background
          with Nano Banana, then composite the photo + stats + Waves logo on top
          — your photo is never altered by AI.
        </p>

        {rows.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-navy-800 bg-navy-900/50 p-12 text-center text-navy-400 uppercase tracking-wider text-sm">
            No selected highlights yet — go back and pick some on the previous
            screen.
          </div>
        ) : (
          <ul className="space-y-4">
            {rows.map((r) => (
              <MediaUploader
                key={r.highlight.id}
                highlight={r.highlight}
                playerName={
                  r.player
                    ? `${r.player.firstName} ${r.player.lastName ?? ""}`.trim()
                    : (r.highlight.playerNameRaw ?? "Unknown")
                }
                jerseyNumber={
                  r.player?.jerseyNumber ?? r.highlight.jerseyNumber
                }
              />
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
