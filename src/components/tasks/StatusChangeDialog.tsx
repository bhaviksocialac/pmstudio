import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { STATUS_META } from "@/lib/task-flow";

export type StatusChangePayload = {
  effectiveDate: string; // YYYY-MM-DD
  note?: string;
};

export function StatusChangeDialog({
  open,
  fromStatus,
  toStatus,
  taskTitle,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  fromStatus: string | null;
  toStatus: string;
  taskTitle: string;
  onCancel: () => void;
  onConfirm: (p: StatusChangePayload) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [mode, setMode] = useState<"today" | "pick">("today");
  const [date, setDate] = useState<string>(today);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setMode("today");
      setDate(today);
      setNote("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const fromLabel = fromStatus ? STATUS_META[fromStatus]?.label ?? fromStatus : "—";
  const toLabel = STATUS_META[toStatus]?.label ?? toStatus;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">When did this happen?</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="rounded-[10px] bg-muted/40 p-3">
            <div className="text-xs text-muted-foreground">{taskTitle}</div>
            <div className="mt-1 font-medium">
              <span className="text-muted-foreground">{fromLabel}</span>
              <span className="mx-2">→</span>
              <span className="text-[#7a4f37]">{toLabel}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setMode("today"); setDate(today); }}
              className={`flex-1 rounded-[10px] border px-3 py-2 text-sm transition-colors ${
                mode === "today" ? "border-[#c17f5a] bg-[#c17f5a]/10 text-[#7a4a32]" : "border-border hover:bg-muted/40"
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setMode("pick")}
              className={`flex-1 rounded-[10px] border px-3 py-2 text-sm transition-colors ${
                mode === "pick" ? "border-[#c17f5a] bg-[#c17f5a]/10 text-[#7a4a32]" : "border-border hover:bg-muted/40"
              }`}
            >
              Different date
            </button>
          </div>

          {mode === "pick" && (
            <div className="space-y-1">
              <Label className="text-xs">Date this happened</Label>
              <Input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs">Note (optional)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Client approved on WhatsApp"
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button
            onClick={() => onConfirm({ effectiveDate: date || today, note: note.trim() || undefined })}
            className="bg-[#c17f5a] hover:bg-[#a86b4a] text-white"
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
