import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  FileText, FileSpreadsheet, ImageIcon, MoreVertical, Eye, RefreshCcw, Pencil,
  Download, FolderInput, Trash2, Upload, Loader2, History, Sparkles, Check, X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  VENDOR_DOC_CATEGORIES, VENDOR_FILE_ACCEPT, validateVendorFile, uploadVendorFile,
  guessCategoryFromName, fileToBase64, type VendorDocCategory,
} from "@/lib/vendor-upload";
import { parseVendorQuotation, type VendorParseResult } from "@/lib/vendor-quotation-ai.functions";
import { VendorQuotationReviewSheet } from "@/components/vendors/VendorQuotationReviewSheet";

type VendorDoc = {
  id: string;
  name: string;
  category: VendorDocCategory;
  custom_label: string | null;
  storage_path: string;
  file_url: string;
  mime_type: string | null;
  file_size: number | null;
  current_version_no: number;
  linked_document_id: string | null;
  notes: string | null;
  created_at: string;
};

type Version = {
  id: string;
  version_no: number;
  file_url: string;
  storage_path: string;
  uploaded_at: string;
};

function FileIcon({ name, mime }: { name: string; mime: string | null }) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (mime?.startsWith("image/") || ["jpg", "jpeg", "png"].includes(ext)) return <ImageIcon className="h-4 w-4 text-[#7a9e8a]" />;
  if (["xls", "xlsx", "csv"].includes(ext)) return <FileSpreadsheet className="h-4 w-4 text-[#4f6b5e]" />;
  return <FileText className="h-4 w-4 text-[#c17f5a]" />;
}

function fmtSize(n: number | null) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
}

const CATEGORY_LABEL: Record<VendorDocCategory, string> = Object.fromEntries(
  VENDOR_DOC_CATEGORIES.map((c) => [c.value, c.label]),
) as Record<VendorDocCategory, string>;

const DOCS_FOLDER_BY_CAT: Record<VendorDocCategory, string> = {
  boq: "BOQ",
  quotation: "Quotations",
  po: "Purchase Orders",
  pi: "Proforma Invoices",
  invoice: "Invoices",
  challan: "Challans",
  other: "Other",
};

function categoryLabel(d: Pick<VendorDoc, "category" | "custom_label">): string {
  if (d.category === "other" && d.custom_label?.trim()) return d.custom_label.trim();
  return CATEGORY_LABEL[d.category] ?? d.category;
}

