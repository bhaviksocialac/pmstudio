import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, CalendarPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { TaskRow } from "./TaskTable";
import { phaseOfTask, PROJECT_PHASES, isTaskDone, type ProjectPhase } from "@/lib/task-flow";

const DAY = 86400000;
const ROW_H = 32;
const HEADER_H = 36;
const LEFT_W = 260;

type Scale = "weekly" | "monthly" | "yearly";
const SCALE_DAY_W: Record<Scale, number> = { weekly: 22, monthly: 7, yearly: 1.6 };

function toDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function diffDays(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / DAY);
}
function fmt(d: Date) {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

type Item = { t: TaskRow; ps: Date | null; pe: Date | null; as: Date | null; ae: Date | null };

type Milestone = {
  id: string;
  name: string;
  kind: string;
  trigger: { phase?: string };
  status: string;
  triggered_at: string | null;
  triggered_on_time: boolean | null;
};

type GroupKey = { phase: ProjectPhase; bucket: string; items: Item[] };

const ROOM_COLOR = {
  done: "#7a9e8a",
  delayed: "#c4685a",
  wip: "#d4882a",
  pending: "#c4b8a6",
} as const;

function roomsOfItem(it: Item): string[] {
  const t = it.t;
  if (Array.isArray(t.areas) && (t.areas as string[]).length) return (t.areas as string[]).filter(Boolean);
  if (t.area) return [t.area];
  return ["(unassigned)"];
}

function roomStatus(its: Item[]): "done" | "delayed" | "wip" | "pending" {
  const today = new Date();
  const all = its.length;
  const done = its.filter((i) => isTaskDone(i.t)).length;
  const delayed = its.some(
    (i) => !isTaskDone(i.t) && i.pe && i.pe < today,
  );
  if (delayed) return "delayed";
  if (done === all && all > 0) return "done";
  if (its.some((i) => i.t.status === "wip" || i.t.status === "in_progress" || (i.as && !isTaskDone(i.t)))) return "wip";
  return "pending";
}

function bucketOf(phase: ProjectPhase, it: Item): string {
  // Procurement → contractor / vendor / "Client approvals"
  if (phase === "Procurement") {
    const s = (it.t.status ?? "").toLowerCase();
    if (s.includes("approval")) return "Client approvals";
    return (it.t.agency || it.t.contractor || "Unassigned").trim();
  }
  // Otherwise: by work_type
  const wts = Array.isArray((it.t as { work_types?: unknown }).work_types)
    ? ((it.t as { work_types?: unknown }).work_types as string[])
    : [];
  return (wts[0] || it.t.work_type || "Other").trim();
}

function smartLabel(phase: ProjectPhase, bucket: string, its: Item[]): string {
  if (phase === "Procurement") return bucket;
  const contractors = Array.from(
    new Set(its.map((i) => (i.t.agency || i.t.contractor || "").trim()).filter(Boolean)),
  );
  if (contractors.length === 1) return `${bucket} — ${contractors[0]}`;
  if (contractors.length > 1) return `${bucket} — ${contractors.length} vendors`;
  return bucket;
}

export function GanttTimeline({
  rows,
  onSelect,
  projectId,
}: {
  rows: TaskRow[];
  onSelect?: (id: string) => void;
  projectId?: string;
}) {
  const [scale, setScale] = useState<Scale>("monthly");
  const DAY_W = SCALE_DAY_W[scale];

  const [milestones, setMilestones] = useState<Milestone[]>([]);
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("milestones")
        .select("id,name,kind,trigger,status,triggered_at,triggered_on_time")
        .eq("project_id", projectId);
      if (!cancelled && data) setMilestones(data as unknown as Milestone[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Items (parents only) + split scheduled / unscheduled
  const { scheduled, unscheduled } = useMemo(() => {
    const parents = rows.filter((r) => !r.parent_task_id);
    const sch: Item[] = [];
    const un: Item[] = [];
    parents.forEach((t) => {
      const ps = toDate(t.planned_start) ?? toDate(t.start_date);
      const pe = toDate(t.planned_end) ?? toDate(t.due_date);
      const as = toDate(t.actual_start) ?? (t.status === "wip" || t.status === "done" ? ps : null);
      const ae = toDate(t.actual_end) ?? (t.status === "done" ? toDate(t.due_date) : null);
      const it: Item = { t, ps, pe, as, ae };
      if (!ps && !pe && !as && !ae) un.push(it);
      else sch.push(it);
    });
    return { scheduled: sch, unscheduled: un };
  }, [rows]);

  // Group scheduled: phase → bucket → items
  const grouped = useMemo(() => {
    const phaseMap = new Map<ProjectPhase, Map<string, Item[]>>();
    scheduled.forEach((it) => {
      const ph = phaseOfTask(it.t);
      const bk = bucketOf(ph, it);
      if (!phaseMap.has(ph)) phaseMap.set(ph, new Map());
      const bMap = phaseMap.get(ph)!;
      const arr = bMap.get(bk) ?? [];
      arr.push(it);
      bMap.set(bk, arr);
    });
    return PROJECT_PHASES.filter((p) => phaseMap.has(p)).map((p) => ({
      phase: p,
      buckets: Array.from(phaseMap.get(p)!.entries())
        .map(([bucket, items]): GroupKey => ({ phase: p, bucket, items }))
        .sort((a, b) => a.bucket.localeCompare(b.bucket)),
    }));
  }, [scheduled]);

  // Date range
  const { start, totalDays } = useMemo(() => {
    let min: Date | null = null;
    let max: Date | null = null;
    scheduled.forEach(({ ps, pe, as, ae }) => {
      [ps, pe, as, ae].forEach((d) => {
        if (d) {
          if (!min || d < min) min = d;
          if (!max || d > max) max = d;
        }
      });
    });
    const today = new Date();
    if (!min) min = new Date(today.getTime() - 14 * DAY);
    if (!max) max = new Date(today.getTime() + 30 * DAY);
    min = new Date(min.getTime() - 3 * DAY);
    max = new Date(max.getTime() + 3 * DAY);
    return { start: min, totalDays: Math.max(14, diffDays(min, max)) };
  }, [scheduled]);

  // Default all phases COLLAPSED
  const [expandedPhase, setExpandedPhase] = useState<Set<string>>(new Set());
  const [expandedBucket, setExpandedBucket] = useState<Set<string>>(new Set());
  const [showUnscheduled, setShowUnscheduled] = useState(false);

  const togglePhase = (p: string) =>
    setExpandedPhase((s) => {
      const n = new Set(s);
      n.has(p) ? n.delete(p) : n.add(p);
      return n;
    });
  const toggleBucket = (k: string) =>
    setExpandedBucket((s) => {
      const n = new Set(s);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });

  type RenderRow =
    | { kind: "phase"; phase: ProjectPhase; items: Item[]; expanded: boolean }
    | { kind: "bucket"; phase: ProjectPhase; bucket: string; items: Item[]; expanded: boolean }
    | { kind: "task"; item: Item };

  const renderRows: RenderRow[] = [];
  grouped.forEach((g) => {
    const allItems = g.buckets.flatMap((b) => b.items);
    const phaseExpanded = expandedPhase.has(g.phase);
    renderRows.push({ kind: "phase", phase: g.phase, items: allItems, expanded: phaseExpanded });
    if (!phaseExpanded) return;
    g.buckets.forEach((b) => {
      const key = `${g.phase}::${b.bucket}`;
      const bExpanded = expandedBucket.has(key);
      renderRows.push({ kind: "bucket", phase: g.phase, bucket: b.bucket, items: b.items, expanded: bExpanded });
      if (!bExpanded) return;
      b.items.forEach((it) => renderRows.push({ kind: "task", item: it }));
    });
  });

  // y offsets
  const yOffsets: number[] = [];
  {
    let y = HEADER_H + 8;
    renderRows.forEach((r) => {
      yOffsets.push(y);
      y += r.kind === "task" ? ROW_H : HEADER_H;
    });
  }

  const width = LEFT_W + totalDays * DAY_W;
  const chartHeight = (yOffsets[yOffsets.length - 1] ?? HEADER_H) + (renderRows[renderRows.length - 1]?.kind === "task" ? ROW_H : HEADER_H) + 12;
  const height = Math.max(180, chartHeight);

  // Top axis ticks based on scale
  const ticks: { x: number; label: string; major: boolean }[] = [];
  for (let d = 0; d <= totalDays; d++) {
    const day = new Date(start.getTime() + d * DAY);
    if (scale === "weekly") {
      if (day.getDay() === 1 || d === 0) {
        ticks.push({ x: LEFT_W + d * DAY_W, label: fmt(day), major: day.getDate() <= 7 });
      }
    } else if (scale === "monthly") {
      if (day.getDate() === 1 || d === 0) {
        ticks.push({
          x: LEFT_W + d * DAY_W,
          label: day.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
          major: day.getMonth() === 0,
        });
      }
    } else {
      if ((day.getMonth() === 0 && day.getDate() === 1) || d === 0) {
        ticks.push({ x: LEFT_W + d * DAY_W, label: String(day.getFullYear()), major: true });
      } else if (day.getDate() === 1 && day.getMonth() % 3 === 0) {
        ticks.push({
          x: LEFT_W + d * DAY_W,
          label: day.toLocaleDateString("en-IN", { month: "short" }),
          major: false,
        });
      }
    }
  }

  const groupSpan = (its: Item[]): { s: Date | null; e: Date | null } => {
    let s: Date | null = null,
      e: Date | null = null;
    its.forEach(({ ps, pe, as, ae }) => {
      [ps, as].forEach((d) => {
        if (d && (!s || d < s)) s = d;
      });
      [pe, ae].forEach((d) => {
        if (d && (!e || d > e)) e = d;
      });
    });
    return { s, e };
  };

  // Phase → milestones
  const milestonesByPhase = useMemo(() => {
    const m = new Map<string, Milestone[]>();
    milestones.forEach((ms) => {
      const ph = ms.kind === "phase" ? (ms.trigger?.phase ?? "").trim() : "";
      if (!ph) return;
      const arr = m.get(ph) ?? [];
      arr.push(ms);
      m.set(ph, arr);
    });
    return m;
  }, [milestones]);

  const PHASE_COLOR: Record<ProjectPhase, string> = {
    Survey: "#8a7d6e",
    Design: "#a07ec0",
    Procurement: "#d4882a",
    Execution: "#c17f5a",
    Finishing: "#7a9e8a",
    Handover: "#5e8a76",
  };

  if (scheduled.length === 0 && unscheduled.length === 0) {
    return <div className="text-center text-sm text-muted-foreground py-12">No tasks to chart.</div>;
  }

  return (
    <div
      className="rounded-[16px] bg-card border border-border overflow-hidden"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
        <h3 className="font-display text-lg">Gantt Timeline</h3>
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground flex-wrap">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: ROOM_COLOR.done }} /> Done
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: ROOM_COLOR.wip }} /> WIP
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: ROOM_COLOR.delayed }} /> Delayed
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: ROOM_COLOR.pending }} /> Pending
          </span>
          <span className="inline-flex items-center gap-1.5 text-[#c4685a]">◆ Milestone</span>
          <div className="flex rounded-[8px] border border-border overflow-hidden ml-2">
            {(["weekly", "monthly", "yearly"] as Scale[]).map((s) => (
              <button
                key={s}
                onClick={() => setScale(s)}
                className={`h-7 px-2.5 text-[11px] capitalize ${scale === s ? "bg-[#c17f5a] text-white" : "bg-white text-muted-foreground hover:bg-muted/40"}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-auto relative">
        <div className="relative" style={{ width, height }}>
          <svg width={width} height={height} className="block absolute inset-0 pointer-events-none">
            {/* axis grid */}
            {ticks.map((m, i) => (
              <g key={i}>
                <line
                  x1={m.x}
                  y1={0}
                  x2={m.x}
                  y2={height}
                  stroke={m.major ? "#d4cdbf" : "#ece7dc"}
                  strokeWidth={1}
                />
                <text
                  x={m.x + 4}
                  y={18}
                  fontSize={10}
                  fill="#8a7d6e"
                  className="font-mono uppercase tracking-wider"
                >
                  {m.label}
                </text>
              </g>
            ))}
            {/* today line — RED */}
            {(() => {
              const today = new Date();
              const d = diffDays(start, today);
              if (d < 0 || d > totalDays) return null;
              const x = LEFT_W + d * DAY_W;
              return (
                <g>
                  <line x1={x} y1={20} x2={x} y2={height - 10} stroke="#dc2626" strokeWidth={1.5} />
                  <text x={x + 3} y={32} fontSize={9} fill="#dc2626" className="font-mono">
                    TODAY
                  </text>
                </g>
              );
            })()}

            {/* bars */}
            {renderRows.map((r, i) => {
              const y = yOffsets[i];

              if (r.kind === "phase" || r.kind === "bucket") {
                const { s, e } = groupSpan(r.items);
                if (!s || !e) return null;
                const x0 = LEFT_W + diffDays(start, s) * DAY_W;
                const w = Math.max(6, (diffDays(s, e) + 1) * DAY_W);
                const barH = r.kind === "phase" ? 18 : 14;
                const yBar = y + (HEADER_H - barH) / 2;

                // Build room segments
                const byRoom = new Map<string, Item[]>();
                r.items.forEach((it) => {
                  roomsOfItem(it).forEach((rm) => {
                    const arr = byRoom.get(rm) ?? [];
                    arr.push(it);
                    byRoom.set(rm, arr);
                  });
                });
                const rooms = Array.from(byRoom.entries());
                const segW = w / Math.max(1, rooms.length);

                return (
                  <g key={i}>
                    <rect
                      x={x0}
                      y={yBar}
                      width={w}
                      height={barH}
                      rx={4}
                      fill="white"
                      stroke={r.kind === "phase" ? PHASE_COLOR[r.phase] : "#c4b8a6"}
                      strokeWidth={1}
                    />
                    {rooms.map(([room, its], k) => {
                      const st = roomStatus(its);
                      const span = groupSpan(its);
                      const dates =
                        span.s && span.e ? `${fmt(span.s)} → ${fmt(span.e)}` : "—";
                      return (
                        <g key={room}>
                          <rect
                            x={x0 + k * segW + 1}
                            y={yBar + 1}
                            width={Math.max(1, segW - 1)}
                            height={barH - 2}
                            fill={ROOM_COLOR[st]}
                            opacity={st === "pending" ? 0.55 : 0.9}
                            style={{ pointerEvents: "auto" }}
                          >
                            <title>{`${room} — ${st.toUpperCase()} — ${dates}`}</title>
                          </rect>
                        </g>
                      );
                    })}
                    {/* milestone diamonds on phase row */}
                    {r.kind === "phase" &&
                      (milestonesByPhase.get(r.phase) ?? []).map((ms, k) => {
                        const at = ms.triggered_at ? toDate(ms.triggered_at) : e;
                        if (!at) return null;
                        const mx = LEFT_W + diffDays(start, at) * DAY_W;
                        const my = yBar + barH / 2;
                        const onTime = ms.status === "pending"
                          ? false
                          : ms.triggered_on_time !== false;
                        const color = onTime ? "#16a34a" : "#dc2626";
                        return (
                          <g key={ms.id + k}>
                            <polygon
                              points={`${mx},${my - 8} ${mx + 7},${my} ${mx},${my + 8} ${mx - 7},${my}`}
                              fill={color}
                              stroke="white"
                              strokeWidth={1.5}
                              style={{ pointerEvents: "auto" }}
                            >
                              <title>{`◆ ${ms.name} — ${ms.status}${ms.triggered_at ? ` (${ms.triggered_at})` : ""}`}</title>
                            </polygon>
                          </g>
                        );
                      })}
                  </g>
                );
              }

              // Task row
              const { ps, pe, as, ae, t } = r.item;
              const delayed = pe && ae && ae > pe;
              return (
                <g key={i}>
                  <rect x={0} y={y} width={width} height={ROW_H} fill={i % 2 ? "#fafaf7" : "transparent"} />
                  {ps && pe && (
                    <rect
                      x={LEFT_W + diffDays(start, ps) * DAY_W}
                      y={y + 8}
                      width={Math.max(2, (diffDays(ps, pe) + 1) * DAY_W)}
                      height={7}
                      rx={3}
                      fill="#c17f5a18"
                      stroke="#c17f5a"
                      strokeWidth={1}
                    />
                  )}
                  {as && (
                    <rect
                      x={LEFT_W + diffDays(start, as) * DAY_W}
                      y={y + 17}
                      width={Math.max(2, (diffDays(as, ae ?? new Date()) + 1) * DAY_W)}
                      height={7}
                      rx={3}
                      fill={delayed ? "#c4685a" : isTaskDone(t) ? "#7a9e8a" : "#d4882a"}
                    />
                  )}
                </g>
              );
            })}
          </svg>

          {/* Left labels (HTML, clickable) */}
          <div className="absolute left-0 top-0" style={{ width: LEFT_W }}>
            {renderRows.map((r, i) => {
              const y = yOffsets[i];
              if (r.kind === "phase") {
                const done = r.items.filter((it) => isTaskDone(it.t)).length;
                const pct = r.items.length ? Math.round((done / r.items.length) * 100) : 0;
                return (
                  <button
                    key={i}
                    onClick={() => togglePhase(r.phase)}
                    className="absolute left-0 right-0 flex items-center gap-1.5 px-2 text-[11px] font-bold uppercase tracking-[0.14em] hover:bg-muted/40"
                    style={{ top: y, height: HEADER_H, color: PHASE_COLOR[r.phase] }}
                  >
                    {r.expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    <span className="flex-1 text-left truncate">{r.phase}</span>
                    <span className="font-mono text-[10px] opacity-70">
                      {done}/{r.items.length} · {pct}%
                    </span>
                  </button>
                );
              }
              if (r.kind === "bucket") {
                const key = `${r.phase}::${r.bucket}`;
                const done = r.items.filter((it) => isTaskDone(it.t)).length;
                const pct = r.items.length ? Math.round((done / r.items.length) * 100) : 0;
                return (
                  <button
                    key={i}
                    onClick={() => toggleBucket(key)}
                    className="absolute left-0 right-0 flex items-center gap-1.5 pl-6 pr-2 text-[11px] font-medium hover:bg-muted/30 text-foreground"
                    style={{ top: y, height: HEADER_H }}
                  >
                    {r.expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    <span className="flex-1 text-left truncate">{smartLabel(r.phase, r.bucket, r.items)}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {done}/{r.items.length} · {pct}%
                    </span>
                  </button>
                );
              }
              const t = r.item.t;
              return (
                <button
                  key={i}
                  onClick={() => onSelect?.(t.id)}
                  className="absolute left-0 right-0 text-left pl-10 pr-2 hover:bg-muted/20"
                  style={{ top: y, height: ROW_H }}
                >
                  <div className="text-[12px] font-medium truncate text-foreground">{t.title}</div>
                  <div className="text-[9px] text-muted-foreground truncate">
                    {(t.agency || t.contractor || "—") +
                      (Array.isArray(t.areas) && (t.areas as string[]).length
                        ? " · " + (t.areas as string[]).slice(0, 2).join(", ")
                        : "")}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Unscheduled tasks section */}
      {unscheduled.length > 0 && (
        <div className="border-t border-border bg-[#fafaf7]">
          <button
            onClick={() => setShowUnscheduled((v) => !v)}
            className="w-full flex items-center gap-2 px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground hover:bg-muted/40"
          >
            {showUnscheduled ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            Unscheduled Tasks — {unscheduled.length} item{unscheduled.length === 1 ? "" : "s"}
          </button>
          {showUnscheduled && (
            <ul className="divide-y divide-border">
              {unscheduled.map((it) => (
                <li
                  key={it.t.id}
                  className="flex items-center gap-3 px-5 py-2.5 text-[12px]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate text-foreground">{it.t.title}</div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {(it.t.agency || it.t.contractor || "—") +
                        (Array.isArray(it.t.areas) && (it.t.areas as string[]).length
                          ? " · " + (it.t.areas as string[]).slice(0, 3).join(", ")
                          : "") +
                        (it.t.work_type ? " · " + it.t.work_type : "")}
                    </div>
                  </div>
                  <button
                    onClick={() => onSelect?.(it.t.id)}
                    className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] bg-[#c17f5a] text-white hover:bg-[#a86b4a]"
                  >
                    <CalendarPlus className="h-3.5 w-3.5" /> Schedule
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
