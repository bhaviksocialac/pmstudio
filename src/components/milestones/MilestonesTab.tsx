import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Plus, Loader2, X, Check, Diamond, AlertTriangle, FileText, MessageSquare, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { listMilestones, createMilestones, deleteMilestone, suggestMilestones, type MilestoneWithProgress, type SuggestedMilestone } from "@/lib/milestones.functions";
import { EXECUTION_PHASE_GROUPS } from "@/lib/phase-sync";
import { supabase } from "@/integrations/supabase/client";

const formatINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export function MilestonesTab({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listMilestones);
  const suggestFn = useServerFn(suggestMilestones);
  const createFn = useServerFn(createMilestones);
  const deleteFn = useServerFn(deleteMilestone);

  const { data: milestones = [], isLoading } = useQuery({
    queryKey: ["project-milestones", projectId],
    queryFn: () => listFn({ data: { projectId } }),
  });

  const [suggestions, setSuggestions] = useState<SuggestedMilestone[] | null>(null);
  const [customOpen, setCustomOpen] = useState(false);

  const suggest = useMutation({
    mutationFn: () => suggestFn({ data: { projectId } }),
    onSuccess: (r) => {
      if (!r.suggestions.length) toast.info("AI didn't find enough context yet. Add a few tasks first.");
      else setSuggestions(r.suggestions.map((s) => ({ ...s })));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const create = useMutation({
    mutationFn: (ms: SuggestedMilestone[]) => createFn({ data: { projectId, milestones: ms } }),
    onSuccess: ({ created }) => {
      toast.success(`Added ${created} milestone${created === 1 ? "" : "s"}`);
      setSuggestions(null);
      setCustomOpen(false);
      qc.invalidateQueries({ queryKey: ["project-milestones", projectId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-milestones", projectId] }),
  });

  const totalRevenue = milestones.reduce((s, m) => s + m.invoice_amount, 0);
  const triggeredRevenue = milestones.filter((m) => m.status !== "pending").reduce((s, m) => s + m.invoice_amount, 0);
  const completedCount = milestones.filter((m) => m.status !== "pending").length;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-2xl">Milestones</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Each milestone fires automatically when all its trigger tasks are Done — invoice + client update drafted for one-tap approval.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => suggest.mutate()}
            disabled={suggest.isPending}
            className="h-10 px-3 inline-flex items-center gap-1.5 rounded-[6px] bg-[#c17f5a] text-white text-sm font-medium hover:brightness-95 disabled:opacity-50"
          >
            {suggest.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            AI-suggest milestones
          </button>
          <button
            onClick={() => setCustomOpen(true)}
            className="h-10 px-3 inline-flex items-center gap-1.5 rounded-[6px] border border-border text-sm font-medium hover:bg-muted"
          >
            <Plus className="h-4 w-4" /> Custom milestone
          </button>
        </div>
      </header>

      {milestones.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Stat label="Milestones complete" value={`${completedCount} of ${milestones.length}`} />
          <Stat label="Revenue triggered" value={formatINR(triggeredRevenue)} />
          <Stat label="Revenue planned" value={formatINR(totalRevenue)} />
        </div>
      )}

      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
      ) : milestones.length === 0 ? (
        <div className="rounded-[16px] border border-dashed border-border p-10 text-center">
          <Diamond className="h-8 w-8 text-[#c17f5a] mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No milestones yet. Ask AI to suggest from your BOQ + tasks, or add one manually.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {milestones.map((m) => <MilestoneCard key={m.id} m={m} onDelete={() => del.mutate(m.id)} />)}
        </div>
      )}

      {suggestions && (
        <SuggestModal
          suggestions={suggestions}
          onClose={() => setSuggestions(null)}
          onConfirm={(picked) => create.mutate(picked)}
          saving={create.isPending}
        />
      )}
      {customOpen && (
        <CustomModal
          projectId={projectId}
          onClose={() => setCustomOpen(false)}
          onSave={(m) => create.mutate([m])}
          saving={create.isPending}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] bg-card border border-border p-4">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1">{label}</div>
      <div className="font-display text-2xl tabular-nums">{value}</div>
    </div>
  );
}

function MilestoneCard({ m, onDelete }: { m: MilestoneWithProgress; onDelete: () => void }) {
  const { progress } = m;
  const triggered = m.status !== "pending";
  const onTime = m.triggered_on_time !== false;
  return (
    <div
      className={`rounded-[14px] border p-5 ${triggered ? "border-[#cfe0d4] bg-[#f4f9f5]" : progress.delayed ? "border-[#e8d4a8] bg-[#fff7eb]" : "border-border bg-card"}`}
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {triggered && (
              <Diamond className="h-4 w-4" style={{ color: onTime ? "#3d6f5a" : "#c4685a", fill: onTime ? "#3d6f5a" : "#c4685a" }} />
            )}
            <h3 className="font-display text-lg truncate">{m.name}</h3>
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-muted text-muted-foreground">{m.kind.replace("_", " ")}</span>
            {progress.delayed && !triggered && (
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-[#d4882a]/20 text-[#8a5a1a] inline-flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> trigger task delayed
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            Triggers when: <span className="font-medium text-foreground">{triggerSummary(m)}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-display text-xl tabular-nums">{formatINR(m.invoice_amount)}</div>
          <StatusPill status={m.status} />
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
          <span>{progress.done} of {progress.total} trigger tasks done</span>
          <span className="font-mono">{progress.pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full transition-all"
            style={{ width: `${progress.pct}%`, background: progress.complete ? "#7a9e8a" : "#c17f5a" }}
          />
        </div>
      </div>

      {triggered && (
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-border/60">
          {m.invoice_id && (
            <a href="#finance" className="h-8 px-3 inline-flex items-center gap-1.5 rounded-[6px] border border-border text-xs font-medium hover:bg-white">
              <FileText className="h-3.5 w-3.5" /> View invoice
            </a>
          )}
          {m.approval_id && (
            <a href="#approvals" className="h-8 px-3 inline-flex items-center gap-1.5 rounded-[6px] border border-border text-xs font-medium hover:bg-white">
              <MessageSquare className="h-3.5 w-3.5" /> Review client message
            </a>
          )}
          {m.triggered_at && (
            <span className="text-[11px] text-muted-foreground ml-auto">
              ◆ Triggered {new Date(m.triggered_at).toLocaleDateString()}
            </span>
          )}
        </div>
      )}

      {!triggered && (
        <div className="flex items-center justify-end mt-3">
          <button onClick={onDelete} className="text-[11px] text-muted-foreground hover:text-[#c4685a] inline-flex items-center gap-1">
            <Trash2 className="h-3 w-3" /> Remove
          </button>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: MilestoneWithProgress["status"] }) {
  const map: Record<string, { label: string; bg: string; fg: string }> = {
    pending: { label: "Pending", bg: "bg-muted", fg: "text-muted-foreground" },
    triggered: { label: "Triggered", bg: "bg-[#7a9e8a]/20", fg: "text-[#3d6f5a]" },
    invoice_sent: { label: "Invoice sent", bg: "bg-[#c17f5a]/20", fg: "text-[#8a5a1a]" },
    paid: { label: "Paid", bg: "bg-[#7a9e8a]/30", fg: "text-[#3d6f5a]" },
  };
  const v = map[status] ?? map.pending;
  return <div className={`mt-1 inline-block text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${v.bg} ${v.fg}`}>{v.label}</div>;
}

function triggerSummary(m: MilestoneWithProgress): string {
  switch (m.kind) {
    case "room": return `all tasks in ${m.trigger.room ?? "—"} are Done`;
    case "phase": return `all ${m.trigger.phase ?? "—"} phase tasks are Done`;
    case "work_type": return `all ${m.trigger.work_type ?? "—"} tasks across all rooms are Done`;
    case "custom": return `${m.trigger.task_ids?.length ?? 0} specific tasks are Done`;
  }
}

// ---------------- Suggestion review modal ----------------

function SuggestModal({
  suggestions, onClose, onConfirm, saving,
}: {
  suggestions: SuggestedMilestone[];
  onClose: () => void;
  onConfirm: (ms: SuggestedMilestone[]) => void;
  saving: boolean;
}) {
  const [list, setList] = useState(suggestions.map((s) => ({ ...s, _picked: true })));

  const picked = list.filter((s) => s._picked).map(({ _picked: _p, ...rest }) => rest);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center p-0 md:p-6" onClick={onClose}>
      <div className="bg-background w-full md:max-w-2xl md:rounded-[16px] border border-border max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#c17f5a] mb-1">AI suggestion</div>
            <h3 className="font-display text-xl">Review milestones</h3>
          </div>
          <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {list.map((s, i) => (
            <label key={i} className={`block rounded-[10px] border p-4 cursor-pointer ${s._picked ? "border-[#c17f5a] bg-[#fff7eb]" : "border-border bg-card"}`}>
              <div className="flex items-start gap-3">
                <input type="checkbox" checked={s._picked} onChange={(e) => setList(l => l.map((x, j) => j === i ? { ...x, _picked: e.target.checked } : x))} className="mt-1" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      value={s.name}
                      onChange={(e) => setList(l => l.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                      className="font-medium text-sm bg-transparent flex-1 min-w-0 outline-none border-b border-transparent focus:border-[#c17f5a]"
                    />
                    <div className="flex items-center gap-1 text-xs">
                      <span>₹</span>
                      <input
                        type="number"
                        value={s.invoice_amount}
                        onChange={(e) => setList(l => l.map((x, j) => j === i ? { ...x, invoice_amount: Number(e.target.value) || 0 } : x))}
                        className="w-28 text-right bg-transparent outline-none border-b border-transparent focus:border-[#c17f5a]"
                      />
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {s.kind} · {s.trigger.room ?? s.trigger.phase ?? s.trigger.work_type ?? "—"}
                  </div>
                  {s.description && <p className="text-xs text-muted-foreground mt-1">{s.description}</p>}
                </div>
              </div>
            </label>
          ))}
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="h-10 px-4 rounded-[6px] border border-border text-sm font-medium hover:bg-muted">Cancel</button>
          <button
            onClick={() => onConfirm(picked)}
            disabled={!picked.length || saving}
            className="h-10 px-4 rounded-[6px] bg-[#c17f5a] text-white text-sm font-medium hover:brightness-95 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Add {picked.length} milestone{picked.length === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------- Custom milestone modal ----------------

const WORK_TYPES = ["Survey", "Design", "Procurement", "Civil", "Electrical", "Plumbing", "HVAC", "Flooring", "Tiling", "Carpentry", "Painting", "False Ceiling", "Snags", "Handover"];

function CustomModal({
  projectId, onClose, onSave, saving,
}: {
  projectId: string;
  onClose: () => void;
  onSave: (m: SuggestedMilestone) => void;
  saving: boolean;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<SuggestedMilestone["kind"]>("work_type");
  const [room, setRoom] = useState("");
  const [phase, setPhase] = useState<string>("Execution");
  const [workType, setWorkType] = useState("Flooring");
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState("");

  const { data: rooms = [] } = useQuery({
    queryKey: ["project-rooms-min", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("project_rooms").select("name").eq("project_id", projectId).order("order_index");
      return (data ?? []).map((r) => r.name);
    },
  });

  const trigger = kind === "room" ? { room } : kind === "phase" ? { phase } : kind === "work_type" ? { work_type: workType } : {};
  const canSave = !!name.trim() && amount >= 0 && (
    (kind === "room" && !!room) || (kind === "phase" && !!phase) || (kind === "work_type" && !!workType) || kind === "custom"
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center p-0 md:p-6" onClick={onClose}>
      <div className="bg-background w-full md:max-w-md md:rounded-[16px] border border-border" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-display text-xl">New milestone</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>
        <div className="p-6 space-y-4">
          <Field label="Name">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Flooring Complete"
              className="w-full h-10 px-3 rounded-[6px] border border-border bg-background text-sm" />
          </Field>
          <Field label="Trigger kind">
            <select value={kind} onChange={(e) => setKind(e.target.value as SuggestedMilestone["kind"])}
              className="w-full h-10 px-3 rounded-[6px] border border-border bg-background text-sm">
              <option value="work_type">Work type — all tasks of a type done</option>
              <option value="room">Room — all tasks in a room done</option>
              <option value="phase">Phase — all tasks in a lifecycle phase done</option>
            </select>
          </Field>
          {kind === "room" && (
            <Field label="Room">
              <select value={room} onChange={(e) => setRoom(e.target.value)}
                className="w-full h-10 px-3 rounded-[6px] border border-border bg-background text-sm">
                <option value="">Select…</option>
                {rooms.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
          )}
          {kind === "phase" && (
            <Field label="Phase">
              <select value={phase} onChange={(e) => setPhase(e.target.value)}
                className="w-full h-10 px-3 rounded-[6px] border border-border bg-background text-sm">
                {EXECUTION_PHASE_GROUPS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
          )}
          {kind === "work_type" && (
            <Field label="Work type">
              <select value={workType} onChange={(e) => setWorkType(e.target.value)}
                className="w-full h-10 px-3 rounded-[6px] border border-border bg-background text-sm">
                {WORK_TYPES.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </Field>
          )}
          <Field label="Invoice amount (₹)">
            <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)}
              className="w-full h-10 px-3 rounded-[6px] border border-border bg-background text-sm" />
          </Field>
          <Field label="Description (optional)">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full px-3 py-2 rounded-[6px] border border-border bg-background text-sm" />
          </Field>
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="h-10 px-4 rounded-[6px] border border-border text-sm font-medium">Cancel</button>
          <button
            onClick={() => onSave({ name: name.trim(), kind, trigger, invoice_amount: amount, description })}
            disabled={!canSave || saving}
            className="h-10 px-4 rounded-[6px] bg-[#c17f5a] text-white text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1.5">{label}</div>
      {children}
    </label>
  );
}
