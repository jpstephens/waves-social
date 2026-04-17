"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { Loader2, RefreshCcw, UploadCloud, Download } from "lucide-react";
import type { Highlight } from "@/lib/db/schema";

// Vercel Blob URLs for private stores can't be loaded directly in the browser
// (no auth). Route through our server proxy at /api/blob/[...path].
function toProxySrc(rawUrl: string | null): string | null {
  if (!rawUrl) return null;
  try {
    const pathname = new URL(rawUrl).pathname.replace(/^\/+/, "");
    return `/api/blob/${pathname}`;
  } catch {
    return rawUrl;
  }
}

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

export function MediaUploader({
  highlight,
  playerName,
  jerseyNumber,
}: {
  highlight: Highlight;
  playerName: string;
  jerseyNumber: number | null;
}) {
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(
    highlight.generatedImageUrl
  );

  const onDrop = useCallback((files: File[]) => {
    if (files[0]) setPhotoFile(files[0]);
  }, []);

  const dropzone = useDropzone({
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp"] },
    maxFiles: 1,
    onDrop,
  });

  const generate = useCallback(
    async (regenerateBackground = false) => {
      if (!photoFile && !generatedUrl) {
        toast.error("Drop a photo first");
        return;
      }
      setGenerating(true);
      try {
        const fd = new FormData();
        if (photoFile) fd.set("photo", photoFile);
        if (regenerateBackground) fd.set("regenerateBackground", "true");

        const res = await fetch(`/api/highlights/${highlight.id}/media`, {
          method: "POST",
          body: fd,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`);

        setGeneratedUrl(json.generatedImageUrl);
        toast.success(
          regenerateBackground ? "Re-rolled background" : "Image generated"
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Generation failed");
      } finally {
        setGenerating(false);
      }
    },
    [photoFile, highlight.id, generatedUrl]
  );

  return (
    <li className="rounded-xl border-2 border-navy-800 bg-navy-900 p-4">
      <div className="flex gap-4">
        {/* Left: highlight info + photo dropzone */}
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
            <div className="min-w-0">
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

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => generate(false)}
              disabled={generating || (!photoFile && !generatedUrl)}
              className="inline-flex items-center text-xs uppercase tracking-wider font-bold px-3 py-2 rounded-lg bg-cyan-400 text-navy-950 hover:bg-cyan-300 disabled:opacity-30"
            >
              {generating ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : null}
              {generatedUrl ? "Re-render" : "Generate"}
            </button>
            {generatedUrl && (
              <button
                onClick={() => generate(true)}
                disabled={generating || !photoFile}
                title={!photoFile ? "Re-drop the photo to re-roll" : ""}
                className="inline-flex items-center text-xs uppercase tracking-wider font-bold px-3 py-2 rounded-lg border border-navy-700 text-navy-300 hover:border-cyan-400 hover:text-cyan-400 disabled:opacity-30"
              >
                <RefreshCcw className="h-3.5 w-3.5 mr-1" />
                New background
              </button>
            )}
            {generatedUrl && (
              <a
                href={toProxySrc(generatedUrl) ?? generatedUrl}
                download
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center text-xs uppercase tracking-wider font-bold px-3 py-2 rounded-lg border border-navy-700 text-navy-300 hover:border-cyan-400 hover:text-cyan-400"
              >
                <Download className="h-3.5 w-3.5 mr-1" />
                Download
              </a>
            )}
          </div>
        </div>

        {/* Right: preview */}
        <div className="w-48 flex-shrink-0">
          <div className="aspect-[9/16] rounded-lg bg-navy-950 border border-navy-800 overflow-hidden flex items-center justify-center">
            {generating ? (
              <Loader2 className="h-6 w-6 text-cyan-400 animate-spin" />
            ) : generatedUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={toProxySrc(generatedUrl) ?? generatedUrl}
                alt={`${playerName} post`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-navy-500 text-[10px] uppercase tracking-wider text-center px-2">
                Preview will appear here
              </div>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
