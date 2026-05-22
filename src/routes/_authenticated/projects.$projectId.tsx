import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Send, Check, Phone, Mail, Plus, Upload, Image as ImageIcon,
  FileText, MessageCircle, FilePlus, Loader2, Pencil, ClipboardList,
} from "lucide-react";
import { ProjectProgressPanels } from "@/components/tasks/ProjectProgressPanels";
import { phaseOfTask, isTaskDone, PROJECT_PHASES, type ProjectPhase } from "@/lib/task-flow";
import { phases, healthMap, type Project } from "@/lib/projects";
import { labelForProjectType } from "@/lib/project-types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { DbProject } from "@/lib/db-types";
import { formatINR } from "@/lib/studio-data";
import { AppShell } from "@/components/AppShell";
import { openModal } from "@/lib/app-bus";
import { toast } from "sonner";
import { SharePortalButton } from "@/components/SharePortalButton";
import { NewProjectWizard } from "@/components/NewProjectWizard";
import { AddTaskPanel } from "@/components/AddTaskPanel";
import { PhaseSubcategoriesPanel } from "@/components/PhaseSubcategoriesPanel";
import { AIPhaseBar } from "@/components/AIPhaseBar";
import { EditPhaseModal } from "@/components/EditPhaseModal";
import { DailyReportModal } from "@/components/DailyReportModal";
import { SiteReportsList } from "@/components/SiteReportsList";
import { PhaseChecklistTab } from "@/components/PhaseChecklistTab";
import { ProjectActivityFeed } from "@/components/ProjectActivityFeed";
import { RoomProgressGrid } from "@/components/tasks/RoomProgressGrid";
import { ProjectTasksTab } from "@/components/tasks/ProjectTasksTab";
import { BoqUploadButton } from "@/components/BoqUploadButton";
import { SnagsTab } from "@/components/SnagsTab";
import { ChangeOrdersTab } from "@/components/ChangeOrdersTab";
import { AttendanceTab } from "@/components/AttendanceTab";
import { useServerFn } from "@tanstack/react-start";
import { sendInvoiceEmail, sendMilestoneEmail } from "@/lib/emails.functions";

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  head: ({ params }) => {
    const title = "Project — PMStudio";
    return { meta: [{ title }, { name: "description", content: `Project ${params.projectId}` }] };
  },
  component: ProjectDetail,
});

// Adapt a DB project row into the rich Project shape the UI expects.
function adaptProject(row: DbProject): Project {
  return {
    id: row.id,
    name: row.name,
    client: "—",
    location: row.location ?? "",
    phase: (row.phase as Project["phase"]) ?? "Survey",
    completion: row.completion ?? 0,
    spent: Number(row.spent ?? 0),
    budget: Number(row.budget ?? 0),
    health: (row.health as Project["health"]) ?? "on-track",
    type: (row.type as Project["type"]) ?? "residential",
    startDate: row.start_date ?? "—",
    expectedHandover: row.expected_handover ?? "—",
    description: row.description ?? "",
    team: [],
    vendors: [],
    milestones: phases.map((p) => ({ label: p, date: "—", done: false })),
    gallery: [],
    budgetBreakdown: [],
    notes: [],
    latitude: (row as unknown as { latitude: number | null }).latitude ?? null,
    longitude: (row as unknown as { longitude: number | null }).longitude ?? null,
    rawStartDate: row.start_date ?? null,
  };
}

