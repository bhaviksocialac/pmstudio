import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Loader2, Upload, Trash2, AlertTriangle, Check, RotateCcw, Filter, Camera } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { BeforeAfterSlider } from "@/components/snags/BeforeAfterSlider";

type SnagStatus = "open" | "in_progress" | "fixed" | "verified" | "closed" | "reopened" | "resolved";

type Snag = {
  id: string;
  description: string;
  photo_url: string | null;
  before_photo_url: string | null;
  after_photo_url: string | null;
  contractor_name: string | null;
  vendor_id: string | null;
  linked_task_id: string | null;
  room: string | null;
  work_type: string | null;
  priority: string;
  raised_date: string | null;
  target_fix_date: string | null;
  deadline: string | null;
  verified_by: string | null;
  reopen_reason: string | null;
  status: SnagStatus;
};

const WORK_TYPES = ["Tiling", "Painting", "Civil", "Carpentry", "Electrical", "Plumbing", "Flooring", "False Ceiling", "Other"];
const PRIORITIES = ["Urgent", "High", "Medium", "Low"];

const STATUS_META: Record<string, { label: string; bg: string; fg: string }> = {
  open: { label: "Open", bg: "#c4685a22", fg: "#8a2a1f" },
  in_progress: { label: "In Progress", bg: "#c17f5a22", fg: "#8a5a1a" },
  fixed: { label: "Fixed", bg: "#7a9e8a22", fg: "#3d6f5a" },
  verified: { label: "Verified", bg: "#7a9e8a30", fg: "#2f4a3d" },
  closed: { label: "Closed", bg: "#2d2d2d18", fg: "#444" },
  reopened: { label: "Reopened", bg: "#c4685a30", fg: "#8a2a1f" },
  resolved: { label: "Resolved", bg: "#7a9e8a22", fg: "#3d6f5a" },
};

const PRIORITY_META: Record<string, { bg: string; fg: string }> = {
  Urgent: { bg: "#c4685a", fg: "#fff" },
  High: { bg: "#c17f5a", fg: "#fff" },
  Medium: { bg: "#d4b96a30", fg: "#8a6a1a" },
  Low: { bg: "#7a9e8a30", fg: "#3d6f5a" },
};

