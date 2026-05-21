import { X } from "lucide-react";

export type FilterState = {
  rooms: Set<string>;
  contractors: Set<string>;
  statuses: Set<string>;
  priorities: Set<string>;
  workTypes: Set<string>;
};

export const emptyFilters = (): FilterState => ({
  rooms: new Set(), contractors: new Set(), statuses: new Set(),
  priorities: new Set(), workTypes: new Set(),
});

type Group = { key: keyof FilterState; label: string; values: string[] };

export function TaskFilters({
  groups, state, setState,
}: {
  groups: Group[];
  state: FilterState;
  setState: (s: FilterState) => void;
}) {
  const toggle = (key: keyof FilterState, v: string) => {
    const next = new Set(state[key]);
    next.has(v) ? next.delete(v) : next.add(v);
    setState({ ...state, [key]: next });
  };
  const activeCount = Object.values(state).reduce((sum, s) => sum + (s as Set<string>).size, 0);

  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g.key} className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium w-24">{g.label}</span>
          {g.values.map((v) => {
            const active = state[g.key].has(v);
            return (
              <button
                key={v}
                onClick={() => toggle(g.key, v)}
                className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                  active
                    ? "bg-[#1a1612] text-white border border-[#1a1612]"
                    : "bg-card border border-border text-muted-foreground hover:border-[#c17f5a] hover:text-foreground"
                }`}
              >
                {v}
              </button>
            );
          })}
        </div>
      ))}
      {activeCount > 0 && (
        <button
          onClick={() => setState(emptyFilters())}
          className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" /> Clear all ({activeCount})
        </button>
      )}
    </div>
  );
}
