import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { WORK_TYPES } from "@/lib/task-flow";

type TaskRow = {
  id: string; area: string | null; work_type: string | null; status: string | null; done: boolean;
};

const STATUS_DOT: Record<string, { icon: string; color: string }> = {
  done:                { icon: "✓", color: "#5e8a76" },
  material_delivered:  { icon: "●", color: "#5e8a76" },
  wip:                 { icon: "◐", color: "#c17f5a" },
  material_ordered:    { icon: "◐", color: "#c17f5a" },
  order_placed:        { icon: "◐", color: "#c17f5a" },
  approval_pending:    { icon: "◐", color: "#d4882a" },
  quotation_pending:   { icon: "◐", color: "#d4882a" },
  selection_pending:   { icon: "◐", color: "#d4882a" },
  payment_pending:     { icon: "!",  color: "#c4685a" },
};

export function RoomProgressGrid({ projectId }: { projectId: string }) {
  const roomsQ = useQuery({
    queryKey: ["project-rooms-grid", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("project_rooms").select("id,name").eq("project_id", projectId).order("order_index");
      return data ?? [];
    },
  });
  const tasksQ = useQuery({
    queryKey: ["project-tasks-grid", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("tasks")
        .select("id,area,work_type,status,done")
        .eq("project_id", projectId);
      return (data ?? []) as TaskRow[];
    },
  });

  const tasks = tasksQ.data ?? [];

  // Group tasks by area then by work_type. Show only work types that actually have tasks for that room.
  const byRoom = useMemo(() => {
    const map = new Map<string, Map<string, TaskRow[]>>();
    tasks.forEach((t) => {
      const room = t.area || "Unassigned";
      const wt = t.work_type || "Other";
      if (!map.has(room)) map.set(room, new Map());
      const wtMap = map.get(room)!;
      const arr = wtMap.get(wt) ?? [];
      arr.push(t);
      wtMap.set(wt, arr);
    });
    return map;
  }, [tasks]);

  const rooms = roomsQ.data ?? [];
  if (rooms.length === 0 && byRoom.size === 0) return null;

  // Combine room list with any extra area names found in tasks
  const allRoomNames = new Set<string>(rooms.map((r) => r.name));
  byRoom.forEach((_v, k) => allRoomNames.add(k));
  const orderedRooms = Array.from(allRoomNames);

  if (orderedRooms.length === 0) return null;

  return (
    <section className="mb-10">
      <div className="flex items-baseline justify-between mb-5">
        <h2 className="font-display text-2xl">Room-wise Progress</h2>
        
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {orderedRooms.map((room) => {
          const wtMap = byRoom.get(room);
          const wtList = wtMap ? Array.from(wtMap.entries()) : [];
          return (
            <div key={room} className="rounded-[14px] bg-card border border-border p-5" style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-baseline justify-between mb-3">
                <h3 className="font-display text-lg">{room}</h3>
                <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-mono">
                  {wtList.length} type{wtList.length === 1 ? "" : "s"}
                </span>
              </div>
              {wtList.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No tasks yet</p>
              ) : (
                <ul className="space-y-1.5">
                  {wtList.map(([wt, tks]) => {
                    const doneCount = tks.filter((t) => t.status === "done" || t.done).length;
                    const wipCount = tks.filter((t) => ["wip", "material_ordered", "material_delivered"].includes(t.status ?? "")).length;
                    const pickStatus = doneCount === tks.length
                      ? "done"
                      : wipCount > 0 ? "wip"
                      : (tks.find((t) => t.status && t.status !== "not_started")?.status ?? "not_started");
                    const dot = STATUS_DOT[pickStatus] ?? { icon: "○", color: "#c4b8a6" };
                    return (
                      <li key={wt} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <span style={{ color: dot.color }} className="text-base leading-none w-4 text-center">{dot.icon}</span>
                          <span>{wt}</span>
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {doneCount}/{tks.length}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
