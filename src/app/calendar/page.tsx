import { AppShell } from "@/components/app-shell";
import { requireCoach } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  await requireCoach();
  return (
    <AppShell subtitle="Content Calendar">
      <div className="mx-auto max-w-3xl p-8">
        <h1 className="font-heading text-4xl text-white tracking-tight mb-2">
          CALENDAR
        </h1>
        <p className="text-navy-400 text-sm">
          Scheduled posts will appear here once Buffer is connected.
        </p>
      </div>
    </AppShell>
  );
}
