import Link from "next/link";
import { format } from "date-fns";
import { desc } from "drizzle-orm";
import { db, games } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { requireCoach } from "@/lib/auth";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await requireCoach();
  const list = await db
    .select()
    .from(games)
    .orderBy(desc(games.playedAt))
    .limit(50);

  return (
    <AppShell subtitle="Recent Games">
      <div className="mx-auto max-w-5xl p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading text-4xl text-white tracking-tight">
              GAMES
            </h1>
            <p className="text-navy-400 text-sm mt-1">
              Drop a box score, generate the highlights.
            </p>
          </div>
          <Link
            href="/games/new"
            className="inline-flex items-center gap-2 bg-cyan-400 text-navy-950 px-5 py-3 rounded-lg font-heading text-sm uppercase tracking-wider hover:bg-cyan-300 active:bg-cyan-500 transition"
          >
            <Plus className="h-4 w-4" />
            New Game
          </Link>
        </div>

        {list.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-navy-800 bg-navy-900/50 p-16 text-center">
            <div className="text-cyan-400 uppercase tracking-[0.3em] text-xs font-bold mb-3">
              No games yet
            </div>
            <p className="text-navy-400 mb-6">
              Upload your first box score to get started.
            </p>
            <Link
              href="/games/new"
              className="inline-flex items-center gap-2 bg-cyan-400 text-navy-950 px-5 py-3 rounded-lg font-heading text-sm uppercase tracking-wider hover:bg-cyan-300 transition"
            >
              <Plus className="h-4 w-4" />
              Upload Box Score
            </Link>
          </div>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {list.map((g) => {
              const won =
                g.teamScore != null &&
                g.opponentScore != null &&
                g.teamScore > g.opponentScore;
              return (
                <li key={g.id}>
                  <Link
                    href={`/games/${g.id}`}
                    className="block rounded-xl border border-navy-800 bg-navy-900 p-5 hover:border-cyan-400/50 hover:bg-navy-800/50 transition"
                  >
                    <div className="flex items-baseline justify-between mb-2">
                      <div className="text-navy-400 text-xs uppercase tracking-wider">
                        {format(g.playedAt, "EEE MMM d, yyyy")}
                      </div>
                      {g.teamScore != null && g.opponentScore != null && (
                        <div
                          className={`font-heading text-lg ${won ? "text-cyan-400" : "text-navy-300"}`}
                        >
                          {g.teamScore}–{g.opponentScore}
                        </div>
                      )}
                    </div>
                    <div className="text-white font-bold text-lg">
                      vs {g.opponent}
                    </div>
                    <div className="mt-3 flex gap-4 text-xs text-navy-400 uppercase tracking-wider">
                      <span>{g.clipUrls.length} clips</span>
                      <span>{g.photoUrls.length} photos</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
