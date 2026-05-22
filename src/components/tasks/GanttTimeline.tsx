import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { TaskRow } from "./TaskTable";
import { STATUS_META, phaseOfTask, PROJECT_PHASES, isTaskDone, type ProjectPhase } from "@/lib/task-flow";

const DAY = 24 * 60 * 60 * 1000;
const ROW_H = 36;
const HEADER_H = 32;
const LEFT_W = 240;
const DAY_W = 22;

function toDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function diffDays(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / DAY);
}

type Item = { t: TaskRow; ps: Date | null; pe: Date | null; as: Date | null; ae: Date | null };

export function GanttTimeline({ rows, onSelect }: { rows: TaskRow[]; onSelect?: (id: string) => void }) {
  const items = useMemo<Item[]>(() => {
    const parents = rows.filter((r) => !r.parent_task_id);
    return parents.map((t) => {
      const ps = toDate(t.planned_start) ?? toDate(t.start_date);
      const pe = toDate(t.planned_end) ?? toDate(t.due_date);
      const as = toDate(t.actual_start) ?? (t.status === "wip" || t.status === "done" ? ps : null);
      const ae = toDate(t.actual_end) ?? (t.status === "done" ? toDate(t.due_date) : null);
      return { t, ps, pe, as, ae };
    });
  }, [rows]);

  // Build grouping: phase -> workType -> items
  const grouped = useMemo(() => {
    const phaseMap = new Map<ProjectPhase, Map<string, Item[]>>();
    items.forEach((it) => {
      const ph = phaseOfTask(it.t);
      const wt = (it.t.work_type || "Other").trim();
      if (!phaseMap.has(ph)) phaseMap.set(ph, new Map());
      const wtMap = phaseMap.get(ph)!;
      const arr = wtMap.get(wt) ?? [];
      arr.push(it);
      wtMap.set(wt, arr);
    });
    // Order phases by PROJECT_PHASES
    const orderedPhases = PROJECT_PHASES.filter((p) => phaseMap.has(p));
    return orderedPhases.map((p) => ({
      phase: p,
      workTypes: Array.from(phaseMap.get(p)!.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([wt, arr]) => ({ workType: wt, items: arr })),
    }));
  }, [items]);

  // Date range
  const { start, totalDays } = useMemo(() => {
    let min: Date | null = null;
    let max: Date | null = null;
    items.forEach(({ ps, pe, as, ae }) => {
      [ps, pe, as, ae].forEach((d) => {
        if (d) {
          if (!min || d < min) min = d;
          if (!max || d > max) max = d;
        }
      });
    });
    if (!min || !max) {
      const today = new Date();
      min = new Date(today.getTime() - 7 * DAY);
      max = new Date(today.getTime() + 21 * DAY);
    }
    min = new Date(min.getTime() - 2 * DAY);
    max = new Date(max.getTime() + 2 * DAY);
    return { start: min, totalDays: diffDays(min, max) };
  }, [items]);

  const [collapsedPhase, setCollapsedPhase] = useState<Set<string>>(new Set());
  const [collapsedWT, setCollapsedWT] = useState<Set<string>>(new Set());

  const togglePhase = (p: string) => setCollapsedPhase((s) => {
    const n = new Set(s); n.has(p) ? n.delete(p) : n.add(p); return n;
  });
  const toggleWT = (k: string) => setCollapsedWT((s) => {
    const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n;
  });

  // Flatten rows for rendering with y positions
  type RenderRow =
    | { kind: "phase"; phase: ProjectPhase; items: Item[]; collapsed: boolean }
    | { kind: "wt"; phase: ProjectPhase; workType: string; items: Item[]; collapsed: boolean }
    | { kind: "task"; item: Item };

  const renderRows: RenderRow[] = [];
  grouped.forEach((g) => {
    const phaseCollapsed = collapsedPhase.has(g.phase);
    const allPhaseItems = g.workTypes.flatMap((w) => w.items);
    renderRows.push({ kind: "phase", phase: g.phase, items: allPhaseItems, collapsed: phaseCollapsed });
    if (phaseCollapsed) return;
    g.workTypes.forEach((w) => {
      const key = `${g.phase}::${w.workType}`;
      const wtCollapsed = collapsedWT.has(key);
      renderRows.push({ kind: "wt", phase: g.phase, workType: w.workType, items: w.items, collapsed: wtCollapsed });
      if (wtCollapsed) return;
      w.items.forEach((it) => renderRows.push({ kind: "task", item: it }));
    });
  });

  const idToIndex = useMemo(() => {
    const m = new Map<string, number>();
    renderRows.forEach((r, i) => { if (r.kind === "task") m.set(r.item.t.id, i); });
    return m;
  }, [renderRows]);

  const width = LEFT_W + totalDays * DAY_W;
  const height = Math.max(140, renderRows.reduce((acc, r) => acc + (r.kind === "task" ? ROW_H : HEADER_H), 60));

  // Month markers
  const months: { x: number; label: string }[] = [];
  for (let d = 0; d <= totalDays; d++) {
    const day = new Date(start.getTime() + d * DAY);
    if (day.getDate() === 1 || d === 0) {
      months.push({
        x: LEFT_W + d * DAY_W,
        label: day.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
      });
    }
  }

  // Compute group summary spans
  const groupSpan = (its: Item[]): { s: Date | null; e: Date | null } => {
    let s: Date | null = null, e: Date | null = null;
    its.forEach(({ ps, pe, as, ae }) => {
      [ps, as].forEach((d) => { if (d && (!s || d < s)) s = d; });
      [pe, ae].forEach((d) => { if (d && (!e || d > e)) e = d; });
    });
    return { s, e };
  };

  // Dependency arrows (between task rows only)
  const arrows: { x1: number; y1: number; x2: number; y2: number }[] = [];
  // Track y offsets
  const yOffsets: number[] = [];
  {
    let y = 40;
    renderRows.forEach((r) => {
      yOffsets.push(y);
      y += r.kind === "task" ? ROW_H : HEADER_H;
    });
  }
  renderRows.forEach((r, i) => {
    if (r.kind !== "task") return;
    const deps = Array.isArray(r.item.t.depends_on) ? (r.item.t.depends_on as string[]) : [];
    deps.forEach((depId) => {
      const fromIdx = idToIndex.get(depId);
      if (fromIdx === undefined) return;
      const fromRow = renderRows[fromIdx];
      if (fromRow.kind !== "task") return;
      const fromEnd = fromRow.item.ae ?? fromRow.item.pe;
      const toStart = r.item.as ?? r.item.ps;
      if (!fromEnd || !toStart) return;
      const x1 = LEFT_W + diffDays(start, fromEnd) * DAY_W;
      const y1 = yOffsets[fromIdx] + ROW_H / 2;
      const x2 = LEFT_W + diffDays(start, toStart) * DAY_W;
      const y2 = yOffsets[i] + ROW_H / 2;
      arrows.push({ x1, y1, x2, y2 });
    });
  });

  if (items.length === 0) {
    return <div className="text-center text-sm text-muted-foreground py-12">No tasks to chart.</div>;
  }

  const PHASE_COLOR: Record<ProjectPhase, string> = {
    Survey: "#8a7d6e", Design: "#a07ec0", Procurement: "#d4882a",
    Execution: "#c17f5a", Finishing: "#7a9e8a", Handover: "#5e8a76",
  };

  return (
    <div className="rounded-[16px] bg-card border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
        <h3 className="font-display text-lg">Gantt Timeline</h3>
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground flex-wrap">
          <span className="inline-flex items-center gap-1.5"><span className="inline-block w-6 h-2 rounded border border-[#c17f5a] bg-[#c17f5a18]" /> Planned</span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-block w-6 h-2 rounded bg-[#c17f5a]" /> Actual</span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-block w-6 h-2 rounded bg-[#c4685a]" /> Delayed</span>
        </div>
      </div>
      <div className="overflow-auto relative">
        {/* HTML overlay layer for clickable group headers, absolutely positioned */}
        <div className="relative" style={{ width, height }}>
          <svg width={width} height={height} className="block absolute inset-0 pointer-events-none">
            {months.map((m, i) => (
              <g key={i}>
                <line x1={m.x} y1={0} x2={m.x} y2={height} stroke="#e8e3da" strokeWidth={1} />
                <text x={m.x + 4} y={16} fontSize={10} fill="#8a7d6e" className="font-mono uppercase tracking-wider">{m.label}</text>
              </g>
            ))}
            {(() => {
              const today = new Date();
              const d = diffDays(start, today);
              if (d < 0 || d > totalDays) return null;
              const x = LEFT_W + d * DAY_W;
              return <line x1={x} y1={20} x2={x} y2={height - 10} stroke="#c4685a" strokeWidth={1.5} strokeDasharray="4 3" />;
            })()}

            {/* Render bars */}
            {renderRows.map((r, i) => {
              const y = yOffsets[i];
              if (r.kind === "phase" || r.kind === "wt") {
                const { s, e } = groupSpan(r.items);
                if (!s || !e) return null;
                const x = LEFT_W + diffDays(start, s) * DAY_W;
                const w = Math.max(4, (diffDays(s, e) + 1) * DAY_W);
                const done = r.items.filter((it) => isTaskDone(it.t)).length;
                const pct = r.items.length ? done / r.items.length : 0;
                const color = r.kind === "phase" ? PHASE_COLOR[r.phase] : "#c17f5a";
                return (
                  <g key={i}>
                    <rect x={x} y={y + (r.kind === "phase" ? 8 : 10)} width={w} height={r.kind === "phase" ? 14 : 10} rx={3}
                      fill={`${color}22`} stroke={color} strokeWidth={1} />
                    <rect x={x} y={y + (r.kind === "phase" ? 8 : 10)} width={w * pct} height={r.kind === "phase" ? 14 : 10} rx={3}
                      fill={color} opacity={0.65} />
                  </g>
                );
              }
              const { t, ps, pe, as, ae } = r.item;
              const sc = STATUS_META[t.status ?? "not_started"] ?? STATUS_META.not_started;
              const delayed = pe && ae && ae > pe;
              return (
                <g key={i}>
                  <rect x={0} y={y} width={width} height={ROW_H} fill={(i % 2) ? "#fafaf7" : "transparent"} />
                  {ps && pe && (
                    <rect x={LEFT_W + diffDays(start, ps) * DAY_W} y={y + 8} width={Math.max(2, (diffDays(ps, pe) + 1) * DAY_W)}
                      height={8} rx={3} fill="#c17f5a18" stroke="#c17f5a" strokeWidth={1} />
                  )}
                  {as && (ae || t.status === "wip") && (
                    <rect x={LEFT_W + diffDays(start, as) * DAY_W} y={y + 18}
                      width={Math.max(2, (diffDays(as, ae ?? new Date()) + 1) * DAY_W)}
                      height={8} rx={3} fill={delayed ? "#c4685a" : sc.dot} />
                  )}
                  {delayed && pe && ae && (
                    <text x={LEFT_W + diffDays(start, ae) * DAY_W + 6} y={y + 25} fontSize={10} fill="#8a2a1f" className="font-mono">
                      +{diffDays(pe, ae)}d delayed
                    </text>
                  )}
                </g>
              );
            })}

            <defs>
              <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#8a7d6e" />
              </marker>
            </defs>
            {arrows.map((a, i) => (
              <path key={i} d={`M${a.x1},${a.y1} C${a.x1 + 30},${a.y1} ${a.x2 - 30},${a.y2} ${a.x2},${a.y2}`}
                stroke="#8a7d6e" strokeWidth={1.2} fill="none" markerEnd="url(#arrow)" opacity={0.6} />
            ))}
          </svg>

          {/* Left labels — HTML so headers are clickable */}
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
                    {r.collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    <span className="flex-1 text-left truncate">{r.phase}</span>
                    <span className="font-mono text-[10px] opacity-70">{done}/{r.items.length} · {pct}%</span>
                  </button>
                );
              }
              if (r.kind === "wt") {
                const key = `${r.phase}::${r.workType}`;
                const done = r.items.filter((it) => isTaskDone(it.t)).length;
                return (
                  <button
                    key={i}
                    onClick={() => toggleWT(key)}
                    className="absolute left-0 right-0 flex items-center gap-1.5 pl-6 pr-2 text-[11px] font-medium hover:bg-muted/30 text-foreground"
                    style={{ top: y, height: HEADER_H }}
                  >
                    {r.collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    <span className="flex-1 text-left truncate">— {r.workType}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{done}/{r.items.length}</span>
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
                    {(t.agency || t.contractor || "—") + ((Array.isArray(t.areas) && (t.areas as string[]).length) ? " · " + (t.areas as string[]).slice(0, 2).join(", ") : "")}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
