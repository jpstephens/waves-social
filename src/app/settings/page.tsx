import { AppShell } from "@/components/app-shell";
import { requireCoach } from "@/lib/auth";
import { db, teams } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireCoach();
  const [team] = await db.select().from(teams).limit(1);

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl p-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Settings</h1>
        <p className="text-sm text-slate-500 mb-6">
          Team + brand configuration. (Edit fields via seed script or DB for
          now; inline editing ships in V1.)
        </p>
        {team ? (
          <pre className="rounded-lg bg-slate-900 text-slate-100 p-4 text-xs overflow-auto">
            {JSON.stringify(team, null, 2)}
          </pre>
        ) : (
          <p className="text-slate-500">
            No team seeded. Run <code>npm run db:seed</code>.
          </p>
        )}
      </div>
    </AppShell>
  );
}
