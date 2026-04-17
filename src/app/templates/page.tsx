import { AppShell } from "@/components/app-shell";
import { requireCoach } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  await requireCoach();
  return (
    <AppShell subtitle="Templates">
      <div className="mx-auto max-w-3xl p-8">
        <h1 className="font-heading text-4xl text-white tracking-tight mb-2">
          TEMPLATES
        </h1>
        <p className="text-navy-400 text-sm">
          MVP uses a built-in 9:16 Reels template (intro → clip → outro). Image
          + multi-template UI lands next.
        </p>
      </div>
    </AppShell>
  );
}
