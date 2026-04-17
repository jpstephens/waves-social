import { notFound } from "next/navigation";
import { format } from "date-fns";
import { eq, asc } from "drizzle-orm";
import { db, games, highlights, players } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { ProposalReview } from "./proposal-review";
import { requireCoach } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function GamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCoach();
  const { id } = await params;

  const [game] = await db.select().from(games).where(eq(games.id, id));
  if (!game) notFound();

  const proposalRows = await db
    .select({ highlight: highlights, player: players })
    .from(highlights)
    .leftJoin(players, eq(highlights.playerId, players.id))
    .where(eq(highlights.gameId, id))
    .orderBy(asc(highlights.createdAt));

  const won =
    game.teamScore != null &&
    game.opponentScore != null &&
    game.teamScore > game.opponentScore;

  return (
    <AppShell subtitle={`vs ${game.opponent}`}>
      <div className="mx-auto max-w-4xl p-8">
        <div className="mb-8">
          <div className="text-cyan-400 text-xs uppercase tracking-[0.3em] font-bold">
            {format(game.playedAt, "EEEE, MMMM d, yyyy")}
          </div>
          <h1 className="font-heading text-4xl text-white tracking-tight mt-1">
            VS {game.opponent.toUpperCase()}
          </h1>
          {game.teamScore != null && game.opponentScore != null && (
            <div
              className={`font-heading text-3xl mt-2 ${won ? "text-cyan-400" : "text-navy-300"}`}
            >
              {won ? "W" : "L"} {game.teamScore}–{game.opponentScore}
            </div>
          )}
        </div>

        <ProposalReview
          gameId={id}
          initialProposals={proposalRows.map((r) => ({
            highlight: r.highlight,
            playerName: r.player
              ? `${r.player.firstName} ${r.player.lastName ?? ""}`.trim()
              : (r.highlight.playerNameRaw ?? "Unknown"),
            jerseyNumber: r.player?.jerseyNumber ?? r.highlight.jerseyNumber,
          }))}
        />
      </div>
    </AppShell>
  );
}
