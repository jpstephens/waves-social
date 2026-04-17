"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Download, Loader2, Send } from "lucide-react";
import type { Highlight, Post } from "@/lib/db/schema";

export function PostReview({
  initialPost,
  highlight,
}: {
  initialPost: Post;
  highlight: Highlight | null;
}) {
  const [post, setPost] = useState(initialPost);
  const [caption, setCaption] = useState(initialPost.caption);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (post.renderStatus !== "rendering") return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/posts/${post.id}/render`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.status === "ready") {
        setPost((p) => ({
          ...p,
          outputVideoUrl: json.url,
          renderStatus: "ready",
        }));
        clearInterval(interval);
      } else if (json.status === "failed") {
        setPost((p) => ({
          ...p,
          renderStatus: "failed",
          errorMessage: json.error,
        }));
        clearInterval(interval);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [post.id, post.renderStatus]);

  const saveCaption = async () => {
    setSaving(true);
    try {
      await fetch(`/api/posts/${post.id}/caption`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caption }),
      });
      setPost((p) => ({ ...p, caption }));
      toast.success("Caption saved");
    } finally {
      setSaving(false);
    }
  };

  const approve = async () => {
    const res = await fetch(`/api/posts/${post.id}/approve`, {
      method: "POST",
    });
    if (res.ok) {
      setPost((p) => ({ ...p, status: "approved" }));
      toast.success("Approved");
    }
  };

  const publish = async () => {
    const res = await fetch(`/api/posts/${post.id}/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const json = await res.json();
    if (res.ok) {
      setPost((p) => ({ ...p, status: "published" }));
      toast.success("Sent to Buffer queue");
    } else if (res.status === 501) {
      toast.info(
        "Buffer not configured — use Download to post manually for now."
      );
    } else {
      toast.error(json.error ?? "Publish failed");
    }
  };

  const mediaUrl = post.outputVideoUrl ?? post.outputImageUrl;
  const statusColor =
    post.status === "published"
      ? "bg-cyan-400 text-navy-950"
      : post.status === "approved"
        ? "bg-navy-700 text-cyan-400"
        : "bg-navy-800 text-navy-400";

  return (
    <div className="rounded-xl border border-navy-800 bg-navy-900 overflow-hidden">
      <div className="aspect-[9/16] max-h-[480px] bg-navy-950 relative flex items-center justify-center">
        {post.renderStatus === "rendering" && (
          <div className="flex flex-col items-center text-cyan-400 gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-xs uppercase tracking-[0.3em] font-bold">
              Rendering…
            </span>
          </div>
        )}
        {post.renderStatus === "failed" && (
          <div className="flex flex-col items-center gap-2 p-4 text-center">
            <span className="text-red-400 text-sm uppercase tracking-wider font-bold">
              Render failed
            </span>
            <span className="text-navy-400 text-xs">{post.errorMessage}</span>
          </div>
        )}
        {post.renderStatus === "ready" && post.outputVideoUrl && (
          <video
            src={post.outputVideoUrl}
            controls
            className="w-full h-full object-contain"
          />
        )}
        {post.renderStatus === "pending" && !mediaUrl && (
          <div className="text-navy-500 text-xs uppercase tracking-wider">
            Text-only post — no clip uploaded
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {highlight && (
            <span className="bg-cyan-400/10 text-cyan-400 text-xs uppercase tracking-wider font-bold px-2.5 py-1 rounded">
              {highlight.headline}
            </span>
          )}
          <span
            className={`text-[10px] uppercase tracking-[0.2em] font-bold px-2.5 py-1 rounded ${statusColor}`}
          >
            {post.status}
          </span>
        </div>

        {highlight && (
          <div className="text-navy-300 text-sm font-mono">
            {highlight.statLine}
          </div>
        )}

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={4}
          className="w-full bg-navy-950 border border-navy-800 text-white text-sm rounded-lg p-3 focus:border-cyan-400 focus:outline-none"
        />

        <div className="flex flex-wrap gap-2">
          <button
            onClick={saveCaption}
            disabled={saving || caption === post.caption}
            className="text-xs uppercase tracking-wider font-bold px-3 py-2 rounded-lg bg-navy-800 text-white hover:bg-navy-700 disabled:opacity-50"
          >
            Save caption
          </button>
          {post.status === "draft" && (
            <button
              onClick={approve}
              className="inline-flex items-center text-xs uppercase tracking-wider font-bold px-3 py-2 rounded-lg bg-cyan-400 text-navy-950 hover:bg-cyan-300"
            >
              <Check className="h-3.5 w-3.5 mr-1" />
              Approve
            </button>
          )}
          {post.status === "approved" && (
            <button
              onClick={publish}
              className="inline-flex items-center text-xs uppercase tracking-wider font-bold px-3 py-2 rounded-lg bg-cyan-400 text-navy-950 hover:bg-cyan-300"
            >
              <Send className="h-3.5 w-3.5 mr-1" />
              Send to Buffer
            </button>
          )}
          {mediaUrl && (
            <a
              href={mediaUrl}
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
    </div>
  );
}
