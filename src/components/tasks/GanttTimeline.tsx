import { useMemo } from "react";
import type { TaskRow } from "./TaskTable";
import { STATUS_META } from "@/lib/task-flow";

const DAY = 24 * 60 * 60 * 1000;
const ROW_H = 36;
const LEFT_W = 220;
const DAY_W = 22;

function toDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function diffDays(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / DAY);
}

export function GanttTimeline({ rows, onSelect }: { rows: TaskRow[]; onSelect?: (id: string) => void }) {
  const { items, start, totalDays } = useMemo(() => {
    const parents = rows.filter((r) => !r.parent_task_id);
    let min: Date | null = null;
    let max: Date | null = null;
    const items = parents.map((t) => {
      const ps = toDate(t.planned_start) ?? toDate(t.start_date);
      const pe = toDate(t.planned_end) ?? toDate(t.due_date);
      const as = toDate(t.actual_start) ?? (t.status === "wip" || t.status === "done" ? ps : null);
      const ae = toDate(t.actual_end) ?? (t.status === "done" ? toDate(t.due_date) : null);
      [ps, pe, as, ae].forEach((d) => {
        if (d) {
          if (!min || d < min) min = d;
          if (!max || d > max) max = d;
        }
      });
      return { t, ps, pe, as, ae };
    });
    if (!min || !max) {
      const today = new Date();
      min = new Date(today.getTime() - 7 * DAY);
      max = new Date(today.getTime() + 21 * DAY);
    }
    min = new Date(min.getTime() - 2 * DAY);
    max = new Date(max.getTime() + 2 * DAY);
    return { items, start: min, totalDays: diffDays(min, max) };
  }, [rows]);

  const idToIndex = useMemo(() => {
    const m = new Map<string, number>();
    items.forEach((it, i) => m.set(it.t.id, i));
    return m;
  }, [items]);

  const width = LEFT_W + totalDays * DAY_W;
  const height = Math.max(120, items.length * ROW_H + 60);

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

  // Dependency arrows
  const arrows: { x1: number; y1: number; x2: number; y2: number }[] = [];
  items.forEach((it, i) => {
    const deps = Array.isArray(it.t.depends_on) ? (it.t.depends_on as string[]) : [];
    deps.forEach((depId) => {
      const fromIdx = idToIndex.get(depId);
      if (fromIdx === undefined) return;
      const from = items[fromIdx];
      const fromEnd = from.ae ?? from.pe;
      const toStart = it.as ?? it.ps;
      if (!fromEnd || !toStart) return;
      const x1 = LEFT_W + diffDays(start, fromEnd) * DAY_W;
      const y1 = 40 + fromIdx * ROW_H + ROW_H / 2;
      const x2 = LEFT_W + diffDays(start, toStart) * DAY_W;
      const y2 = 40 + i * ROW_H + ROW_H / 2;
      arrows.push({ x1, y1, x2, y2 });
    });
  });

  if (items.length === 0) {
    return <div className="text-center text-sm text-muted-foreground py-12">No tasks to chart.</div>;
  }

  return (
    <div className="rounded-[16px] bg-card border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <h3 className="font-display text-lg">Gantt Timeline</h3>
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-6 h-2 rounded border border-[#c17f5a] bg-[#c17f5a18]" /> Planned
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-6 h-2 rounded bg-[#c17f5a]" /> Actual
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-6 h-2 rounded bg-[#c4685a]" /> Delayed
          </span>
        </div>
      </div>
      <div className="overflow-auto">
        <svg width={width} height={height} className="block">
          {/* Month grid */}
          {months.map((m, i) => (
            <g key={i}>
              <line x1={m.x} y1={0} x2={m.x} y2={height} stroke="#e8e3da" strokeWidth={1} />
              <text x={m.x + 4} y={16} fontSize={10} fill="#8a7d6e" className="font-mono uppercase tracking-wider">{m.label}</text>
            </g>
          ))}

          {/* Today line */}
          {(() => {
            const today = new Date();
            const d = diffDays(start, today);
            if (d < 0 || d > totalDays) return null;
            const x = LEFT_W + d * DAY_W;
            return <line x1={x} y1={20} x2={x} y2={height - 10} stroke="#c4685a" strokeWidth={1.5} strokeDasharray="4 3" />;
          })()}

          {/* Row labels + bars */}
          {items.map(({ t, ps, pe, as, ae }, i) => {
            const y = 40 + i * ROW_H;
            const sc = STATUS_META[t.status ?? "not_started"] ?? STATUS_META.not_started;
            const delayed = pe && ae && ae > pe;

            return (
              <g key={t.id} onClick={() => onSelect?.(t.id)} style={{ cursor: "pointer" }}>
                <rect x={0} y={y} width={width} height={ROW_H} fill={i % 2 ? "#fafaf7" : "transparent"} />
                <text x={12} y={y + ROW_H / 2 + 4} fontSize={12} fill="#1a1612" className="font-medium">
                  {t.title.length > 26 ? t.title.slice(0, 26) + "…" : t.title}
                </text>
                <text x={12} y={y + ROW_H / 2 + 16} fontSize={9} fill="#8a7d6e">
                  {(t.agency || t.contractor || "—") + (t.areas && Array.isArray(t.areas) && (t.areas as string[]).length ? " · " + (t.areas as string[]).slice(0, 2).join(", ") : "")}
                </text>

                {/* Planned bar */}
                {ps && pe && (
                  <rect
                    x={LEFT_W + diffDays(start, ps) * DAY_W}
                    y={y + 8}
                    width={Math.max(2, (diffDays(ps, pe) + 1) * DAY_W)}
                    height={8}
                    rx={3}
                    fill="#c17f5a18"
                    stroke="#c17f5a"
                    strokeWidth={1}
                  />
                )}
                {/* Actual bar */}
                {as && (ae || t.status === "wip") && (
                  <rect
                    x={LEFT_W + diffDays(start, as) * DAY_W}
                    y={y + 18}
                    width={Math.max(2, (diffDays(as, ae ?? new Date()) + 1) * DAY_W)}
                    height={8}
                    rx={3}
                    fill={delayed ? "#c4685a" : sc.dot}
                  />
                )}
                {/* Delay label */}
                {delayed && pe && ae && (
                  <text
                    x={LEFT_W + diffDays(start, ae) * DAY_W + 6}
                    y={y + 25}
                    fontSize={10}
                    fill="#8a2a1f"
                    className="font-mono"
                  >
                    +{diffDays(pe, ae)}d delayed
                  </text>
                )}
              </g>
            );
          })}

          {/* Dependency arrows */}
          <defs>
            <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="#8a7d6e" />
            </marker>
          </defs>
          {arrows.map((a, i) => (
            <path
              key={i}
              d={`M${a.x1},${a.y1} C${a.x1 + 30},${a.y1} ${a.x2 - 30},${a.y2} ${a.x2},${a.y2}`}
              stroke="#8a7d6e"
              strokeWidth={1.2}
              fill="none"
              markerEnd="url(#arrow)"
              opacity={0.6}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
