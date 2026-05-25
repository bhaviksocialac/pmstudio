import { useMemo, useRef, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FilePlus, FolderPlus, Folder, FileText, Image as ImageIcon, ChevronRight,
  ArrowLeft, MoreVertical, Download, Trash2, Pencil, Share2, FolderInput,
  X, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { BoqUploadButton } from "@/components/BoqUploadButton";

const SYSTEM_ROOTS = [
  "Contracts", "Floor Plans", "Invoices", "Drawings", "BOQ",
  "Site Reports", "Warranties", "Other",
] as const;
const DRAWINGS_SUBS = ["IFR", "IFA", "IFC"] as const;
const CATEGORY_TO_FOLDER: Record<string, string> = {
  Contracts: "Contracts", "Floor Plans": "Floor Plans", Invoices: "Invoices",
  Drawings: "Drawings", BOQ: "BOQ", "Site Reports": "Site Reports",
  Warranties: "Warranties", Other: "Other",
};
const ALL_CATEGORIES = [...SYSTEM_ROOTS];

type Doc = {
  id: string; name: string; category: string; folder_path: string;
  file_url: string; storage_path: string; mime_type: string | null;
  file_size: number | null; uploaded_by_name: string | null; created_at: string;
};
type Folder = { id: string; project_id: string; path: string; name: string };

function fmtBytes(n: number | null | undefined) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
const joinPath = (parent: string, name: string) => (parent ? `${parent}/${name}` : name);
const parentOf = (path: string) => path.split("/").slice(0, -1).join("/");

export function DocumentsTab({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [currentPath, setCurrentPath] = useState<string>(""); // "" = root
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<Doc | null>(null);
  const [moveDoc, setMoveDoc] = useState<Doc | null>(null);
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null);
  const [lightboxDoc, setLightboxDoc] = useState<Doc | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Upload state
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingCat, setPendingCat] = useState("Other");
  const [pendingFolder, setPendingFolder] = useState<string>("Other");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dupAsk, setDupAsk] = useState<{ existing: Doc } | null>(null);

  const { data: docs = [] } = useQuery<Doc[]>({
    queryKey: ["project-documents", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_documents").select("*")
        .eq("project_id", projectId).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Doc[];
    },
  });
  const { data: customFolders = [] } = useQuery<Folder[]>({
    queryKey: ["document-folders", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_folders").select("*").eq("project_id", projectId);
      if (error) throw error;
      return (data ?? []) as Folder[];
    },
  });

  // Resolve folders at currentPath: system roots when at "", system subs for Drawings,
  // plus any custom folders whose parent equals currentPath.
  const subfolders = useMemo(() => {
    const out: { path: string; name: string; system: boolean }[] = [];
    if (currentPath === "") {
      for (const r of SYSTEM_ROOTS) out.push({ path: r, name: r, system: true });
    } else if (currentPath === "Drawings") {
      for (const s of DRAWINGS_SUBS) out.push({ path: `Drawings/${s}`, name: s, system: true });
    }
    for (const f of customFolders) {
      if (parentOf(f.path) === currentPath && !out.some((x) => x.path === f.path)) {
        out.push({ path: f.path, name: f.name, system: false });
      }
    }
    return out;
  }, [currentPath, customFolders]);

  const filesHere = useMemo(
    () => docs.filter((d) => (d.folder_path || "Other") === currentPath),
    [docs, currentPath],
  );
  const fileCountByFolder = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of docs) {
      const p = d.folder_path || "Other";
      // count for every ancestor too
      let cur = p;
      while (cur) { m.set(cur, (m.get(cur) ?? 0) + 1); cur = parentOf(cur); }
    }
    return m;
  }, [docs]);

  // ── Upload ────────────────────────────────────────────────
  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) { toast.error("Max 25MB"); return; }
    setPendingFile(f);
    // Default folder = currentPath if inside one, else Other
    const startFolder = currentPath || "Other";
    setPendingFolder(startFolder);
    const rootCat = startFolder.split("/")[0];
    setPendingCat((ALL_CATEGORIES as string[]).includes(rootCat) ? rootCat : "Other");
  };

  const actuallyUpload = async (replaceExistingId?: string) => {
    if (!pendingFile) return;
    setUploading(true); setProgress(10);
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id;
      if (!userId) throw new Error("Not signed in");
      const ext = pendingFile.name.split(".").pop() ?? "bin";
      const path = `${userId}/${projectId}/${crypto.randomUUID()}.${ext}`;
      setProgress(30);
      const up = await supabase.storage.from("project-documents")
        .upload(path, pendingFile, { contentType: pendingFile.type, upsert: false });
      if (up.error) throw up.error;
      setProgress(70);
      const { data: pub } = supabase.storage.from("project-documents").getPublicUrl(path);
      const { data: prof } = await supabase.from("profiles").select("full_name").maybeSingle();

      if (replaceExistingId) {
        // delete old storage + row
        const old = docs.find((d) => d.id === replaceExistingId);
        if (old?.storage_path) {
          await supabase.storage.from("project-documents").remove([old.storage_path]);
        }
        await supabase.from("project_documents").delete().eq("id", replaceExistingId);
      }

      const { error } = await supabase.from("project_documents").insert({
        user_id: userId, project_id: projectId,
        name: pendingFile.name, category: pendingCat,
        folder_path: pendingFolder,
        file_url: pub.publicUrl, storage_path: path,
        mime_type: pendingFile.type, file_size: pendingFile.size,
        uploaded_by_name: prof?.full_name ?? null,
      });
      if (error) throw error;
      setProgress(100);
      toast.success(replaceExistingId ? "File replaced" : "Document uploaded");
      setPendingFile(null); setDupAsk(null);
      qc.invalidateQueries({ queryKey: ["project-documents", projectId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false); setProgress(0);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const doUpload = async () => {
    if (!pendingFile) return;
    // duplicate detection: same filename in the same folder
    const existing = docs.find(
      (d) => d.name.toLowerCase() === pendingFile.name.toLowerCase() &&
             (d.folder_path || "Other") === pendingFolder,
    );
    if (existing) { setDupAsk({ existing }); return; }
    await actuallyUpload();
  };

  // ── File actions ──────────────────────────────────────────
  const doRename = async (id: string) => {
    const v = renameValue.trim();
    if (!v) { setRenameId(null); return; }
    const { error } = await supabase.from("project_documents")
      .update({ name: v }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Renamed"); setRenameId(null); }
    qc.invalidateQueries({ queryKey: ["project-documents", projectId] });
  };
  const doDelete = async () => {
    if (!deleteDoc) return;
    if (deleteDoc.storage_path) {
      await supabase.storage.from("project-documents").remove([deleteDoc.storage_path]);
    }
    const { error } = await supabase.from("project_documents")
      .delete().eq("id", deleteDoc.id);
    if (error) toast.error(error.message);
    else toast.success("Deleted");
    setDeleteDoc(null);
    qc.invalidateQueries({ queryKey: ["project-documents", projectId] });
  };
  const moveFiles = async (ids: string[], target: string) => {
    const { error } = await supabase.from("project_documents")
      .update({ folder_path: target }).in("id", ids);
    if (error) toast.error(error.message);
    else toast.success(`Moved ${ids.length} file${ids.length === 1 ? "" : "s"}`);
    setMoveDoc(null); setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["project-documents", projectId] });
  };
  const doShare = async (d: Doc) => {
    try {
      await navigator.clipboard.writeText(d.file_url);
      toast.success("Share link copied");
    } catch { toast.error("Could not copy link"); }
  };

  const createFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    if (name.includes("/")) { toast.error("No slashes in folder name"); return; }
    const path = joinPath(currentPath, name);
    const { data: u } = await supabase.auth.getUser();
    const userId = u.user?.id;
    if (!userId) return;
    const { error } = await supabase.from("document_folders").insert({
      user_id: userId, project_id: projectId, path, name,
    });
    if (error) toast.error(error.message);
    else { toast.success("Folder created"); setNewFolderName(""); setNewFolderOpen(false); }
    qc.invalidateQueries({ queryKey: ["document-folders", projectId] });
  };

  // ── Drag & drop ───────────────────────────────────────────
  const onFileDragStart = (e: React.DragEvent, docId: string) => {
    const ids = selected.has(docId) ? Array.from(selected) : [docId];
    e.dataTransfer.setData("application/x-doc-ids", JSON.stringify(ids));
    e.dataTransfer.effectAllowed = "move";
  };
  const onFolderDrop = (e: React.DragEvent, target: string) => {
    e.preventDefault(); setDragOver(null);
    try {
      const ids: string[] = JSON.parse(e.dataTransfer.getData("application/x-doc-ids") || "[]");
      if (ids.length) moveFiles(ids, target);
    } catch { /* noop */ }
  };

  // close menu on outside click
  useEffect(() => {
    if (!menuOpenId) return;
    const h = () => setMenuOpenId(null);
    window.addEventListener("click", h);
    return () => window.removeEventListener("click", h);
  }, [menuOpenId]);

  const allFolderPaths = useMemo(() => {
    const set = new Set<string>(SYSTEM_ROOTS);
    DRAWINGS_SUBS.forEach((s) => set.add(`Drawings/${s}`));
    customFolders.forEach((f) => set.add(f.path));
    return Array.from(set).sort();
  }, [customFolders]);

  const crumbs = currentPath ? currentPath.split("/") : [];

  return (
    <div className="space-y-6 relative">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {currentPath && (
            <button onClick={() => setCurrentPath(parentOf(currentPath))}
              className="h-9 w-9 rounded-[6px] border border-border bg-card hover:bg-muted inline-flex items-center justify-center">
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="flex items-center gap-1 text-sm font-medium min-w-0">
            <button onClick={() => setCurrentPath("")} className="hover:underline">Documents</button>
            {crumbs.map((c, i) => {
              const p = crumbs.slice(0, i + 1).join("/");
              return (
                <span key={p} className="flex items-center gap-1 min-w-0">
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <button onClick={() => setCurrentPath(p)} className="hover:underline truncate">{c}</button>
                </span>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <BoqUploadButton projectId={projectId} />
          <button onClick={() => setNewFolderOpen(true)}
            className="h-9 px-3 rounded-[6px] border border-border bg-card text-xs font-medium hover:bg-muted inline-flex items-center gap-1.5">
            <FolderPlus className="h-3.5 w-3.5" /> New Folder
          </button>
          <input ref={fileRef} type="file" hidden onChange={onPick}
            accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx,.xls,.dwg,.dxf,.zip,application/pdf,image/*" />
          <button onClick={() => fileRef.current?.click()}
            className="h-9 px-3 rounded-[6px] bg-primary text-primary-foreground text-xs font-medium hover:brightness-95 inline-flex items-center gap-1.5">
            <FilePlus className="h-3.5 w-3.5" /> Upload Document
          </button>
        </div>
      </div>

      {/* Upload dialog */}
      {pendingFile && (
        <Card className="p-4 flex flex-wrap items-center gap-3">
          <FileText className="h-5 w-5 text-[#c17f5a]" />
          <div className="flex-1 min-w-[180px]">
            <div className="text-sm font-medium truncate">{pendingFile.name}</div>
            <div className="text-[11px] text-muted-foreground">{fmtBytes(pendingFile.size)}</div>
          </div>
          <label className="text-[11px] text-muted-foreground">Category</label>
          <select value={pendingCat}
            onChange={(e) => {
              const v = e.target.value; setPendingCat(v);
              if (CATEGORY_TO_FOLDER[v]) setPendingFolder(CATEGORY_TO_FOLDER[v]);
            }}
            className="h-9 px-2 rounded-[6px] border border-border bg-card text-xs">
            {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <label className="text-[11px] text-muted-foreground">Folder</label>
          <select value={pendingFolder} onChange={(e) => setPendingFolder(e.target.value)}
            className="h-9 px-2 rounded-[6px] border border-border bg-card text-xs">
            {allFolderPaths.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          {uploading ? (
            <div className="flex items-center gap-2">
              <div className="h-2 w-32 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-[#c17f5a] transition-all" style={{ width: `${progress}%` }} />
              </div>
              <Loader2 className="h-4 w-4 animate-spin text-[#c17f5a]" />
            </div>
          ) : (
            <>
              <button onClick={doUpload}
                className="h-9 px-4 rounded-[6px] bg-primary text-primary-foreground text-xs font-medium">Upload</button>
              <button onClick={() => setPendingFile(null)}
                className="h-9 px-3 rounded-[6px] border border-border text-xs">Cancel</button>
            </>
          )}
        </Card>
      )}

      {/* Duplicate dialog */}
      {dupAsk && (
        <Modal onClose={() => setDupAsk(null)}>
          <h3 className="font-display text-xl mb-2">File already exists</h3>
          <p className="text-sm text-muted-foreground mb-5">
            <span className="font-medium text-foreground">{dupAsk.existing.name}</span> already
            exists in <span className="font-medium text-foreground">{dupAsk.existing.folder_path || "Other"}</span>.
            Replace it or keep both copies?
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setDupAsk(null)}
              className="h-9 px-3 rounded-[6px] border border-border text-xs">Cancel</button>
            <button onClick={() => actuallyUpload()}
              className="h-9 px-3 rounded-[6px] border border-border text-xs">Keep both</button>
            <button onClick={() => actuallyUpload(dupAsk.existing.id)}
              className="h-9 px-3 rounded-[6px] bg-primary text-primary-foreground text-xs">Replace</button>
          </div>
        </Modal>
      )}

      {/* New folder modal */}
      {newFolderOpen && (
        <Modal onClose={() => setNewFolderOpen(false)}>
          <h3 className="font-display text-xl mb-2">New folder</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Created inside <span className="font-medium text-foreground">{currentPath || "Documents"}</span>
          </p>
          <input autoFocus value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createFolder()}
            placeholder="Folder name"
            className="w-full h-10 px-3 rounded-[6px] border border-border bg-card text-sm mb-4" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setNewFolderOpen(false)}
              className="h-9 px-3 rounded-[6px] border border-border text-xs">Cancel</button>
            <button onClick={createFolder}
              className="h-9 px-3 rounded-[6px] bg-primary text-primary-foreground text-xs">Create</button>
          </div>
        </Modal>
      )}

      {/* Selection bar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between bg-[#fff7eb] border border-[#e8d5b8] rounded-[8px] px-3 py-2 text-xs">
          <span>{selected.size} selected</span>
          <div className="flex gap-2">
            <button onClick={() => { const first = docs.find((d) => selected.has(d.id)); if (first) setMoveDoc(first); }}
              className="h-7 px-2 rounded-[5px] border border-border bg-card">Move</button>
            <button onClick={() => setSelected(new Set())}
              className="h-7 px-2 rounded-[5px] border border-border bg-card">Clear</button>
          </div>
        </div>
      )}

      {/* Folder grid */}
      {subfolders.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Folders</div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {subfolders.map((f) => {
              const cnt = fileCountByFolder.get(f.path) ?? 0;
              const hl = dragOver === f.path;
              return (
                <button key={f.path}
                  onClick={() => setCurrentPath(f.path)}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(f.path); }}
                  onDragLeave={() => setDragOver((p) => p === f.path ? null : p)}
                  onDrop={(e) => onFolderDrop(e, f.path)}
                  className={`flex items-center gap-3 p-4 rounded-[10px] border text-left transition-colors ${
                    hl ? "border-[#c17f5a] bg-[#fff7eb]" : "border-border bg-card hover:bg-muted"
                  }`}>
                  <Folder className="h-5 w-5 text-[#c17f5a] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{f.name}</div>
                    <div className="text-[11px] text-muted-foreground">{cnt} file{cnt === 1 ? "" : "s"}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Files */}
      <div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Files</div>
        {filesHere.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground border border-dashed border-border rounded-[10px]">
            No files in this folder. Click Upload Document to add one.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filesHere.map((d) => {
              const isImage = (d.mime_type ?? "").startsWith("image/");
              const isPdf = (d.mime_type ?? "").includes("pdf") || d.name.toLowerCase().endsWith(".pdf");
              const isExcel = /(excel|sheet|xls)/i.test(d.mime_type ?? "") || /\.(xlsx?|csv)$/i.test(d.name);
              const checked = selected.has(d.id);
              const openFile = () => {
                if (isPdf) setPreviewDoc(d);
                else if (isImage) setLightboxDoc(d);
                else if (isExcel) {
                  const a = document.createElement("a");
                  a.href = d.file_url; a.download = d.name; a.click();
                } else window.open(d.file_url, "_blank");
              };
              return (
                <Card key={d.id}
                  draggable
                  onDragStart={(e) => onFileDragStart(e, d.id)}
                  className={`p-4 relative cursor-pointer hover:-translate-y-[2px] transition-transform ${
                    checked ? "ring-2 ring-[#c17f5a]" : ""
                  }`}
                  onClick={openFile}>
                  <div className="absolute top-2 left-2" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={checked}
                      onChange={(e) => {
                        const s = new Set(selected);
                        if (e.target.checked) s.add(d.id); else s.delete(d.id);
                        setSelected(s);
                      }} />
                  </div>
                  <div className="absolute top-2 right-2" onClick={(e) => e.stopPropagation()}>
                    <button onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === d.id ? null : d.id); }}
                      className="h-7 w-7 rounded-[5px] hover:bg-muted inline-flex items-center justify-center">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {menuOpenId === d.id && (
                      <div className="absolute right-0 top-8 z-30 w-44 bg-card border border-border rounded-[8px] shadow-lg py-1 text-xs">
                        <MenuItem icon={<Pencil className="h-3.5 w-3.5" />}
                          onClick={() => { setRenameId(d.id); setRenameValue(d.name); setMenuOpenId(null); }}>
                          Rename
                        </MenuItem>
                        <MenuItem icon={<FolderInput className="h-3.5 w-3.5" />}
                          onClick={() => { setMoveDoc(d); setMenuOpenId(null); }}>
                          Move to folder
                        </MenuItem>
                        <MenuItem icon={<Download className="h-3.5 w-3.5" />}
                          onClick={() => {
                            const a = document.createElement("a");
                            a.href = d.file_url; a.download = d.name; a.click();
                            setMenuOpenId(null);
                          }}>
                          Download
                        </MenuItem>
                        <MenuItem icon={<Share2 className="h-3.5 w-3.5" />}
                          onClick={() => { doShare(d); setMenuOpenId(null); }}>
                          Share
                        </MenuItem>
                        <div className="h-px bg-border my-1" />
                        <MenuItem icon={<Trash2 className="h-3.5 w-3.5" />} danger
                          onClick={() => { setDeleteDoc(d); setMenuOpenId(null); }}>
                          Delete
                        </MenuItem>
                      </div>
                    )}
                  </div>
                  <div className="h-12 w-12 rounded-[10px] bg-[#fff7eb] flex items-center justify-center mb-3 mt-4">
                    {isImage ? <ImageIcon className="h-5 w-5 text-[#c17f5a]" /> : <FileText className="h-5 w-5 text-[#c17f5a]" />}
                  </div>
                  {renameId === d.id ? (
                    <input autoFocus value={renameValue}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => doRename(d.id)}
                      onKeyDown={(e) => { if (e.key === "Enter") doRename(d.id); if (e.key === "Escape") setRenameId(null); }}
                      className="w-full h-8 px-2 rounded-[5px] border border-border bg-card text-sm" />
                  ) : (
                    <div className="text-sm font-medium truncate">{d.name}</div>
                  )}
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                    {d.category} · {fmtBytes(d.file_size)}
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border text-[11px] text-muted-foreground font-mono">
                    <span className="truncate">{d.uploaded_by_name ?? "—"}</span>
                    <span>{new Date(d.created_at).toLocaleDateString()}</span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Move dialog */}
      {moveDoc && (
        <Modal onClose={() => setMoveDoc(null)}>
          <h3 className="font-display text-xl mb-3">Move to folder</h3>
          <div className="max-h-72 overflow-y-auto space-y-1 mb-4">
            {allFolderPaths.map((p) => (
              <button key={p}
                onClick={() => {
                  const ids = selected.size > 0 && selected.has(moveDoc.id)
                    ? Array.from(selected) : [moveDoc.id];
                  moveFiles(ids, p);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-[6px] hover:bg-muted text-left text-sm">
                <Folder className="h-4 w-4 text-[#c17f5a]" /> {p}
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <button onClick={() => setMoveDoc(null)}
              className="h-9 px-3 rounded-[6px] border border-border text-xs">Cancel</button>
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      {deleteDoc && (
        <Modal onClose={() => setDeleteDoc(null)}>
          <h3 className="font-display text-xl mb-2">Delete file?</h3>
          <p className="text-sm text-muted-foreground mb-5">
            <span className="font-medium text-foreground">{deleteDoc.name}</span> will be permanently deleted.
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setDeleteDoc(null)}
              className="h-9 px-3 rounded-[6px] border border-border text-xs">Cancel</button>
            <button onClick={doDelete}
              className="h-9 px-3 rounded-[6px] bg-red-600 text-white text-xs">Delete</button>
          </div>
        </Modal>
      )}

      {/* PDF preview side panel */}
      {previewDoc && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/50" onClick={() => setPreviewDoc(null)} />
          <div className="w-full max-w-[640px] bg-background border-l border-border flex flex-col">
            <div className="flex items-center justify-between p-3 border-b border-border">
              <div className="text-sm font-medium truncate">{previewDoc.name}</div>
              <button onClick={() => setPreviewDoc(null)} className="h-8 w-8 rounded-[5px] hover:bg-muted inline-flex items-center justify-center">
                <X className="h-4 w-4" />
              </button>
            </div>
            <iframe title="preview" src={previewDoc.file_url} className="flex-1 w-full" />
          </div>
        </div>
      )}

      {/* Image lightbox */}
      {lightboxDoc && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-6" onClick={() => setLightboxDoc(null)}>
          <button className="absolute top-4 right-4 h-9 w-9 rounded-full bg-white/10 text-white inline-flex items-center justify-center">
            <X className="h-5 w-5" />
          </button>
          <img src={lightboxDoc.file_url} alt={lightboxDoc.name}
            className="max-h-full max-w-full rounded-[8px]"
            onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  children, icon, onClick, danger,
}: { children: React.ReactNode; icon: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-left ${danger ? "text-red-600" : ""}`}>
      {icon} {children}
    </button>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background border border-border rounded-[12px] p-6 max-w-md w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
