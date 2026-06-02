import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, X, MessageCircle, ExternalLink, Pencil, Trash2, Loader2, Phone, FileUp, Upload, Sparkles, Check, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatINR } from "@/lib/studio-data";
import type { DbVendor } from "@/lib/db-types";
import { VendorAutocomplete } from "@/components/VendorAutocomplete";
import { VendorModal } from "@/routes/_authenticated/vendors";
import { InvoiceUploadDialog } from "@/components/vendors/InvoiceUploadDialog";
import { VendorInvoiceList } from "@/components/vendors/VendorInvoiceList";
import { extractVendorQuotation, type QuotationExtract } from "@/lib/vendor-quotation.functions";
import { assignVendorToProjectTasks } from "@/lib/vendor-assignment.functions";
import { DEFAULT_WORK_CATEGORIES } from "@/lib/vendor-constants";
import { AddVendorSheet } from "@/components/vendors/AddVendorSheet";
import { VendorDocumentsSection } from "@/components/vendors/VendorDocumentsSection";



type ProjectVendorRow = {
  id: string;
  project_id: string;
  vendor_id: string;
  scope: string | null;
  po_amount: number;
  expected_delivery: string | null;
  status: string;
  notes: string | null;
};

type Joined = ProjectVendorRow & { vendor: DbVendor | null };

const STATUS = {
  pending: { bg: "rgba(212,136,42,0.18)", color: "#d4882a", label: "Pending" },
  confirmed: { bg: "rgba(122,158,138,0.18)", color: "#7a9e8a", label: "Confirmed" },
  delayed: { bg: "rgba(196,104,90,0.18)", color: "#c4685a", label: "Delayed" },
  completed: { bg: "rgba(122,158,138,0.18)", color: "#7a9e8a", label: "Delivered" },
} as const;