export function VendorDocumentsSection({
  projectId, vendorId, projectVendorId, vendorName,
}: {
  projectId: string;
  vendorId: string;
  projectVendorId: string;
  vendorName: string;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pendingCategoryFor, setPendingCategoryFor] = useState<File | null>(null);
  const [editing, setEditing] = useState<VendorDoc | null>(null);
  const [showHistoryFor, setShowHistoryFor] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<VendorParseResult | null>(null);
  const [aiOffer, setAiOffer] = useState<VendorDoc | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  const parseFn = useServerFn(parseVendorQuotation);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["vendor-documents", projectId, vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_documents")
        .select("*")
        .eq("project_id", projectId)
        .eq("vendor_id", vendorId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as VendorDoc[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["vendor-documents", projectId, vendorId] });

  // ---------- Upload new file ----------
  const upload = useMutation({
    mutationFn: async ({ file, category, customLabel }: { file: File; category: VendorDocCategory; customLabel?: string | null }) => {
      if (!user) throw new Error("Not authenticated");
      const up = await uploadVendorFile(file, { projectId, vendorId });
      const { data, error } = await supabase.from("vendor_documents").insert({
        user_id: user.id,
        project_id: projectId,
        vendor_id: vendorId,
        project_vendor_id: projectVendorId,
        name: file.name,
        category,
        custom_label: category === "other" ? (customLabel?.trim() || null) : null,
        storage_path: up.path,
        file_url: up.url,
        mime_type: file.type || null,
        file_size: file.size,
      }).select("*").single();
      if (error) throw new Error(error.message);
      return { doc: data as VendorDoc, file };
    },
    onSuccess: ({ doc, file }) => {
      toast.success(`Uploaded ${file.name}`);
      invalidate();
      if (doc.category === "quotation" || doc.category === "boq") {
        setAiOffer(doc);
      } else if (doc.category === "invoice") {
        toast.info("Open the invoice from the list to process payments.");
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Upload failed"),
  });

  const handleFile = (file: File) => {
    const err = validateVendorFile(file);
    if (err) { toast.error(err); return; }
    setPendingCategoryFor(file);
  };

  // ---------- AI process existing doc ----------
  const runAi = async (doc: VendorDoc) => {
    setAiBusy(true);
    try {
      // re-download the file
      const res = await fetch(doc.file_url);
      if (!res.ok) throw new Error("Could not fetch file");
      const blob = await res.blob();
      const file = new File([blob], doc.name, { type: doc.mime_type || blob.type });
      const base64 = await fileToBase64(file);
      const r = await parseFn({
        data: { projectId, vendorName, fileBase64: base64, filename: doc.name, mime: file.type || "application/octet-stream" },
      });
      if (r.items.length === 0) { toast.info("No line items detected."); return; }
      setParseResult(r);
      setAiOffer(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI failed");
    } finally {
      setAiBusy(false);
    }
  };

  // ---------- Replace (version) ----------
  const replace = useMutation({
    mutationFn: async ({ doc, file }: { doc: VendorDoc; file: File }) => {
      if (!user) throw new Error("Not authenticated");
      const err = validateVendorFile(file);
      if (err) throw new Error(err);
      // archive current
      const { error: vErr } = await supabase.from("vendor_document_versions").insert({
        user_id: user.id,
        vendor_document_id: doc.id,
        version_no: doc.current_version_no,
        storage_path: doc.storage_path,
        file_url: doc.file_url,
        mime_type: doc.mime_type,
        file_size: doc.file_size,
      });
      if (vErr) throw new Error(vErr.message);
      const up = await uploadVendorFile(file, { projectId, vendorId });
      const { error } = await supabase.from("vendor_documents").update({
        name: file.name,
        storage_path: up.path,
        file_url: up.url,
        mime_type: file.type || null,
        file_size: file.size,
        current_version_no: doc.current_version_no + 1,
      }).eq("id", doc.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { toast.success("File replaced"); invalidate(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Replace failed"),
  });

  // ---------- Edit details ----------
  const saveEdit = useMutation({
    mutationFn: async (patch: { name: string; category: VendorDocCategory; notes: string; customLabel: string | null }) => {
      if (!editing) return;
      const { error } = await supabase.from("vendor_documents").update({
        name: patch.name,
        category: patch.category,
        notes: patch.notes,
        custom_label: patch.category === "other" ? (patch.customLabel?.trim() || null) : null,
      }).eq("id", editing.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { toast.success("Updated"); setEditing(null); invalidate(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  // ---------- Move to Documents tab ----------
  const moveToDocs = useMutation({
    mutationFn: async (doc: VendorDoc) => {
      if (!user) throw new Error("Not authenticated");
      if (doc.linked_document_id) {
        toast.info("Already linked in Documents.");
        return;
      }
      const folder = `${DOCS_FOLDER_BY_CAT[doc.category]}/${vendorName}`;
      const { data: ins, error } = await supabase.from("project_documents").insert({
        user_id: user.id,
        project_id: projectId,
        name: doc.name,
        category: categoryLabel(doc),
        folder_path: folder,
        storage_path: doc.storage_path,
        file_url: doc.file_url,
        mime_type: doc.mime_type,
        file_size: doc.file_size,
      }).select("id").single();
      if (error) throw new Error(error.message);
      await supabase.from("vendor_documents").update({ linked_document_id: ins.id }).eq("id", doc.id);
    },
    onSuccess: () => {
      toast.success("Copied to Documents tab");
      invalidate();
      qc.invalidateQueries({ queryKey: ["project-documents", projectId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Move failed"),
  });

  // ---------- Delete ----------
  const del = useMutation({
    mutationFn: async (doc: VendorDoc) => {
      if (!confirm(`Delete ${doc.name}? You can restore from Trash within 30 days.`)) throw new Error("cancelled");
      const { error } = await supabase.from("vendor_documents").update({ deleted_at: new Date().toISOString() }).eq("id", doc.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { toast.success("Moved to Trash"); invalidate(); },
    onError: (e) => { if (e instanceof Error && e.message !== "cancelled") toast.error(e.message); },
  });

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault(); setDragOver(false);
        const f = e.dataTransfer.files?.[0]; if (f) handleFile(f);
      }}
      className={`rounded-[10px] border border-dashed transition ${
        dragOver ? "border-[#c17f5a] bg-[#fff7eb]" : "border-border bg-card"
      } p-3`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          Documents · {docs.length}
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          className="h-7 px-2.5 rounded-[6px] bg-[#c17f5a] text-white text-[11px] font-medium inline-flex items-center gap-1 hover:brightness-110"
        >
          <Upload className="h-3 w-3" /> Add File
        </button>
        <input
          ref={fileRef}
          type="file"
          hidden
          accept={VENDOR_FILE_ACCEPT}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.currentTarget.value = ""; }}
        />
      </div>

      {isLoading ? (
        <div className="h-12 animate-pulse bg-muted/40 rounded" />
      ) : docs.length === 0 ? (
        <div className="text-[11px] text-muted-foreground text-center py-3">
          {dragOver ? "Drop to upload" : "Drop a file here or click Add File"}
        </div>
      ) : (
        <ul className="space-y-1.5">
          {docs.map((d) => (
            <li key={d.id} className="rounded-[8px] bg-background border border-border">
              <div className="flex items-center gap-2 px-2.5 py-2">
                <FileIcon name={d.name} mime={d.mime_type} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{d.name}</div>
                  <div className="text-[10px] text-muted-foreground flex flex-wrap gap-x-1.5">
                    <span className="px-1.5 rounded bg-muted">{categoryLabel(d)}</span>
                    <span>{fmtDate(d.created_at)}</span>
                    <span>· {fmtSize(d.file_size)}</span>
                    {d.current_version_no > 1 && (
                      <button onClick={() => setShowHistoryFor(showHistoryFor === d.id ? null : d.id)} className="text-[#c17f5a] hover:underline inline-flex items-center gap-0.5">
                        <History className="h-2.5 w-2.5" /> v{d.current_version_no}
                      </button>
                    )}
                    {d.linked_document_id && <span className="text-[#4f6b5e]">· Linked in Docs</span>}
                  </div>
                </div>
                <div className="relative">
                  <button onClick={() => setOpenMenuId(openMenuId === d.id ? null : d.id)} className="h-7 w-7 rounded hover:bg-muted inline-flex items-center justify-center">
                    <MoreVertical className="h-3.5 w-3.5" />
                  </button>
                  {openMenuId === d.id && (
                    <div onMouseLeave={() => setOpenMenuId(null)} className="absolute right-0 top-full mt-1 z-30 w-48 bg-card border border-border rounded-[8px] shadow-lg py-1 text-xs">
                      <MenuItem icon={Eye} label="View" onClick={() => { window.open(d.file_url, "_blank"); setOpenMenuId(null); }} />
                      <MenuItem icon={RefreshCcw} label="Replace" onClick={() => {
                        const inp = document.createElement("input");
                        inp.type = "file"; inp.accept = VENDOR_FILE_ACCEPT;
                        inp.onchange = () => { const f = inp.files?.[0]; if (f) replace.mutate({ doc: d, file: f }); };
                        inp.click();
                        setOpenMenuId(null);
                      }} />
                      <MenuItem icon={Pencil} label="Edit Details" onClick={() => { setEditing(d); setOpenMenuId(null); }} />
                      <MenuItem icon={Download} label="Download" onClick={() => { const a = document.createElement("a"); a.href = d.file_url; a.download = d.name; a.click(); setOpenMenuId(null); }} />
                      <MenuItem icon={FolderInput} label={d.linked_document_id ? "Linked in Docs" : "Move to Documents"} disabled={!!d.linked_document_id} onClick={() => { moveToDocs.mutate(d); setOpenMenuId(null); }} />
                      {(d.category === "quotation" || d.category === "boq") && (
                        <MenuItem icon={Sparkles} label="Process with AI" onClick={() => { setAiOffer(d); setOpenMenuId(null); }} />
                      )}
                      <div className="border-t border-border my-1" />
                      <MenuItem icon={Trash2} label="Delete" danger onClick={() => { del.mutate(d); setOpenMenuId(null); }} />
                    </div>
                  )}
                </div>
              </div>
              {showHistoryFor === d.id && <VersionHistoryList docId={d.id} currentVersion={d.current_version_no} />}
            </li>
          ))}
        </ul>
      )}

      {pendingCategoryFor && (
        <CategoryPickerDialog
          file={pendingCategoryFor}
          onCancel={() => setPendingCategoryFor(null)}
          onConfirm={(cat, customLabel) => {
            const f = pendingCategoryFor;
            setPendingCategoryFor(null);
            upload.mutate({ file: f, category: cat, customLabel });
          }}
        />
      )}

      {editing && (
        <EditDetailsDialog doc={editing} onCancel={() => setEditing(null)} onSave={(p) => saveEdit.mutate(p)} busy={saveEdit.isPending} />
      )}

      {aiOffer && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !aiBusy && setAiOffer(null)}>
          <div className="bg-card rounded-[14px] shadow-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="inline-flex items-center gap-2 mb-2"><Sparkles className="h-4 w-4 text-[#c17f5a]" /><h4 className="font-display text-lg">Process with AI?</h4></div>
            <p className="text-xs text-muted-foreground mb-4">
              Process <span className="font-medium">{aiOffer.name}</span> to create or update tasks for {vendorName}?
            </p>
            <div className="flex justify-end gap-2">
              <button disabled={aiBusy} onClick={() => setAiOffer(null)} className="h-9 px-3 rounded-[6px] border border-border text-xs">Not now</button>
              <button disabled={aiBusy} onClick={() => runAi(aiOffer)} className="h-9 px-4 rounded-[6px] bg-[#c17f5a] text-white text-xs font-medium inline-flex items-center gap-1.5">
                {aiBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Process
              </button>
            </div>
          </div>
        </div>
      )}

      {parseResult && (
        <VendorQuotationReviewSheet
          projectId={projectId}
          projectVendorId={projectVendorId}
          vendorId={vendorId}
          vendorName={vendorName}
          parseResult={parseResult}
          onClose={() => setParseResult(null)}
        />
      )}
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger, disabled }: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full px-3 py-1.5 inline-flex items-center gap-2 text-left hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed ${danger ? "text-[#c4685a]" : ""}`}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

function VersionHistoryList({ docId, currentVersion }: { docId: string; currentVersion: number }) {
  const { data: versions = [] } = useQuery({
    queryKey: ["vendor-document-versions", docId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_document_versions")
        .select("*")
        .eq("vendor_document_id", docId)
        .order("version_no", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Version[];
    },
  });
  return (
    <div className="border-t border-border px-3 py-2 bg-muted/30 text-[11px] space-y-1">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Version history</div>
      <div className="flex items-center gap-2 text-[#4f6b5e]">
        <span className="font-medium">v{currentVersion}</span><span className="text-muted-foreground">(current)</span>
      </div>
      {versions.map((v) => (
        <div key={v.id} className="flex items-center gap-2">
          <span>v{v.version_no}</span>
          <span className="text-muted-foreground">{fmtDate(v.uploaded_at)}</span>
          <a href={v.file_url} target="_blank" rel="noreferrer" className="text-[#c17f5a] hover:underline ml-auto">Open</a>
        </div>
      ))}
    </div>
  );
}

function CategoryPickerDialog({
  file, onCancel, onConfirm,
}: { file: File; onCancel: () => void; onConfirm: (c: VendorDocCategory) => void }) {
  const [cat, setCat] = useState<VendorDocCategory>(guessCategoryFromName(file.name));
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-card rounded-[14px] shadow-2xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <h4 className="font-display text-lg">What is this file?</h4>
            <p className="text-[11px] text-muted-foreground truncate max-w-[14rem]">{file.name}</p>
          </div>
          <button onClick={onCancel} className="h-7 w-7 rounded hover:bg-muted inline-flex items-center justify-center"><X className="h-3.5 w-3.5" /></button>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {VENDOR_DOC_CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setCat(c.value)}
              className={`h-9 px-3 rounded-[6px] text-xs border ${cat === c.value ? "bg-[#c17f5a] text-white border-[#c17f5a]" : "border-border hover:bg-muted"}`}
            >
              {cat === c.value && <Check className="inline h-3 w-3 mr-1 -mt-0.5" />}{c.label}
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="h-9 px-3 rounded-[6px] border border-border text-xs">Cancel</button>
          <button onClick={() => onConfirm(cat)} className="h-9 px-4 rounded-[6px] bg-[#c17f5a] text-white text-xs font-medium">Upload</button>
        </div>
      </div>
    </div>
  );
}

function EditDetailsDialog({
  doc, onCancel, onSave, busy,
}: {
  doc: VendorDoc;
  onCancel: () => void;
  onSave: (p: { name: string; category: VendorDocCategory; notes: string }) => void;
  busy: boolean;
}) {
  const [name, setName] = useState(doc.name);
  const [category, setCategory] = useState<VendorDocCategory>(doc.category);
  const [notes, setNotes] = useState(doc.notes ?? "");
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-card rounded-[14px] shadow-2xl p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-display text-lg">Edit file details</h4>
          <button onClick={onCancel} className="h-7 w-7 rounded hover:bg-muted inline-flex items-center justify-center"><X className="h-3.5 w-3.5" /></button>
        </div>
        <div className="space-y-3">
          <label className="block">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Name</div>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full h-9 px-3 rounded-[8px] border border-border bg-card text-sm" />
          </label>
          <label className="block">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Category</div>
            <select value={category} onChange={(e) => setCategory(e.target.value as VendorDocCategory)} className="w-full h-9 px-3 rounded-[8px] border border-border bg-card text-sm">
              {VENDOR_DOC_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
          <label className="block">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Notes</div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-[8px] border border-border bg-card text-sm" />
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onCancel} className="h-9 px-3 rounded-[6px] border border-border text-xs">Cancel</button>
          <button disabled={busy} onClick={() => onSave({ name, category, notes })} className="h-9 px-4 rounded-[6px] bg-[#c17f5a] text-white text-xs font-medium inline-flex items-center gap-1.5">
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
          </button>
        </div>
      </div>
    </div>
  );
}
