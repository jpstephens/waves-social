import { and, eq, gte, lt, isNull, isNotNull, desc, asc, inArray } from "drizzle-orm";
import { AppShell } from "@/components/app-shell";
import { requireCoach } from "@/lib/auth";
import { db, posts, highlights, players } from "@/lib/db";
import { CalendarView } from "./calendar-view";

export const dynamic = "force-dynamic";

function parseMonth(value: string | undefined): Date {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const [y, m] = value.split("-").map(Number);
    return new Date(y, m - 1, 1);
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await requireCoach();
  const sp = await searchParams;
  const monthStart = parseMonth(sp.month);
  const monthEnd = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() + 1,
    1
  );

  // Scheduled posts for this month — join highlight + player for chips.
  const scheduledRows = await db
    .select({ post: posts, highlight: highlights, player: players })
    .from(posts)
    .leftJoin(highlights, eq(posts.highlightId, highlights.id))
    .leftJoin(players, eq(highlights.playerId, players.id))
    .where(
      and(
        isNotNull(posts.scheduledAt),
        gte(posts.scheduledAt, monthStart),
        lt(posts.scheduledAt, monthEnd)
      )
    )
    .orderBy(asc(posts.scheduledAt));

  // Approved, unscheduled posts (the drafts drawer).
  const draftRows = await db
    .select({ post: posts, highlight: highlights, player: players })
    .from(posts)
    .leftJoin(highlights, eq(posts.highlightId, highlights.id))
    .leftJoin(players, eq(highlights.playerId, players.id))
    .where(and(eq(posts.status, "approved"), isNull(posts.scheduledAt)))
    .orderBy(desc(posts.updatedAt));

  const toItem = (r: (typeof scheduledRows)[number]) => ({
    id: r.post.id,
    caption: r.post.caption ?? "",
    imageUrl: r.post.outputImageUrl ?? r.post.outputVideoUrl ?? null,
    status: r.post.status,
    scheduledAt: r.post.scheduledAt ? r.post.scheduledAt.toISOString() : null,
    playerName: r.player
      ? `${r.player.firstName} ${r.player.lastName ?? ""}`.trim()
      : (r.highlight?.playerNameRaw ?? "Unknown"),
    jerseyNumber: r.player?.jerseyNumber ?? r.highlight?.jerseyNumber ?? null,
    kind: r.highlight?.kind ?? "",
    headline: r.highlight?.headline ?? "",
  });

  return (
    <AppShell subtitle="Content Calendar">
      <CalendarView
        monthStart={monthStart.toISOString()}
        scheduled={scheduledRows.map(toItem)}
        drafts={draftRows.map(toItem)}
      />
    </AppShell>
  );
}
