import { desc } from "drizzle-orm";
import { db, players } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { requireCoach } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  await requireCoach();
  const roster = await db
    .select()
    .from(players)
    .orderBy(desc(players.spotlightCount));

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Players</h1>
        <p className="text-sm text-slate-500 mb-6">
          Spotlight counts drive fair rotation across the season.
        </p>

        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="p-3 font-medium">Player</th>
                <th className="p-3 font-medium">#</th>
                <th className="p-3 font-medium">Position</th>
                <th className="p-3 font-medium text-right">Spotlights</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="p-3 text-slate-900 font-medium">
                    {p.firstName} {p.lastName ?? ""}
                  </td>
                  <td className="p-3 text-slate-500">{p.jerseyNumber ?? "—"}</td>
                  <td className="p-3 text-slate-500">{p.primaryPosition ?? "—"}</td>
                  <td className="p-3 text-right font-semibold text-slate-900">
                    {p.spotlightCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
