"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  addDays,
  addMonths,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  CalendarClock,
  X,
  Loader2,
} from "lucide-react";

export type PostItem = {
  id: string;
  caption: string;
  imageUrl: string | null;
  status: string;
  scheduledAt: string | null;
  playerName: string;
  jerseyNumber: number | null;
  kind: string;
  headline: string;
};

const SLOT_START_HOUR = 6; // 6:00 AM
const SLOT_END_HOUR = 23; // 11:00 PM (exclusive upper — last slot is 10:30 PM)
const SLOT_MINUTES = 30;

function buildSlots(day: Date): Date[] {
  const slots: Date[] = [];
  const base = new Date(day);
  base.setHours(SLOT_START_HOUR, 0, 0, 0);
  for (
    let m = 0;
    m < (SLOT_END_HOUR - SLOT_START_HOUR) * 60;
    m += SLOT_MINUTES
  ) {
    slots.push(new Date(base.getTime() + m * 60 * 1000));
  }
  return slots;
}

export function CalendarView({
  monthStart,
  scheduled,
  drafts,
}: {
  monthStart: string;
  scheduled: PostItem[];
  drafts: PostItem[];
}) {
  const router = useRouter();
  const month = useMemo(() => new Date(monthStart), [monthStart]);
  const today = useMemo(() => new Date(), []);
  const [selectedDay, setSelectedDay] = useState<Date>(() => {
    // Pick today if it's in this month, else first of month
    if (isSameMonth(today, month)) return new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return new Date(month);
  });
  const [pickerOpen, setPickerOpen] = useState<{ slot: Date } | null>(null);
  const [actionChip, setActionChip] = useState<{ post: PostItem } | null>(null);
  const [busy, setBusy] = useState(false);

  const goMonth = (delta: number) => {
    const next = addMonths(month, delta);
    router.push(`/calendar?month=${format(next, "yyyy-MM")}`);
  };
  const goToday = () => {
    router.push(`/calendar?month=${format(today, "yyyy-MM")}`);
  };

  // Build 6-week grid
  const gridDays = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [month]);

  const scheduledByDay = useMemo(() => {
    const map = new Map<string, PostItem[]>();
    for (const p of scheduled) {
      if (!p.scheduledAt) continue;
      const d = new Date(p.scheduledAt);
      const key = format(d, "yyyy-MM-dd");
      const list = map.get(key) ?? [];
      list.push(p);
      map.set(key, list);
    }
    return map;
  }, [scheduled]);

  const selectedKey = format(selectedDay, "yyyy-MM-dd");
  const selectedDayPosts = scheduledByDay.get(selectedKey) ?? [];
  const slots = useMemo(() => buildSlots(selectedDay), [selectedDay]);

  // Find which slot (if any) each post falls into
  const postBySlot = useMemo(() => {
    const map = new Map<string, PostItem>();
    for (const p of selectedDayPosts) {
      if (!p.scheduledAt) continue;
      const d = new Date(p.scheduledAt);
      const slotMinutes =
        (d.getHours() - SLOT_START_HOUR) * 60 + d.getMinutes();
      const slotIdx = Math.floor(slotMinutes / SLOT_MINUTES);
      if (slotIdx < 0 || slotIdx >= slots.length) continue;
      map.set(format(slots[slotIdx], "HH:mm"), p);
    }
    return map;
  }, [selectedDayPosts, slots]);

  const schedulePost = useCallback(
    async (postId: string, when: Date) => {
      setBusy(true);
      try {
        const res = await fetch(`/api/posts/${postId}/publish`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ scheduledAt: when.toISOString() }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`);
        if (json.warning === "buffer_not_configured") {
          toast.warning("Scheduled locally (Buffer not configured)");
        } else {
          toast.success(`Scheduled for ${format(when, "MMM d, h:mm a")}`);
        }
        setPickerOpen(null);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Schedule failed");
      } finally {
        setBusy(false);
      }
    },
    [router]
  );

  const unschedulePost = useCallback(
    async (postId: string) => {
      setBusy(true);
      try {
        const res = await fetch(`/api/posts/${postId}/unschedule`, {
          method: "POST",
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`);
        toast.success("Unscheduled");
        setActionChip(null);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unschedule failed");
      } finally {
        setBusy(false);
      }
    },
    [router]
  );

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-4xl text-white tracking-tight">
          CALENDAR
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => goMonth(-1)}
            className="rounded-lg border border-navy-700 text-navy-300 hover:text-cyan-400 hover:border-cyan-400 p-2"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-white font-bold uppercase tracking-wider text-sm min-w-[140px] text-center">
            {format(month, "MMMM yyyy")}
          </div>
          <button
            onClick={() => goMonth(1)}
            className="rounded-lg border border-navy-700 text-navy-300 hover:text-cyan-400 hover:border-cyan-400 p-2"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={goToday}
            className="ml-2 rounded-lg border border-navy-700 text-navy-300 hover:text-cyan-400 hover:border-cyan-400 px-3 py-2 text-xs uppercase tracking-wider font-bold"
          >
            Today
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_360px] gap-6">
        {/* Monthly grid */}
        <div className="rounded-xl border-2 border-navy-800 bg-navy-900 p-3">
          <div className="grid grid-cols-7 text-center text-[10px] uppercase tracking-wider text-navy-500 font-bold mb-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 grid-rows-6 gap-1">
            {gridDays.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const posts = scheduledByDay.get(key) ?? [];
              const inMonth = isSameMonth(day, month);
              const isSelected = isSameDay(day, selectedDay);
              const isToday = isSameDay(day, today);
              return (
                <button
                  key={key}
                  onClick={() => setSelectedDay(day)}
                  className={`relative aspect-square rounded-lg border text-left p-2 transition-colors ${
                    isSelected
                      ? "border-cyan-400 bg-cyan-400/10"
                      : "border-navy-800 hover:border-navy-700"
                  } ${inMonth ? "bg-navy-950" : "bg-navy-950/30"}`}
                >
                  <div
                    className={`text-xs font-bold ${
                      isToday
                        ? "text-cyan-400"
                        : inMonth
                        ? "text-white"
                        : "text-navy-600"
                    }`}
                  >
                    {format(day, "d")}
                  </div>
                  {posts.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-0.5">
                      {posts.slice(0, 4).map((p) => (
                        <span
                          key={p.id}
                          className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-400"
                        />
                      ))}
                      {posts.length > 4 && (
                        <span className="text-[9px] text-cyan-400 font-bold">
                          +{posts.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sidebar: daily hourly slots + drafts */}
        <div className="space-y-4">
          <div className="rounded-xl border-2 border-navy-800 bg-navy-900 p-4">
            <div className="text-white font-bold uppercase tracking-wider text-sm mb-3">
              {format(selectedDay, "EEEE, MMM d")}
            </div>
            <div className="max-h-[560px] overflow-y-auto divide-y divide-navy-800/60 border-t border-navy-800/60">
              {slots.map((slot) => {
                const label = format(slot, "h:mm a");
                const key = format(slot, "HH:mm");
                const post = postBySlot.get(key);
                const isHourTop = slot.getMinutes() === 0;
                return (
                  <div
                    key={key}
                    className={`flex items-center gap-2 py-1.5 text-xs ${
                      isHourTop ? "" : "pl-6"
                    }`}
                  >
                    <div
                      className={`w-14 flex-shrink-0 font-mono ${
                        isHourTop ? "text-navy-300" : "text-navy-600"
                      }`}
                    >
                      {isHourTop ? label : format(slot, ":mm")}
                    </div>
                    {post ? (
                      <button
                        onClick={() => setActionChip({ post })}
                        className="flex-1 flex items-center gap-2 rounded-lg bg-cyan-400/10 border border-cyan-400/30 px-2 py-1.5 hover:bg-cyan-400/20"
                      >
                        {post.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={post.imageUrl}
                            alt=""
                            className="h-8 w-6 object-cover rounded"
                          />
                        )}
                        <div className="min-w-0 flex-1 text-left">
                          <div className="text-cyan-300 text-[11px] font-bold truncate">
                            #{post.jerseyNumber ?? "—"} {post.playerName}
                          </div>
                          <div className="text-navy-400 text-[10px] truncate">
                            {post.headline}
                          </div>
                        </div>
                      </button>
                    ) : (
                      <button
                        onClick={() => setPickerOpen({ slot })}
                        disabled={drafts.length === 0}
                        className="flex-1 rounded-lg border border-dashed border-navy-800 hover:border-cyan-400/50 text-navy-600 hover:text-cyan-400 py-1.5 text-[10px] uppercase tracking-wider disabled:opacity-30"
                      >
                        {drafts.length === 0 ? "—" : "+ Schedule"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Drafts */}
          <div className="rounded-xl border-2 border-navy-800 bg-navy-900 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-white font-bold uppercase tracking-wider text-sm">
                Approved · unscheduled
              </div>
              <span className="text-[10px] text-navy-500 font-mono">
                {drafts.length}
              </span>
            </div>
            {drafts.length === 0 ? (
              <div className="text-navy-500 text-xs text-center py-4">
                Approve a post from a game to see it here.
              </div>
            ) : (
              <ul className="space-y-2 max-h-[260px] overflow-y-auto">
                {drafts.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-2 rounded-lg border border-navy-800 bg-navy-950 p-2"
                  >
                    {p.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.imageUrl}
                        alt=""
                        className="h-10 w-[30px] object-cover rounded flex-shrink-0"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-white text-[11px] font-bold truncate">
                        #{p.jerseyNumber ?? "—"} {p.playerName}
                      </div>
                      <div className="text-navy-400 text-[10px] truncate">
                        {p.headline}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Pick-a-draft dialog when a slot is clicked */}
      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setPickerOpen(null)}
        >
          <div
            className="bg-navy-900 border-2 border-navy-800 rounded-2xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-white font-bold text-lg">
                  Schedule a post
                </div>
                <div className="text-navy-400 text-xs">
                  {format(pickerOpen.slot, "EEE, MMM d · h:mm a")}
                </div>
              </div>
              <button
                onClick={() => setPickerOpen(null)}
                className="text-navy-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {drafts.length === 0 ? (
              <div className="text-navy-400 text-sm text-center py-6">
                No approved posts available.
              </div>
            ) : (
              <ul className="space-y-2 max-h-[400px] overflow-y-auto">
                {drafts.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => schedulePost(p.id, pickerOpen.slot)}
                      disabled={busy}
                      className="w-full flex items-center gap-3 rounded-lg border border-navy-800 bg-navy-950 p-2 hover:border-cyan-400 hover:bg-cyan-400/5 disabled:opacity-50 text-left"
                    >
                      {p.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.imageUrl}
                          alt=""
                          className="h-14 w-[42px] object-cover rounded flex-shrink-0"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-white text-sm font-bold truncate">
                          #{p.jerseyNumber ?? "—"} {p.playerName}
                        </div>
                        <div className="text-navy-400 text-xs truncate">
                          {p.headline}
                        </div>
                      </div>
                      {busy && (
                        <Loader2 className="h-4 w-4 text-cyan-400 animate-spin" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Scheduled chip popover */}
      {actionChip && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setActionChip(null)}
        >
          <div
            className="bg-navy-900 border-2 border-navy-800 rounded-2xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-white font-bold text-lg">
                  #{actionChip.post.jerseyNumber ?? "—"}{" "}
                  {actionChip.post.playerName}
                </div>
                <div className="text-navy-400 text-xs">
                  {actionChip.post.scheduledAt &&
                    format(
                      new Date(actionChip.post.scheduledAt),
                      "EEE, MMM d · h:mm a"
                    )}
                </div>
              </div>
              <button
                onClick={() => setActionChip(null)}
                className="text-navy-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {actionChip.post.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={actionChip.post.imageUrl}
                alt=""
                className="w-full aspect-[9/16] object-cover rounded-lg mb-3"
              />
            )}
            {actionChip.post.caption && (
              <p className="text-navy-300 text-sm whitespace-pre-wrap mb-4">
                {actionChip.post.caption}
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => unschedulePost(actionChip.post.id)}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-lg border border-navy-700 text-navy-300 hover:border-red-400 hover:text-red-400 px-3 py-2 text-xs uppercase tracking-wider font-bold disabled:opacity-30"
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <CalendarClock className="h-3.5 w-3.5" />
                Unschedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