function ProjectDetail() {
  const { projectId } = Route.useParams();
  const { data: project, isLoading, error } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
      if (error) throw error;
      return data ? adaptProject(data as DbProject) : null;
    },
  });

  if (isLoading) {
    return (
      <AppShell>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (error || !project) {
    return (
      <AppShell>
        <div className="min-h-[60vh] flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-3">404</div>
            <h1 className="font-display text-4xl mb-3">Project not found</h1>
            <Link to="/" className="inline-flex items-center gap-2 h-10 px-5 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95">
              <ArrowLeft className="h-4 w-4" /> Back to Dashboard
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return <ProjectDetailView project={project} />;
}

type Tab = "overview" | "timeline" | "tasks" | "phases" | "snags" | "attendance" | "change-orders" | "reports" | "photos" | "vendors" | "finance" | "documents";
const tabs: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "timeline", label: "Timeline" },
  { id: "tasks", label: "Tasks" },
  { id: "phases", label: "Phases" },
  { id: "snags", label: "Snags" },
  { id: "attendance", label: "Attendance" },
  { id: "change-orders", label: "Change Orders" },
  { id: "reports", label: "Reports" },
  { id: "photos", label: "Photos" },
  { id: "vendors", label: "Vendors" },
  { id: "finance", label: "Finance" },
  { id: "documents", label: "Documents" },
];


function ProjectDetailView({ project }: { project: Project }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [editing, setEditing] = useState(false);
  const [dailyReport, setDailyReport] = useState(false);
  const h = healthMap[project.health as keyof typeof healthMap];

  return (
    <AppShell>
      <main className="px-4 md:px-8 py-6 md:py-8 max-w-[1400px] w-full pb-24 md:pb-10">
        <Link to="/" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground mb-6 font-mono uppercase tracking-wider">
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>

        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <span className={`h-1.5 w-1.5 rounded-full ${h.pulse}`} style={{ background: h.color, color: h.color }} />
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{h.label}</span>
            </div>
            <h1 className="font-display text-4xl md:text-[36px] leading-tight">{project.name}</h1>
            <div className="flex flex-wrap gap-2 mt-3">
              <Pill>{project.client}</Pill>
              <Pill>{project.location}</Pill>
              <Pill>{labelForProjectType(project.type)}</Pill>
              <Pill>{project.phase}</Pill>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[6px] text-xs font-medium" style={{ background: `${h.color}22`, color: h.color }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: h.color }} /> {h.label}
            </span>
            <button onClick={() => setEditing(true)} className="h-10 px-3 inline-flex items-center gap-1.5 rounded-[6px] border border-border text-sm font-medium hover:bg-muted">
              <Pencil className="h-3.5 w-3.5" /> Edit Project
            </button>
            <button onClick={() => setDailyReport(true)} className="h-10 px-3 inline-flex items-center gap-1.5 rounded-[6px] border border-border text-sm font-medium hover:bg-muted">
              <ClipboardList className="h-3.5 w-3.5" /> Daily Report
            </button>
            <button onClick={() => openModal("draft-update")} className="h-10 px-4 inline-flex items-center gap-1.5 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95">
              <Send className="h-3.5 w-3.5" /> Send Update
            </button>
            <SharePortalButton projectId={project.id} variant="outline" size="md" label="Share Portal" stopPropagation={false} />
          </div>
        </header>

        {tab !== "tasks" && <AIPhaseBar projectId={project.id} />}


        {/* Tabs */}
        <div className="border-b border-border mb-8 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                      className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t.id ? "border-[#c17f5a] text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {tab === "overview" && <OverviewTab project={project} />}
        {tab === "timeline" && <TimelineTab project={project} />}
        {tab === "tasks" && <ProjectTasksTab projectId={project.id} projectName={project.name} />}
        {tab === "phases" && <PhaseChecklistTab projectId={project.id} projectBudget={project.budget} />}
        {tab === "snags" && <SnagsTab projectId={project.id} />}
        {tab === "attendance" && (
          <AttendanceTab
            projectId={project.id}
            projectName={project.name}
            projectLocation={project.location}
            projectLat={project.latitude ?? null}
            projectLng={project.longitude ?? null}
            projectStartDate={project.rawStartDate ?? null}
          />
        )}
        {tab === "change-orders" && <ChangeOrdersTab projectId={project.id} />}
        {tab === "reports" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl">Daily Site Reports</h2>
                <p className="text-sm text-muted-foreground mt-1">Photos, work done, attendance — logged each day.</p>
              </div>
              <button onClick={() => setDailyReport(true)} className="h-10 px-4 inline-flex items-center gap-2 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95">
                <ClipboardList className="h-4 w-4" /> New Daily Report
              </button>
            </div>
            <SiteReportsList projectId={project.id} />
          </div>
        )}
        {tab === "photos" && <PhotosTab project={project} />}
        {tab === "vendors" && <VendorsTab project={project} />}
        {tab === "finance" && <FinanceTab project={project} />}
        {tab === "documents" && <DocumentsTab project={project} />}
      </main>
      {editing && <NewProjectWizard onClose={() => setEditing(false)} editProjectId={project.id} />}
      {dailyReport && <DailyReportModal projectId={project.id} defaultLocation={project.location} onClose={() => setDailyReport(false)} />}
    </AppShell>
  );
}

const Pill = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-[6px] bg-muted text-muted-foreground">{children}</span>
);

const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = "", children, ...p }) => (
  <div {...p} className={`rounded-[16px] bg-card border border-border ${className}`} style={{ boxShadow: "var(--shadow-card)" }}>{children}</div>
);

