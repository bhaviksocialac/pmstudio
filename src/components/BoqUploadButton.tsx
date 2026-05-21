import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, FileUp } from "lucide-react";
import { toast } from "sonner";
import { parseBoqChecklist } from "@/lib/boq-checklist.functions";

export function BoqUploadButton({ projectId, className }: { projectId: string; className?: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const fn = useServerFn(parseBoqChecklist);
  const qc = useQueryClient();

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const buf = await file.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buf);
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
      }
      const fileBase64 = btoa(binary);
      return fn({ data: { projectId, fileBase64, filename: file.name, mime: file.type || "application/octet-stream" } });
    },
    onSuccess: (res) => {
      toast.success(`BOQ parsed: ${res.created} tasks created${res.subcategoriesAdded ? `, ${res.subcategoriesAdded} subcategories added` : ""}.`);
      qc.invalidateQueries({ queryKey: ["phase-subs", projectId] });
      qc.invalidateQueries({ queryKey: ["tasks-by-sub", projectId] });
      qc.invalidateQueries({ queryKey: ["project-activity", projectId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to parse BOQ"),
    onSettled: () => setPending(false),
  });

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.xlsx,.xls,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) { setPending(true); upload.mutate(f); }
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={pending}
        className={className ?? "h-9 px-3 rounded-[6px] bg-[#c17f5a] text-white text-xs font-medium hover:brightness-95 inline-flex items-center gap-1.5 disabled:opacity-60"}
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
        {pending ? "Reading BOQ…" : "Upload BOQ (auto-checklist)"}
      </button>
    </>
  );
}
