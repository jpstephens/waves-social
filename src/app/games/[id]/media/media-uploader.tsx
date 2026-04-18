"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import {
  Loader2,
  RefreshCcw,
  UploadCloud,
  Download,
  Check,
  CalendarClock,
  Maximize2,
  X,
} from "lucide-react";
import type { Highlight, Post, PostFormat } from "@/lib/db/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const KIND_LABEL: Record<string, string> = {
  extra_base_hit: "Extra-base hit",
  rbi: "RBI",
  at_bat: "At bat",
  pitching: "Pitching",
  stolen_base: "Steal",
  effort: "Effort",
  milestone: "Milestone",
  teamwork: "Teamwork",
};

const FORMATS: { id: PostFormat; label: string; aspect: string; ratio: string }[] = [
  { id: "feed", label: "Feed", aspect: "aspect-[4/5]", ratio: "4:5" },
  { id: "square", label: "Square", aspect: "aspect-square", ratio: "1:1" },
  { id: "story", label: "Story", aspect: "aspect-[9/16]", ratio: "9:16" },
];

type PostLite = Pick<
  Post,
  "id" | "status" | "caption" | "outputImages" | "publishFormat"
> | null;

type FormatUrls = Partial<Record<PostFormat, string>>;

export function MediaUploader({
  highlight,
  post,
  playerName,
  jerseyNumber,
}: {
  highlight: Highlight;
  post: Post | null;
  playerName: string;
  jerseyNumber: number | null;
}) {
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<FormatUrls>(
    highlight.generatedImages ?? {}
  );
  const [postState, setPostState] = useState<PostLite>(
    post
      ? {
          id: post.id,
          status: post.status,
          caption: post.caption,
          outputImages: post.outputImages,
          publishFormat: post.publishFormat,
        }
      : null
  );
  const [caption, setCaption] = useState<string>(
    post?.caption ?? highlight.caption ?? ""
  );
  const [savingCaption, setSavingCaption] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleValue, setScheduleValue] = useState<string>(defaultScheduleValue());
  const [scheduleFormat, setScheduleFormat] = useState<PostFormat>(
    post?.publishFormat ?? "feed"
  );
  const [publishing, setPublishing] = useState(false);
  const [fullscreen, setFullscreen] = useState<PostFormat | null>(null);

  const onDrop = useCallback((files: File[]) => {
    if (files[0]) setPhotoFile(files[0]);
  }, []);

  const dropzone = useDropzone({
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp"] },
    maxFiles: 1,
    onDrop,
  });

  const hasAny = Object.keys(generatedImages).length > 0;

  const generate = useCallback(
    async (regenerateBackground = false) => {
      if (!photoFile) {
        toast.error(
          hasAny
            ? "Re-drop the photo to re-render"
            : "Drop a photo first"
        );
        return;
      }
      setGenerating(true);
      try {
        const fd = new FormData();
        fd.set("photo", photoFile);
        if (regenerateBackground) fd.set("regenerateBackground", "true");

        const res = await fetch(`/api/highlights/${highlight.id}/media`, {
          method: "POST",
          body: fd,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`);

        setGeneratedImages(json.generatedImages ?? {});
        if (json.postId) {
          setPostState((prev) => ({
            id: json.postId,
            status: prev?.status ?? "draft",
            caption: prev?.caption ?? caption,
            outputImages: json.generatedImages ?? {},
            publishFormat: prev?.publishFormat ?? "feed",
          }));
        }
        const sources = (json.backgroundSources ?? {}) as Partial<
          Record<PostFormat, "ai" | "template" | "cached">
        >;
        const templateFormats = (Object.keys(sources) as PostFormat[]).filter(
          (k) => sources[k] === "template"
        );
        if (templateFormats.length > 0) {
          toast.warning(
            `AI background unavailable for: ${templateFormats.join(", ")} — used static templates`
          );
        } else {
          toast.success(
            regenerateBackground
              ? "Re-rolled backgrounds"
              : "Generated 3 formats"
          );
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Generation failed");
      } finally {
        setGenerating(false);
      }
    },
    [photoFile, highlight.id, hasAny, caption]
  );

  const captionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!postState?.id) return;
    if (caption === (postState.caption ?? "")) return;
    if (captionTimer.current) clearTimeout(captionTimer.current);
    captionTimer.current = setTimeout(async () => {
      setSavingCaption(true);
      try {
        const res = await fetch(`/api/posts/${postState.id}/caption`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ caption }),
        });
        if (!res.ok) throw new Error(`Save failed (${res.status})`);
        setPostState((p) => (p ? { ...p, caption } : p));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Caption save failed");
      } finally {
        setSavingCaption(false);
      }
    }, 800);
    return () => {
      if (captionTimer.current) clearTimeout(captionTimer.current);
    };
  }, [caption, postState?.id, postState?.caption]);

  const approve = useCallback(async () => {
    if (!postState?.id) return;
    try {
      const res = await fetch(`/api/posts/${postState.id}/approve`, {
        method: "POST",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Approve failed (${res.status})`);
      }
      setPostState((p) => (p ? { ...p, status: "approved" } : p));
      toast.success("Approved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Approve failed");
    }
  }, [postState?.id]);

  const schedule = useCallback(async () => {
    if (!postState?.id) return;
    setPublishing(true);
    try {
      const scheduledAt = new Date(scheduleValue);
      if (isNaN(scheduledAt.getTime())) throw new Error("Invalid date/time");
      if (scheduledAt.getTime() < Date.now() - 60_000) {
        throw new Error("Pick a future time");
      }
      const res = await fetch(`/api/posts/${postState.id}/publish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scheduledAt: scheduledAt.toISOString(),
          format: scheduleFormat,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `Schedule failed (${res.status})`);
      setPostState((p) =>
        p ? { ...p, status: "scheduled", publishFormat: scheduleFormat } : p
      );
      setScheduleOpen(false);
      toast.success(
        `Scheduled ${scheduleFormat} for ${scheduledAt.toLocaleString()}`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Schedule failed");
    } finally {
      setPublishing(false);
    }
  }, [postState?.id, scheduleValue, scheduleFormat]);

  const status = postState?.status ?? "draft";
  const canApprove = Boolean(postState?.id) && hasAny && status === "draft";
  const canSchedule = Boolean(postState?.id) && status === "approved";

  return (
    <li className="rounded-xl border-2 border-navy-800 bg-navy-900 p-4">
      <div className="flex gap-4">
        {/* Left: highlight info + photo dropzone + caption + actions */}
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-navy-700 to-navy-900 border-2 border-navy-700 flex items-center justify-center flex-shrink-0">
              <span
                className="text-white font-black text-base italic"
                style={{ fontFamily: "Georgia, serif" }}
              >
                {jerseyNumber ?? "—"}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-white font-bold text-base truncate">
                {playerName}
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-cyan-400 uppercase tracking-[0.2em] font-bold bg-cyan-400/10 px-2 py-0.5 rounded">
                  {KIND_LABEL[highlight.kind] ?? highlight.kind}
                </span>
                <span className="text-navy-300 font-mono">
                  {highlight.statLine}
                </span>
              </div>
            </div>
            <StatusChip status={status} hasPost={Boolean(postState?.id)} />
          </div>

          <div className="font-heading text-lg text-white tracking-tight">
            {highlight.headline}
          </div>

          <div
            {...dropzone.getRootProps()}
            className="rounded-lg border-2 border-dashed border-navy-800 hover:border-cyan-400/50 p-4 cursor-pointer bg-navy-950 transition-colors"
          >
            <input {...dropzone.getInputProps()} />
            {photoFile ? (
              <div className="text-white text-sm flex items-center gap-2">
                <UploadCloud className="h-4 w-4 text-cyan-400" />
                {photoFile.name}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1 text-navy-400 py-2">
                <UploadCloud className="h-5 w-5" />
                <span className="text-[11px] uppercase tracking-wider">
                  Drop player photo
                </span>
              </div>
            )}
          </div>

          {postState?.id && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] uppercase tracking-wider text-navy-400">
                  Caption
                </label>
                {savingCaption && (
                  <span className="text-[10px] text-navy-500 flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Saving…
                  </span>
                )}
              </div>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={3}
                placeholder="Write a caption for Instagram…"
                className="w-full rounded-lg bg-navy-950 border border-navy-800 text-white text-sm p-2 focus:border-cyan-400/60 focus:outline-none resize-y"
              />
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => generate(false)}
              disabled={generating || !photoFile}
              title={!photoFile ? "Drop a photo to (re-)generate" : ""}
              className="inline-flex items-center text-xs uppercase tracking-wider font-bold px-3 py-2 rounded-lg bg-cyan-400 text-navy-950 hover:bg-cyan-300 disabled:opacity-30"
            >
              {generating ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : null}
              {hasAny ? "Re-render all" : "Generate"}
            </button>
            {hasAny && (
              <button
                onClick={() => generate(true)}
                disabled={generating || !photoFile}
                title={!photoFile ? "Re-drop the photo to re-roll" : ""}
                className="inline-flex items-center text-xs uppercase tracking-wider font-bold px-3 py-2 rounded-lg border border-navy-700 text-navy-300 hover:border-cyan-400 hover:text-cyan-400 disabled:opacity-30"
              >
                <RefreshCcw className="h-3.5 w-3.5 mr-1" />
                New backgrounds
              </button>
            )}
            <button
              onClick={approve}
              disabled={!canApprove}
              className="inline-flex items-center text-xs uppercase tracking-wider font-bold px-3 py-2 rounded-lg border border-cyan-400/40 text-cyan-400 hover:bg-cyan-400/10 disabled:opacity-30"
            >
              <Check className="h-3.5 w-3.5 mr-1" />
              Approve
            </button>
            <button
              onClick={() => setScheduleOpen(true)}
              disabled={!canSchedule}
              className="inline-flex items-center text-xs uppercase tracking-wider font-bold px-3 py-2 rounded-lg border border-navy-700 text-navy-300 hover:border-cyan-400 hover:text-cyan-400 disabled:opacity-30"
            >
              <CalendarClock className="h-3.5 w-3.5 mr-1" />
              Schedule
            </button>
          </div>
        </div>

        {/* Right: three format previews */}
        <div className="w-64 flex-shrink-0 space-y-3">
          {FORMATS.map((f) => {
            const url = generatedImages[f.id];
            return (
              <div key={f.id} className="space-y-1">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-navy-400">
                  <span className="font-bold">{f.label}</span>
                  <span className="font-mono">{f.ratio}</span>
                </div>
                <div
                  className={`relative ${f.aspect} rounded-lg bg-navy-950 border border-navy-800 overflow-hidden flex items-center justify-center group`}
                >
                  {generating ? (
                    <Loader2 className="h-5 w-5 text-cyan-400 animate-spin" />
                  ) : url ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`${playerName} ${f.label}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setFullscreen(f.id)}
                          title="Fullscreen"
                          className="bg-navy-950/80 text-white rounded p-1 hover:bg-cyan-400 hover:text-navy-950"
                        >
                          <Maximize2 className="h-3 w-3" />
                        </button>
                        <a
                          href={url}
                          download
                          target="_blank"
                          rel="noreferrer"
                          title="Download"
                          className="bg-navy-950/80 text-white rounded p-1 hover:bg-cyan-400 hover:text-navy-950"
                        >
                          <Download className="h-3 w-3" />
                        </a>
                      </div>
                    </>
                  ) : (
                    <div className="text-navy-500 text-[10px] uppercase tracking-wider text-center px-2">
                      {hasAny ? "Failed" : "—"}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {fullscreen && generatedImages[fullscreen] && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setFullscreen(null)}
        >
          <button
            onClick={() => setFullscreen(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-navy-950/60 rounded-full p-2"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={generatedImages[fullscreen]!}
            alt={`${playerName} ${fullscreen} fullscreen`}
            className="max-h-[95vh] max-w-[95vw] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule post</DialogTitle>
            <DialogDescription>
              Pick a format, date, and time. Buffer will publish to Instagram at that moment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-navy-400">
                Format
              </label>
              <div className="flex gap-1 mt-1">
                {FORMATS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setScheduleFormat(f.id)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs uppercase tracking-wider font-bold ${
                      scheduleFormat === f.id
                        ? "border-cyan-400 bg-cyan-400/10 text-cyan-300"
                        : "border-navy-700 text-navy-400 hover:border-navy-600"
                    }`}
                  >
                    {f.label}
                    <div className="text-[9px] font-mono opacity-60 normal-case">
                      {f.ratio}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-navy-400">
                When
              </label>
              <input
                type="datetime-local"
                value={scheduleValue}
                onChange={(e) => setScheduleValue(e.target.value)}
                className="w-full mt-1 rounded-lg bg-navy-950 border border-navy-800 text-white text-sm p-2 focus:border-cyan-400/60 focus:outline-none"
              />
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setScheduleOpen(false)}
              className="inline-flex items-center text-xs uppercase tracking-wider font-bold px-3 py-2 rounded-lg border border-navy-700 text-navy-300 hover:border-cyan-400"
            >
              Cancel
            </button>
            <button
              onClick={schedule}
              disabled={publishing}
              className="inline-flex items-center text-xs uppercase tracking-wider font-bold px-3 py-2 rounded-lg bg-cyan-400 text-navy-950 hover:bg-cyan-300 disabled:opacity-30"
            >
              {publishing && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Schedule
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}

function StatusChip({
  status,
  hasPost,
}: {
  status: string;
  hasPost: boolean;
}) {
  if (!hasPost) return null;
  const map: Record<string, { label: string; cls: string }> = {
    draft: { label: "Draft", cls: "bg-navy-800 text-navy-300" },
    approved: { label: "Approved", cls: "bg-cyan-400/20 text-cyan-300" },
    scheduled: { label: "Scheduled", cls: "bg-amber-400/20 text-amber-300" },
    published: { label: "Published", cls: "bg-emerald-500/20 text-emerald-300" },
    failed: { label: "Failed", cls: "bg-red-500/20 text-red-300" },
  };
  const s = map[status] ?? map.draft;
  return (
    <span
      className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded ${s.cls}`}
    >
      {s.label}
    </span>
  );
}

function defaultScheduleValue(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