/* ---------------- Overview ---------------- */
function OverviewTab({ project }: { project: Project }) {
  const phaseIdx = phases.indexOf(project.phase);
  const budgetPct = Math.round((project.spent / project.budget) * 100);
  const { user } = useAuth();
  const qc = useQueryClient();
  const [confirmPhase, setConfirmPhase] = useState<string | null>(null);
  const [addTaskFor, setAddTaskFor] = useState<string | null>(null);
  const [editPhase, setEditPhase] = useState<string | null>(null);

  const { data: phaseRows = [] } = useQuery({
    queryKey: ["project-phases", project.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_phases")
        .select("phase,status,end_date,updated_at")
        .eq("project_id", project.id);
      return data ?? [];
    },
  });
  const phaseMeta = new Map<string, { status: string; updated_at: string; end_date: string | null }>();
  phaseRows.forEach((r: { phase: string; status: string; updated_at: string; end_date: string | null }) =>
    phaseMeta.set(r.phase, { status: r.status, updated_at: r.updated_at, end_date: r.end_date })
  );

  const PHASE_INVOICE_PCT: Record<string, number> = {
    Survey: 5, Design: 15, Procurement: 20, Execution: 35, Finishing: 15, Handover: 10,
  };

  const sendInvoiceEmailFn = useServerFn(sendInvoiceEmail);
  const sendMilestoneEmailFn = useServerFn(sendMilestoneEmail);

  const markPhaseComplete = useMutation({
    mutationFn: async (targetPhaseStr: string) => {
      const targetPhase = targetPhaseStr as Project["phase"];
      const today = new Date().toISOString().slice(0, 10);
      const targetIdx = phases.indexOf(targetPhase as Project["phase"]);
      const nextPhase = phases[targetIdx + 1];
      await supabase.from("project_phases")
        .update({ status: "done", end_date: today })
        .eq("project_id", project.id)
        .eq("phase", targetPhase);
      if (nextPhase) {
        await supabase.from("project_phases")
          .update({ status: "active" })
          .eq("project_id", project.id)
          .eq("phase", nextPhase);
      }
      const newCompletion = Math.min(100, Math.round(((targetIdx + 1) / phases.length) * 100));
      await supabase.from("projects")
        .update({ phase: nextPhase ?? targetPhase, completion: newCompletion })
        .eq("id", project.id);
      const pct = PHASE_INVOICE_PCT[targetPhase] ?? 10;
      const amount = +(project.budget * 100000 * (pct / 100)).toFixed(0);
      await supabase.from("invoices").insert({
        user_id: user!.id,
        project_id: project.id,
        amount,
        milestone: `${targetPhase} complete`,
        status: "draft",
      });
      return { currentPhase: targetPhase, amount };
    },
    onSuccess: ({ currentPhase, amount }) => {
      qc.invalidateQueries({ queryKey: ["project", project.id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project-phases", project.id] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Phase marked complete. Draft invoice created. You can undo within 24 h.");
      setConfirmPhase(null);
      const milestone = `${currentPhase} complete`;
      sendMilestoneEmailFn({ data: { projectId: project.id, milestone } }).catch((e: unknown) =>
        console.warn("milestone email failed", e),
      );
      sendInvoiceEmailFn({ data: { projectId: project.id, milestone, amount } }).catch((e: unknown) =>
        console.warn("invoice email failed", e),
      );
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const undoComplete = useMutation({
    mutationFn: async (targetPhaseStr: string) => {
      const targetPhase = targetPhaseStr as Project["phase"];
      const targetIdx = phases.indexOf(targetPhase as Project["phase"]);
      const nextPhase = phases[targetIdx + 1];
      await supabase.from("project_phases")
        .update({ status: "active", end_date: null })
        .eq("project_id", project.id)
        .eq("phase", targetPhase);
      if (nextPhase) {
        await supabase.from("project_phases")
          .update({ status: "planned" })
          .eq("project_id", project.id)
          .eq("phase", nextPhase);
      }
      const newCompletion = Math.max(0, Math.round((targetIdx / phases.length) * 100));
      await supabase.from("projects")
        .update({ phase: targetPhase, completion: newCompletion })
        .eq("id", project.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", project.id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project-phases", project.id] });
      toast.success("Phase completion reverted");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6">
      <Card className="p-6 md:p-8">
        <h2 className="font-display text-2xl mb-1">Phase Progress</h2>
        <p className="text-xs text-muted-foreground mb-6">All 6 stages run in parallel. Mark each complete when ready.</p>
        <div className="relative pl-8">
          <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />
          {phases.map((ph, i) => {
            const meta = phaseMeta.get(ph);
            const done = meta ? meta.status === "done" : i < phaseIdx;
            const current = i === phaseIdx;
            const mile = project.milestones[i];
            const undoable =
              done && meta?.updated_at &&
              Date.now() - new Date(meta.updated_at).getTime() < 24 * 60 * 60 * 1000;
            return (
              <div key={ph} className="relative pb-6 last:pb-0">
                <span className="absolute -left-[22px] top-1 h-3.5 w-3.5 rounded-full flex items-center justify-center"
                      style={{
                        background: done ? "#7a9e8a" : current ? "#d4882a" : "transparent",
                        border: done || current ? "none" : "2px solid #d4c9b9",
                        boxShadow: current ? "0 0 0 4px rgba(212,136,42,0.18)" : "none",
                      }}>
                  {done && <Check className="h-2 w-2 text-white" />}
                </span>
                <div className={`rounded-[10px] border ${current ? "border-[#d4882a] bg-[#fff7eb]" : done ? "border-[#cfe0d4] bg-[#f4f9f5]" : "border-border bg-card"} p-4`}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="font-display text-lg">{ph}</h3>
                    <div className="flex items-center gap-2">
                      {mile && <span className="text-[11px] font-mono text-muted-foreground">{mile.date}</span>}
                      <button onClick={(e) => { e.stopPropagation(); setEditPhase(ph); }}
                        className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-[6px] border border-border hover:bg-white">
                        Edit
                      </button>
                    </div>
                  </div>
                  {(ph === "Procurement" || ph === "Execution") ? (
                    <div className="mt-3">
                      <PhaseSubcategoriesPanel projectId={project.id} phase={ph} />
                    </div>
                  ) : (
                    <div className="space-y-1.5 mt-2">
                      {["Site visit","Vendor confirmation","Material delivery"].map((t, k) => (
                        <label key={k} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <input type="checkbox" defaultChecked={done || (current && k === 0)} className="accent-[#c17f5a]" />
                          <span>{t}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/60">
                    {!done && (
                      <button onClick={() => setConfirmPhase(ph)} className="h-8 px-3 rounded-[6px] bg-[#7a9e8a] text-white text-xs font-medium hover:brightness-110">Mark Phase Complete</button>
                    )}
                    {undoable && (
                      <button
                        onClick={() => undoComplete.mutate(ph)}
                        disabled={undoComplete.isPending}
                        className="h-8 px-3 rounded-[6px] border border-border text-xs font-medium hover:bg-white disabled:opacity-60"
                      >
                        Undo Complete
                      </button>
                    )}
                    <button onClick={() => setAddTaskFor(ph)} className="h-8 px-3 rounded-[6px] border border-border text-xs font-medium hover:bg-white">+ Add Task</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {addTaskFor && (
        <AddTaskPanel
          projectId={project.id}
          projectName={project.name}
          defaultPhase={addTaskFor as "Survey" | "Design" | "Procurement" | "Execution" | "Finishing" | "Handover"}
          onClose={() => setAddTaskFor(null)}
        />
      )}
      {editPhase && (
        <EditPhaseModal projectId={project.id} phase={editPhase} onClose={() => setEditPhase(null)} />
      )}
      {confirmPhase && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setConfirmPhase(null)}>
          <div className="bg-card rounded-[16px] p-6 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-2xl mb-2">Complete {confirmPhase}?</h3>
            <p className="text-sm text-muted-foreground mb-5">This will advance the project to the next phase and draft an invoice for {PHASE_INVOICE_PCT[confirmPhase] ?? 10}% of the budget.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmPhase(null)} className="h-10 px-4 rounded-[6px] border border-border text-sm font-medium hover:bg-muted">Cancel</button>
              <button onClick={() => markPhaseComplete.mutate(confirmPhase)} disabled={markPhaseComplete.isPending} className="h-10 px-5 rounded-[6px] bg-[#7a9e8a] text-white text-sm font-medium hover:brightness-110 inline-flex items-center gap-2 disabled:opacity-60">
                {markPhaseComplete.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <Card className="p-6">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1">Total Budget</div>
          <div className="font-display text-4xl tabular-nums">₹{project.budget}L</div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Spent</div><div className="font-display text-xl tabular-nums">₹{project.spent}L</div></div>
            <div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Remaining</div><div className="font-display text-xl tabular-nums" style={{ color: budgetPct > 100 ? "#c4685a" : "#7a9e8a" }}>₹{(project.budget - project.spent).toFixed(1)}L</div></div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full" style={{ width: `${Math.min(budgetPct, 100)}%`, background: budgetPct > 100 ? "#c4685a" : budgetPct > 80 ? "#d4882a" : "#c17f5a" }} />
          </div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mt-1.5">{budgetPct}% used</div>

          <div className="mt-5 space-y-2.5">
            {project.budgetBreakdown.map((b) => {
              const pct = Math.round((b.spent / b.allocated) * 100);
              const tone = pct > 100 ? "#c4685a" : pct > 80 ? "#d4882a" : "#7a9e8a";
              return (
                <div key={b.category}>
                  <div className="flex justify-between text-xs mb-1"><span>{b.category}</span><span className="font-mono">₹{b.spent}L / ₹{b.allocated}L</span></div>
                  <div className="h-1 rounded-full bg-muted overflow-hidden"><div className="h-full" style={{ width: `${Math.min(pct, 100)}%`, background: tone }} /></div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-6">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-3">Quick Actions</div>
          <div className="grid grid-cols-2 gap-2">
            <QA icon={Upload} label="Upload Photos" onClick={() => openModal("upload-photos", { projectId: project.id })} />
            <QA icon={Plus} label="Add Task" onClick={() => setAddTaskFor(project.phase)} />
            <QA icon={FileText} label="Send Invoice" onClick={() => openModal("new-invoice")} />
            <QA icon={Plus} label="Add Vendor" onClick={() => openModal("add-vendor")} />
          </div>
        </Card>

        <Card className="p-6 bg-[#1a1612] text-white border-[#1a1612]">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[#c17f5a] mb-2">Client Contact</div>
          <div className="font-display text-xl">{project.client}</div>
          <div className="text-xs text-white/60 font-mono mt-1">{project.location}</div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <button onClick={() => toast("Calling…")} className="h-9 rounded-[6px] bg-white/10 hover:bg-white/15 text-xs font-medium inline-flex items-center justify-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Call</button>
            <button onClick={() => toast("Email opened")} className="h-9 rounded-[6px] bg-[#c17f5a] hover:brightness-95 text-xs font-medium inline-flex items-center justify-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email</button>
          </div>
        </Card>

        <RoomProgressGrid projectId={project.id} />
        <ProjectProgressPanels projectId={project.id} />
        <ProjectActivityFeed projectId={project.id} />
        <AutoPhaseCompleter project={project} phaseMeta={phaseMeta} />
      </div>
    </div>
  );
}

/** Watches task completion per phase. When all tasks in a phase are done and >=1 task exists,
 *  auto-marks that phase complete (idempotent via a ref). */
function AutoPhaseCompleter({
  project, phaseMeta,
}: {
  project: Project;
  phaseMeta: Map<string, { status: string; updated_at: string; end_date: string | null }>;
}) {
  const qc = useQueryClient();
  const triggered = useRef<Set<string>>(new Set());

  const { data: tasks = [] } = useQuery({
    queryKey: ["project-tasks-autophase", project.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("status,done,work_type")
        .eq("project_id", project.id);
      return (data ?? []) as { status: string | null; done: boolean | null; work_type: string | null }[];
    },
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (!tasks.length) return;
    const byPhase = new Map<ProjectPhase, { total: number; done: number }>();
    tasks.forEach((t) => {
      const ph = phaseOfTask(t);
      const cur = byPhase.get(ph) ?? { total: 0, done: 0 };
      cur.total++;
      if (isTaskDone(t)) cur.done++;
      byPhase.set(ph, cur);
    });
    byPhase.forEach(async (v, ph) => {
      if (v.total === 0 || v.done < v.total) return;
      if (phaseMeta.get(ph)?.status === "done") return;
      const key = `${project.id}:${ph}`;
      if (triggered.current.has(key)) return;
      triggered.current.add(key);
      const today = new Date().toISOString().slice(0, 10);
      await supabase.from("project_phases")
        .update({ status: "done", end_date: today })
        .eq("project_id", project.id)
        .eq("phase", ph);
      const idx = PROJECT_PHASES.indexOf(ph);
      const next = PROJECT_PHASES[idx + 1];
      if (next) {
        await supabase.from("project_phases")
          .update({ status: "active" })
          .eq("project_id", project.id)
          .eq("phase", next);
      }
      qc.invalidateQueries({ queryKey: ["project-phases", project.id] });
      qc.invalidateQueries({ queryKey: ["project", project.id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success(`${ph} phase auto-completed — all tasks done`);
    });
  }, [tasks, phaseMeta, project.id, qc]);

  return null;
}

function QA({ icon: Icon, label, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="h-20 rounded-[10px] border border-border hover:border-[#c17f5a] hover:bg-[#fff7eb] flex flex-col items-center justify-center gap-1.5 text-xs font-medium transition-colors">
      <Icon className="h-4 w-4 text-[#c17f5a]" />
      {label}
    </button>
  );
}

/* ---------------- Timeline (Gantt) ---------------- */
type TimelineBar = {
  id: string;
  label: string;
  kind: "phase" | "Procurement" | "Execution";
  start: Date | null;
  end: Date | null;
  status: string;
  assignee?: string | null;
};

const CAT_FILTERS = ["All", "Phases", "Procurement", "Execution"] as const;
type CatFilter = typeof CAT_FILTERS[number];

function TimelineTab({ project }: { project: Project }) {
  const [filter, setFilter] = useState<CatFilter>("All");

  const { data: phaseRows = [] } = useQuery({
    queryKey: ["project-phases", project.id],
    queryFn: async () => {
      const { data } = await supabase.from("project_phases").select("*").eq("project_id", project.id).order("order_index");
      return data ?? [];
    },
  });
  const { data: subRows = [] } = useQuery({
    queryKey: ["phase-subs-timeline", project.id],
    queryFn: async () => {
      const { data: subs } = await supabase.from("phase_subcategories").select("*").eq("project_id", project.id).order("order_index");
      const vendorIds = Array.from(new Set((subs ?? []).map((s: any) => s.vendor_id).filter(Boolean)));
      const vendorMap = new Map<string, string>();
      if (vendorIds.length) {
        const { data: vs } = await supabase.from("vendors").select("id,name,company_name").in("id", vendorIds);
        (vs ?? []).forEach((v: any) => vendorMap.set(v.id, v.company_name || v.name));
      }
      return (subs ?? []).map((s: any) => ({ ...s, vendor_name: s.vendor_id ? vendorMap.get(s.vendor_id) : null }));
    },
  });

  const parse = (s: string | null | undefined) => (s ? new Date(s) : null);

  const allBars: TimelineBar[] = [
    ...phaseRows.map((p: any) => ({
      id: `phase-${p.id}`,
      label: p.phase,
      kind: "phase" as const,
      start: parse(p.start_date),
      end: parse(p.end_date),
      status: p.status,
    })),
    ...subRows.map((s) => ({
      id: `sub-${s.id}`,
      label: s.name,
      kind: s.phase as "Procurement" | "Execution",
      start: parse(s.start_date),
      end: parse(s.end_date),
      status: s.status,
      assignee: s.contractor_name || s.vendor_name || null,
    })),
  ];

  const bars = allBars.filter((b) => {
    if (filter === "All") return true;
    if (filter === "Phases") return b.kind === "phase";
    return b.kind === filter;
  });

  // Determine timeline range
  const projStart = parse(project.startDate) ?? new Date();
  const projEnd = parse(project.expectedHandover) ?? new Date(projStart.getTime() + 1000 * 60 * 60 * 24 * 180);
  const startMs = projStart.getTime();
  const endMs = Math.max(projEnd.getTime(), startMs + 1000 * 60 * 60 * 24 * 30);
  const totalMs = endMs - startMs;

  // Build month labels
  const months: { label: string; offsetPct: number }[] = [];
  const cursor = new Date(projStart.getFullYear(), projStart.getMonth(), 1);
  while (cursor.getTime() <= endMs) {
    months.push({
      label: cursor.toLocaleString("en", { month: "short" }),
      offsetPct: ((cursor.getTime() - startMs) / totalMs) * 100,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const today = new Date();
  const todayPct = ((today.getTime() - startMs) / totalMs) * 100;

  const colorFor = (b: TimelineBar) => {
    if (b.status === "done") return "#7a9e8a";
    if (b.status === "delayed") return "#c4685a";
    if (b.status === "in_progress" || b.status === "active") return "#c17f5a";
    return "#d4882a";
  };

  return (
    <Card className="p-6 overflow-x-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <div>
          <h2 className="font-display text-2xl">Timeline</h2>
          <p className="text-xs text-muted-foreground">{project.startDate} → {project.expectedHandover}</p>
        </div>
        <div className="flex gap-1">
          {CAT_FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`h-8 px-3 rounded-[6px] text-xs font-medium transition-colors ${filter === f ? "bg-[#1a1612] text-white" : "border border-border bg-card hover:bg-muted"}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="min-w-[720px] relative mt-8">
        {/* Month header */}
        <div className="relative h-5 border-b border-border mb-5" style={{ marginLeft: 180 }}>
          {months.map((m, i) => (
            <div key={i} className="absolute top-0 text-[10px] uppercase tracking-wider text-muted-foreground font-mono" style={{ left: `${m.offsetPct}%` }}>
              {m.label}
            </div>
          ))}
        </div>

        {bars.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">No timeline items yet. Use the AI Site Update bar above to add some.</div>
        )}

        <div className="relative">
          {bars.map((b) => {
            if (!b.start || !b.end) {
              return (
                <div key={b.id} className="flex items-center mb-4 h-9">
                  <div className="w-[180px] pr-3 truncate">
                    <div className="text-xs font-medium truncate">{b.label}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{b.kind === "phase" ? "Phase" : b.kind} {b.assignee ? `· ${b.assignee}` : ""}</div>
                  </div>
                  <div className="flex-1 text-[10px] text-muted-foreground italic">no dates set</div>
                </div>
              );
            }
            const left = Math.max(0, ((b.start.getTime() - startMs) / totalMs) * 100);
            const width = Math.max(2, ((b.end.getTime() - b.start.getTime()) / totalMs) * 100);
            const color = colorFor(b);
            return (
              <div key={b.id} className="flex items-center mb-4 h-9">
                <div className="w-[180px] pr-3 truncate">
                  <div className="text-xs font-medium truncate">{b.label}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{b.kind === "phase" ? "Phase" : b.kind}{b.assignee ? ` · ${b.assignee}` : ""}</div>
                </div>
                <div className="flex-1 relative h-7">
                  <div className="absolute h-7 rounded-[6px] flex items-center px-2 text-[10px] font-medium text-white overflow-hidden"
                    style={{ left: `${left}%`, width: `${width}%`, background: color, opacity: b.status === "planned" ? 0.6 : 1 }}>
                    <span className="truncate">{b.assignee ?? b.status}</span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Dependency arrows: connect consecutive bars in same category */}
          {bars.length > 1 && (
            <svg
              className="absolute pointer-events-none"
              style={{ left: 180, top: 0, right: 0, bottom: 0, width: `calc(100% - 180px)`, height: bars.length * 52 }}
              preserveAspectRatio="none"
            >
              <defs>
                <marker id="arrow-warm" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                  <path d="M0,0 L10,5 L0,10 z" fill="#c17f5a" />
                </marker>
              </defs>
              {bars.map((b, i) => {
                if (i === 0) return null;
                const prev = bars[i - 1];
                if (!prev.start || !prev.end || !b.start || !b.end) return null;
                if (prev.kind !== b.kind) return null;
                const x1Pct = ((prev.end.getTime() - startMs) / totalMs) * 100;
                const x2Pct = ((b.start.getTime() - startMs) / totalMs) * 100;
                const rowH = 52; // mb-4 (16) + h-9 (36)
                const y1 = (i - 1) * rowH + 14 + rowH / 2 - 14; // bar vertical center within row
                const y2 = i * rowH + 14 + rowH / 2 - 14;
                const midX = `calc(${x1Pct}% + 6px)`;
                return (
                  <g key={`dep-${b.id}`} stroke="#c17f5a" strokeWidth="1.5" fill="none" opacity="0.85">
                    <line x1={`${x1Pct}%`} y1={y1} x2={midX} y2={y1} />
                    <line x1={midX} y1={y1} x2={midX} y2={y2} />
                    <line x1={midX} y1={y2} x2={`${x2Pct}%`} y2={y2} markerEnd="url(#arrow-warm)" />
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        {/* Today line */}
        {todayPct >= 0 && todayPct <= 100 && (
          <div className="absolute top-0 bottom-0 w-px bg-[#c4685a]" style={{ left: `calc(180px + (100% - 180px) * ${todayPct / 100})` }}>
            <div className="absolute -top-1 -translate-x-1/2 text-[9px] uppercase tracking-wider text-[#c4685a] font-mono bg-card px-1">Today</div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-4 mt-6 text-[11px] text-muted-foreground">
        <div className="inline-flex items-center gap-2"><span className="h-2 w-4 rounded-sm bg-[#7a9e8a]" /> Done</div>
        <div className="inline-flex items-center gap-2"><span className="h-2 w-4 rounded-sm bg-[#c17f5a]" /> In progress</div>
        <div className="inline-flex items-center gap-2"><span className="h-2 w-4 rounded-sm bg-[#d4882a]" /> Planned</div>
        <div className="inline-flex items-center gap-2"><span className="h-2 w-4 rounded-sm bg-[#c4685a]" /> Delayed</div>
      </div>
    </Card>
  );
}

/* ---------------- Photos ---------------- */
function PhotosTab({ project }: { project: Project }) {
  const [room, setRoom] = useState<string>("All");
  const [compareRoom, setCompareRoom] = useState<string | null>(null);
  const [slider, setSlider] = useState(50);
  const rooms = ["All", ...project.gallery.map((g) => g.room)];
  const allItems = project.gallery.flatMap((g) => g.items.map((it) => ({ ...it, room: g.room })));
  const visible = room === "All" ? allItems : allItems.filter((it) => it.room === room);

  const compareData = compareRoom ? project.gallery.find((g) => g.room === compareRoom) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 overflow-x-auto">
          {rooms.map((r) => (
            <button key={r} onClick={() => setRoom(r)}
                    className={`h-9 px-3 rounded-[6px] text-xs font-medium transition-colors ${room === r ? "bg-[#1a1612] text-white" : "border border-border bg-card hover:bg-muted"}`}>
              {r}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setCompareRoom(compareRoom ? null : (project.gallery[0]?.room ?? null))}
                  className="h-9 px-3 rounded-[6px] border border-border text-xs font-medium hover:bg-muted">
            {compareRoom ? "Close Compare" : "Before / After"}
          </button>
          <button onClick={() => openModal("upload-photos")} className="h-9 px-3 rounded-[6px] bg-primary text-primary-foreground text-xs font-medium hover:brightness-95 inline-flex items-center gap-1.5">
            <Upload className="h-3.5 w-3.5" /> Upload Photos
          </button>
        </div>
      </div>

      {compareRoom && compareData && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-xl">{compareRoom}</h3>
              <div className="text-xs text-muted-foreground">Before & After</div>
            </div>
            <select value={compareRoom} onChange={(e) => setCompareRoom(e.target.value)} className="h-9 px-3 rounded-[6px] bg-card border border-border text-xs">
              {project.gallery.map((g) => <option key={g.room}>{g.room}</option>)}
            </select>
          </div>
          <div className="relative aspect-[16/9] rounded-[10px] overflow-hidden" style={{ background: compareData.items[compareData.items.length - 1].tone }}>
            <div className="absolute inset-0" style={{ background: compareData.items[0].tone, clipPath: `inset(0 ${100 - slider}% 0 0)` }} />
            <div className="absolute inset-y-0 w-0.5 bg-white shadow-lg pointer-events-none" style={{ left: `${slider}%` }}>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white shadow-lg flex items-center justify-center text-[10px] font-mono">⇔</div>
            </div>
            <span className="absolute top-3 left-3 text-[10px] uppercase tracking-wider px-2 py-1 rounded-[6px] bg-black/60 text-white">Before</span>
            <span className="absolute top-3 right-3 text-[10px] uppercase tracking-wider px-2 py-1 rounded-[6px] bg-black/60 text-white">Latest</span>
          </div>
          <input type="range" min={0} max={100} value={slider} onChange={(e) => setSlider(+e.target.value)} className="w-full mt-3 accent-[#c17f5a]" />
        </Card>
      )}

      {project.gallery.map((g) => {
        if (room !== "All" && g.room !== room) return null;
        return (
          <div key={g.room}>
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="font-display text-xl">{g.room}</h3>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">{g.items.length} photos</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {g.items.map((it, i) => (
                <button key={i} onClick={() => openModal("lightbox", { src: it.tone, caption: `${g.room} — ${it.caption}` })}
                        className="group relative aspect-square rounded-[10px] overflow-hidden border border-border hover:-translate-y-[2px] transition-transform">
                  <div className="absolute inset-0" style={{ background: it.tone }} />
                  {i === 0 && <span className="absolute top-2 left-2 text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-[4px] bg-black/70 text-white">Before</span>}
                  {i === g.items.length - 1 && i !== 0 && <span className="absolute top-2 right-2 text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-[4px] bg-[#c17f5a] text-white">Latest</span>}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-[11px] text-white opacity-0 group-hover:opacity-100 transition-opacity">{it.caption}</div>
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {visible.length === 0 && (
        <div className="rounded-[16px] border border-dashed border-border p-12 text-center">
          <ImageIcon className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No photos in this room yet.</p>
        </div>
      )}
    </div>
  );
}

/* ---------------- Vendors ---------------- */
const vendorStatus: Record<string, { bg: string; color: string; label: string }> = {
  confirmed: { bg: "rgba(122,158,138,0.18)", color: "#7a9e8a", label: "Ordered" },
  pending: { bg: "rgba(107,95,88,0.12)", color: "#6b5f58", label: "Pending" },
  delayed: { bg: "rgba(196,104,90,0.18)", color: "#c4685a", label: "Delayed" },
  completed: { bg: "rgba(122,158,138,0.18)", color: "#7a9e8a", label: "Delivered" },
};

function VendorsTab({ project }: { project: Project }) {
  return (
    <Card className="overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <h2 className="font-display text-xl">Project Vendors</h2>
        <button onClick={() => openModal("add-vendor")} className="h-9 px-3 rounded-[6px] bg-primary text-primary-foreground text-xs font-medium hover:brightness-95 inline-flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add Vendor
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <tr>{["Vendor","Category","Item","Quote","PO Raised","Delivery","Status","Actions"].map((h) => <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-border">
            {project.vendors.map((v, i) => {
              const s = vendorStatus[v.status];
              return (
                <tr key={i} className="hover:bg-muted/40">
                  <td className="px-4 py-3 font-medium">{v.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{v.scope.split(" ")[0]}</td>
                  <td className="px-4 py-3 text-muted-foreground">{v.scope}</td>
                  <td className="px-4 py-3 font-mono">{formatINR(120000 + i * 50000)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono">PO-{200 + i}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{18 + i} May</td>
                  <td className="px-4 py-3"><span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-[6px]" style={{ background: s.bg, color: s.color }}>{s.label}</span></td>
                  <td className="px-4 py-3">
                    <button onClick={() => toast.success(`WhatsApp draft to ${v.name}`)} className="h-8 w-8 rounded-[6px] border border-border flex items-center justify-center hover:bg-muted text-[#7a9e8a]">
                      <MessageCircle className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ---------------- Finance ---------------- */
function FinanceTab({ project }: { project: Project }) {
  const { data: projectInvoices = [] } = useQuery({
    queryKey: ["invoices", project.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices").select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniCard label="Project Budget" value={`₹${project.budget}L`} />
        <MiniCard label="Spent" value={`₹${project.spent}L`} tone="#c17f5a" />
        <MiniCard label="Pending POs" value="₹0" tone="#d4882a" />
        <MiniCard label="Available" value={`₹${(project.budget - project.spent).toFixed(1)}L`} tone="#7a9e8a" />
      </div>
      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-display text-xl">Invoices</h2>
          <button onClick={() => openModal("new-invoice")} className="h-9 px-3 rounded-[6px] bg-primary text-primary-foreground text-xs font-medium hover:brightness-95 inline-flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Raise Invoice
          </button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <tr>{["#","Milestone","Amount","Status","Sent","Due"].map((h) => <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-border">
            {projectInvoices.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">No invoices yet for this project.</td></tr>
            )}
            {projectInvoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-muted/40">
                <td className="px-4 py-3 font-mono text-xs">{inv.number ?? inv.id.slice(0, 6)}</td>
                <td className="px-4 py-3">{inv.milestone ?? "—"}</td>
                <td className="px-4 py-3 font-mono tabular-nums">{formatINR(Number(inv.amount))}</td>
                <td className="px-4 py-3 capitalize">{inv.status}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{inv.sent_at ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{inv.due_at ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}


function MiniCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Card className="p-5">
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="font-display text-3xl mt-1 tabular-nums" style={{ color: tone }}>{value}</div>
    </Card>
  );
}

/* ---------------- Documents ---------------- */
function DocumentsTab({ project }: { project: Project }) {
  const [cat, setCat] = useState("All");
  const cats = ["All","Contracts","Floor Plans","Invoices","Site Reports","Warranties"];
  const docs = [
    { name: "Design Contract.pdf", type: "PDF", category: "Contracts", date: "12 Jan 2026", by: "Bhavik" },
    { name: "Floor Plan v3.pdf", type: "PDF", category: "Floor Plans", date: "28 Feb 2026", by: "Riya" },
    { name: "INV-002.pdf", type: "PDF", category: "Invoices", date: "01 May 2026", by: "Bhavik" },
    { name: "Site Visit Apr 28.jpg", type: "Image", category: "Site Reports", date: "28 Apr 2026", by: "Aditya" },
    { name: "Warranty - Stone.pdf", type: "PDF", category: "Warranties", date: "10 Mar 2026", by: "Vendor" },
    { name: "Client Approval - Lime Wash.pdf", type: "PDF", category: "Contracts", date: "12 May 2026", by: "Bhavik" },
  ];
  const visible = cat === "All" ? docs : docs.filter((d) => d.category === cat);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 overflow-x-auto">
          {cats.map((c) => (
            <button key={c} onClick={() => setCat(c)}
                    className={`h-9 px-3 rounded-[6px] text-xs font-medium ${cat === c ? "bg-[#1a1612] text-white" : "border border-border bg-card hover:bg-muted"}`}>
              {c}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <BoqUploadButton projectId={project.id} />
          <button onClick={() => toast.success("Document uploaded")} className="h-9 px-3 rounded-[6px] bg-primary text-primary-foreground text-xs font-medium hover:brightness-95 inline-flex items-center gap-1.5">
            <FilePlus className="h-3.5 w-3.5" /> Upload Document
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {visible.map((d, i) => (
          <Card key={i} className="p-5 hover:-translate-y-[2px] transition-transform cursor-pointer">
            <div className="h-12 w-12 rounded-[10px] bg-[#fff7eb] flex items-center justify-center mb-3">
              {d.type === "PDF" ? <FileText className="h-5 w-5 text-[#c17f5a]" /> : <ImageIcon className="h-5 w-5 text-[#c17f5a]" />}
            </div>
            <div className="text-sm font-medium truncate">{d.name}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{d.category}</div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border text-[11px] text-muted-foreground font-mono">
              <span>{d.by}</span><span>{d.date}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
