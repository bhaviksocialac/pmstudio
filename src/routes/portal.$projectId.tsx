import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Check, Circle, AlertCircle, Loader2, Share2, Globe, Sun, ChevronRight,
  FileText, FileSignature, ScrollText, ReceiptText, BadgeCheck, X,
} from "lucide-react";
import { toast } from "sonner";
import { getPortalData, submitApproval } from "@/lib/portal.functions";
import { t, type Lang } from "@/lib/portal-i18n";
import { supabase } from "@/integrations/supabase/client";
import { copyPortalLink } from "@/components/SharePortalButton";

type Search = { lang?: Lang };

export const Route = createFileRoute("/portal/$projectId")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    lang: s.lang === "hi" ? "hi" : "en",
  }),
  head: ({ params }) => ({
    meta: [
      { title: "Client Portal — PMStudio" },
      { name: "description", content: `Live project portal for ${params.projectId}` },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
  }),
  component: PortalPage,
});

const PHASES = ["Survey", "Design", "Procurement", "Execution", "Finishing", "Handover"] as const;

function PortalPage() {
  const { projectId } = Route.useParams();
  const search = useSearch({ from: "/portal/$projectId" });
  const [lang, setLang] = useState<Lang>(search.lang ?? "en");

  const fetcher = useServerFn(getPortalData);
  const { data, isLoading } = useQuery({
    queryKey: ["portal", projectId],
    queryFn: () => fetcher({ data: { projectId } }),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-3">PMStudio</div>
          <h1 className="font-display text-4xl">{t.notFound[lang]}</h1>
        </div>
      </div>
    );
  }

  const { project, client, phases, budgetLines, tasks, photos, approvals } = data;
  const pendingApprovals = approvals.filter((a) => a.status === "pending");
  const clientName = client?.name ?? "there";

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Sticky header */}
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur border-b border-border">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-display text-sm">P</span>
            <span className="font-display text-lg leading-none">PMStudio</span>
          </div>
          <div className="flex items-center gap-1">
            <LangToggle lang={lang} setLang={setLang} />
            <button
              onClick={() => copyPortalLink(projectId)}
              className="h-9 w-9 rounded-[8px] hover:bg-muted flex items-center justify-center text-foreground"
              aria-label={t.share[lang]}
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-6 space-y-6">
        {/* Hero */}
        <section className="animate-fade-up">
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-2">
            {t.phase[lang]} · {translatePhase(project.phase, lang)}
          </div>
          <h1 className="font-display text-[2.4rem] leading-[1.05] tracking-tight">{project.name}</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {t.client[lang]}: <span className="text-foreground">{clientName}</span>
          </p>

          <div className="mt-5">
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{t.completion[lang]}</span>
              <span className="font-mono text-sm tabular-nums">{project.completion}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${project.completion}%`,
                  background: "linear-gradient(90deg, #c17f5a, #d4882a)",
                  animation: "bar-grow 1s ease-out",
                }}
              />
            </div>
            {project.expected_handover && (
              <p className="text-xs text-muted-foreground mt-2 font-mono">
                {t.handover[lang]}: {formatDate(project.expected_handover, lang)}
              </p>
            )}
          </div>
        </section>

        {/* Pending approvals — top priority */}
        {pendingApprovals.length > 0 && (
          <ApprovalsSection
            projectId={projectId}
            approvals={pendingApprovals.map((a) => ({
              id: a.id, title: a.title, created_at: a.created_at,
            }))}
            lang={lang}
          />
        )}

        {/* Morning AI update */}
        <MorningCard tasks={tasks} clientName={clientName} lang={lang} />

        {/* Timeline */}
        <Timeline phases={phases} lang={lang} />

        {/* Photos */}
        <PhotosSection photos={photos} lang={lang} />

        {/* Budget */}
        <BudgetSection project={project} lines={budgetLines} lang={lang} />

        {/* Documents */}
        <DocumentsSection lang={lang} />

        {/* Footer */}
        <footer className="pt-8 text-center">
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Powered by PMStudio
          </p>
        </footer>
      </main>
    </div>
  );
}

/* ---------- Language toggle ---------- */
function LangToggle({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div className="flex items-center rounded-[8px] border border-border overflow-hidden text-[11px] font-medium">
      <button
        onClick={() => setLang("en")}
        className={`h-8 px-2.5 flex items-center gap-1 ${lang === "en" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
      >
        <Globe className="h-3 w-3" /> EN
      </button>
      <button
        onClick={() => setLang("hi")}
        className={`h-8 px-2.5 ${lang === "hi" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
      >
        हि
      </button>
    </div>
  );
}

/* ---------- Approvals ---------- */
type PendingApproval = { id: string; title: string; created_at: string };

function ApprovalsSection({
  projectId, approvals, lang,
}: { projectId: string; approvals: PendingApproval[]; lang: Lang }) {
  return (
    <section className="rounded-[16px] border-2 border-[#d4882a] bg-[#fff7eb] p-5 animate-fade-up">
      <div className="flex items-center gap-2 mb-4">
        <AlertCircle className="h-4 w-4 text-[#d4882a]" />
        <h2 className="font-display text-xl">{t.pendingApprovals[lang]}</h2>
        <span className="ml-auto text-[10px] uppercase tracking-wider font-mono bg-[#d4882a] text-white rounded-full px-2 py-0.5">
          {approvals.length}
        </span>
      </div>
      <div className="space-y-3">
        {approvals.map((a) => (
          <ApprovalCard key={a.id} approval={a} projectId={projectId} lang={lang} />
        ))}
      </div>
    </section>
  );
}

function ApprovalCard({
  approval, projectId, lang,
}: { approval: PendingApproval; projectId: string; lang: Lang }) {
  const [open, setOpen] = useState<null | "approve" | "change">(null);
  const [phrase, setPhrase] = useState("");
  const qc = useQueryClient();
  const submit = useServerFn(submitApproval);

  const ageDays = Math.floor((Date.now() - new Date(approval.created_at).getTime()) / 86400000);
  const isOverdue = ageDays > 3;

  const mut = useMutation({
    mutationFn: (action: "approve" | "request_change") =>
      submit({ data: { projectId, approvalId: approval.id, action, phrase } }),
    onSuccess: () => {
      toast.success(t.approved[lang]);
      setOpen(null);
      setPhrase("");
      qc.invalidateQueries({ queryKey: ["portal", projectId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="rounded-[10px] bg-card border border-border p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="font-medium text-sm">{approval.title}</h3>
          <p className={`text-xs mt-0.5 ${isOverdue ? "text-[#c4685a]" : "text-muted-foreground"}`}>
            {isOverdue ? t.overdue[lang] : `${ageDays}d`}
          </p>
        </div>
      </div>

      {open === null && (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setOpen("approve")}
            className="h-10 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95 inline-flex items-center justify-center gap-1.5"
          >
            <Check className="h-3.5 w-3.5" /> {t.approve[lang]}
          </button>
          <button
            onClick={() => mut.mutate("request_change")}
            disabled={mut.isPending}
            className="h-10 rounded-[6px] border border-border text-sm font-medium hover:bg-muted"
          >
            {t.requestChange[lang]}
          </button>
        </div>
      )}

      {open === "approve" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{t.typeToApprove[lang]}</p>
          <input
            autoFocus
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder={t.confirmPhrase[lang]}
            className="w-full h-10 px-3 rounded-[8px] border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => mut.mutate("approve")}
              disabled={mut.isPending}
              className="h-10 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95 inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              {mut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t.confirm[lang]}
            </button>
            <button
              onClick={() => { setOpen(null); setPhrase(""); }}
              className="h-10 rounded-[6px] border border-border text-sm hover:bg-muted"
            >
              {t.cancel[lang]}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Morning AI ---------- */
function MorningCard({
  tasks, clientName, lang,
}: { tasks: { title: string; due_date: string | null; done: boolean; updated_at: string }[]; clientName: string; lang: Lang }) {
  const { yesterday, today } = useMemo(() => buildDailyDigest(tasks), [tasks]);

  return (
    <section className="rounded-[16px] p-5 text-white animate-fade-up" style={{ background: "linear-gradient(135deg, #1a1612, #2a2520)" }}>
      <div className="flex items-center gap-2 mb-3">
        <Sun className="h-4 w-4 text-[#d4882a]" />
        <p className="text-sm">
          {t.goodMorning[lang]} <span className="font-display text-lg">{clientName.split(" ")[0]}</span>
        </p>
      </div>
      <div className="space-y-3 text-sm">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/50 mb-1">{t.yesterday[lang]}</div>
          {yesterday.length ? (
            <ul className="space-y-1">
              {yesterday.map((y, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 text-[#7a9e8a] mt-0.5 flex-shrink-0" /> <span>{y}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-white/60 text-xs">{t.nothingYet[lang]}</p>
          )}
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/50 mb-1">{t.today[lang]}</div>
          {today.length ? (
            <ul className="space-y-1">
              {today.map((y, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Circle className="h-3 w-3 text-[#d4882a] mt-1 flex-shrink-0" /> <span>{y}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-white/60 text-xs">{t.nothingYet[lang]}</p>
          )}
        </div>
      </div>
    </section>
  );
}

function buildDailyDigest(tasks: { title: string; due_date: string | null; done: boolean; updated_at: string }[]) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const yesterday = tasks
    .filter((t) => t.done && t.updated_at.slice(0, 10) >= yesterdayStr)
    .slice(0, 3)
    .map((t) => t.title);
  const today = tasks
    .filter((t) => !t.done && t.due_date && t.due_date <= todayStr)
    .slice(0, 3)
    .map((t) => t.title);
  return { yesterday, today };
}

/* ---------- Timeline ---------- */
function Timeline({
  phases, lang,
}: { phases: { phase: string; order_index: number; start_date: string | null; end_date: string | null; status: string }[]; lang: Lang }) {
  const ordered = PHASES.map((p, i) => {
    const found = phases.find((x) => x.phase === p);
    return found ?? { phase: p, order_index: i, start_date: null, end_date: null, status: "planned" };
  });
  const activeIdx = ordered.findIndex((p) => p.status === "active");

  return (
    <section className="rounded-[16px] bg-card border border-border p-5 animate-fade-up">
      <h2 className="font-display text-xl mb-4">{t.timeline[lang]}</h2>
      <div className="relative pl-7">
        <div className="absolute left-[10px] top-2 bottom-2 w-px bg-border" />
        {ordered.map((p, i) => {
          const done = activeIdx === -1 ? false : i < activeIdx;
          const current = activeIdx === -1 ? p.status === "active" : i === activeIdx;
          return (
            <div key={p.phase} className="relative pb-4 last:pb-0">
              <span
                className={`absolute -left-[22px] top-1 h-4 w-4 rounded-full flex items-center justify-center ${current ? "pulse-slow" : ""}`}
                style={{
                  background: done ? "#7a9e8a" : current ? "#d4882a" : "transparent",
                  border: done || current ? "none" : "2px solid #d4c9b9",
                  color: current ? "#d4882a" : "transparent",
                }}
              >
                {done && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
              </span>
              <div className="flex items-baseline justify-between gap-2">
                <h3 className={`text-sm font-medium ${done ? "text-muted-foreground line-through" : ""}`}>
                  {translatePhase(p.phase, lang)}
                </h3>
                <span className="text-[11px] font-mono text-muted-foreground">
                  {p.end_date ? formatDate(p.end_date, lang) : "—"}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {done ? t.completed[lang] : current ? t.inProgress[lang] : t.upcoming[lang]}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ---------- Photos ---------- */
type Photo = { id: string; room: string | null; caption: string | null; storage_path: string | null; created_at: string };

function PhotosSection({ photos, lang }: { photos: Photo[]; lang: Lang }) {
  const grouped = useMemo(() => {
    const m = new Map<string, Photo[]>();
    for (const p of photos) {
      const room = p.room || "Others";
      if (!m.has(room)) m.set(room, []);
      m.get(room)!.push(p);
    }
    return Array.from(m.entries()).map(([room, list]) => ({
      room,
      latest3: list.slice(0, 3),
      first: list[list.length - 1],
      last: list[0],
    }));
  }, [photos]);

  const [lightbox, setLightbox] = useState<Photo | null>(null);

  return (
    <section className="rounded-[16px] bg-card border border-border p-5 animate-fade-up">
      <h2 className="font-display text-xl mb-4">{t.progressPhotos[lang]}</h2>

      {grouped.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">{t.noPhotos[lang]}</p>
      ) : (
        <div className="space-y-6">
          {grouped.map((g) => (
            <div key={g.room}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium">{g.room}</h3>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">{g.latest3.length}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {g.latest3.map((p, i) => (
                  <button
                    key={p.id}
                    onClick={() => setLightbox(p)}
                    className="relative aspect-square rounded-[10px] overflow-hidden bg-muted border border-border group"
                  >
                    <PhotoImg photo={p} />
                    {i === 0 && (
                      <span className="absolute top-1.5 left-1.5 text-[9px] font-mono bg-primary text-primary-foreground rounded px-1.5 py-0.5">
                        {t.latest[lang]}
                      </span>
                    )}
                    {p.id === g.first.id && g.first.id !== g.last.id && (
                      <span className="absolute top-1.5 right-1.5 text-[9px] font-mono bg-[#1a1612] text-white rounded px-1.5 py-0.5">
                        {t.before[lang]}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {g.first.id !== g.last.id && (
                <BeforeAfter before={g.first} after={g.last} lang={lang} />
              )}
            </div>
          ))}
        </div>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 text-white flex items-center justify-center">
            <X className="h-5 w-5" />
          </button>
          <div className="max-w-full max-h-full">
            <PhotoImg photo={lightbox} className="max-h-[80vh] max-w-full object-contain" />
            {lightbox.caption && <p className="text-white/80 text-sm text-center mt-3">{lightbox.caption}</p>}
          </div>
        </div>
      )}
    </section>
  );
}

function PhotoImg({ photo, className = "" }: { photo: Photo; className?: string }) {
  const url = resolvePhotoUrl(photo.storage_path);
  if (!url) {
    return (
      <div className={`w-full h-full bg-gradient-to-br from-[#f1ece4] to-[#e8d8c4] flex items-center justify-center ${className}`}>
        <FileText className="h-5 w-5 text-muted-foreground" />
      </div>
    );
  }
  return <img src={url} alt={photo.caption ?? ""} loading="lazy" className={`w-full h-full object-cover ${className}`} />;
}

function resolvePhotoUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  try {
    const { data } = supabase.storage.from("project-photos").getPublicUrl(path);
    return data.publicUrl;
  } catch {
    return null;
  }
}

/* ---------- Before / After slider ---------- */
function BeforeAfter({ before, after, lang }: { before: Photo; after: Photo; lang: Lang }) {
  const [pos, setPos] = useState(50);
  const beforeUrl = resolvePhotoUrl(before.storage_path);
  const afterUrl = resolvePhotoUrl(after.storage_path);
  if (!beforeUrl || !afterUrl) return null;

  return (
    <div className="mt-3">
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1.5">{t.beforeAfter[lang]}</div>
      <div className="relative aspect-[16/10] rounded-[10px] overflow-hidden bg-muted select-none">
        <img src={afterUrl} alt="after" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          <img src={beforeUrl} alt="before" className="w-full h-full object-cover" />
        </div>
        <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg" style={{ left: `${pos}%` }}>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white shadow-lg flex items-center justify-center">
            <ChevronRight className="h-4 w-4 -ml-2" />
            <ChevronRight className="h-4 w-4 -ml-1 rotate-180" />
          </div>
        </div>
        <span className="absolute top-2 left-2 text-[9px] font-mono bg-black/60 text-white rounded px-1.5 py-0.5">{t.before[lang]}</span>
        <span className="absolute top-2 right-2 text-[9px] font-mono bg-primary text-primary-foreground rounded px-1.5 py-0.5">{t.latest[lang]}</span>
        <input
          type="range"
          min={0}
          max={100}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize"
        />
      </div>
    </div>
  );
}

