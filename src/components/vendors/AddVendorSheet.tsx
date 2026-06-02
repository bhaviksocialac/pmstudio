import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, X, Upload, Check, FileText, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { VendorAutocomplete } from "@/components/VendorAutocomplete";
import { VendorModal } from "@/routes/_authenticated/vendors";
import {
  VENDOR_FILE_ACCEPT, validateVendorFile, uploadVendorFile, fileToBase64,
  guessCategoryFromName, VENDOR_DOC_CATEGORIES, type VendorDocCategory,
} from "@/lib/vendor-upload";
import { parseVendorQuotation, type VendorParseResult } from "@/lib/vendor-quotation-ai.functions";
import type { DbVendor } from "@/lib/db-types";
import { VendorQuotationReviewSheet } from "@/components/vendors/VendorQuotationReviewSheet";

type Step = "pick" | "create-master" | "form" | "review";

export function AddVendorSheet({
  projectId, existingVendorIds, onClose,
}: {
  projectId: string;
  existingVendorIds: string[];
  onClose: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>("pick");
  const [vendor, setVendor] = useState<DbVendor | null>(null);
  const [creatingName, setCreatingName] = useState<string | null>(null);

  const [scope, setScope] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadDone, setUploadDone] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [parseResult, setParseResult] = useState<VendorParseResult | null>(null);
  const [projectVendorId, setProjectVendorId] = useState<string | null>(null);
  const parseFn = useServerFn(parseVendorQuotation);

  const handleFile = (f: File) => {
    const err = validateVendorFile(f);
    if (err) { toast.error(err); return; }
    setFile(f);
    setUploadDone(false);
    setUploadError(null);
    setUploadPct(0);
  };

  const submit = useMutation({
    mutationFn: async () => {
      if (!user || !vendor) throw new Error("Pick a vendor first.");
      const category: VendorDocCategory = file ? guessCategoryFromName(file.name) : "other";

      // 1. Create project_vendors row
      const { data: pv, error: pvErr } = await supabase
        .from("project_vendors")
        .insert({
          user_id: user.id,
          project_id: projectId,
          vendor_id: vendor.id,
          scope: scope.trim() || null,
          status: "pending",
        })
        .select("id")
        .single();
      if (pvErr) throw new Error(`Could not link vendor: ${pvErr.message}`);
      const pvId = pv.id as string;
      setProjectVendorId(pvId);

      // 2. Upload file if provided
      if (file) {
        try {
          const up = await uploadVendorFile(file, {
            projectId,
            vendorId: vendor.id,
            onProgress: setUploadPct,
          });
          setUploadDone(true);

          const { error: vdErr } = await supabase.from("vendor_documents").insert({
            user_id: user.id,
            project_id: projectId,
            vendor_id: vendor.id,
            project_vendor_id: pvId,
            name: file.name,
            category,
            storage_path: up.path,
            file_url: up.url,
            mime_type: file.type || null,
            file_size: file.size,
          });
          if (vdErr) throw new Error(`File saved but record failed: ${vdErr.message}`);

          // 3. AI parse (only quotations / BOQs)
          if (category === "quotation" || category === "boq" || category === "other") {
            const base64 = await fileToBase64(file);
            const res = await parseFn({
              data: {
                projectId,
                vendorName: vendor.company_name || vendor.name,
                fileBase64: base64,
                filename: file.name,
                mime: file.type || "application/octet-stream",
              },
            });
            if (res.items.length === 0) {
              toast.info("No line items detected. Vendor added without tasks.");
              qc.invalidateQueries({ queryKey: ["project_vendors", projectId] });
              qc.invalidateQueries({ queryKey: ["vendor-documents", projectId] });
              onClose();
              return;
            }
            setParseResult(res);
            setStep("review");
            return;
          }
        } catch (e) {
          setUploadError(e instanceof Error ? e.message : "Upload failed");
          throw e;
        }
      }

      toast.success(`${vendor.company_name || vendor.name} added to project`);
      qc.invalidateQueries({ queryKey: ["project_vendors", projectId] });
      qc.invalidateQueries({ queryKey: ["vendor-documents", projectId] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  useEffect(() => { if (vendor) setStep("form"); }, [vendor]);

  if (step === "review" && parseResult && projectVendorId && vendor) {
    return (
      <VendorQuotationReviewSheet
        projectId={projectId}
        projectVendorId={projectVendorId}
        vendorId={vendor.id}
        vendorName={vendor.company_name || vendor.name}
        parseResult={parseResult}
        onClose={() => {
          qc.invalidateQueries({ queryKey: ["project_vendors", projectId] });
          qc.invalidateQueries({ queryKey: ["vendor-documents", projectId] });
          onClose();
        }}
      />
    );
  }

  if (creatingName !== null) {
    return (
      <VendorModal
        initialName={creatingName}
        onClose={() => setCreatingName(null)}
        onCreated={(v) => { setCreatingName(null); setVendor(v); }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-xl bg-card rounded-[16px] shadow-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Add Vendor to Project</div>
            <h3 className="font-display text-xl">{vendor ? (vendor.company_name || vendor.name) : "Pick or create vendor"}</h3>
          </div>
          <button onClick={onClose} className="h-9 w-9 rounded-[10px] hover:bg-muted flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>

        {step === "pick" && (
          <div className="p-6 space-y-3">
            <p className="text-xs text-muted-foreground">Search your master vendor list, or create a new one.</p>
            <VendorAutocomplete
              excludeIds={existingVendorIds}
              onSelect={(v) => setVendor(v)}
              onCreateNew={(name) => setCreatingName(name)}
            />
            <button
              onClick={() => setCreatingName("")}
              className="w-full h-10 rounded-[8px] border border-dashed border-border text-xs font-medium hover:bg-muted"
            >+ New vendor in master list</button>
          </div>
        )}

        {step === "form" && vendor && (
          <div className="p-6 space-y-5">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Scope of work (optional)</div>
              <textarea
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 rounded-[8px] bg-card border border-border text-sm"
                placeholder="e.g. Civil + plumbing for master bath"
              />
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Upload quotation or BOQ <span className="text-muted-foreground/70 normal-case">(AI auto-creates tasks)</span>
              </div>

              {!file && (
                <label
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault(); setDragOver(false);
                    const f = e.dataTransfer.files?.[0]; if (f) handleFile(f);
                  }}
                  className={`block rounded-[10px] border border-dashed p-6 text-center cursor-pointer transition ${
                    dragOver ? "border-[#c17f5a] bg-[#fff7eb]" : "border-border hover:bg-muted/50"
                  }`}
                >
                  <Upload className="h-5 w-5 mx-auto text-[#c17f5a] mb-2" />
                  <div className="text-sm font-medium">Drop file here, or click to browse</div>
                  <div className="text-[11px] text-muted-foreground mt-1">PDF · XLSX · XLS · CSV · JPG · PNG (max 25 MB)</div>
                  <input
                    type="file"
                    hidden
                    accept={VENDOR_FILE_ACCEPT}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.currentTarget.value = ""; }}
                  />
                </label>
              )}

              {file && (
                <div className="rounded-[10px] border border-border p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-[#c17f5a] shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{file.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)} MB · Will be saved as{" "}
                        <span className="font-medium">
                          {VENDOR_DOC_CATEGORIES.find((c) => c.value === guessCategoryFromName(file.name))?.label}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => { setFile(null); setUploadDone(false); setUploadError(null); }}
                      className="text-muted-foreground hover:text-foreground"
                    ><X className="h-4 w-4" /></button>
                  </div>

                  {submit.isPending && !uploadDone && !uploadError && (
                    <div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-[#c17f5a] transition-all" style={{ width: `${uploadPct}%` }} />
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1 inline-flex items-center gap-1.5">
                        <Loader2 className="h-3 w-3 animate-spin" /> Uploading & reading…
                      </div>
                    </div>
                  )}

                  {uploadDone && !uploadError && (
                    <div className="text-[11px] inline-flex items-center gap-1.5 text-[#4f6b5e]">
                      <Check className="h-3.5 w-3.5" /> Uploaded
                    </div>
                  )}

                  {uploadError && (
                    <div className="text-[11px] text-[#c4685a] bg-[#fff0ee] border border-[#f1d4ce] rounded-[6px] px-2 py-1.5">
                      {uploadError}
                    </div>
                  )}
                </div>
              )}
            </div>

            {file && (
              <div className="rounded-[10px] bg-[#fff7eb] border border-[#f1e0c4] p-3 text-[11px] text-[#6a3f27] inline-flex items-start gap-2">
                <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>AI will read this file, detect work types and budgets, and propose tasks for your review.</span>
              </div>
            )}
          </div>
        )}

        {step === "form" && (
          <div className="px-6 py-4 border-t border-border flex justify-end gap-2 sticky bottom-0 bg-card">
            <button onClick={onClose} className="h-10 px-4 rounded-[6px] border border-border text-sm">Cancel</button>
            <button
              onClick={() => submit.mutate()}
              disabled={submit.isPending || !vendor}
              className="h-10 px-5 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium inline-flex items-center gap-2 disabled:opacity-60"
            >
              {submit.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Add to Project
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
