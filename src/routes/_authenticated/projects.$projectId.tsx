import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Send, Check, Pencil, Upload, Plus, Image as ImageIcon, Loader2,
  ChevronDown, Calendar as CalendarIcon, MapPin,
} from "lucide-react";
import { ProjectProgressPanels } from "@/components/tasks/ProjectProgressPanels";
import { computeRollup, EXECUTION_PHASE_GROUPS, isDone, overallProjectPct, phaseOfTask, type ExecutionPhaseGroup, type GroupRollup, type TaskLite } from "@/lib/phase-sync";
import { phases, healthMap, type Project } from "@/lib/projects";
import { labelForProjectType } from "@/lib/project-types";
import { supabase } from "@/integrations/supabase/client";
import type { DbProject } from "@/lib/db-types";
import { formatINR } from "@/lib/studio-data";
import { AppShell } from "@/components/AppShell";
import { openModal } from "@/lib/app-bus";
import { toast } from "sonner";
import { SharePortalButton } from "@/components/SharePortalButton";
import { NewProjectWizard } from "@/components/NewProjectWizard";
import { AddTaskPanel } from "@/components/AddTaskPanel";
import { ShareProjectCard } from "@/components/ShareProjectCard";

import { SiteReportsList } from "@/components/SiteReportsList";
import { AINarrativeBar } from "@/components/tasks/AINarrativeBar";
import { PhaseChecklistTab } from "@/components/PhaseChecklistTab";
import { ProjectActivityFeed } from "@/components/ProjectActivityFeed";
import { RoomProgressGrid } from "@/components/tasks/RoomProgressGrid";
import { ProjectTasksTab } from "@/components/tasks/ProjectTasksTab";

import { SnagsTab } from "@/components/SnagsTab";
import { ChangeOrdersTab } from "@/components/ChangeOrdersTab";
import { AttendanceTab } from "@/components/AttendanceTab";
import { MilestonesTab } from "@/components/milestones/MilestonesTab";
import { ProjectVendorsTab } from "@/components/vendors/ProjectVendorsTab";
import { DocumentsTab } from "@/components/documents/DocumentsTab";
import { BudgetReconciliationPanel } from "@/components/BudgetReconciliationPanel";
import { ProjectAlertsStrip } from "@/components/ProjectAlertsStrip";

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
    clientId: row.client_id ?? null,
    location: row.location ?? "",
    flatNumber: row.flat_number ?? null,
    street: row.street ?? null,
    city: row.city ?? null,
    pincode: row.pincode ?? null,
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
            <Link to="/dashboard" className="inline-flex items-center gap-2 h-10 px-5 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95">
              <ArrowLeft className="h-4 w-4" /> Back to Dashboard
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return <ProjectDetailView project={project} />;
}

type Tab =
  | "overview" | "timeline" | "calendar" | "tasks" | "budget" | "documents"
  | "milestones" | "phases" | "snags" | "attendance" | "change-orders"
  | "reports" | "photos" | "vendors" | "finance";

const primaryTabs: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "timeline", label: "Timeline" },
  { id: "calendar", label: "Calendar" },
  { id: "tasks", label: "Tasks" },
  { id: "budget", label: "Budget" },
  { id: "documents", label: "Documents" },
];

const secondaryTabs: { id: Tab; label: string }[] = [
  { id: "milestones", label: "Milestones" },
  { id: "phases", label: "Phases" },
  { id: "snags", label: "Snags" },
  { id: "attendance", label: "Attendance" },
  { id: "change-orders", label: "Change Orders" },
  { id: "reports", label: "Reports" },
  { id: "photos", label: "Photos" },
  { id: "vendors", label: "Vendors" },
  { id: "finance", label: "Invoices" },
];

const allTabs = [...primaryTabs, ...secondaryTabs];


