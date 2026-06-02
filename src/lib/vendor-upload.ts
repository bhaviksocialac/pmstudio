import { supabase } from "@/integrations/supabase/client";

export const VENDOR_FILE_ACCEPT =
  ".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.csv,application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv";
export const VENDOR_FILE_MAX_BYTES = 25 * 1024 * 1024;

export type VendorDocCategory =
  | "boq"
  | "quotation"
  | "po"
  | "pi"
  | "invoice"
  | "challan"
  | "other";

export const VENDOR_DOC_CATEGORIES: { value: VendorDocCategory; label: string; hint: string }[] = [
  { value: "boq",       label: "BOQ",       hint: "Bill of Quantities" },
  { value: "quotation", label: "Quotation", hint: "Vendor price quote" },
  { value: "po",        label: "PO",        hint: "Purchase Order" },
  { value: "pi",        label: "PI",        hint: "Proforma Invoice" },
  { value: "invoice",   label: "Invoice",   hint: "Tax / payment invoice" },
  { value: "challan",   label: "Challan",   hint: "Delivery challan / gate pass" },
  { value: "other",     label: "Other",     hint: "Custom category" },
];

export function guessCategoryFromName(name: string): VendorDocCategory {
  const n = name.toLowerCase();
  if (/\b(boq|bill[\s_-]?of[\s_-]?quantit)/.test(n)) return "boq";
  if (/\b(quote|quotation|estimate)\b/.test(n)) return "quotation";
  if (/\b(proforma|pro[\s_-]?forma|\bpi[\s_-]?\d)/.test(n)) return "pi";
  if (/\b(invoice|inv[\s_-]?\d|tax[\s_-]?invoice)\b/.test(n)) return "invoice";
  if (/\b(challan|gate[\s_-]?pass|delivery)\b/.test(n)) return "challan";
  if (/\b(po[\s_-]?\d|purchase[\s_-]?order|work[\s_-]?order)\b/.test(n)) return "po";
  return "other";
}

export function validateVendorFile(file: File): string | null {
  if (file.size > VENDOR_FILE_MAX_BYTES) return "File is too large (max 25 MB).";
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const okExt = ["pdf", "jpg", "jpeg", "png", "xlsx", "xls", "csv"].includes(ext);
  if (!okExt) return "Unsupported file type. Use PDF, JPG, PNG, XLSX, XLS, or CSV.";
  return null;
}

export type UploadResult = { path: string; url: string };

/** Upload a vendor file to the project-documents bucket. */
export async function uploadVendorFile(
  file: File,
  opts: { projectId: string; vendorId: string; onProgress?: (pct: number) => void },
): Promise<UploadResult> {
  const err = validateVendorFile(file);
  if (err) throw new Error(err);
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const path = `vendors/${opts.projectId}/${opts.vendorId}/${crypto.randomUUID()}.${ext}`;
  opts.onProgress?.(30);
  const { error } = await supabase.storage
    .from("project-documents")
    .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
  if (error) throw new Error(error.message);
  const { data: pub } = supabase.storage.from("project-documents").getPublicUrl(path);
  opts.onProgress?.(100);
  return { path, url: pub.publicUrl };
}

export async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}
