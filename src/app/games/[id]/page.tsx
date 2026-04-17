import { notFound } from "next/navigation";
import { format } from "date-fns";
import { eq } from "drizzle-orm";
import { db, games, highlights, posts } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { PostReview } from "./post-review";
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

  const postList = await db
    .select({ post: posts, highlight: highlights })
    .from(posts)
    .leftJoin(highlights, eq(posts.highlightId, highlights.id))
    .where(eq(posts.gameId, id));

  const won =
    game.teamScore != null &&
    game.opponentScore != null &&
    game.teamScore > game.opponentScore;

  return (
    <AppShell subtitle={`vs ${game.opponent}`}>
      <div className="mx-auto max-w-5xl p-8">
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

        {postList.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-navy-800 bg-navy-900/50 p-12 text-center text-navy-400 uppercase tracking-wider">
            No highlights generated yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {postList.map(({ post, highlight }) => (
              <PostReview
                key={post.id}
                initialPost={post}
                highlight={highlight}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
