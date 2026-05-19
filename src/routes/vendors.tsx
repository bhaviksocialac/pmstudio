import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Plus, Star, MessageCircle, Phone } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { vendors } from "@/lib/studio-data";
import { openModal } from "@/lib/app-bus";
import { toast } from "sonner";

export const Route = createFileRoute("/vendors")({
  head: () => ({ meta: [{ title: "Vendors — StudioOS" }, { name: "description", content: "All vendors with performance, payments and active projects." }] }),
  component: VendorsPage,
});

function VendorsPage() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const cats = ["All", ...Array.from(new Set(vendors.map((v) => v.category)))];
  const filtered = vendors.filter((v) => (cat === "All" || v.category === cat) && v.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <AppShell>
      <main className="px-4 md:px-8 py-8 md:py-10 max-w-[1400px] w-full pb-24 md:pb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-3">Supply</div>
            <h1 className="font-display text-4xl md:text-5xl">Vendors</h1>
            <p className="text-muted-foreground mt-2">{vendors.length} trusted partners across categories</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search vendors…" className="h-10 pl-10 pr-3 rounded-[10px] bg-card border border-border text-sm w-56 focus:outline-none focus:ring-2 focus:ring-ring/30" />
            </div>
            <select value={cat} onChange={(e) => setCat(e.target.value)} className="h-10 px-3 rounded-[10px] bg-card border border-border text-sm">
              {cats.map((c) => <option key={c}>{c}</option>)}
            </select>
            <button onClick={() => openModal("add-vendor")} className="h-10 px-4 inline-flex items-center gap-2 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95">
              <Plus className="h-4 w-4" /> Add Vendor
            </button>
          </div>
        </div>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-10">
          {filtered.map((v) => (
            <article key={v.id} onClick={() => openModal("vendor-panel", v)}
                     className="cursor-pointer rounded-[16px] bg-card border border-border p-6 hover:-translate-y-[2px] transition-transform" style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-[6px]" style={{ background: "rgba(193,127,90,0.15)", color: "#c17f5a" }}>{v.category}</span>
                  </div>
                  <h3 className="font-display text-2xl leading-tight">{v.name}</h3>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground font-mono">
                    <Phone className="h-3 w-3" /> {v.phone}
                  </div>
                </div>
                <div className="flex">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5" fill={i < v.rating ? "#d4882a" : "transparent"} color={i < v.rating ? "#d4882a" : "#c9c1b6"} />
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-5 mb-5">
                <Mini label="Last used" value={v.lastUsed} />
                <Mini label="Active" value={`${v.activeProjects} proj`} />
                <Mini label="Terms" value={v.paymentTerms} />
              </div>
              <div className="flex gap-2 pt-2 border-t border-border" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => openModal("vendor-panel", v)} className="flex-1 h-9 rounded-[6px] border border-border text-xs font-medium hover:bg-muted">View History</button>
                <button onClick={() => toast.success("WhatsApp opened")} className="flex-1 h-9 rounded-[6px] bg-[#1a1612] text-white text-xs font-medium hover:brightness-110 inline-flex items-center justify-center gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                </button>
              </div>
            </article>
          ))}
        </section>

        <section className="rounded-[16px] bg-card border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-display text-xl">Performance Ranking</h2>
            <p className="text-xs text-muted-foreground mt-1">Sorted by on-time delivery rate</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <tr>
                {["Vendor","Category","Orders","On Time %","Delays","Rating"].map((h) => <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[...vendors].sort((a, b) => b.onTimePct - a.onTimePct).map((v) => (
                <tr key={v.id} className="hover:bg-muted/40 cursor-pointer" onClick={() => openModal("vendor-panel", v)}>
                  <td className="px-4 py-3 font-medium">{v.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{v.category}</td>
                  <td className="px-4 py-3 font-mono">{v.orders}</td>
                  <td className="px-4 py-3 font-mono" style={{ color: v.onTimePct >= 90 ? "#7a9e8a" : v.onTimePct >= 80 ? "#d4882a" : "#c4685a" }}>{v.onTimePct}%</td>
                  <td className="px-4 py-3 font-mono">{v.delays}</td>
                  <td className="px-4 py-3">
                    <div className="flex">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-3 w-3" fill={i < v.rating ? "#d4882a" : "transparent"} color={i < v.rating ? "#d4882a" : "#c9c1b6"} />)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </AppShell>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-xs font-medium mt-0.5 truncate">{value}</div>
    </div>
  );
}
