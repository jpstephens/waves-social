"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UploadCloud, FileText, Film, Images, X } from "lucide-react";

export function NewGameForm() {
  const router = useRouter();
  const [pdf, setPdf] = useState<File | null>(null);
  const [clip, setClip] = useState<File | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [opponent, setOpponent] = useState("");
  const [playedAt, setPlayedAt] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const pdfDropzone = useDropzone({
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    onDrop: (files) => files[0] && setPdf(files[0]),
  });
  const clipDropzone = useDropzone({
    accept: { "video/*": [".mp4", ".mov", ".webm"] },
    maxFiles: 1,
    onDrop: (files) => files[0] && setClip(files[0]),
  });
  const photoDropzone = useDropzone({
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp"] },
    onDrop: (files) => setPhotos((prev) => [...prev, ...files]),
  });

  const onSubmit = useCallback(async () => {
    if (!pdf) {
      toast.error("Box score PDF is required");
      return;
    }
    if (!opponent.trim()) {
      toast.error("Opponent name is required");
      return;
    }

    setSubmitting(true);
    const fd = new FormData();
    fd.set("pdf", pdf);
    if (clip) fd.set("clip", clip);
    for (const p of photos) fd.append("photos", p);
    fd.set("opponent", opponent);
    fd.set("playedAt", new Date(playedAt).toISOString());
    if (notes) fd.set("notes", notes);

    try {
      const res = await fetch("/api/games", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok && res.status !== 202) {
        throw new Error(json.error ?? `Upload failed (${res.status})`);
      }
      if (json.warning) {
        toast.warning(json.warning);
      } else {
        toast.success("Highlights generated!");
      }
      router.push(`/games/${json.gameId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSubmitting(false);
    }
  }, [pdf, clip, photos, opponent, playedAt, notes, router]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="opponent">Opponent</Label>
          <Input
            id="opponent"
            value={opponent}
            onChange={(e) => setOpponent(e.target.value)}
            placeholder="e.g., Sharks"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="playedAt">Game date</Label>
          <Input
            id="playedAt"
            type="date"
            value={playedAt}
            onChange={(e) => setPlayedAt(e.target.value)}
          />
        </div>
      </div>

      <Dropzone
        {...pdfDropzone.getRootProps()}
        icon={<FileText className="h-6 w-6" />}
        label="Box score PDF"
        file={pdf}
        onClear={() => setPdf(null)}
      >
        <input {...pdfDropzone.getInputProps()} />
      </Dropzone>

      <Dropzone
        {...clipDropzone.getRootProps()}
        icon={<Film className="h-6 w-6" />}
        label="Highlight clip (optional but recommended)"
        file={clip}
        onClear={() => setClip(null)}
      >
        <input {...clipDropzone.getInputProps()} />
      </Dropzone>

      <div>
        <Label className="mb-2 block">Photos (optional)</Label>
        <div
          {...photoDropzone.getRootProps()}
          className="rounded-lg border-2 border-dashed border-slate-300 p-6 text-center hover:border-slate-400 cursor-pointer bg-white"
        >
          <input {...photoDropzone.getInputProps()} />
          <Images className="h-6 w-6 mx-auto text-slate-400 mb-2" />
          <p className="text-sm text-slate-500">Drop player photos here</p>
        </div>
        {photos.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {photos.map((p, i) => (
              <li
                key={i}
                className="flex items-center gap-2 rounded-md bg-slate-100 px-3 py-1 text-xs"
              >
                {p.name}
                <button
                  onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))}
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Coach notes (optional)</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything the AI should emphasize? (e.g., first career hit for Sam)"
          rows={3}
        />
      </div>

      <Button onClick={onSubmit} disabled={submitting} size="lg" className="w-full">
        {submitting ? "Processing — this takes ~30s…" : "Generate highlights"}
      </Button>
    </div>
  );
}

function Dropzone({
  icon,
  label,
  file,
  onClear,
  children,
  ...rootProps
}: {
  icon: React.ReactNode;
  label: string;
  file: File | null;
  onClear: () => void;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div>
      <Label className="mb-2 block">{label}</Label>
      <div
        {...rootProps}
        className="rounded-lg border-2 border-dashed border-slate-300 p-6 text-center hover:border-slate-400 cursor-pointer bg-white"
      >
        {children}
        {file ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {icon}
              <span className="text-sm text-slate-700">{file.name}</span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-500">
            <UploadCloud className="h-6 w-6" />
            <span className="text-sm">Click or drop</span>
          </div>
        )}
      </div>
    </div>
  );
}