export function ProjectVendorsTab({ projectId }: { projectId: string }) {
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState<Joined | null>(null);
  const [uploadingFor, setUploadingFor] = useState<DbVendor | null>(null);
  const qc = useQueryClient();
  const assignFn = useServerFn(assignVendorToProjectTasks);
  const assign = useMutation({
    mutationFn: (projectVendorId: string) => assignFn({ data: { projectId, projectVendorId } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      qc.invalidateQueries({ queryKey: ["budget-rollup", projectId] });
      qc.invalidateQueries({ queryKey: ["alerts-tasks", projectId] });
      if (r.matchedCount === 0) {
        toast.info(`No matching tasks found for ${r.vendorName} (scope: ${r.scopeCategories.join(", ") || "none"})`);
      } else {
        toast.success(`Linked ${r.vendorName} to ${r.matchedCount} task${r.matchedCount > 1 ? "s" : ""} · ${formatINR(r.totalQuoted)} quoted`);
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Auto-link failed"),
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["project_vendors", projectId],
    queryFn: async () => {
      const { data: links, error } = await supabase
        .from("project_vendors")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = (links ?? []).map((l) => l.vendor_id);
      const { data: vendors } = ids.length
        ? await supabase.from("vendors").select("*").in("id", ids)
        : { data: [] as DbVendor[] };
      const map = new Map((vendors ?? []).map((v) => [v.id, v as DbVendor]));
      return (links ?? []).map((l) => ({ ...l, vendor: map.get(l.vendor_id) ?? null })) as Joined[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_vendors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project_vendors", projectId] });
      toast.success("Vendor removed from project");
    },
  });

  return (
    <div className="rounded-[16px] bg-card border border-border overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl">Project Vendors</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Linked from your master vendor list</p>
        </div>
        <button
          onClick={() => setPicking(true)}
          className="h-9 px-3 rounded-[6px] bg-primary text-primary-foreground text-xs font-medium hover:brightness-95 inline-flex items-center gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" /> Add Vendor
        </button>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="h-40 animate-pulse bg-muted rounded-[10px]" />
        ) : rows.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground mb-4">No vendors added to this project yet.</p>
            <button
              onClick={() => setPicking(true)}
              className="h-10 px-5 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium"
            >
              + Add Vendor
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rows.map((r) => {
              const s = STATUS[r.status as keyof typeof STATUS] ?? STATUS.pending;
              const v = r.vendor;
              return (
                <article key={r.id} className="rounded-[12px] border border-border p-4 bg-background">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {v?.category && (
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-[6px] mb-1 inline-block"
                          style={{ background: "rgba(193,127,90,0.15)", color: "#c17f5a" }}>{v.category}</span>
                      )}
                      <h3 className="font-display text-lg leading-tight">{v?.company_name || v?.name || "Vendor"}</h3>
                      {v?.phone && <div className="text-xs text-muted-foreground font-mono mt-0.5 flex items-center gap-1.5"><Phone className="h-3 w-3" />{v.phone}</div>}
                    </div>
                    <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-[6px]" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div><div className="text-muted-foreground text-[10px] uppercase">Scope</div><div>{r.scope || "—"}</div></div>
                    <div><div className="text-muted-foreground text-[10px] uppercase">PO Amount</div><div className="font-mono">{formatINR(Number(r.po_amount))}</div></div>
                    <div><div className="text-muted-foreground text-[10px] uppercase">Expected Delivery</div><div className="font-mono">{r.expected_delivery ?? "—"}</div></div>
                  </div>
                  <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                    {v && (
                      <button onClick={() => setUploadingFor(v)} className="h-8 px-2.5 rounded-[6px] bg-[#c17f5a] text-white text-[11px] font-medium inline-flex items-center gap-1 hover:brightness-110">
                        <FileUp className="h-3 w-3" /> Upload Invoice
                      </button>
                    )}
                    {v?.whatsapp || v?.phone ? (
                      <a href={`https://wa.me/${(v.whatsapp || v.phone || "").replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                        className="h-8 px-2.5 rounded-[6px] border border-border text-[11px] hover:bg-muted inline-flex items-center gap-1 text-[#25D366]">
                        <MessageCircle className="h-3 w-3" /> WhatsApp
                      </a>
                    ) : null}
                    <Link to="/vendors" className="h-8 px-2.5 rounded-[6px] border border-border text-[11px] hover:bg-muted inline-flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" /> View Profile
                    </Link>
                    <button onClick={() => setEditing(r)} className="h-8 px-2.5 rounded-[6px] border border-border text-[11px] hover:bg-muted inline-flex items-center gap-1">
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                    <button
                      onClick={() => assign.mutate(r.id)}
                      disabled={assign.isPending}
                      title="Link this vendor to matching BOQ tasks and split the PO across them"
                      className="h-8 px-2.5 rounded-[6px] border border-border text-[11px] hover:bg-muted inline-flex items-center gap-1 disabled:opacity-60"
                    >
                      {assign.isPending && assign.variables === r.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Link2 className="h-3 w-3" />
                      )}
                      Auto-link tasks
                    </button>
                    <button onClick={() => del.mutate(r.id)} className="h-8 px-2.5 rounded-[6px] border border-border text-[11px] hover:bg-[#fff0ee] text-[#c4685a] inline-flex items-center gap-1">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  {v && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <VendorInvoiceList projectId={projectId} vendorId={v.id} />
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      {picking && (
        <AddVendorSheet
          projectId={projectId}
          existingVendorIds={rows.map((r) => r.vendor_id)}
          onClose={() => setPicking(false)}
        />
      )}
      {editing && (
        <ProjectVendorDetailsModal
          mode="edit"
          row={editing}
          vendor={editing.vendor}
          projectId={projectId}
          onClose={() => setEditing(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["project_vendors", projectId] })}
        />
      )}
      {uploadingFor && (
        <InvoiceUploadDialog projectId={projectId} vendor={uploadingFor} onClose={() => setUploadingFor(null)} />
      )}
    </div>
  );
}

function VendorPickerOverlay({
  projectId, existingVendorIds, onClose, onLinked,
}: { projectId: string; existingVendorIds: string[]; onClose: () => void; onLinked: () => void }) {
  const [selected, setSelected] = useState<DbVendor | null>(null);
  const [creatingName, setCreatingName] = useState<string | null>(null);

  if (selected) {
    return (
      <ProjectVendorDetailsModal
        mode="create"
        vendor={selected}
        projectId={projectId}
        onClose={onClose}
        onSaved={() => { onLinked(); onClose(); }}
      />
    );
  }

  if (creatingName !== null) {
    return (
      <VendorModal
        initialName={creatingName}
        onClose={() => setCreatingName(null)}
        onCreated={(v) => { setCreatingName(null); setSelected(v); }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-card rounded-[16px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-display text-xl">Add Vendor to Project</h3>
          <button onClick={onClose} className="h-9 w-9 rounded-[10px] hover:bg-muted flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-6 space-y-3">
          <p className="text-xs text-muted-foreground">Search your master vendor list. Pick one to link it to this project.</p>
          <VendorAutocomplete
            excludeIds={existingVendorIds}
            onSelect={(v) => setSelected(v)}
            onCreateNew={(name) => setCreatingName(name)}
            placeholder="Search vendor by name or company…"
          />
          <div className="pt-2 border-t border-border">
            <button
              onClick={() => setCreatingName("")}
              className="w-full h-10 rounded-[8px] border border-dashed border-border text-xs font-medium hover:bg-muted inline-flex items-center justify-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> Add New Vendor to Master List
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectVendorDetailsModal({
  mode, row, vendor, projectId, onClose, onSaved,
}: {
  mode: "create" | "edit";
  row?: Joined;
  vendor: DbVendor | null;
  projectId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const extractFn = useServerFn(extractVendorQuotation);
  const assignFn = useServerFn(assignVendorToProjectTasks);

  // Vendor default categories pre-checked
  const vendorDefaultCats: string[] = (() => {
    const wc = (vendor as any)?.work_categories;
    if (Array.isArray(wc) && wc.length) return wc as string[];
    if (vendor?.category) return [vendor.category];
    return [];
  })();
  const rowCats = (row as any)?.scope_categories as string[] | undefined;
  const initialCats = (rowCats && rowCats.length ? rowCats : vendorDefaultCats);

  // Combine default + any custom cats from vendor / row to render in the picker
  const allCategoryOptions = Array.from(new Set([
    ...DEFAULT_WORK_CATEGORIES,
    ...vendorDefaultCats,
    ...(rowCats ?? []),
  ]));

  const [selectedCats, setSelectedCats] = useState<string[]>(initialCats);
  const [scope, setScope] = useState(row?.scope ?? "");
  const [amount, setAmount] = useState(String(row?.po_amount ?? ""));
  const [delivery, setDelivery] = useState(row?.expected_delivery ?? "");
  const [status, setStatus] = useState(row?.status ?? "pending");
  const [notes, setNotes] = useState(row?.notes ?? "");

  const [extracting, setExtracting] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [quotation, setQuotation] = useState<QuotationExtract | null>(null);
  const [quoteFileUrl, setQuoteFileUrl] = useState<string | null>(null);
  const [quoteFilePath, setQuoteFilePath] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    vendorName: string;
    cats: string[];
    matched: number;
    byCategory: Record<string, number>;
    poAmount: number;
  } | null>(null);

  const toggleCat = (c: string) =>
    setSelectedCats((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));

  const ACCEPT = ".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.csv,application/pdf,image/jpeg,image/png,image/jpg,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv";

  const isAiExtractable = (mime: string, name: string) => {
    if (mime.startsWith("image/") || mime === "application/pdf") return true;
    const ext = name.split(".").pop()?.toLowerCase();
    return ext === "pdf" || ext === "jpg" || ext === "jpeg" || ext === "png";
  };

  const onFile = async (file: File) => {
    if (file.size > 15 * 1024 * 1024) { toast.error("Max 15MB"); return; }
    const ext = (file.name.split(".").pop() ?? "bin").toLowerCase();
    const okExt = ["pdf", "jpg", "jpeg", "png", "xlsx", "xls", "csv"].includes(ext);
    if (!okExt) { toast.error("Only PDF, JPG, PNG, XLSX, XLS, CSV"); return; }
    setPendingFile(file);
    setExtracting(true);
    try {
      const path = `quotations/${projectId}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("project-photos").upload(path, file, {
        contentType: file.type || "application/octet-stream", upsert: false,
      });
      if (up.error) throw up.error;
      const { data: pub } = supabase.storage.from("project-photos").getPublicUrl(path);
      setQuoteFileUrl(pub.publicUrl);
      setQuoteFilePath(path);

      if (!isAiExtractable(file.type, file.name)) {
        toast.success("Quotation uploaded. Spreadsheet auto-scope coming soon — please tick the scope categories below.");
        return;
      }

      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = ""; for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      const res = await extractFn({
        data: {
          fileName: file.name,
          mimeType: file.type || "application/pdf",
          base64,
          selectedCategories: selectedCats,
        },
      });
      if (!res.ok || !res.data) {
        toast.error(res.error || "AI couldn't read the quotation");
        return;
      }
      setQuotation(res.data);
      if (res.data.total_amount) setAmount(String(res.data.total_amount));
      // Auto-tick categories found in the quotation
      const detected = res.data.categories.map((c) => c.name).filter(Boolean);
      if (detected.length) {
        setSelectedCats((prev) => Array.from(new Set([...prev, ...detected])));
        toast.success(`AI detected ${detected.length} work categor${detected.length > 1 ? "ies" : "y"} in the quotation`);
      } else {
        toast.success("Quotation read");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setExtracting(false);
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!user || !vendor) throw new Error("Missing user/vendor");
      const payload = {
        scope: scope.trim() || null,
        scope_categories: selectedCats,
        po_amount: Number(amount) || 0,
        expected_delivery: delivery || null,
        status,
        notes: notes.trim() || null,
        quotation_url: quoteFileUrl,
        quotation_storage_path: quoteFilePath,
      };
      let pvId = row?.id;
      if (mode === "edit" && row) {
        const { error } = await supabase.from("project_vendors").update(payload).eq("id", row.id);
        if (error) throw error;
      } else {
        const { data: ins, error } = await supabase.from("project_vendors").insert({
          user_id: user.id, project_id: projectId, vendor_id: vendor.id, ...payload,
        }).select("id").single();
        if (error) throw error;
        pvId = ins?.id;
      }

      // Auto-link tasks based on selected scope categories
      let assignResult = { matchedCount: 0, byCategory: {} as Record<string, number>, vendorName: vendor.company_name || vendor.name || "Vendor" };
      if (pvId && selectedCats.length) {
        try {
          const r = await assignFn({ data: { projectId, projectVendorId: pvId } });
          assignResult = { matchedCount: r.matchedCount, byCategory: r.byCategory, vendorName: r.vendorName };
        } catch (e) {
          console.warn("Auto-assign failed", e);
        }
      }
      return assignResult;
    },
    onSuccess: (r) => {
      setSummary({
        vendorName: r.vendorName,
        cats: selectedCats,
        matched: r.matchedCount,
        byCategory: r.byCategory,
        poAmount: Number(amount) || 0,
      });
      onSaved();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (summary) {
    return (
      <SummaryCard
        summary={summary}
        projectId={projectId}
        onClose={onClose}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-2xl bg-card rounded-[16px] shadow-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{mode === "edit" ? "Edit Project Vendor" : "Add Vendor to Project"}</div>
            <h3 className="font-display text-xl">{vendor?.company_name || vendor?.name}</h3>
            {vendorDefaultCats.length > 0 && mode === "create" && (
              <div className="text-[11px] text-muted-foreground mt-0.5">Master categories pre-selected: {vendorDefaultCats.join(", ")}</div>
            )}
          </div>
          <button onClick={onClose} className="h-9 w-9 rounded-[10px] hover:bg-muted flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-6 space-y-5">
          {/* Scope categories */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Scope of Work — pick categories</div>
            <div className="flex flex-wrap gap-1.5">
              {allCategoryOptions.map((c) => {
                const on = selectedCats.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCat(c)}
                    className={`h-8 px-3 rounded-full text-[11px] border transition ${on ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted border-border text-foreground"}`}
                  >
                    {on && <Check className="inline h-3 w-3 mr-1 -mt-0.5" />}
                    {c}
                  </button>
                );
              })}
            </div>
            {selectedCats.length === 0 && (
              <p className="text-[11px] text-[#c4685a] mt-2">No scope selected — vendor won't be auto-assigned to any tasks.</p>
            )}
          </div>

          <Field label="Scope notes (optional)">
            <textarea value={scope} onChange={(e) => setScope(e.target.value)} rows={2}
              className="w-full px-3 py-2 rounded-[8px] bg-card border border-border text-sm" placeholder="e.g. Master bedroom flooring + skirting" />
          </Field>

          {/* Quotation upload */}
          {mode === "create" && !quotation && !extracting && (
            <label className="block">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Upload Quotation (optional)</div>
              <div className="rounded-[10px] border border-dashed border-[#c17f5a] bg-[#fff7eb] p-5 text-center cursor-pointer hover:bg-[#ffeed8]">
                <Upload className="h-5 w-5 mx-auto text-[#c17f5a] mb-2" />
                <div className="text-xs font-medium text-[#c17f5a]">Choose PDF, JPG, PNG, XLSX, XLS or CSV</div>
                <div className="text-[10px] text-muted-foreground mt-1">AI auto-detects scope categories &amp; total amount</div>
                <input type="file" hidden accept={ACCEPT}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
              </div>
            </label>
          )}

          {extracting && (
            <div className="rounded-[10px] border border-[#e8d9c9] bg-[#fff7eb] p-5 text-center">
              <Loader2 className="h-6 w-6 mx-auto animate-spin text-[#c17f5a] mb-2" />
              <div className="text-sm font-medium">AI reading quotation…</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">~10 seconds</div>
            </div>
          )}

          {quotation && (
            <div className="rounded-[10px] border border-[#7a9e8a] bg-[#f0f5f1] p-4">
              <div className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-[#4f6b5e] mt-0.5" />
                <div className="flex-1 text-sm">
                  <div className="font-medium">{pendingFile?.name}</div>
                  <div className="text-[12px] mt-1">
                    Total {formatINR(Number(quotation.total_amount) || 0)} ·{" "}
                    {quotation.categories.length} categor{quotation.categories.length === 1 ? "y" : "ies"} ·{" "}
                    {quotation.categories.reduce((s, c) => s + c.lines.length, 0)} line items
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    Detected: {quotation.categories.map((c) => c.name).join(", ") || "—"}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="PO Amount (₹)">
              <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                className="w-full h-10 px-3 rounded-[8px] bg-card border border-border text-sm font-mono" placeholder="0" />
            </Field>
            <Field label="Expected Delivery">
              <input type="date" value={delivery} onChange={(e) => setDelivery(e.target.value)}
                className="w-full h-10 px-3 rounded-[8px] bg-card border border-border text-sm" />
            </Field>
            <Field label="Status">
              <select value={status} onChange={(e) => setStatus(e.target.value)}
                className="w-full h-10 px-3 rounded-[8px] bg-card border border-border text-sm">
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="delayed">Delayed</option>
                <option value="completed">Delivered</option>
              </select>
            </Field>
            <Field label="Notes">
              <input value={notes} onChange={(e) => setNotes(e.target.value)}
                className="w-full h-10 px-3 rounded-[8px] bg-card border border-border text-sm" />
            </Field>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-end gap-2 sticky bottom-0 bg-card">
          <button onClick={onClose} className="h-10 px-4 rounded-[6px] border border-border text-sm">Cancel</button>
          <button onClick={() => save.mutate()} disabled={save.isPending || extracting}
            className="h-10 px-5 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium inline-flex items-center gap-2 disabled:opacity-60">
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {mode === "edit" ? "Save Changes" : "Add to Project"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  summary, projectId, onClose,
}: {
  summary: { vendorName: string; cats: string[]; matched: number; byCategory: Record<string, number>; poAmount: number };
  projectId: string;
  onClose: () => void;
}) {
  const entries = Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1]);
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card rounded-[16px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-border">
          <div className="flex items-center gap-2 text-[#7a9e8a]">
            <Check className="h-5 w-5" />
            <div className="font-display text-lg">Vendor added</div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Vendor</div>
            <div className="font-medium">{summary.vendorName}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Scope categories</div>
            <div className="flex flex-wrap gap-1">
              {summary.cats.length === 0 ? (
                <span className="text-xs text-muted-foreground">— none —</span>
              ) : summary.cats.map((c) => (
                <span key={c} className="text-[11px] px-2 py-0.5 rounded-full bg-muted">{c}</span>
              ))}
            </div>
          </div>
          {summary.poAmount > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Contract value</div>
              <div className="font-mono">{formatINR(summary.poAmount)}</div>
            </div>
          )}
          <div className="rounded-[10px] bg-[#f0f5f1] border border-[#cfe0d4] p-4">
            <div className="text-sm font-medium text-[#3a5c47]">
              {summary.matched === 0
                ? `No matching tasks found for ${summary.vendorName}.`
                : `${summary.vendorName} assigned as agency on ${summary.matched} task${summary.matched === 1 ? "" : "s"}`}
            </div>
            {entries.length > 0 && (
              <div className="text-[12px] text-[#4f6b5e] mt-1">
                {entries.map(([k, v]) => `${v} ${k}`).join(" · ")}
              </div>
            )}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="h-10 px-4 rounded-[6px] border border-border text-sm">Close</button>
          {summary.matched > 0 && (
            <button
              onClick={() => {
                onClose();
                // Switch to the Tasks tab via the project page's hash if it listens, otherwise just toast
                window.dispatchEvent(new CustomEvent("pmstudio:goto-tab", { detail: { tab: "tasks", projectId, vendor: summary.vendorName } }));
                toast.info(`Open the Tasks tab to see ${summary.vendorName}'s assignments.`);
              }}
              className="h-10 px-5 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium inline-flex items-center gap-2"
            >
              View assigned tasks <ExternalLink className="h-3.5 w-3.5" />
            </button>
          )}

        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}

