import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_ROOMS = ["Living Room", "Master Bedroom", "Kitchen", "Bathroom", "Dining", "Balcony", "Others"];

export function PhotoRoomTagModal({
  photoId,
  projectId,
  open,
  onClose,
}: {
  photoId: string | null;
  projectId?: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { data: rooms = [] } = useQuery({
    enabled: open && !!projectId,
    queryKey: ["project_rooms", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_rooms")
        .select("name")
        .eq("project_id", projectId!)
        .order("order_index");
      return data ?? [];
    },
  });
  const options = rooms.length ? rooms.map((r) => r.name) : DEFAULT_ROOMS;
  const [room, setRoom] = useState<string>(options[0] ?? "Living Room");

  const save = useMutation({
    mutationFn: async () => {
      if (!photoId) return;
      const { error } = await supabase.from("photos").update({ room }).eq("id", photoId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["photos"] });
      toast.success(`Tagged as ${room}`);
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (!open || !photoId) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-up" onClick={onClose}>
      <div className="w-full max-w-md bg-card rounded-[16px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-display text-xl">Which room is this?</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Tag the photo so the client can find it</p>
          </div>
          <button onClick={onClose} className="h-9 w-9 rounded-[10px] hover:bg-muted flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-4 space-y-3">
          <select
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            className="w-full h-10 px-3 rounded-[8px] border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
          >
            {options.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-[#c17f5a]" />
            Auto-tagging available when Google Vision API is connected.
          </p>
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="h-10 px-4 rounded-[6px] border border-border text-sm font-medium hover:bg-muted">Skip</button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="h-10 px-5 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium inline-flex items-center gap-1.5 hover:brightness-95 disabled:opacity-60"
          >
            {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save Tag
          </button>
        </div>
      </div>
    </div>
  );
}
