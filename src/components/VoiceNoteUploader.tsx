import { useRef, useState } from "react";
import { Mic, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function VoiceNoteUploader({
  threadWith,
  kind,
}: {
  threadWith: string | null;
  kind: "client" | "vendor";
}) {
  const { user } = useAuth();
  const ref = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);

  const upload = useMutation({
    mutationFn: async (f: File) => {
      // Store as placeholder message — actual transcription requires Whisper API
      const sizeKb = Math.round(f.size / 1024);
      const { error } = await supabase.from("messages").insert({
        user_id: user!.id,
        body: `🎙 Voice note · ${f.name} (${sizeKb} KB)\n_Transcription pending — Whisper API required_`,
        from_me: true,
        kind,
        thread_with: threadWith,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages"] });
      toast.success("Voice note attached · Transcription pending");
      setFile(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Upload failed"),
  });

  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) { setFile(f); upload.mutate(f); }
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={upload.isPending}
        title="Upload voice note (Transcription pending — Whisper API required)"
        className="h-10 w-10 inline-flex items-center justify-center rounded-[6px] border border-border bg-card hover:bg-muted disabled:opacity-60"
      >
        {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
      </button>
      {file && upload.isPending && (
        <span className="text-[11px] text-muted-foreground font-mono ml-1">{file.name}</span>
      )}
    </>
  );
}
