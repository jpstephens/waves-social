import { AppShell } from "@/components/app-shell";
import { NewGameForm } from "./new-game-form";
import { requireCoach } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewGamePage() {
  await requireCoach();
  return (
    <AppShell subtitle="New Game">
      <div className="mx-auto max-w-2xl p-8">
        <h1 className="font-heading text-4xl text-white tracking-tight mb-1">
          NEW GAME
        </h1>
        <p className="text-navy-400 text-sm mb-8">
          Drop the box score PDF and a highlight clip. We&apos;ll handle the rest.
        </p>
        <NewGameForm />
      </div>
    </AppShell>
  );
}
