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
    .select({
      post: posts,
      highlight: highlights,
    })
    .from(posts)
    .leftJoin(highlights, eq(posts.highlightId, highlights.id))
    .where(eq(posts.gameId, id));

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl p-8">
        <div className="mb-6">
          <div className="text-sm text-slate-500">
            {format(game.playedAt, "EEEE, MMMM d, yyyy")}
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            vs {game.opponent}{" "}
            {game.teamScore != null && game.opponentScore != null && (
              <span className="text-slate-500 font-normal">
                — {game.teamScore}&ndash;{game.opponentScore}
              </span>
            )}
          </h1>
        </div>

        {postList.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
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
