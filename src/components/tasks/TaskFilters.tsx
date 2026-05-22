import { useState } from "react";
import { Plus, X } from "lucide-react";

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

type Group = {
  key: keyof FilterState;
  label: string;
  values: string[];
  /** Optional display formatter (raw value → label). */
  format?: (v: string) => string;
  /** If provided, shows a "+ Add" button that lets the user add a custom value. */
  onAdd?: (v: string) => void;
  addLabel?: string;
};

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
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  active
                    ? "bg-[#c17f5a] text-white border-[#c17f5a]"
                    : "bg-white border-[#e8e3da] text-foreground hover:bg-[#c17f5a18] hover:border-[#c17f5a66]"
                }`}
              >
                {g.format ? g.format(v) : v}
              </button>
            );
          })}
          {g.onAdd && <AddPill label={g.addLabel ?? "Add"} onAdd={g.onAdd} />}
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

function AddPill({ label, onAdd }: { label: string; onAdd: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  const commit = () => {
    const v = val.trim();
    if (v) { onAdd(v); setVal(""); setOpen(false); }
  };
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border border-dashed border-[#c17f5a] text-[#c17f5a] bg-white hover:bg-[#c17f5a18] transition-all"
      >
        <Plus className="h-3 w-3" /> {label}
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-[#c17f5a] bg-white">
      <input
        autoFocus
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setVal(""); setOpen(false); } }}
        onBlur={commit}
        placeholder={label}
        className="h-5 w-32 text-xs bg-transparent outline-none placeholder:text-muted-foreground"
      />
    </span>
  );
}
