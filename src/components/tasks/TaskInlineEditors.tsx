import { useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Check, Search, Plus, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

// ---------- Date ----------

export function DateField({
  value, onChange, placeholder = "Pick date", className,
}: {
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  placeholder?: string;
  className?: string;
}) {
  const date = value ? new Date(value + "T00:00:00") : undefined;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "h-9 w-full px-3 rounded-[8px] bg-white border border-border text-xs font-mono inline-flex items-center justify-between hover:border-[#c17f5a]",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <span>{value ?? placeholder}</span>
          <CalendarIcon className="h-3.5 w-3.5 opacity-50 ml-2" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 z-50" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => onChange(d ? format(d, "yyyy-MM-dd") : null)}
          initialFocus
          className="p-3 pointer-events-auto"
        />
        {value && (
          <div className="p-2 border-t border-border">
            <button onClick={() => onChange(null)} className="w-full text-xs text-muted-foreground hover:text-foreground py-1">
              Clear
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function InlineDateCell({ value, color, label, onChange }: {
  value: string | null | undefined;
  color?: string;
  label?: string;
  onChange: (v: string | null) => void;
}) {
  return (
    <DateField
      value={value}
      onChange={onChange}
      className={cn("border-transparent bg-transparent hover:bg-muted/40 hover:border-border", color)}
      placeholder="—"
    />
  );
}

// ---------- Agency ----------

export type AgencyKind = "team" | "client" | "vendor" | "unknown";

export function classifyAgency(
  value: string | null | undefined,
  teamNames: string[],
  vendorNames: string[],
): AgencyKind {
  if (!value) return "unknown";
  const v = value.toLowerCase().trim();
  if (v === "client") return "client";
  if (teamNames.some((n) => n.toLowerCase() === v)) return "team";
  if (vendorNames.some((n) => n.toLowerCase() === v)) return "vendor";
  return "unknown";
}

export function AgencyTag({ value, kind, className }: { value: string | null; kind: AgencyKind; className?: string }) {
  if (!value) return <span className="text-xs text-muted-foreground">—</span>;
  const styles: Record<AgencyKind, string> = {
    team:    "bg-[#c17f5a22] text-[#7a4628] border-[#c17f5a55]",
    client:  "bg-[#7a9e8a22] text-[#3d5e4b] border-[#7a9e8a55]",
    vendor:  "bg-[#e6e2da] text-[#3a3a3a] border-[#cfc8bd]",
    unknown: "bg-[#e6e2da] text-[#3a3a3a] border-[#cfc8bd]",
  };
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-[6px] text-[11px] font-medium border whitespace-nowrap",
      styles[kind], className,
    )}>
      {value}
    </span>
  );
}

export function AgencyPicker({ value, vendors, teamMembers = [], onChange }: {
  value: string | null;
  vendors: { id: string; name: string }[];
  teamMembers?: { name: string; role?: string }[];
  onChange: (v: string | null) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const teamNames = useMemo(() => {
    const seen = new Set<string>();
    return teamMembers
      .map((m) => m.name)
      .filter((n) => { const k = n.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  }, [teamMembers]);

  const vendorNames = useMemo(() => {
    const seen = new Set([...teamNames.map((n) => n.toLowerCase()), "client"]);
    return vendors
      .map((v) => v.name)
      .filter((n) => { const k = n.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  }, [vendors, teamNames]);

  const ql = q.toLowerCase();
  const filteredTeam = teamNames.filter((n) => !ql || n.toLowerCase().includes(ql));
  const filteredVendors = vendorNames.filter((n) => !ql || n.toLowerCase().includes(ql));
  const showClient = !ql || "client".includes(ql);

  const kind = classifyAgency(value, teamNames, vendorNames);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="h-9 w-full px-2 rounded-[8px] bg-white border border-border text-left hover:border-[#c17f5a] inline-flex items-center">
          <AgencyTag value={value} kind={kind} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2 z-50" align="start">
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            autoFocus value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search agencies…"
            className="w-full h-8 pl-8 pr-2 rounded-[6px] bg-muted/30 border border-border text-xs focus:outline-none"
          />
        </div>
        <div className="max-h-[280px] overflow-y-auto space-y-2">
          {value && (
            <button
              onClick={() => { onChange(null); setOpen(false); }}
              className="w-full text-left px-2 py-1.5 rounded text-xs text-muted-foreground hover:bg-muted"
            >
              Clear
            </button>
          )}

          {filteredTeam.length > 0 && (
            <div>
              <div className="text-[9px] uppercase tracking-[0.18em] text-[#c17f5a] font-medium px-2 mb-1">My Team</div>
              {filteredTeam.map((n) => {
                const role = teamMembers.find((m) => m.name === n)?.role;
                return (
                  <button key={n} onClick={() => { onChange(n); setOpen(false); }}
                    className={cn("w-full text-left px-2 py-1.5 rounded text-xs hover:bg-[#c17f5a14] inline-flex items-center justify-between gap-2", value === n && "bg-[#c17f5a22]")}>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#c17f5a]" />
                      <span className="font-medium">{n}</span>
                      {role && <span className="text-[10px] text-muted-foreground">{role}</span>}
                    </span>
                    {value === n && <Check className="h-3 w-3 text-[#c17f5a]" />}
                  </button>
                );
              })}
            </div>
          )}

          {showClient && (
            <div>
              <div className="text-[9px] uppercase tracking-[0.18em] text-[#3d5e4b] font-medium px-2 mb-1">Client</div>
              <button onClick={() => { onChange("Client"); setOpen(false); }}
                className={cn("w-full text-left px-2 py-1.5 rounded text-xs hover:bg-[#7a9e8a14] inline-flex items-center justify-between", value === "Client" && "bg-[#7a9e8a22]")}>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#7a9e8a]" />
                  <span>Client</span>
                </span>
                {value === "Client" && <Check className="h-3 w-3 text-[#7a9e8a]" />}
              </button>
            </div>
          )}

          {filteredVendors.length > 0 && (
            <div>
              <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground font-medium px-2 mb-1">Vendors &amp; Contractors</div>
              {filteredVendors.map((n) => (
                <button key={n} onClick={() => { onChange(n); setOpen(false); }}
                  className={cn("w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted inline-flex items-center justify-between", value === n && "bg-[#c17f5a18]")}>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#9a9388]" />
                    <span>{n}</span>
                  </span>
                  {value === n && <Check className="h-3 w-3 text-[#c17f5a]" />}
                </button>
              ))}
            </div>
          )}

          {q.trim() &&
            ![...teamNames, ...vendorNames, "Client"].some((o) => o.toLowerCase() === ql) && (
            <button
              onClick={() => { onChange(q.trim()); setOpen(false); setQ(""); }}
              className="w-full text-left px-2 py-1.5 rounded text-xs text-[#c17f5a] hover:bg-[#c17f5a18]"
            >
              + Use &quot;{q.trim()}&quot;
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------- Area multi-select ----------

export function AreaPicker({ value, rooms, onChange, onAddRoom }: {
  value: string[];
  rooms: string[];
  onChange: (v: string[]) => void;
  onAddRoom?: (r: string) => void;
}) {
  const [q, setQ] = useState("");
  const opts = useMemo(() => {
    const seen = new Set<string>();
    return rooms.filter((r) => {
      const k = r.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return !q || r.toLowerCase().includes(q.toLowerCase());
    });
  }, [rooms, q]);

  const toggle = (r: string) => {
    onChange(value.includes(r) ? value.filter((x) => x !== r) : [...value, r]);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="min-h-9 w-full px-2 py-1 rounded-[8px] bg-white border border-border text-left hover:border-[#c17f5a]">
          {value.length === 0 ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {value.map((a) => (
                <span key={a} className="px-1.5 py-0.5 rounded-[4px] text-[10px] bg-[#c17f5a18] text-[#7a4f37] whitespace-nowrap">
                  {a}
                </span>
              ))}
            </div>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2 z-50" align="start">
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            autoFocus value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search rooms…"
            className="w-full h-8 pl-8 pr-2 rounded-[6px] bg-muted/30 border border-border text-xs focus:outline-none"
          />
        </div>
        <div className="max-h-[200px] overflow-y-auto space-y-0.5">
          {opts.map((r) => {
            const on = value.includes(r);
            return (
              <button
                key={r}
                onClick={() => toggle(r)}
                className={cn(
                  "w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted inline-flex items-center justify-between",
                  on && "bg-[#c17f5a18]"
                )}
              >
                <span>{r}</span>
                {on && <Check className="h-3 w-3 text-[#c17f5a]" />}
              </button>
            );
          })}
        </div>
        {onAddRoom && q.trim() && !opts.some((o) => o.toLowerCase() === q.trim().toLowerCase()) && (
          <button
            onClick={() => { onAddRoom(q.trim()); toggle(q.trim()); setQ(""); }}
            className="w-full mt-2 px-2 py-1.5 rounded text-xs text-[#c17f5a] hover:bg-[#c17f5a18] inline-flex items-center gap-1 border border-dashed border-[#c17f5a]"
          >
            <Plus className="h-3 w-3" /> Add "{q.trim()}"
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ---------- Work Type multi-select ----------

export function WorkTypePicker({ value, options, onChange, onAddOption }: {
  value: string[];
  options: readonly string[];
  onChange: (v: string[]) => void;
  onAddOption?: (v: string) => void;
}) {
  const [q, setQ] = useState("");
  const seen = useMemo(() => {
    const s = new Set<string>();
    const out: string[] = [];
    options.forEach((o) => {
      const k = o.toLowerCase();
      if (!s.has(k)) { s.add(k); out.push(o); }
    });
    return out;
  }, [options]);
  const ql = q.toLowerCase().trim();
  const filtered = seen.filter((o) => !ql || o.toLowerCase().includes(ql));
  const toggle = (o: string) => {
    onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="min-h-9 w-full px-2 py-1 rounded-[8px] bg-white border border-border text-left hover:border-[#c17f5a]">
          {value.length === 0 ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {value.map((w) => (
                <span key={w} className="px-1.5 py-0.5 rounded-[4px] text-[10px] bg-[#7a9e8a22] text-[#3f5a4d] border border-[#7a9e8a55] whitespace-nowrap">
                  {w}
                </span>
              ))}
            </div>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2 z-50" align="start">
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            autoFocus value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search work types…"
            className="w-full h-8 pl-8 pr-2 rounded-[6px] bg-muted/30 border border-border text-xs focus:outline-none"
          />
        </div>
        <div className="max-h-[220px] overflow-y-auto space-y-0.5">
          {filtered.map((o) => {
            const on = value.includes(o);
            return (
              <button key={o} onClick={() => toggle(o)}
                className={cn(
                  "w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted inline-flex items-center justify-between",
                  on && "bg-[#7a9e8a22]"
                )}>
                <span>{o}</span>
                {on && <Check className="h-3 w-3 text-[#3f5a4d]" />}
              </button>
            );
          })}
          {filtered.length === 0 && <div className="text-xs text-muted-foreground py-2 text-center">No matches</div>}
        </div>
        {q.trim() && !seen.some((o) => o.toLowerCase() === ql) && (
          <button
            onClick={() => {
              const v = q.trim();
              onAddOption?.(v);
              if (!value.includes(v)) onChange([...value, v]);
              setQ("");
            }}
            className="w-full mt-2 px-2 py-1.5 rounded text-xs text-[#c17f5a] hover:bg-[#c17f5a18] inline-flex items-center gap-1 border border-dashed border-[#c17f5a]"
          >
            <Plus className="h-3 w-3" /> Add Work Type "{q.trim()}"
          </button>
        )}
        {value.length > 0 && (
          <button onClick={() => onChange([])}
            className="w-full mt-2 px-2 py-1.5 rounded text-xs text-muted-foreground hover:bg-muted inline-flex items-center gap-1">
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ---------- Dependency picker ----------

export function DependencyPicker({ allTasks, selected, onChange }: {
  allTasks: { id: string; title: string; agency?: string | null; contractor?: string | null; area?: string | null; status?: string | null }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = allTasks.filter((t) =>
    !q || t.title.toLowerCase().includes(q.toLowerCase()) ||
    (t.agency || t.contractor || "").toLowerCase().includes(q.toLowerCase())
  );
  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };
  const labels = selected.map((id) => allTasks.find((t) => t.id === id)?.title).filter(Boolean) as string[];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="min-h-9 w-full px-2 py-1 rounded-[8px] bg-white border border-border text-left hover:border-[#c17f5a]">
          {labels.length === 0 ? (
            <span className="text-xs text-muted-foreground">— Link</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {labels.map((l, i) => (
                <span key={i} className="px-1.5 py-0.5 rounded-[4px] text-[10px] bg-[#8a4a3f18] text-[#8a4a3f] whitespace-nowrap">
                  {l.slice(0, 22)}
                </span>
              ))}
            </div>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2 z-50" align="start">
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            autoFocus value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search project tasks…"
            className="w-full h-8 pl-8 pr-2 rounded-[6px] bg-muted/30 border border-border text-xs focus:outline-none"
          />
        </div>
        <div className="max-h-[260px] overflow-y-auto space-y-0.5">
          {filtered.length === 0 && <div className="text-xs text-muted-foreground py-2 text-center">No tasks</div>}
          {filtered.map((t) => {
            const on = selected.includes(t.id);
            return (
              <button
                key={t.id}
                onClick={() => toggle(t.id)}
                className={cn(
                  "w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted",
                  on && "bg-[#c17f5a18]"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{t.title}</span>
                  {on && <Check className="h-3 w-3 text-[#c17f5a] shrink-0" />}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {(t.agency || t.contractor || "—")}{t.area ? " · " + t.area : ""}
                </div>
              </button>
            );
          })}
        </div>
        {selected.length > 0 && (
          <button
            onClick={() => onChange([])}
            className="w-full mt-2 px-2 py-1.5 rounded text-xs text-muted-foreground hover:bg-muted inline-flex items-center gap-1"
          >
            <X className="h-3 w-3" /> Clear all
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ---------- Status / Priority simple pill picker ----------

export function PillPicker<T extends string>({
  value, options, format, onChange, bg, fg,
}: {
  value: T;
  options: readonly T[];
  format?: (v: T) => string;
  onChange: (v: T) => void;
  bg?: string;
  fg?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center px-2.5 py-1 rounded-[6px] text-[10px] uppercase tracking-wider font-mono font-medium whitespace-nowrap hover:brightness-95"
          style={{ background: bg, color: fg }}
        >
          {format ? format(value) : value}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1 z-50" align="start">
        <div className="max-h-[280px] overflow-y-auto">
          {options.map((o) => (
            <button
              key={o}
              onClick={() => onChange(o)}
              className={cn(
                "w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted inline-flex items-center justify-between",
                value === o && "bg-[#c17f5a18]"
              )}
            >
              <span>{format ? format(o) : o}</span>
              {value === o && <Check className="h-3 w-3 text-[#c17f5a]" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
