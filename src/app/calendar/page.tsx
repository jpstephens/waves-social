import { AppShell } from "@/components/app-shell";
import { requireCoach } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  await requireCoach();
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Content calendar</h1>
        <p className="text-sm text-slate-500">
          Scheduled posts will appear here once Buffer is connected (V1).
        </p>
      </div>
    </AppShell>
  );
}
