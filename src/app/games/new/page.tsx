import { AppShell } from "@/components/app-shell";
import { NewGameForm } from "./new-game-form";
import { requireCoach } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewGamePage() {
  await requireCoach();
  return (
    <AppShell>
      <div className="mx-auto max-w-2xl p-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">New Game</h1>
        <p className="text-sm text-slate-500 mb-6">
          Drop in the box score PDF and a highlight clip. We&apos;ll handle the rest.
        </p>
        <NewGameForm />
      </div>
    </AppShell>
  );
}
