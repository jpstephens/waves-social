import { AppShell } from "@/components/app-shell";
import { requireCoach } from "@/lib/auth";
import { db, teams } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireCoach();
  const [team] = await db.select().from(teams).limit(1);

  return (
    <AppShell subtitle="Settings">
      <div className="mx-auto max-w-2xl p-8">
        <h1 className="font-heading text-4xl text-white tracking-tight mb-2">
          SETTINGS
        </h1>
        <p className="text-navy-400 text-sm mb-6">
          Team + brand. Inline editing ships in V1.
        </p>
        {team ? (
          <pre className="rounded-lg bg-navy-900 border border-navy-800 text-cyan-300 p-4 text-xs overflow-auto">
            {JSON.stringify(team, null, 2)}
          </pre>
        ) : (
          <p className="text-navy-400">
            No team seeded. Run <code className="text-cyan-400">npm run db:seed</code>.
          </p>
        )}
      </div>
    </AppShell>
  );
}
