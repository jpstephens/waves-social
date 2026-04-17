import { AppShell } from "@/components/app-shell";
import { requireCoach } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  await requireCoach();
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Templates</h1>
        <p className="text-sm text-slate-500">
          The MVP uses a single built-in Reels template (intro → clip → outro,
          overlay with player name + stat line). Multi-template UI ships in V2.
        </p>
      </div>
    </AppShell>
  );
}
