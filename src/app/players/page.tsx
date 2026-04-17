import { asc } from "drizzle-orm";
import { db, players } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { requireCoach } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  await requireCoach();
  const roster = await db
    .select()
    .from(players)
    .orderBy(asc(players.jerseyNumber));

  return (
    <AppShell subtitle="Roster">
      <div className="mx-auto max-w-3xl p-8">
        <div className="mb-6">
          <h1 className="font-heading text-4xl text-white tracking-tight">
            ROSTER
          </h1>
          <p className="text-navy-400 text-sm mt-1">
            Spotlight counts drive fair rotation across the season.
          </p>
        </div>

        <ul className="space-y-2">
          {roster.map((p) => {
            const isPitcher = p.primaryPosition === "P";
            return (
              <li
                key={p.id}
                className="bg-navy-900 border border-navy-800 rounded-lg p-3 flex items-center gap-3"
              >
                <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-navy-700 to-navy-900 border-2 border-navy-700 flex items-center justify-center flex-shrink-0">
                  <span
                    className="text-white font-black text-base italic"
                    style={{ fontFamily: "Georgia, serif" }}
                  >
                    {p.jerseyNumber ?? "—"}
                  </span>
                  {isPitcher && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-cyan-400 rounded-full flex items-center justify-center">
                      <span className="text-navy-950 text-[9px] font-black">
                        P
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-white font-bold text-base leading-tight">
                    {p.firstName} {p.lastName ?? ""}
                  </div>
                  <div className="text-navy-400 text-xs uppercase tracking-wider mt-0.5">
                    {p.spotlightCount} spotlight
                    {p.spotlightCount === 1 ? "" : "s"}
                    {p.primaryPosition ? ` · ${p.primaryPosition}` : ""}
                  </div>
                </div>

                <div className="font-heading text-2xl text-cyan-400">
                  {p.spotlightCount}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </AppShell>
  );
}