function ProjectDetailView({ project }: { project: Project }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [editing, setEditing] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    const onGoto = (e: Event) => {
      const detail = (e as CustomEvent).detail as { tab?: Tab; projectId?: string } | undefined;
      if (detail?.projectId && detail.projectId !== project.id) return;
      if (detail?.tab) setTab(detail.tab);
    };
    window.addEventListener("pmstudio:goto-tab", onGoto as EventListener);
    return () => window.removeEventListener("pmstudio:goto-tab", onGoto as EventListener);
  }, [project.id]);

  useEffect(() => {
    const onClick = () => setMoreOpen(false);
    if (moreOpen) {
      window.addEventListener("click", onClick);
      return () => window.removeEventListener("click", onClick);
    }
  }, [moreOpen]);

  const h = healthMap[project.health as keyof typeof healthMap];
  const budgetPct = project.budget > 0 ? Math.round((project.spent / project.budget) * 100) : 0;
  const activeTabLabel = allTabs.find((t) => t.id === tab)?.label ?? "Overview";
  const isSecondary = secondaryTabs.some((t) => t.id === tab);

  return (
    <AppShell>
      <main className="px-4 md:px-10 lg:px-14 py-8 md:py-12 max-w-[1400px] w-full pb-24 md:pb-16">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-[10px] text-muted-foreground hover:text-foreground mb-10 uppercase tracking-[0.22em] font-medium">
          <ArrowLeft className="h-3 w-3" /> Dashboard
        </Link>

        {/* Editorial header */}
        <header className="mb-12">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="min-w-0 max-w-3xl">
              <div className="flex items-center gap-2.5 mb-4">
                <span className={`h-1.5 w-1.5 rounded-full ${h.pulse}`} style={{ background: h.color }} />
                <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">{project.phase} · {h.label}</span>
              </div>
              <h1 className="font-display text-[44px] md:text-[56px] leading-[1.05] tracking-[-0.01em]">{project.name}</h1>
              {project.location && (
                <p className="font-display italic text-lg md:text-xl text-muted-foreground mt-2.5">
                  {project.location}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => setEditing(true)} className="h-10 px-4 inline-flex items-center gap-1.5 rounded-[6px] text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
              <SharePortalButton projectId={project.id} variant="outline" size="md" label="Share Portal" stopPropagation={false} />
              <button onClick={() => openModal("draft-update")} className="h-10 px-5 inline-flex items-center gap-1.5 rounded-[6px] bg-[#1a1612] text-white text-sm font-medium hover:brightness-110 transition">
                <Send className="h-3.5 w-3.5" /> Send Update
              </button>
            </div>
          </div>

          {/* Editorial metadata strip */}
          <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-x-10 gap-y-6 pt-8 border-t border-border/60">
            <MetaCell label="Client" value={project.client} />
            <MetaCell label="Type" value={labelForProjectType(project.type)} />
            <MetaCell label="Handover" value={project.expectedHandover} />
            <MetaCell
              label="Budget"
              value={`₹${project.spent}L / ₹${project.budget}L`}
              hint={`${budgetPct}% used`}
              tone={budgetPct > 100 ? "#c4685a" : budgetPct > 80 ? "#d4882a" : undefined}
            />
          </div>
        </header>

        <div className="mb-8">
          <AINarrativeBar projectId={project.id} />
        </div>

        {/* Editorial tab nav: 6 primary + More overflow */}
        <div className="border-b border-border/60 mb-10">
          <div className="flex items-center gap-1 overflow-x-auto">
            {primaryTabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-5 py-4 text-sm font-medium border-b -mb-px transition-colors whitespace-nowrap ${
                  tab === t.id
                    ? "border-[#c17f5a] text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
            <div className="relative ml-auto" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setMoreOpen((v) => !v)}
                className={`px-5 py-4 text-sm font-medium border-b -mb-px transition-colors inline-flex items-center gap-1.5 whitespace-nowrap ${
                  isSecondary
                    ? "border-[#c17f5a] text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {isSecondary ? activeTabLabel : "More"} <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {moreOpen && (
                <div
                  className="absolute right-0 top-full mt-1 z-20 min-w-[180px] rounded-[10px] bg-card border border-border/60 py-1.5"
                  style={{ boxShadow: "var(--shadow-card)" }}
                >
                  {secondaryTabs.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => { setTab(t.id); setMoreOpen(false); }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-muted/60 transition-colors ${tab === t.id ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>


        <div className="mb-4">
          <ProjectAlertsStrip projectId={project.id} projectBudget={project.budget} />
        </div>

        {tab === "overview" && <OverviewTab project={project} onGoTo={setTab} />}
        {tab === "milestones" && <MilestonesTab projectId={project.id} />}
        {tab === "timeline" && <TimelineTab project={project} />}
        {tab === "calendar" && <CalendarTab project={project} />}
        {tab === "tasks" && <ProjectTasksTab projectId={project.id} projectName={project.name} />}
        {tab === "budget" && <BudgetTab project={project} />}
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
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#c17f5a] mb-2">Site Pulse</div>
              <h2 className="font-display text-3xl">Daily Site Reports</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-xl">Auto-compiled every evening from today's tasks, attendance, photos and snags.</p>
            </div>
            <SiteReportsList projectId={project.id} />
          </div>
        )}
        {tab === "photos" && <PhotosTab project={project} />}
        {tab === "vendors" && <ProjectVendorsTab projectId={project.id} />}
        {tab === "finance" && <FinanceTab project={project} />}
        {tab === "documents" && <DocumentsTab projectId={project.id} />}
      </main>
      {editing && <NewProjectWizard onClose={() => setEditing(false)} editProjectId={project.id} />}

    </AppShell>
  );
}

function MetaCell({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-2">{label}</div>
      <div className="font-display text-xl truncate" style={tone ? { color: tone } : undefined}>{value}</div>
      {hint && <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1 font-mono">{hint}</div>}
    </div>
  );
}

const Pill = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-[6px] bg-muted text-muted-foreground">{children}</span>
);

const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = "", children, ...p }) => (
  <div {...p} className={`rounded-[16px] bg-card ${className}`} style={{ boxShadow: "var(--shadow-card)" }}>{children}</div>
);

/* ---------------- Overview ---------------- */
function OverviewTab({ project, onGoTo }: { project: Project; onGoTo: (t: Tab) => void }) {
  const budgetPct = Math.round((project.spent / project.budget) * 100);
  const qc = useQueryClient();
  const [addTaskFor, setAddTaskFor] = useState<string | null>(null);

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

  const { data: overviewTasks = [] } = useQuery({
    queryKey: ["project-tasks-overview", project.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("id,status,done,work_type,work_types,areas,area,room,completion_pct,notes,phase,ifr_date,ifa_date,ifc_date")
        .eq("project_id", project.id);
      return (data ?? []) as TaskLite[];
    },
  });
  const overviewRollups = useMemo<GroupRollup[]>(() => computeRollup(overviewTasks), [overviewTasks]);
  const rollupByPhase = useMemo(() => new Map(overviewRollups.map((r) => [r.group, r])), [overviewRollups]);
  const taskDrivenOverall = overallProjectPct(overviewTasks);

  const { data: clientRow } = useQuery({
    queryKey: ["project-client", project.id, project.clientId],
    queryFn: async () => {
      if (!project.clientId) return null;
      const { data } = await supabase
        .from("clients")
        .select("name,phone,email")
        .eq("id", project.clientId)
        .maybeSingle();
      return data;
    },
    enabled: !!project.clientId,
  });
  const clientData = clientRow
    ? { name: clientRow.name ?? "", phone: clientRow.phone ?? null, email: clientRow.email ?? null }
    : null;

  const signOffPhase = async (phase: ExecutionPhaseGroup) => {
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase
      .from("project_phases")
      .update({ status: "done", end_date: today })
      .eq("project_id", project.id)
      .eq("phase", phase);
    if (error) throw error;
    await supabase.from("projects").update({ completion: taskDrivenOverall }).eq("id", project.id);
    await qc.invalidateQueries({ queryKey: ["project-phases", project.id] });
    await qc.invalidateQueries({ queryKey: ["project", project.id] });
    await qc.invalidateQueries({ queryKey: ["projects"] });
    toast.success(`${phase} signed off`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6">
      <Card className="p-6 md:p-8">
        <h2 className="font-display text-2xl mb-1">Phase Progress</h2>
        <p className="text-xs text-muted-foreground mb-6">All 6 stages run in parallel. Progress is calculated only from tasks.</p>
        <div className="relative pl-8">
          <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />
          {EXECUTION_PHASE_GROUPS.map((ph) => {
            const meta = phaseMeta.get(ph);
            const rollup = rollupByPhase.get(ph);
            const pct = rollup?.pct ?? 0;
            const done = pct === 100 && (rollup?.total ?? 0) > 0;
            const signed = meta?.status === "done";
            return (
              <div key={ph} className="relative pb-6 last:pb-0">
                <span className="absolute -left-[22px] top-1 h-3.5 w-3.5 rounded-full flex items-center justify-center"
                      style={{
                        background: done ? "#7a9e8a" : pct > 0 ? "#d4882a" : "transparent",
                        border: done || pct > 0 ? "none" : "2px solid #d4c9b9",
                        boxShadow: pct > 0 && !done ? "0 0 0 4px rgba(212,136,42,0.18)" : "none",
                      }}>
                  {done && <Check className="h-2 w-2 text-white" />}
                </span>
                <div className={`rounded-[10px] border ${pct > 0 && !done ? "border-[#d4882a] bg-[#fff7eb]" : done ? "border-[#cfe0d4] bg-[#f4f9f5]" : "border-border bg-card"} p-4`}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="font-display text-lg">{ph}</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-muted-foreground">{rollup?.done ?? 0}/{rollup?.total ?? 0} · {pct}%</span>
                      {signed && <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-[6px] bg-[#7a9e8a]/20 text-[#3d6f5a]">Signed Off</span>}
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full transition-all" style={{ width: `${pct}%`, background: done ? "#7a9e8a" : "#c17f5a" }} />
                  </div>
                  <div className="space-y-1.5 mt-3">
                    {(rollup?.workTypes ?? []).slice(0, 4).map((wt) => (
                      <div key={wt.workType} className="flex justify-between text-xs text-muted-foreground">
                        <span>{wt.workType}</span><span className="font-mono">{wt.done}/{wt.total} · {wt.pct}%</span>
                      </div>
                    ))}
                    {!rollup?.total && <div className="text-xs text-muted-foreground italic">No tasks tagged to {ph} yet.</div>}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/60">
                    <button onClick={() => setAddTaskFor(ph)} className="h-8 px-3 rounded-[6px] border border-border text-xs font-medium hover:bg-white">+ Add Task</button>
                    <button
                      onClick={() => signOffPhase(ph).catch((e) => toast.error(e instanceof Error ? e.message : "Failed"))}
                      disabled={!done || signed}
                      className="h-8 px-3 rounded-[6px] bg-[#7a9e8a] text-white text-xs font-medium hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Sign Off
                    </button>
                    {!done && rollup?.blocker && (
                      <span className="text-[11px] text-[#8a5a1a] self-center">{rollup.blocker}</span>
                    )}
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

        <ShareProjectCard
          project={{
            id: project.id,
            name: project.name,
            type: labelForProjectType(project.type),
            phase: project.phase,
            flatNumber: project.flatNumber ?? null,
            street: project.street ?? null,
            city: project.city ?? null,
            pincode: project.pincode ?? null,
            location: project.location ?? null,
          }}
          client={clientData}
        />

        <RoomProgressGrid projectId={project.id} />
        <ProjectProgressPanels projectId={project.id} />
        <BudgetReconciliationPanel projectId={project.id} projectBudget={project.budget} />
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
        .select("status,done,work_type,work_types,phase,ifr_date,ifa_date,ifc_date")
        .eq("project_id", project.id);
      return (data ?? []) as TaskLite[];
    },
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (!tasks.length) return;
    const byPhase = new Map<ExecutionPhaseGroup, { total: number; done: number }>();
    tasks.forEach((t) => {
      const ph = phaseOfTask(t);
      const cur = byPhase.get(ph) ?? { total: 0, done: 0 };
      cur.total++;
      if (isDone(t)) cur.done++;
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
      const idx = EXECUTION_PHASE_GROUPS.indexOf(ph);
      const next = EXECUTION_PHASE_GROUPS[idx + 1];
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
          <div className="py-12 text-center text-sm text-muted-foreground">No timeline items yet. Use the AI Update bar in the Tasks tab to add some.</div>
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

/* Vendors tab now provided by ProjectVendorsTab */


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


/* ---------------- Calendar ---------------- */
type CalendarEvent = {
  id: string;
  date: Date;
  title: string;
  kind: "milestone" | "task" | "handover";
  meta?: string;
  tone: string;
};

function CalendarTab({ project }: { project: Project }) {
  const { data: milestones = [] } = useQuery({
    queryKey: ["calendar-milestones", project.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("milestones")
        .select("id,name,triggered_at,status,invoice_amount")
        .eq("project_id", project.id);
      return data ?? [];
    },
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ["calendar-tasks", project.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("id,title,due_date,done,status,assignee,room")
        .eq("project_id", project.id)
        .not("due_date", "is", null);
      return data ?? [];
    },
  });

  const events: CalendarEvent[] = useMemo(() => {
    const list: CalendarEvent[] = [];
    (tasks as Array<{ id: string; title: string | null; due_date: string | null; done: boolean | null; assignee: string | null; room: string | null }>).forEach((t) => {
      if (!t.due_date) return;
      list.push({
        id: `t-${t.id}`,
        date: new Date(t.due_date),
        title: t.title ?? "Untitled task",
        kind: "task",
        meta: [t.room, t.assignee].filter(Boolean).join(" · ") || undefined,
        tone: t.done ? "#7a9e8a" : new Date(t.due_date) < new Date() ? "#c4685a" : "#c17f5a",
      });
    });
    (milestones as Array<{ id: string; name: string; triggered_at: string | null; status: string; invoice_amount: number | null }>).forEach((m) => {
      if (!m.triggered_at) return;
      list.push({
        id: `m-${m.id}`,
        date: new Date(m.triggered_at),
        title: m.name,
        kind: "milestone",
        meta: m.invoice_amount ? `Bill ₹${(Number(m.invoice_amount) / 100000).toFixed(1)}L` : undefined,
        tone: "#7a9e8a",
      });
    });
    if (project.expectedHandover && project.expectedHandover !== "—") {
      const d = new Date(project.expectedHandover);
      if (!isNaN(d.getTime())) {
        list.push({
          id: "handover",
          date: d,
          title: "Expected Handover",
          kind: "handover",
          tone: "#1a1612",
        });
      }
    }
    return list.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [milestones, tasks, project.expectedHandover]);

  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach((e) => {
      const key = e.date.toLocaleString("en", { month: "long", year: "numeric" });
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    return Array.from(map.entries());
  }, [events]);

  const today = new Date();
  const upcoming = events.filter((e) => e.date >= new Date(today.getFullYear(), today.getMonth(), today.getDate())).length;
  const overdue = events.filter((e) => e.kind === "task" && e.tone === "#c4685a").length;

  return (
    <div className="space-y-10">
      <div>
        <div className="text-[10px] uppercase tracking-[0.22em] text-[#c17f5a] mb-2">Schedule</div>
        <h2 className="font-display text-3xl">Calendar</h2>
        <p className="text-sm text-muted-foreground mt-2">
          {upcoming} upcoming · {overdue} overdue
        </p>
      </div>

      {grouped.length === 0 && (
        <Card className="p-12 text-center">
          <CalendarIcon className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No scheduled events yet. Add task due dates or trigger milestones to see them here.</p>
        </Card>
      )}

      {grouped.map(([month, items]) => (
        <section key={month}>
          <div className="flex items-baseline justify-between mb-5 pb-3 border-b border-border/60">
            <h3 className="font-display text-2xl">{month}</h3>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">{items.length} event{items.length === 1 ? "" : "s"}</span>
          </div>
          <div className="space-y-2">
            {items.map((e) => {
              const day = e.date.getDate();
              const weekday = e.date.toLocaleString("en", { weekday: "short" }).toUpperCase();
              return (
                <div
                  key={e.id}
                  className="group flex items-center gap-6 px-5 py-5 rounded-[12px] bg-card hover:bg-[#f5efe7] transition-colors"
                  style={{ boxShadow: "var(--shadow-card)" }}
                >
                  <div className="w-14 shrink-0 text-center">
                    <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{weekday}</div>
                    <div className="font-display text-3xl leading-none mt-1">{day}</div>
                  </div>
                  <div className="w-px self-stretch bg-border/60" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: e.tone }} />
                      <span className="text-[9px] uppercase tracking-[0.22em] text-muted-foreground">{e.kind}</span>
                    </div>
                    <div className="font-display text-lg truncate">{e.title}</div>
                    {e.meta && <div className="text-xs text-muted-foreground mt-1">{e.meta}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}


/* ---------------- Budget ---------------- */
function BudgetTab({ project }: { project: Project }) {
  const budgetPct = project.budget > 0 ? Math.round((project.spent / project.budget) * 100) : 0;
  const remaining = project.budget - project.spent;

  return (
    <div className="space-y-10">
      <div>
        <div className="text-[10px] uppercase tracking-[0.22em] text-[#c17f5a] mb-2">Financial Overview</div>
        <h2 className="font-display text-3xl">Budget</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-xl">
          Live reconciliation of allocated budget, spend, and outstanding commitments.
        </p>
      </div>

      <Card className="p-8 md:p-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-3">Allocated</div>
            <div className="font-display text-[44px] leading-none tabular-nums">₹{project.budget}L</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-3">Spent</div>
            <div className="font-display text-[44px] leading-none tabular-nums" style={{ color: "#c17f5a" }}>₹{project.spent}L</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-2 font-mono">{budgetPct}% used</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-3">Remaining</div>
            <div
              className="font-display text-[44px] leading-none tabular-nums"
              style={{ color: remaining < 0 ? "#c4685a" : "#7a9e8a" }}
            >
              ₹{remaining.toFixed(1)}L
            </div>
          </div>
        </div>
        <div className="mt-10 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full transition-all"
            style={{
              width: `${Math.min(budgetPct, 100)}%`,
              background: budgetPct > 100 ? "#c4685a" : budgetPct > 80 ? "#d4882a" : "#c17f5a",
            }}
          />
        </div>
      </Card>

      <BudgetReconciliationPanel projectId={project.id} projectBudget={project.budget} />

      <FinanceTab project={project} />
    </div>
  );
}




