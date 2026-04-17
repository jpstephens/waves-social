"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
        <FieldLabel label="Opponent">
          <input
            value={opponent}
            onChange={(e) => setOpponent(e.target.value)}
            placeholder="SHARKS"
            className={inputCls}
            style={{ fontFamily: "ui-monospace, monospace" }}
          />
        </FieldLabel>
        <FieldLabel label="Game date">
          <input
            type="date"
            value={playedAt}
            onChange={(e) => setPlayedAt(e.target.value)}
            className={inputCls}
            style={{ fontFamily: "ui-monospace, monospace" }}
          />
        </FieldLabel>
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
        <FieldLabelText>Player photos (optional)</FieldLabelText>
        <div
          {...photoDropzone.getRootProps()}
          className="rounded-lg border-2 border-dashed border-navy-800 hover:border-cyan-400/50 p-6 text-center cursor-pointer bg-navy-900 transition-colors"
        >
          <input {...photoDropzone.getInputProps()} />
          <Images className="h-6 w-6 mx-auto text-navy-400 mb-2" />
          <p className="text-sm text-navy-400 uppercase tracking-wider">
            Drop player photos here
          </p>
        </div>
        {photos.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {photos.map((p, i) => (
              <li
                key={i}
                className="flex items-center gap-2 rounded-md bg-navy-800 text-white px-3 py-1 text-xs"
              >
                {p.name}
                <button
                  onClick={() =>
                    setPhotos((ps) => ps.filter((_, j) => j !== i))
                  }
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <FieldLabel label="Coach notes (optional)">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything the AI should emphasize? (e.g., first career hit for Sam)"
          rows={3}
          className={inputCls + " font-sans"}
        />
      </FieldLabel>

      <button
        onClick={onSubmit}
        disabled={submitting}
        className="w-full bg-cyan-400 text-navy-950 py-4 rounded-lg font-heading text-lg uppercase tracking-wider hover:bg-cyan-300 active:bg-cyan-500 transition disabled:opacity-50"
      >
        {submitting ? "Processing — this takes ~30s…" : "Generate highlights"}
      </button>
    </div>
  );
}

const inputCls =
  "w-full bg-navy-900 border-2 border-navy-800 text-white px-4 py-3 rounded-lg uppercase font-bold focus:border-cyan-400 focus:outline-none transition-colors placeholder:text-navy-500";

function FieldLabelText({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-cyan-400 text-xs font-bold uppercase tracking-[0.2em] mb-2">
      {children}
    </div>
  );
}

function FieldLabel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <FieldLabelText>{label}</FieldLabelText>
      {children}
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
      <FieldLabelText>{label}</FieldLabelText>
      <div
        {...rootProps}
        className="rounded-lg border-2 border-dashed border-navy-800 hover:border-cyan-400/50 p-6 text-center cursor-pointer bg-navy-900 transition-colors"
      >
        {children}
        {file ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              {icon}
              <span className="text-sm">{file.name}</span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="text-navy-400 hover:text-cyan-400"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-navy-400">
            <UploadCloud className="h-6 w-6" />
            <span className="text-xs uppercase tracking-wider">
              Click or drop
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