/* ---------- Budget ---------- */
function BudgetSection({
  project, lines, lang,
}: {
  project: { budget: number; spent: number };
  lines: { category: string; percentage: number; amount: number }[];
  lang: Lang;
}) {
  const budget = project.budget;
  const spent = project.spent;
  const pct = budget > 0 ? Math.min(120, (spent / budget) * 100) : 0;
  const status: "green" | "amber" | "red" = pct > 100 ? "red" : pct > 90 ? "amber" : "green";
  const statusColor = { green: "#7a9e8a", amber: "#d4882a", red: "#c4685a" }[status];
  const statusLabel = { green: t.onBudget[lang], amber: t.closeToLimit[lang], red: t.overBudget[lang] }[status];

  return (
    <section className="rounded-[16px] bg-card border border-border p-5 animate-fade-up">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-xl">{t.budget[lang]}</h2>
        <span className="text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5" style={{ background: `${statusColor}22`, color: statusColor }}>
          {statusLabel}
        </span>
      </div>

      <div className="flex items-baseline justify-between mb-1.5 text-sm">
        <span className="font-mono tabular-nums">₹{spent.toFixed(1)}L</span>
        <span className="font-mono tabular-nums text-muted-foreground">/ ₹{budget.toFixed(1)}L</span>
      </div>
      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, background: statusColor }} />
      </div>

      {lines.length > 0 && (
        <div className="mt-5 space-y-2.5">
          {lines.map((l) => (
            <div key={l.category} className="flex items-center justify-between text-sm">
              <span>{l.category}</span>
              <span className="font-mono tabular-nums text-muted-foreground">
                ₹{Number(l.amount).toFixed(1)}L
                <span className="text-xs ml-1">({l.percentage}%)</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------- Documents ---------- */
function DocumentsSection({ lang }: { lang: Lang }) {
  const cats = [
    { key: "contracts", icon: FileSignature, label: t.contracts[lang] },
    { key: "floorPlans", icon: ScrollText, label: t.floorPlans[lang] },
    { key: "invoices", icon: ReceiptText, label: t.invoices[lang] },
    { key: "warranties", icon: BadgeCheck, label: t.warranties[lang] },
  ];
  return (
    <section className="rounded-[16px] bg-card border border-border p-5 animate-fade-up">
      <h2 className="font-display text-xl mb-4">{t.documents[lang]}</h2>
      <div className="grid grid-cols-2 gap-2">
        {cats.map((c) => (
          <div key={c.key} className="rounded-[10px] border border-dashed border-border p-4 flex flex-col items-center justify-center gap-2 text-center">
            <c.icon className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs font-medium">{c.label}</span>
            <span className="text-[10px] text-muted-foreground">{t.noDocs[lang]}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- helpers ---------- */
function translatePhase(phase: string, lang: Lang): string {
  const v = t.phases[phase];
  return v ? v[lang] : phase;
}

function formatDate(d: string, lang: Lang): string {
  const date = new Date(d);
  return date.toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}
