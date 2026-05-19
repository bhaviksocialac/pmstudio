import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Plus, Eye, Link2, MessageCircle, Pencil } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { clients } from "@/lib/studio-data";
import { openModal } from "@/lib/app-bus";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clients")({
  head: () => ({ meta: [{ title: "Clients — StudioOS" }, { name: "description", content: "Track every client, their project status and portal activity." }] }),
  component: ClientsPage,
});

const portalTone: Record<string, { bg: string; color: string; label: string }> = {
  active: { bg: "rgba(122,158,138,0.18)", color: "#7a9e8a", label: "Active" },
  sent: { bg: "rgba(212,136,42,0.18)", color: "#d4882a", label: "Sent" },
  "not-sent": { bg: "rgba(107,95,88,0.12)", color: "#6b5f58", label: "Not sent" },
};

function ClientsPage() {
  const [q, setQ] = useState("");
  const filtered = clients.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <AppShell>
      <main className="px-4 md:px-8 py-8 md:py-10 max-w-[1400px] w-full pb-24 md:pb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-3">People</div>
            <h1 className="font-display text-4xl md:text-5xl">Clients</h1>
            <p className="text-muted-foreground mt-2">{clients.length} active relationships across the studio</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clients…" className="h-10 pl-10 pr-3 rounded-[10px] bg-card border border-border text-sm w-56 focus:outline-none focus:ring-2 focus:ring-ring/30" />
            </div>
            <button onClick={() => openModal("add-client")} className="h-10 px-4 inline-flex items-center gap-2 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95">
              <Plus className="h-4 w-4" /> Add Client
            </button>
          </div>
        </div>

        <section className="rounded-[16px] bg-card border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <tr>
                {["Client","Project","Phone","Email","Phase","Budget","Portal","Actions"].map((h) => <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((c) => {
                const t = portalTone[c.portal];
                return (
                  <tr key={c.id} className="hover:bg-muted/40 cursor-pointer transition-colors" onClick={() => openModal("client-panel", c)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="h-8 w-8 rounded-full bg-[#c17f5a] text-white text-[10px] font-medium flex items-center justify-center">{c.initials}</span>
                        <span className="font-medium">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.projectName}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{c.phone}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{c.email}</td>
                    <td className="px-4 py-3"><span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-[6px] bg-muted">{c.phase}</span></td>
                    <td className="px-4 py-3 font-mono tabular-nums">₹{c.budget}L</td>
                    <td className="px-4 py-3"><span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-[6px]" style={{ background: t.bg, color: t.color }}>{t.label}</span></td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <button onClick={() => openModal("client-panel", c)} className="h-8 w-8 rounded-[6px] border border-border flex items-center justify-center hover:bg-muted"><Eye className="h-3.5 w-3.5" /></button>
                        <button onClick={() => { navigator.clipboard?.writeText(`https://studioos.app/portal/${c.id}`).catch(() => {}); toast.success("Portal link copied"); }} className="h-8 w-8 rounded-[6px] border border-border flex items-center justify-center hover:bg-muted"><Link2 className="h-3.5 w-3.5" /></button>
                        <button onClick={() => toast.success("WhatsApp opened")} className="h-8 w-8 rounded-[6px] border border-border flex items-center justify-center hover:bg-muted"><MessageCircle className="h-3.5 w-3.5" /></button>
                        <button className="h-8 w-8 rounded-[6px] border border-border flex items-center justify-center hover:bg-muted"><Pencil className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </main>
    </AppShell>
  );
}