export function SnagsTab({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState<{ prefill?: Partial<Snag> & { description?: string } } | null>(null);
  const [openDetail, setOpenDetail] = useState<string | null>(null);
  const [filterRoom, setFilterRoom] = useState("");
  const [filterWorkType, setFilterWorkType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");

  const { data: snags = [], isLoading } = useQuery({
    queryKey: ["snags", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("snags").select("*").eq("project_id", projectId).order("raised_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Snag[];
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["snag-tasks", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("id,title,description,room,work_type,contractor,vendor_id").eq("project_id", projectId);
      return data ?? [];
    },
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ["snag-vendors"],
    queryFn: async () => {
      const { data } = await supabase.from("vendors").select("id,name,category,phone");
      return data ?? [];
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const isOpenStatus = (s: SnagStatus) => s === "open" || s === "in_progress" || s === "reopened";
  const isOverdue = (s: Snag) => isOpenStatus(s.status) && !!s.target_fix_date && s.target_fix_date < today;

  const summary = useMemo(() => {
    return {
      total: snags.length,
      open: snags.filter((s) => s.status === "open" || s.status === "reopened").length,
      in_progress: snags.filter((s) => s.status === "in_progress").length,
      fixed: snags.filter((s) => s.status === "fixed").length,
      closed: snags.filter((s) => s.status === "closed" || s.status === "verified").length,
      overdue: snags.filter(isOverdue).length,
    };
  }, [snags]);

  const rooms = useMemo(() => Array.from(new Set(snags.map((s) => s.room).filter(Boolean) as string[])), [snags]);

  const filtered = snags.filter((s) => {
    if (filterRoom && s.room !== filterRoom) return false;
    if (filterWorkType && s.work_type !== filterWorkType) return false;
    if (filterStatus && s.status !== filterStatus) return false;
    if (filterPriority && s.priority !== filterPriority) return false;
    return true;
  });

  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-2xl">Snags</h2>
          <p className="text-xs text-muted-foreground mt-1">Quality issues linked to tasks. Open snags block Finishing &amp; Handover milestones.</p>
        </div>
        <button onClick={() => setAdding({})} className="h-10 px-4 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95 inline-flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add Snag
        </button>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        <Stat label="Total" v={summary.total} />
        <Stat label="Open" v={summary.open} accent="#8a2a1f" />
        <Stat label="In Progress" v={summary.in_progress} accent="#8a5a1a" />
        <Stat label="Fixed" v={summary.fixed} accent="#3d6f5a" />
        <Stat label="Closed" v={summary.closed} accent="#444" />
        <Stat label="Overdue" v={summary.overdue} accent="#c4685a" />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <Select v={filterRoom} onChange={setFilterRoom} placeholder="All rooms" opts={rooms} />
        <Select v={filterWorkType} onChange={setFilterWorkType} placeholder="All types" opts={WORK_TYPES} />
        <Select v={filterStatus} onChange={setFilterStatus} placeholder="All statuses" opts={Object.keys(STATUS_META)} />
        <Select v={filterPriority} onChange={setFilterPriority} placeholder="All priorities" opts={PRIORITIES} />
        {(filterRoom || filterWorkType || filterStatus || filterPriority) && (
          <button onClick={() => { setFilterRoom(""); setFilterWorkType(""); setFilterStatus(""); setFilterPriority(""); }} className="text-[11px] text-muted-foreground hover:text-foreground underline">
            Clear
          </button>
        )}
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}

      {!isLoading && filtered.length === 0 && (
        <div className="rounded-[10px] border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No snags yet. Type a quality issue in the AI bar above or click Add Snag.
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((s) => {
          const overdue = isOverdue(s);
          const st = STATUS_META[s.status] ?? STATUS_META.open;
          const pr = PRIORITY_META[s.priority] ?? PRIORITY_META.Medium;
          const linkedTask = s.linked_task_id ? taskMap.get(s.linked_task_id) : null;
          return (
            <button
              key={s.id}
              onClick={() => setOpenDetail(s.id)}
              className={`w-full text-left rounded-[10px] border p-4 flex items-start gap-3 transition hover:shadow ${overdue ? "border-[#c4685a] bg-[#fdf3f1]" : "border-border bg-card"}`}
            >
              <div className="h-16 w-16 rounded-[6px] bg-muted bg-cover bg-center flex-shrink-0 flex items-center justify-center" style={s.before_photo_url || s.photo_url ? { backgroundImage: `url(${s.before_photo_url || s.photo_url})` } : undefined}>
                {!s.before_photo_url && !s.photo_url && <Camera className="h-5 w-5 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{s.description}</div>
                <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-2.5 gap-y-1 mt-1.5">
                  {s.room && <Tag>{s.room}</Tag>}
                  {s.work_type && <Tag>{s.work_type}</Tag>}
                  {s.contractor_name && <span>👤 {s.contractor_name}</span>}
                  {linkedTask && <span className="text-[#c17f5a]">↳ {linkedTask.title.slice(0, 40)}</span>}
                  {s.target_fix_date && (
                    <span className={overdue ? "text-[#c4685a] font-medium inline-flex items-center gap-1" : ""}>
                      {overdue && <AlertTriangle className="h-3 w-3" />}
                      Fix by {s.target_fix_date}{overdue ? " · overdue" : ""}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-medium" style={{ background: pr.bg, color: pr.fg }}>{s.priority}</span>
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-medium" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
              </div>
            </button>
          );
        })}
      </div>

      {adding && (
        <SnagFormModal
          projectId={projectId}
          tasks={tasks}
          vendors={vendors}
          prefill={adding.prefill}
          onClose={() => setAdding(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["snags", projectId] });
            qc.invalidateQueries({ queryKey: ["snags-open", projectId] });
            setAdding(null);
          }}
        />
      )}

      {openDetail && (
        <SnagDetailModal
          snag={snags.find((x) => x.id === openDetail)!}
          tasks={tasks}
          onClose={() => setOpenDetail(null)}
          onChanged={() => {
            qc.invalidateQueries({ queryKey: ["snags", projectId] });
            qc.invalidateQueries({ queryKey: ["snags-open", projectId] });
            qc.invalidateQueries({ queryKey: ["project-milestones", projectId] });
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, v, accent }: { label: string; v: number; accent?: string }) {
  return (
    <div className="rounded-[10px] border border-border bg-card p-3">
      <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="font-display text-xl tabular-nums" style={accent ? { color: accent } : undefined}>{v}</div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{children}</span>;
}

function Select({ v, onChange, placeholder, opts }: { v: string; onChange: (s: string) => void; placeholder: string; opts: string[] }) {
  return (
    <select value={v} onChange={(e) => onChange(e.target.value)} className="h-8 px-2 rounded-[6px] border border-border text-xs bg-card">
      <option value="">{placeholder}</option>
      {opts.map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
    </select>
  );
}

// ============== Add Snag Modal ==============

function SnagFormModal({
  projectId, tasks, vendors, prefill, onClose, onSaved,
}: {
  projectId: string;
  tasks: any[];
  vendors: any[];
  prefill?: Partial<Snag> & { description?: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [description, setDescription] = useState(prefill?.description ?? "");
  const [room, setRoom] = useState(prefill?.room ?? "");
  const [workType, setWorkType] = useState(prefill?.work_type ?? "");
  const [linkedTaskId, setLinkedTaskId] = useState<string>(prefill?.linked_task_id ?? "");
  const [vendorId, setVendorId] = useState<string>(prefill?.vendor_id ?? "");
  const [contractor, setContractor] = useState(prefill?.contractor_name ?? "");
  const [priority, setPriority] = useState(prefill?.priority ?? "Medium");
  const [targetDate, setTargetDate] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // auto-pick most recent done task of same room+work_type
  const autoPickTask = () => {
    if (linkedTaskId || !room || !workType) return;
    const match = tasks.find((t) => t.room === room && t.work_type === workType);
    if (match) {
      setLinkedTaskId(match.id);
      if (!contractor && match.contractor) setContractor(match.contractor);
      if (!vendorId && match.vendor_id) setVendorId(match.vendor_id);
    }
  };

  const submit = useMutation({
    mutationFn: async () => {
      let photo_url: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${user!.id}/${projectId}/snags/${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("project-photos").upload(path, file);
        if (!error) {
          const { data } = supabase.storage.from("project-photos").getPublicUrl(path);
          photo_url = data.publicUrl;
        }
      }
      const vendor = vendors.find((v) => v.id === vendorId);
      const { error } = await supabase.from("snags").insert({
        user_id: user!.id,
        project_id: projectId,
        description,
        room: room || null,
        work_type: workType || null,
        linked_task_id: linkedTaskId || null,
        vendor_id: vendorId || null,
        contractor_name: contractor || vendor?.name || null,
        priority,
        target_fix_date: targetDate || null,
        deadline: targetDate || null,
        photo_url,
        before_photo_url: photo_url,
        status: "open",
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Snag raised"); onSaved(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const ic = "w-full h-10 px-3 rounded-[8px] bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 mt-1";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-card rounded-t-[20px] sm:rounded-[16px] w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
          <h2 className="font-display text-2xl">Raise Snag</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Description *</span>
            <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={ic + " py-2 h-auto"} placeholder="Grout missing in 3 tiles near window…" />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Room</span>
              <input value={room} onBlur={autoPickTask} onChange={(e) => setRoom(e.target.value)} className={ic} placeholder="Living Room" />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Work Type</span>
              <select value={workType} onBlur={autoPickTask} onChange={(e) => setWorkType(e.target.value)} className={ic}>
                <option value="">—</option>
                {WORK_TYPES.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Linked Task</span>
            <select value={linkedTaskId} onChange={(e) => setLinkedTaskId(e.target.value)} className={ic}>
              <option value="">Auto-detect from room + work type</option>
              {tasks.map((t) => <option key={t.id} value={t.id}>{t.title.slice(0, 60)}{t.room ? ` · ${t.room}` : ""}</option>)}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Assigned Vendor</span>
              <select value={vendorId} onChange={(e) => { setVendorId(e.target.value); const v = vendors.find((x) => x.id === e.target.value); if (v) setContractor(v.name); }} className={ic}>
                <option value="">—</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}{v.category ? ` · ${v.category}` : ""}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Contractor name</span>
              <input value={contractor} onChange={(e) => setContractor(e.target.value)} className={ic} placeholder="Or type" />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Priority</span>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className={ic}>
                {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Target fix date</span>
              <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className={ic} />
            </label>
          </div>

          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Before Photo</span>
            <div className="mt-1">
              <label className="h-10 px-3 rounded-[6px] border border-dashed border-border inline-flex items-center gap-1.5 text-xs cursor-pointer hover:bg-muted">
                <Upload className="h-3.5 w-3.5" /> {file ? file.name.slice(0, 28) : "Choose photo"}
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>
          </label>
        </div>
        <div className="px-5 py-4 border-t border-border flex justify-end gap-2 sticky bottom-0 bg-card">
          <button onClick={onClose} className="h-10 px-4 rounded-[6px] border border-border text-sm font-medium hover:bg-muted">Cancel</button>
          <button onClick={() => submit.mutate()} disabled={!description.trim() || submit.isPending}
            className="h-10 px-5 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95 inline-flex items-center gap-2 disabled:opacity-60">
            {submit.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Raise Snag
          </button>
        </div>
      </div>
    </div>
  );
}

// ============== Detail Modal w/ workflow ==============

function SnagDetailModal({ snag, tasks, onClose, onChanged }: { snag: Snag; tasks: any[]; onClose: () => void; onChanged: () => void }) {
  const { user } = useAuth();
  const [afterFile, setAfterFile] = useState<File | null>(null);
  const [reopenReason, setReopenReason] = useState("");
  const [showReopen, setShowReopen] = useState(false);
  const linkedTask = snag.linked_task_id ? tasks.find((t) => t.id === snag.linked_task_id) : null;

  const updateStatus = useMutation({
    mutationFn: async (patch: Partial<Snag> & { status: SnagStatus }) => {
      const update: any = { ...patch };
      if (patch.status === "fixed" && afterFile) {
        const ext = afterFile.name.split(".").pop() || "jpg";
        const path = `${user!.id}/${snag.id}/after-${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("project-photos").upload(path, afterFile);
        if (!error) {
          const { data } = supabase.storage.from("project-photos").getPublicUrl(path);
          update.after_photo_url = data.publicUrl;
        }
      }
      if (patch.status === "verified" || patch.status === "closed") {
        update.verified_at = new Date().toISOString();
      }
      const { error } = await supabase.from("snags").update(update).eq("id", snag.id);
      if (error) throw error;
    },
    onSuccess: () => { onChanged(); onClose(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("snags").delete().eq("id", snag.id);
      if (error) throw error;
    },
    onSuccess: () => { onChanged(); onClose(); toast.success("Snag deleted"); },
  });

  const isFixedOrLater = snag.status === "fixed" || snag.status === "verified" || snag.status === "closed";

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-card rounded-t-[20px] sm:rounded-[16px] w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 sticky top-0 bg-card z-10">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1">Snag · {snag.status.replace("_", " ")}</div>
            <h2 className="font-display text-xl">{snag.description}</h2>
            <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-2">
              {snag.room && <Tag>{snag.room}</Tag>}
              {snag.work_type && <Tag>{snag.work_type}</Tag>}
              {snag.contractor_name && <span>👤 {snag.contractor_name}</span>}
              {snag.priority && <span>· {snag.priority}</span>}
              {snag.target_fix_date && <span>· fix by {snag.target_fix_date}</span>}
              {linkedTask && <span className="text-[#c17f5a]">· task: {linkedTask.title.slice(0, 40)}</span>}
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center shrink-0"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Before/After */}
          {isFixedOrLater && snag.before_photo_url && snag.after_photo_url ? (
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Before ↔ After (drag slider)</div>
              <BeforeAfterSlider before={snag.before_photo_url} after={snag.after_photo_url} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <PhotoCell label="Before" url={snag.before_photo_url || snag.photo_url} />
              <PhotoCell label="After" url={snag.after_photo_url} />
            </div>
          )}

          {snag.reopen_reason && (
            <div className="rounded-[8px] bg-[#fdf3f1] border border-[#c4685a40] p-3 text-xs text-[#8a2a1f]">
              <strong>Reopen reason:</strong> {snag.reopen_reason}
            </div>
          )}

          {/* Workflow actions */}
          <div className="rounded-[10px] border border-border p-4 bg-muted/30">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-3">Next action</div>

            {snag.status === "open" || snag.status === "reopened" ? (
              <button onClick={() => updateStatus.mutate({ status: "in_progress" })} disabled={updateStatus.isPending}
                className="h-10 px-4 rounded-[6px] bg-[#c17f5a] text-white text-sm font-medium hover:brightness-95 inline-flex items-center gap-2">
                Mark In Progress
              </button>
            ) : null}

            {snag.status === "in_progress" && (
              <div className="space-y-3">
                <label className="block">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Upload after photo</span>
                  <div className="mt-1">
                    <label className="h-10 px-3 rounded-[6px] border border-dashed border-border inline-flex items-center gap-1.5 text-xs cursor-pointer hover:bg-muted">
                      <Upload className="h-3.5 w-3.5" /> {afterFile ? afterFile.name.slice(0, 28) : "Choose photo"}
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setAfterFile(e.target.files?.[0] ?? null)} />
                    </label>
                  </div>
                </label>
                <button onClick={() => updateStatus.mutate({ status: "fixed" })} disabled={!afterFile || updateStatus.isPending}
                  className="h-10 px-4 rounded-[6px] bg-[#7a9e8a] text-white text-sm font-medium hover:brightness-95 inline-flex items-center gap-2 disabled:opacity-50">
                  <Check className="h-4 w-4" /> Mark as Fixed
                </button>
              </div>
            )}

            {snag.status === "fixed" && !showReopen && (
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => updateStatus.mutate({ status: "closed" })} disabled={updateStatus.isPending}
                  className="h-10 px-4 rounded-[6px] bg-[#3d6f5a] text-white text-sm font-medium hover:brightness-95 inline-flex items-center gap-2">
                  <Check className="h-4 w-4" /> Verify &amp; Close
                </button>
                <button onClick={() => setShowReopen(true)}
                  className="h-10 px-4 rounded-[6px] border border-[#c4685a] text-[#8a2a1f] text-sm font-medium hover:bg-[#fdf3f1] inline-flex items-center gap-2">
                  <RotateCcw className="h-4 w-4" /> Reopen
                </button>
              </div>
            )}

            {showReopen && (
              <div className="space-y-2">
                <textarea value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} rows={2}
                  className="w-full px-3 py-2 rounded-[6px] border border-border text-sm" placeholder="Why are you reopening this snag?" />
                <div className="flex gap-2">
                  <button onClick={() => updateStatus.mutate({ status: "reopened", reopen_reason: reopenReason })} disabled={!reopenReason.trim() || updateStatus.isPending}
                    className="h-10 px-4 rounded-[6px] bg-[#c4685a] text-white text-sm font-medium disabled:opacity-50">
                    Confirm Reopen
                  </button>
                  <button onClick={() => setShowReopen(false)} className="h-10 px-4 rounded-[6px] border border-border text-sm">Cancel</button>
                </div>
              </div>
            )}

            {(snag.status === "closed" || snag.status === "verified") && (
              <div className="text-sm text-[#3d6f5a] inline-flex items-center gap-2"><Check className="h-4 w-4" /> Closed — milestone can fire</div>
            )}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border flex justify-between sticky bottom-0 bg-card">
          <button onClick={() => remove.mutate()} className="text-[#c4685a] hover:text-[#8a2a1f] text-sm inline-flex items-center gap-1"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
          <button onClick={onClose} className="h-10 px-4 rounded-[6px] border border-border text-sm font-medium hover:bg-muted">Close</button>
        </div>
      </div>
    </div>
  );
}

function PhotoCell({ label, url }: { label: string; url: string | null | undefined }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1.5">{label}</div>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="block w-full aspect-[4/3] rounded-[8px] bg-muted bg-cover bg-center border border-border" style={{ backgroundImage: `url(${url})` }} />
      ) : (
        <div className="w-full aspect-[4/3] rounded-[8px] bg-muted border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground">
          No {label.toLowerCase()} photo
        </div>
      )}
    </div>
  );
}
