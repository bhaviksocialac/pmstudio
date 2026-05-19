import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Send, Check, Phone, Mail, Plus, Upload, Image as ImageIcon,
  FileText, MessageCircle, Download, FileDown, Pencil, Folder, FilePlus,
  Share2, Loader2,
} from "lucide-react";
import { phases, healthMap, type Project } from "@/lib/projects";
import { supabase } from "@/integrations/supabase/client";
import type { DbProject } from "@/lib/db-types";
import { formatINR } from "@/lib/studio-data";
import { AppShell } from "@/components/AppShell";
import { openModal } from "@/lib/app-bus";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  head: ({ params }) => {
    const title = "Project — StudioOS";
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

type Tab = "overview" | "timeline" | "photos" | "vendors" | "finance" | "documents";
const tabs: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "timeline", label: "Timeline" },
  { id: "photos", label: "Photos" },
  { id: "vendors", label: "Vendors" },
  { id: "finance", label: "Finance" },
  { id: "documents", label: "Documents" },
];

function ProjectDetailView({ project }: { project: Project }) {
  const [tab, setTab] = useState<Tab>("overview");
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
              <Pill>{project.type === "residential" ? "Residential" : "Commercial"}</Pill>
              <Pill>{project.phase}</Pill>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[6px] text-xs font-medium" style={{ background: `${h.color}22`, color: h.color }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: h.color }} /> {h.label}
            </span>
            <button onClick={() => openModal("draft-update")} className="h-10 px-4 inline-flex items-center gap-1.5 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95">
              <Send className="h-3.5 w-3.5" /> Send Update
            </button>
            <button onClick={() => { navigator.clipboard?.writeText(`https://studioos.app/portal/${project.id}`).catch(() => {}); toast.success("Portal link copied"); }}
                    className="h-10 px-4 inline-flex items-center gap-1.5 rounded-[6px] border border-border text-sm font-medium hover:bg-muted">
              <Share2 className="h-3.5 w-3.5" /> Share Portal
            </button>
          </div>
        </header>

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
        {tab === "photos" && <PhotosTab project={project} />}
        {tab === "vendors" && <VendorsTab project={project} />}
        {tab === "finance" && <FinanceTab project={project} />}
        {tab === "documents" && <DocumentsTab project={project} />}
      </main>
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6">
      <Card className="p-6 md:p-8">
        <h2 className="font-display text-2xl mb-1">Phase Progress</h2>
        <p className="text-xs text-muted-foreground mb-6">6 stages from survey to handover</p>
        <div className="relative pl-8">
          <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />
          {phases.map((ph, i) => {
            const done = i < phaseIdx;
            const current = i === phaseIdx;
            const mile = project.milestones[i];
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
                <div className={`rounded-[10px] border ${current ? "border-[#d4882a] bg-[#fff7eb]" : "border-border bg-card"} p-4`}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="font-display text-lg">{ph}</h3>
                    {mile && <span className="text-[11px] font-mono text-muted-foreground">{mile.date}</span>}
                  </div>
                  <div className="space-y-1.5 mt-2">
                    {["Site visit","Vendor confirmation","Material delivery"].map((t, k) => (
                      <label key={k} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <input type="checkbox" defaultChecked={done || (current && k === 0)} className="accent-[#c17f5a]" />
                        <span>{t}</span>
                      </label>
                    ))}
                  </div>
                  {current && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-[#e8d9c9]">
                      <button onClick={() => toast.success("Phase marked complete")} className="h-8 px-3 rounded-[6px] bg-[#7a9e8a] text-white text-xs font-medium hover:brightness-110">Mark Phase Complete</button>
                      <button onClick={() => toast("New task added")} className="h-8 px-3 rounded-[6px] border border-border text-xs font-medium hover:bg-white">+ Add Task</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

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
            <QA icon={Upload} label="Upload Photos" onClick={() => openModal("upload-photos")} />
            <QA icon={Plus} label="Add Task" onClick={() => toast("Task added")} />
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
      </div>
    </div>
  );
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
function TimelineTab({ project }: { project: Project }) {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct"];
  const phaseColors = ["#7a9e8a","#7a9e8a","#c17f5a","#c17f5a","#d4882a","#d4882a"];

  return (
    <Card className="p-6 overflow-x-auto">
      <h2 className="font-display text-2xl mb-1">Timeline</h2>
      <p className="text-xs text-muted-foreground mb-6">{project.startDate} → {project.expectedHandover}</p>
      <div className="min-w-[720px] relative">
        <div className="grid border-b border-border pb-2 mb-3 text-[10px] uppercase tracking-wider text-muted-foreground font-mono" style={{ gridTemplateColumns: `120px repeat(${months.length}, 1fr)` }}>
          <div></div>
          {months.map((m) => <div key={m} className="text-center">{m}</div>)}
        </div>
        {phases.map((ph, i) => {
          const start = i * 1.5;
          const end = start + 2;
          const delayed = i === 2; // procurement delayed for demo
          return (
            <div key={ph} className="grid items-center mb-2.5" style={{ gridTemplateColumns: `120px repeat(${months.length}, 1fr)` }}>
              <div className="text-xs font-medium pr-2 truncate">{ph}</div>
              <div className="col-span-10 relative h-6">
                <div className="absolute h-6 rounded-[6px] flex items-center px-2 text-[10px] font-mono text-white"
                     style={{ left: `${(start / months.length) * 100}%`, width: `${((end - start) / months.length) * 100}%`, background: delayed ? `${phaseColors[i]}99` : phaseColors[i] }}>
                  {delayed && <span className="text-[9px] uppercase tracking-wider">delayed</span>}
                </div>
              </div>
            </div>
          );
        })}
        {/* Today line */}
        <div className="absolute top-0 bottom-0 w-px bg-[#c4685a]" style={{ left: `calc(120px + ${(4.5 / months.length) * (100 - (120 / 8))}%)` }} />
      </div>
      <div className="flex gap-4 mt-6 text-[11px] text-muted-foreground">
        <div className="inline-flex items-center gap-2"><span className="h-2 w-4 rounded-sm bg-[#7a9e8a]" /> Completed</div>
        <div className="inline-flex items-center gap-2"><span className="h-2 w-4 rounded-sm bg-[#c17f5a]" /> In progress</div>
        <div className="inline-flex items-center gap-2"><span className="h-2 w-4 rounded-sm bg-[#d4882a]" /> Upcoming</div>
        <div className="inline-flex items-center gap-2"><span className="h-3 w-px bg-[#c4685a]" /> Today</div>
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
  const projectInvoices = invoices.filter((inv) => inv.projectId === project.id);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniCard label="Project Budget" value={`₹${project.budget}L`} />
        <MiniCard label="Spent" value={`₹${project.spent}L`} tone="#c17f5a" />
        <MiniCard label="Pending POs" value="₹1.2L" tone="#d4882a" />
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
            <tr>{["#","Milestone","Amount","Status","Sent","Paid"].map((h) => <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-border">
            {projectInvoices.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">No invoices yet for this project.</td></tr>
            )}
            {projectInvoices.map((inv) => (
              <tr key={inv.no} className="hover:bg-muted/40">
                <td className="px-4 py-3 font-mono text-xs">{inv.no}</td>
                <td className="px-4 py-3">{inv.milestone}</td>
                <td className="px-4 py-3 font-mono tabular-nums">{formatINR(inv.amount)}</td>
                <td className="px-4 py-3 capitalize">{inv.status}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{inv.sent}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{inv.status === "paid" ? inv.due : "—"}</td>
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
        <button onClick={() => toast.success("Document uploaded")} className="h-9 px-3 rounded-[6px] bg-primary text-primary-foreground text-xs font-medium hover:brightness-95 inline-flex items-center gap-1.5">
          <FilePlus className="h-3.5 w-3.5" /> Upload Document
        </button>
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
