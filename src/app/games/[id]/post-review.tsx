"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
      const res = await fetch(`/api/posts/${post.id}/render`, { method: "POST" });
      const json = await res.json();
      if (json.status === "ready") {
        setPost((p) => ({ ...p, outputVideoUrl: json.url, renderStatus: "ready" }));
        clearInterval(interval);
      } else if (json.status === "failed") {
        setPost((p) => ({ ...p, renderStatus: "failed", errorMessage: json.error }));
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
    const res = await fetch(`/api/posts/${post.id}/approve`, { method: "POST" });
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
      toast.success("Published to Buffer queue");
    } else if (res.status === 501) {
      toast.info(
        "Buffer not configured — use the Download button to post manually."
      );
    } else {
      toast.error(json.error ?? "Publish failed");
    }
  };

  const mediaUrl = post.outputVideoUrl ?? post.outputImageUrl;

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="aspect-[9/16] max-h-[480px] bg-slate-900 relative">
        {post.renderStatus === "rendering" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-sm text-slate-300">Rendering video…</span>
          </div>
        )}
        {post.renderStatus === "failed" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-red-200 gap-2 p-4 text-center">
            <span className="text-sm">Render failed</span>
            <span className="text-xs opacity-75">{post.errorMessage}</span>
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
          <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
            No clip uploaded — text-only post
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          {highlight && (
            <Badge variant="secondary">
              {highlight.headline}
            </Badge>
          )}
          <Badge
            variant={post.status === "published" ? "default" : "outline"}
          >
            {post.status}
          </Badge>
        </div>

        {highlight && (
          <div className="text-sm text-slate-600">
            <strong>{highlight.statLine}</strong>
          </div>
        )}

        <Textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={4}
          className="text-sm"
        />

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={saveCaption}
            disabled={saving || caption === post.caption}
          >
            Save caption
          </Button>
          {post.status === "draft" && (
            <Button size="sm" onClick={approve}>
              <Check className="h-4 w-4 mr-1" />
              Approve
            </Button>
          )}
          {post.status === "approved" && (
            <Button size="sm" onClick={publish}>
              <Send className="h-4 w-4 mr-1" />
              Send to Buffer
            </Button>
          )}
          {mediaUrl && (
            <a
              href={mediaUrl}
              download
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[0.8rem] font-medium text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-4 w-4 mr-1" />
              Download
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
