import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { DbVendor } from "@/lib/db-types";

export function VendorAutocomplete({
  excludeIds = [],
  onSelect,
  onCreateNew,
  placeholder = "Search vendor by name or company…",
}: {
  excludeIds?: string[];
  onSelect: (vendor: DbVendor) => void;
  onCreateNew: (name: string) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ["vendors-full"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vendors").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as DbVendor[];
    },
  });

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const ql = q.trim().toLowerCase();
  const matches = ql
    ? vendors.filter(
        (v) =>
          !excludeIds.includes(v.id) &&
          (v.name.toLowerCase().includes(ql) || (v.company_name ?? "").toLowerCase().includes(ql)),
      )
    : [];
  const exact = vendors.some(
    (v) => v.name.toLowerCase() === ql || (v.company_name ?? "").toLowerCase() === ql,
  );

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full h-9 pl-8 pr-3 rounded-[8px] bg-card border border-border text-xs focus:outline-none focus:ring-2 focus:ring-ring/30"
        />
        {isLoading && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>
      {open && ql && (
        <div className="absolute z-40 left-0 right-0 mt-1 rounded-[8px] bg-card border border-border shadow-lg max-h-64 overflow-y-auto">
          {matches.slice(0, 8).map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => { onSelect(v); setQ(""); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-muted border-b border-border last:border-0"
            >
              <div className="font-medium">{v.company_name || v.name}</div>
              <div className="text-[10px] text-muted-foreground flex flex-wrap gap-x-2">
                {v.company_name && v.name && <span>Contact: {v.name}</span>}
                {v.category && <span>· {v.category}</span>}
                {v.phone && <span className="font-mono">· {v.phone}</span>}
                {v.gst && <span className="font-mono">· GST {v.gst}</span>}
              </div>
            </button>
          ))}
          {matches.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground italic">No matching vendors.</div>
          )}
          {!exact && (
            <button
              type="button"
              onClick={() => { onCreateNew(q.trim()); setQ(""); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-muted bg-[#fff7eb] border-t border-border inline-flex items-center gap-1.5 text-[#c17f5a] font-medium"
            >
              <Plus className="h-3 w-3" /> Create new vendor "{q}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}
