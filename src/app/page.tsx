import Link from "next/link";
import { format } from "date-fns";
import { desc } from "drizzle-orm";
import { db, games } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { buttonVariants } from "@/components/ui/button";
import { requireCoach } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await requireCoach();
  const list = await db.select().from(games).orderBy(desc(games.playedAt)).limit(50);

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Games</h1>
            <p className="text-sm text-slate-500">
              Upload a post-game bundle to generate highlights.
            </p>
          </div>
          <Link href="/games/new" className={buttonVariants()}>
            + New Game
          </Link>
        </div>

        {list.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <p className="text-slate-500 mb-4">No games yet.</p>
            <Link href="/games/new" className={buttonVariants()}>
              Upload your first box score
            </Link>
          </div>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {list.map((g) => (
              <li key={g.id}>
                <Link
                  href={`/games/${g.id}`}
                  className="block rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-400 transition"
                >
                  <div className="flex items-baseline justify-between">
                    <div className="text-sm text-slate-500">
                      {format(g.playedAt, "EEE MMM d, yyyy")}
                    </div>
                    <div className="text-sm font-semibold text-slate-700">
                      {g.teamScore ?? "—"}–{g.opponentScore ?? "—"}
                    </div>
                  </div>
                  <div className="mt-2 text-lg font-semibold text-slate-900">
                    vs {g.opponent}
                  </div>
                  <div className="mt-3 flex gap-4 text-xs text-slate-500">
                    <span>{g.clipUrls.length} clips</span>
                    <span>{g.photoUrls.length} photos</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
