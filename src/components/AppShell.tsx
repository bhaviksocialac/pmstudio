import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search, Plus, LayoutDashboard, FolderKanban, Users, Truck, Wallet,
  MessageSquare, Bell, X, ChevronRight, Check, Phone, Mail, Link2,
  Settings, LogOut, HelpCircle, CreditCard, UserCircle,
  Sparkles, AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { DbClient, DbVendor, DbProject } from "@/lib/db-types";
import {
  notifications as notifs, type Client, type Vendor,
} from "@/lib/studio-data";
import { onModal, openModal, type ModalEvent } from "@/lib/app-bus";
import { NewProjectWizard } from "@/components/NewProjectWizard";
import { AICopilot } from "@/components/AICopilot";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/" as const },
  { label: "Projects", icon: FolderKanban, to: "/projects" as const },
  { label: "Clients", icon: Users, to: "/clients" as const },
  { label: "Vendors", icon: Truck, to: "/vendors" as const },
  { label: "Finance", icon: Wallet, to: "/finance" as const },
  { label: "Messages", icon: MessageSquare, to: "/messages" as const, badge: 7 },
  { label: "Settings", icon: Settings, to: "/settings" as const },
];

export function AppShell({ children, pageTitle }: { children: React.ReactNode; pageTitle?: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen flex bg-background text-foreground font-sans">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      <Sidebar pathname={pathname} />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <div key={pathname} className="flex-1 animate-fade-up" style={{ animationDuration: "0.2s" }}>
          {children}
        </div>
        <MobileBottomNav pathname={pathname} />
      </div>

      <GlobalModals />
      <AICopilot />
    </div>
  );
}

function useProjectsList() {
  return useQuery({
    queryKey: ["projects", "list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id,name,location").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function Sidebar({ pathname }: { pathname: string }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name,studio_name").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });
  const fullName = profile?.full_name || user?.email || "Studio";
  const initials = fullName.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  const handleSignOut = async () => {
    setProfileOpen(false);
    const { error } = await supabase.auth.signOut();
    if (error) { toast.error(error.message); return; }
    queryClient.clear();
    toast.success("Signed out");
    navigate({ to: "/login" });
  };

  return (
    <aside className="hidden md:flex w-64 shrink-0 bg-sidebar text-sidebar-foreground flex-col border-r border-sidebar-border sticky top-0 h-screen">
      <div className="px-6 pt-8 pb-10">
        <Link to="/" className="font-display text-3xl leading-none">
          <span className="text-white">PM</span><span className="text-[#c17f5a]">Studio</span>
        </Link>
        <div className="text-[10px] uppercase tracking-[0.22em] text-white/35 mt-2">Design Command Centre</div>
      </div>
      <nav className="px-3 space-y-1 flex-1">
        {navItems.map((n) => {
          const active = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
          return (
            <Link
              key={n.label}
              to={n.to}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm transition-[background-color,color] duration-[150ms] ${
                active
                  ? "bg-sidebar-accent text-white border-l-2 border-[#c17f5a]"
                  : "text-white/65 hover:text-white hover:bg-sidebar-accent border-l-2 border-transparent"
              }`}
            >
              <n.icon className="h-4 w-4" />
              <span className="flex-1 text-left">{n.label}</span>
              {n.badge && (
                <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-md bg-[#c17f5a] text-white">{n.badge}</span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 relative">
        {profileOpen && (
          <div className="absolute bottom-full left-3 right-3 mb-2 rounded-[10px] bg-white text-foreground shadow-lg border border-border overflow-hidden z-50">
            {[
              { icon: UserCircle, label: "My Profile", onClick: () => { setProfileOpen(false); toast("My Profile coming soon"); } },
              { icon: Settings, label: "Studio Settings", onClick: () => { setProfileOpen(false); toast("Studio Settings coming soon"); } },
              { icon: HelpCircle, label: "Help & Support", onClick: () => { setProfileOpen(false); toast("Help & Support coming soon"); } },
              { icon: LogOut, label: "Sign Out", onClick: handleSignOut },
            ].map((it) => (
              <button
                key={it.label}
                onClick={it.onClick}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-muted text-left"
              >
                <it.icon className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">{it.label}</span>
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setProfileOpen((v) => !v)}
          className="w-full flex items-center gap-3 p-3 rounded-[10px] bg-sidebar-accent border border-sidebar-border hover:bg-[#332b25] transition-colors"
        >
          <span className="h-9 w-9 rounded-full bg-[#c17f5a] text-white flex items-center justify-center text-xs font-medium">{initials || "S"}</span>
          <div className="flex-1 text-left min-w-0">
            <div className="text-sm font-medium text-white truncate">{fullName}</div>
            <div className="text-[10px] font-mono text-white/45 truncate">{profile?.studio_name || "Studio"}</div>
          </div>
          <ChevronRight className={`h-3.5 w-3.5 text-white/50 transition-transform ${profileOpen ? "rotate-90" : ""}`} />
        </button>
      </div>
    </aside>
  );
}

function TopBar() {
  const [query, setQuery] = useState("");
  const [bellOpen, setBellOpen] = useState(false);
  const navigate = useNavigate();
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const q = query.trim().toLowerCase();
  const enabled = q.length > 0;

  const { data: searchProjects = [] } = useQuery({
    queryKey: ["search", "projects", q],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id,name,location").ilike("name", `%${q}%`).limit(3);
      if (error) throw error;
      return (data ?? []) as Pick<DbProject, "id" | "name" | "location">[];
    },
  });
  const { data: searchClients = [] } = useQuery({
    queryKey: ["search", "clients", q],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id,name,email").ilike("name", `%${q}%`).limit(3);
      if (error) throw error;
      return (data ?? []) as Pick<DbClient, "id" | "name" | "email">[];
    },
  });
  const { data: searchVendors = [] } = useQuery({
    queryKey: ["search", "vendors", q],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("vendors").select("id,name,category").ilike("name", `%${q}%`).limit(3);
      if (error) throw error;
      return (data ?? []) as Pick<DbVendor, "id" | "name" | "category">[];
    },
  });

  const hasResults = enabled && (searchProjects.length || searchClients.length || searchVendors.length);

  return (
    <header className="h-16 border-b border-border bg-background/85 backdrop-blur flex items-center px-4 md:px-8 gap-3 sticky top-0 z-30">
      <div className="relative flex-1 max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask AI or search anything…"
          className="w-full h-10 pl-10 pr-4 rounded-[10px] bg-card border border-border text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring/30"
        />
        {enabled && (
          <div className="absolute top-full left-0 right-0 mt-2 rounded-[10px] bg-card border border-border shadow-lg overflow-hidden z-40 max-h-[60vh] overflow-y-auto">
            {!hasResults && (
              <div className="px-4 py-6 text-sm text-muted-foreground text-center">No results for "{query}"</div>
            )}
            {searchProjects.length > 0 && (
              <SearchSection title="Projects" items={searchProjects.map((p) => ({
                key: p.id, label: p.name, sub: p.location || "—",
                onClick: () => { navigate({ to: "/projects/$projectId", params: { projectId: p.id } }); setQuery(""); },
              }))} />
            )}
            {searchClients.length > 0 && (
              <SearchSection title="Clients" items={searchClients.map((c) => ({
                key: c.id, label: c.name, sub: c.email || "—",
                onClick: () => { navigate({ to: "/clients" }); setQuery(""); },
              }))} />
            )}
            {searchVendors.length > 0 && (
              <SearchSection title="Vendors" items={searchVendors.map((v) => ({
                key: v.id, label: v.name, sub: v.category || "—",
                onClick: () => { navigate({ to: "/vendors" }); setQuery(""); },
              }))} />
            )}
          </div>
        )}
      </div>
      <div className="ml-auto flex items-center gap-3">
        <div ref={bellRef} className="relative">
          <button
            onClick={() => setBellOpen((v) => !v)}
            className="relative h-10 w-10 inline-flex items-center justify-center rounded-[10px] border border-border bg-card hover:bg-muted transition-colors duration-150"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-[#c17f5a] shadow-[0_0_0_3px_rgba(193,127,90,0.25)] pulse-fast" />
          </button>
          {bellOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 rounded-[16px] bg-card border border-border shadow-lg overflow-hidden z-40">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <span className="text-sm font-medium">Notifications</span>
                <span className="text-[10px] uppercase tracking-wider text-[#c17f5a] font-mono">{notifs.length} new</span>
              </div>
              <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
                {notifs.map((n) => (
                  <button key={n.id} className="w-full text-left px-4 py-3 hover:bg-muted transition-colors flex gap-3">
                    <span className={`h-2 w-2 rounded-full mt-1.5 shrink-0`} style={{ background: n.tone === "success" ? "#7a9e8a" : n.tone === "warning" ? "#d4882a" : "#c17f5a" }} />
                    <div className="flex-1">
                      <div className="text-sm">{n.title}</div>
                      <div className="text-[11px] text-muted-foreground font-mono mt-0.5">{n.time}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <button
          onClick={() => openModal("new-project")}
          className="h-10 px-4 inline-flex items-center gap-2 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95 transition-[filter] duration-150"
        >
          <Plus className="h-4 w-4" /><span className="hidden sm:inline">New project</span>
        </button>
      </div>
    </header>
  );
}

function SearchSection({ title, items }: { title: string; items: { key: string; label: string; sub: string; onClick: () => void }[] }) {
  return (
    <div className="py-2">
      <div className="px-4 py-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{title}</div>
      {items.map((it) => (
        <button key={it.key} onClick={it.onClick} className="w-full text-left px-4 py-2.5 hover:bg-muted transition-colors">
          <div className="text-sm font-medium">{it.label}</div>
          <div className="text-[11px] text-muted-foreground">{it.sub}</div>
        </button>
      ))}
    </div>
  );
}

function MobileBottomNav({ pathname }: { pathname: string }) {
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-sidebar border-t border-sidebar-border px-2 py-2 flex justify-around">
      {[navItems[0], navItems[1], navItems[2], navItems[4], navItems[5]].map((n) => {
        const active = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
        return (
          <Link key={n.label} to={n.to}
            className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-[10px] text-[10px] ${active ? "text-[#c17f5a]" : "text-white/60"}`}>
            <n.icon className="h-5 w-5" />
            <span>{n.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/* ------------------------------- Modals ------------------------------- */

function GlobalModals() {
  const [open, setOpen] = useState<ModalEvent | null>(null);
  useEffect(() => onModal((e) => setOpen(e)), []);
  const close = () => setOpen(null);

  if (!open) return null;
  switch (open.name) {
    case "new-project": return <NewProjectWizard onClose={close} />;
    case "draft-update": return <DraftUpdateModal onClose={close} />;
    case "view-impact": return <ViewImpactPanel onClose={close} />;
    case "add-client": return <AddClientModal onClose={close} />;
    case "client-panel": return <ClientPanel client={open.data as Client} onClose={close} />;
    case "add-vendor": return <AddVendorModal onClose={close} />;
    case "vendor-panel": return <VendorPanel vendor={open.data as Vendor} onClose={close} />;
    case "new-invoice": return <NewInvoiceModal onClose={close} />;
    case "upload-photos": return <UploadPhotosModal onClose={close} presetProjectId={(open.data as { projectId?: string } | undefined)?.projectId} />;
    case "lightbox": return <Lightbox data={open.data as { src: string; caption: string }} onClose={close} />;
    default: return null;
  }
}

/* ------ Modal building blocks ------ */

function Overlay({ onClose, children, align = "center" }: { onClose: () => void; children: React.ReactNode; align?: "center" | "right" }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm animate-fade-up" style={{ animationDuration: "0.15s" }} onClick={onClose}>
      <div
        className={`absolute ${align === "right" ? "right-0 top-0 bottom-0" : "inset-0 flex items-center justify-center p-4"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}{required && <span className="text-[#c17f5a] ml-1">*</span>}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
const inputCls = "w-full h-10 px-3 rounded-[10px] bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring/30";

/* ------ New Project Panel (3 steps) ------ */
function NewProjectPanel({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState({ name: "", phone: "", email: "", sameWA: true, address: "", type: "3BHK", style: "Modern Minimal", budget: "", start: "", handover: "", notes: "" });
  const update = (k: string, v: string | boolean) => setData((d) => ({ ...d, [k]: v }));

  const create = () => {
    onClose();
    toast.success(`${data.name || "New project"} created successfully. Client portal ready to share.`);
  };

  return (
    <Overlay onClose={onClose} align="right">
      <div className="w-[480px] max-w-[100vw] h-full bg-background flex flex-col shadow-2xl">
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <h2 className="font-display text-2xl">New Project</h2>
          <button onClick={onClose} className="h-9 w-9 rounded-[10px] hover:bg-muted flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 pt-5">
          <div className="flex items-center gap-2 text-[11px] font-mono">
            {["Client Info", "Project Details", "Budget & Timeline"].map((s, i) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[11px] ${step > i ? "bg-[#7a9e8a] text-white" : step === i + 1 ? "bg-[#c17f5a] text-white" : "bg-muted text-muted-foreground"}`}>
                  {step > i ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <span className={`text-[10px] uppercase tracking-wider ${step === i + 1 ? "text-foreground" : "text-muted-foreground"} hidden sm:inline`}>{s}</span>
                {i < 2 && <div className="flex-1 h-px bg-border" />}
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          {step === 1 && (<>
            <Field label="Client Name" required><input className={inputCls} value={data.name} onChange={(e) => update("name", e.target.value)} placeholder="Priya Mehta" /></Field>
            <Field label="Phone Number" required>
              <div className="flex gap-2">
                <span className="h-10 px-3 rounded-[10px] bg-muted border border-border text-sm flex items-center font-mono">+91</span>
                <input className={inputCls} value={data.phone} onChange={(e) => update("phone", e.target.value)} placeholder="98765 43210" />
              </div>
            </Field>
            <Field label="Email" required><input type="email" className={inputCls} value={data.email} onChange={(e) => update("email", e.target.value)} placeholder="priya@example.com" /></Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={data.sameWA} onChange={(e) => update("sameWA", e.target.checked)} className="accent-[#c17f5a]" />
              WhatsApp same as phone
            </label>
            <Field label="Property Address"><textarea rows={3} className={`${inputCls} h-auto py-2`} value={data.address} onChange={(e) => update("address", e.target.value)} placeholder="Full address" /></Field>
          </>)}
          {step === 2 && (<>
            <Field label="Property Type">
              <select className={inputCls} value={data.type} onChange={(e) => update("type", e.target.value)}>
                {["2BHK","3BHK","4BHK","Villa","Penthouse","Commercial Office","Retail Shop","Restaurant"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Scope of Work">
              <div className="grid grid-cols-2 gap-2">
                {["Living Room","Master Bedroom","Bedroom 2","Bedroom 3","Kitchen","Bathrooms","Dining","Balcony","Full Home"].map((s) => (
                  <label key={s} className="flex items-center gap-2 text-sm px-3 py-2 rounded-[10px] border border-border bg-card cursor-pointer hover:border-[#c17f5a]">
                    <input type="checkbox" className="accent-[#c17f5a]" /> {s}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="Design Style">
              <select className={inputCls} value={data.style} onChange={(e) => update("style", e.target.value)}>
                {["Modern Minimal","Contemporary","Traditional Indian","Industrial","Bohemian","Luxury","Scandinavian","Eclectic"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
          </>)}
          {step === 3 && (<>
            <Field label="Total Budget">
              <div className="flex gap-2">
                <span className="h-10 px-3 rounded-[10px] bg-muted border border-border text-sm flex items-center font-mono">₹</span>
                <input className={inputCls} value={data.budget} onChange={(e) => update("budget", e.target.value)} placeholder="14,00,000" />
              </div>
            </Field>
            <div className="rounded-[10px] border border-border bg-card p-4 space-y-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Budget Breakdown</div>
              {[{l:"Civil", v:25},{l:"Electrical",v:15},{l:"Flooring",v:20},{l:"Furniture",v:30},{l:"Other",v:10}].map((b) => (
                <div key={b.l}>
                  <div className="flex justify-between text-xs mb-1"><span>{b.l}</span><span className="font-mono">{b.v}%</span></div>
                  <input type="range" defaultValue={b.v} className="w-full accent-[#c17f5a]" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start Date"><input type="date" className={inputCls} value={data.start} onChange={(e) => update("start", e.target.value)} /></Field>
              <Field label="Expected Handover"><input type="date" className={inputCls} value={data.handover} onChange={(e) => update("handover", e.target.value)} /></Field>
            </div>
            <Field label="Project Notes"><textarea rows={3} className={`${inputCls} h-auto py-2`} value={data.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Optional" /></Field>
          </>)}
        </div>
        <div className="px-6 py-4 border-t border-border flex gap-2">
          {step > 1 && <button onClick={() => setStep(step - 1)} className="h-10 px-5 rounded-[6px] border border-border text-sm font-medium hover:bg-muted">← Back</button>}
          <div className="flex-1" />
          {step < 3 ? (
            <button onClick={() => setStep(step + 1)} className="h-10 px-5 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95">Next →</button>
          ) : (
            <button onClick={create} className="h-10 px-5 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95">Create Project</button>
          )}
        </div>
      </div>
    </Overlay>
  );
}

/* ------ Draft Update Modal ------ */
function DraftUpdateModal({ onClose }: { onClose: () => void }) {
  const [channel, setChannel] = useState<"whatsapp" | "email">("whatsapp");
  const [text, setText] = useState("Hi Priya, quick update on your home — tile procurement is in progress, delivery expected 15th May. Flooring begins immediately after. Everything on track for June handover. Any questions?");
  const send = () => { onClose(); toast.success(`Update sent via ${channel === "whatsapp" ? "WhatsApp" : "Email"}`); };
  return (
    <Overlay onClose={onClose}>
      <div className="w-full max-w-lg bg-card rounded-[16px] shadow-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-display text-2xl">Draft Client Update</h3>
            <p className="text-xs text-muted-foreground mt-1">For Priya Mehta · Mehta Residence</p>
          </div>
          <button onClick={onClose} className="h-9 w-9 rounded-[10px] hover:bg-muted flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="rounded-[10px] border border-border bg-[#faf8f5] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-3.5 w-3.5 text-[#c17f5a]" />
              <span className="text-[10px] uppercase tracking-[0.2em] text-[#c17f5a]">AI Draft</span>
            </div>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} className="w-full bg-transparent text-sm focus:outline-none resize-none leading-relaxed" />
          </div>
          <div className="flex gap-2">
            {(["whatsapp","email"] as const).map((c) => (
              <button key={c} onClick={() => setChannel(c)}
                className={`flex-1 h-10 rounded-[6px] text-sm font-medium border transition-colors ${channel === c ? "bg-[#1a1612] text-white border-[#1a1612]" : "border-border bg-card hover:bg-muted"}`}>
                Send via {c === "whatsapp" ? "WhatsApp" : "Email"}
              </button>
            ))}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-end">
          <button onClick={send} className="h-10 px-6 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95">Send Now</button>
        </div>
      </div>
    </Overlay>
  );
}

/* ------ View Impact Panel ------ */
function ViewImpactPanel({ onClose }: { onClose: () => void }) {
  const cascade = [
    { label: "Tile delay", days: 3, date: "12 May" },
    { label: "Flooring pushed to 18th May", days: 3, date: "18 May" },
    { label: "Painting pushed to 28th May", days: 5, date: "28 May" },
    { label: "Handover pushed to 25th June", days: 8, date: "25 Jun" },
  ];
  return (
    <Overlay onClose={onClose} align="right">
      <div className="w-[440px] max-w-[100vw] h-full bg-background flex flex-col shadow-2xl">
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl">Impact Cascade</h2>
            <p className="text-xs text-muted-foreground mt-1">Mehta Residence · 3 day tile delay</p>
          </div>
          <button onClick={onClose} className="h-9 w-9 rounded-[10px] hover:bg-muted flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="relative pl-8">
            <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />
            {cascade.map((c, i) => (
              <div key={i} className="relative pb-6 last:pb-0">
                <span className="absolute -left-[22px] top-1 h-3 w-3 rounded-full" style={{ background: "#d4882a", boxShadow: "0 0 0 4px rgba(212,136,42,0.18)" }} />
                <div className="rounded-[10px] border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-medium">{c.label}</div>
                    <span className="shrink-0 text-[10px] font-mono px-2 py-0.5 rounded-[6px]" style={{ background: "rgba(212,136,42,0.15)", color: "#d4882a" }}>+{c.days} days</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono mt-1.5">New date: {c.date}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-[10px] bg-[#1a1612] text-white p-4">
            <div className="flex items-center gap-2 mb-2 text-[#c17f5a]">
              <AlertTriangle className="h-3.5 w-3.5" /><span className="text-[10px] uppercase tracking-wider">Recommendation</span>
            </div>
            <p className="text-sm text-white/80 leading-relaxed">Notify Priya today. Offer the 25th June handover and parallel start of painting to recover 3 days.</p>
          </div>
        </div>
      </div>
    </Overlay>
  );
}

/* ------ Add Client / Vendor / Invoice / Photos ------ */
function AddClientModal({ onClose }: { onClose: () => void }) {
  return (
    <Overlay onClose={onClose}>
      <div className="w-full max-w-md bg-card rounded-[16px] shadow-2xl">
        <ModalHeader title="Add Client" onClose={onClose} />
        <div className="p-6 space-y-4">
          <Field label="Full Name" required><input className={inputCls} /></Field>
          <Field label="Phone" required>
            <div className="flex gap-2"><span className="h-10 px-3 rounded-[10px] bg-muted border border-border text-sm flex items-center font-mono">+91</span><input className={inputCls} /></div>
          </Field>
          <Field label="Email" required><input className={inputCls} type="email" /></Field>
          <Field label="Property Address"><textarea rows={2} className={`${inputCls} h-auto py-2`} /></Field>
          <Field label="Property Type"><select className={inputCls}><option>2BHK</option><option>3BHK</option><option>Villa</option><option>Commercial</option></select></Field>
          <Field label="Assign to Project">
            <select className={inputCls}>
              <option>+ Create new project</option>
              <ProjectOptions />

            </select>
          </Field>
        </div>
        <ModalFooter onPrimary={() => { onClose(); toast.success("Client added"); }} primaryLabel="Save Client" />
      </div>
    </Overlay>
  );
}

function AddVendorModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const DEFAULT_CATS = ["Civil","Carpentry","Electrical","Plumbing","Flooring","Painting","Furniture","Lighting","Hardware","Tiles","Sanitary","HVAC","Other"];
  const DEFAULT_TERMS = ["100% Advance","50% Advance 50% on Delivery","30 Days Credit","On Completion"];

  const { data: customCats = [] } = useQuery({
    queryKey: ["user_options", "vendor_category"],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_options").select("value").eq("kind", "vendor_category");
      return (data ?? []).map((r) => r.value);
    },
  });
  const { data: customTerms = [] } = useQuery({
    queryKey: ["user_options", "payment_terms"],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_options").select("value").eq("kind", "payment_terms");
      return (data ?? []).map((r) => r.value);
    },
  });
  const allCats = [...DEFAULT_CATS, ...customCats.filter((c) => !DEFAULT_CATS.includes(c))];
  const allTerms = [...DEFAULT_TERMS, ...customTerms.filter((c) => !DEFAULT_TERMS.includes(c))];

  const [name, setName] = useState("");
  const [category, setCategory] = useState(allCats[0] ?? "Civil");
  const [customCatMode, setCustomCatMode] = useState(false);
  const [customCat, setCustomCat] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [terms, setTerms] = useState(DEFAULT_TERMS[0]);
  const [customTermsMode, setCustomTermsMode] = useState(false);
  const [customTermsValue, setCustomTermsValue] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!user) { toast.error("Sign in first"); return; }
    const finalCategory = customCatMode ? customCat.trim() : category;
    const finalTerms = customTermsMode ? customTermsValue.trim() : terms;
    if (!name.trim()) { toast.error("Vendor name is required"); return; }
    if (!finalCategory) { toast.error("Category is required"); return; }
    setBusy(true);
    // Persist custom values if new
    if (customCatMode && customCat.trim() && !customCats.includes(customCat.trim())) {
      await supabase.from("user_options").insert({ user_id: user.id, kind: "vendor_category", value: customCat.trim() });
    }
    if (customTermsMode && customTermsValue.trim() && !customTerms.includes(customTermsValue.trim())) {
      await supabase.from("user_options").insert({ user_id: user.id, kind: "payment_terms", value: customTermsValue.trim() });
    }
    const { error } = await supabase.from("vendors").insert({
      user_id: user.id,
      name: name.trim(),
      category: finalCategory,
      phone: phone.trim() || null,
      email: email.trim() || null,
      payment_terms: finalTerms || null,
      notes: notes.trim() || null,
      rating: 0,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["vendors"] });
    qc.invalidateQueries({ queryKey: ["vendors-light"] });
    qc.invalidateQueries({ queryKey: ["user_options"] });
    onClose();
    toast.success("Vendor saved");
  };

  return (
    <Overlay onClose={onClose}>
      <div className="w-full max-w-md bg-card rounded-[16px] shadow-2xl">
        <ModalHeader title="Add Vendor" onClose={onClose} />
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <Field label="Vendor Name" required>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Category" required>
            {customCatMode ? (
              <div className="flex gap-2">
                <input autoFocus className={inputCls} value={customCat} onChange={(e) => setCustomCat(e.target.value)} placeholder="Type custom category…" />
                <button onClick={() => { setCustomCatMode(false); setCustomCat(""); }} className="h-10 px-3 rounded-[10px] border border-border text-xs">Cancel</button>
              </div>
            ) : (
              <select className={inputCls} value={category} onChange={(e) => {
                if (e.target.value === "__custom__") { setCustomCatMode(true); }
                else setCategory(e.target.value);
              }}>
                {allCats.map((c) => <option key={c}>{c}</option>)}
                <option value="__custom__">+ Add Custom Category…</option>
              </select>
            )}
          </Field>
          <Field label="Phone">
            <div className="flex gap-2"><span className="h-10 px-3 rounded-[10px] bg-muted border border-border text-sm flex items-center font-mono">+91</span>
              <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </Field>
          <Field label="Email"><input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Payment Terms">
            {customTermsMode ? (
              <div className="flex gap-2">
                <input autoFocus className={inputCls} value={customTermsValue} onChange={(e) => setCustomTermsValue(e.target.value)} placeholder="Type custom terms…" />
                <button onClick={() => { setCustomTermsMode(false); setCustomTermsValue(""); }} className="h-10 px-3 rounded-[10px] border border-border text-xs">Cancel</button>
              </div>
            ) : (
              <select className={inputCls} value={terms} onChange={(e) => {
                if (e.target.value === "__custom__") setCustomTermsMode(true);
                else setTerms(e.target.value);
              }}>
                {allTerms.map((t) => <option key={t}>{t}</option>)}
                <option value="__custom__">Custom…</option>
              </select>
            )}
          </Field>
          <Field label="Notes"><textarea rows={2} className={`${inputCls} h-auto py-2`} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </div>
        <ModalFooter onPrimary={save} primaryLabel={busy ? "Saving…" : "Save Vendor"} />
      </div>
    </Overlay>
  );
}

function NewInvoiceModal({ onClose }: { onClose: () => void }) {
  return (
    <Overlay onClose={onClose}>
      <div className="w-full max-w-lg bg-card rounded-[16px] shadow-2xl">
        <ModalHeader title="New Invoice" subtitle="Auto-numbered INV-006" onClose={onClose} />
        <div className="p-6 space-y-4">
          <Field label="Project"><select className={inputCls}><ProjectOptions /></select></Field>
          <Field label="Milestone"><input className={inputCls} placeholder="Procurement Start" /></Field>
          <Field label="Description"><textarea rows={3} className={`${inputCls} h-auto py-2`} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Amount ₹"><input className={inputCls} placeholder="3,50,000" /></Field>
            <Field label="GST %"><select className={inputCls}><option>0</option><option>5</option><option>12</option><option>18</option><option>28</option></select></Field>
            <Field label="Due Date"><input type="date" className={inputCls} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" defaultChecked className="accent-[#c17f5a]" /> Attach Razorpay payment link
          </label>
        </div>
        <div className="px-6 py-4 border-t border-border flex gap-2 justify-end">
          <button onClick={() => { onClose(); toast.success("Invoice saved as draft"); }} className="h-10 px-5 rounded-[6px] border border-border text-sm font-medium hover:bg-muted">Save as Draft</button>
          <button onClick={() => { onClose(); toast.success("Invoice sent to client"); }} className="h-10 px-5 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95">Send to Client</button>
        </div>
      </div>
    </Overlay>
  );
}

function UploadPhotosModal({ onClose, presetProjectId }: { onClose: () => void; presetProjectId?: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: projects = [] } = useProjectsList();
  const [files, setFiles] = useState<File[]>([]);
  const [projectId, setProjectId] = useState<string>(presetProjectId ?? "");
  const [room, setRoom] = useState("Living Room");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-open native picker when modal first opens
  useEffect(() => {
    inputRef.current?.click();
  }, []);

  const upload = async () => {
    if (!user) return;
    const pid = projectId || presetProjectId || projects[0]?.id;
    if (!pid) { toast.error("No project to attach photos to"); return; }
    if (files.length === 0) { toast.error("Pick at least one photo"); return; }
    setBusy(true);
    try {
      for (const file of files) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${user.id}/${pid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("project-photos").upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("project-photos").getPublicUrl(path);
        const { error: insErr } = await supabase.from("photos").insert({
          user_id: user.id,
          project_id: pid,
          room,
          caption: caption.trim() || null,
          storage_path: path,
          image_url: pub.publicUrl,
          status: "approved",
        });
        if (insErr) throw insErr;
      }
      qc.invalidateQueries({ queryKey: ["photos"] });
      qc.invalidateQueries({ queryKey: ["project-photos"] });
      onClose();
      toast.success(`${files.length} photo${files.length > 1 ? "s" : ""} uploaded`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Overlay onClose={onClose}>
      <div className="w-full max-w-md bg-card rounded-[16px] shadow-2xl">
        <ModalHeader title="Upload Photos" onClose={onClose} />
        <div className="p-6 space-y-4">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
          <button onClick={() => inputRef.current?.click()}
            className="w-full rounded-[10px] border-2 border-dashed border-border hover:border-[#c17f5a] hover:bg-[#fff7eb] p-6 text-center transition-colors">
            <div className="text-sm font-medium">{files.length > 0 ? `${files.length} file${files.length > 1 ? "s" : ""} selected` : "Click to choose photos"}</div>
            <div className="text-[11px] text-muted-foreground mt-1">JPG / PNG · multiple allowed</div>
          </button>

          {!presetProjectId && projects.length > 0 && (
            <Field label="Project" required>
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputCls}>
                <option value="">Select a project…</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Room" required>
            <select value={room} onChange={(e) => setRoom(e.target.value)} className={inputCls}>
              {["Living Room","Master Bedroom","Bedroom 2","Bedroom 3","Kitchen","Bathroom","Dining","Balcony","Study","Other"].map((r) => <option key={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Caption (optional)">
            <input value={caption} maxLength={200} onChange={(e) => setCaption(e.target.value)} className={inputCls} placeholder="Coral arch finish, day 3" />
          </Field>
        </div>
        <ModalFooter onPrimary={upload} primaryLabel={busy ? "Uploading…" : `Upload ${files.length || ""} photo${files.length === 1 ? "" : "s"}`} />
      </div>
    </Overlay>
  );
}

function ModalHeader({ title, subtitle, onClose }: { title: string; subtitle?: string; onClose: () => void }) {
  return (
    <div className="px-6 py-5 border-b border-border flex items-center justify-between">
      <div>
        <h3 className="font-display text-2xl">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-1 font-mono">{subtitle}</p>}
      </div>
      <button onClick={onClose} className="h-9 w-9 rounded-[10px] hover:bg-muted flex items-center justify-center"><X className="h-4 w-4" /></button>
    </div>
  );
}
function ModalFooter({ onPrimary, primaryLabel }: { onPrimary: () => void; primaryLabel: string }) {
  return (
    <div className="px-6 py-4 border-t border-border flex justify-end">
      <button onClick={onPrimary} className="h-10 px-6 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95">{primaryLabel}</button>
    </div>
  );
}

function ProjectOptions() {
  const { data = [] } = useProjectsList();
  return <>{data.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</>;
}

/* ------ Client / Vendor side panels ------ */
function ClientPanel({ client, onClose }: { client: Client; onClose: () => void }) {
  if (!client) return null;
  const project = undefined as { completion?: number } | undefined;
  return (
    <Overlay onClose={onClose} align="right">
      <div className="w-[440px] max-w-[100vw] h-full bg-background flex flex-col shadow-2xl">
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="h-12 w-12 rounded-full bg-[#c17f5a] text-white flex items-center justify-center font-medium">{client.initials}</span>
            <div>
              <h2 className="font-display text-2xl leading-none">{client.name}</h2>
              <div className="text-xs text-muted-foreground mt-1">{client.projectName}</div>
            </div>
          </div>
          <button onClick={onClose} className="h-9 w-9 rounded-[10px] hover:bg-muted flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <InfoRow icon={Phone} label="Phone" value={client.phone} />
          <InfoRow icon={Mail} label="Email" value={client.email} />
          <InfoRow icon={Link2} label="Address" value={client.address} />
          <div className="rounded-[10px] border border-border bg-card p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Current Project</div>
            <div className="text-sm font-medium">{client.projectName}</div>
            <div className="flex justify-between text-xs text-muted-foreground mt-2 mb-1.5"><span>{client.phase}</span><span className="font-mono">{project?.completion ?? 0}%</span></div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-[#c17f5a]" style={{ width: `${project?.completion ?? 0}%` }} />
            </div>
          </div>
          <div className="rounded-[10px] border border-border bg-card p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-3">Portal Activity</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><div className="font-display text-xl">{client.views}</div><div className="text-[10px] text-muted-foreground uppercase tracking-wider">Views</div></div>
              <div><div className="font-display text-xl">{client.approvals}</div><div className="text-[10px] text-muted-foreground uppercase tracking-wider">Approvals</div></div>
              <div><div className="font-mono text-xs mt-1">{client.lastOpened}</div><div className="text-[10px] text-muted-foreground uppercase tracking-wider">Last seen</div></div>
            </div>
          </div>
          {client.notes && (
            <div className="rounded-[10px] border border-border bg-card p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Notes</div>
              <p className="text-sm leading-relaxed">{client.notes}</p>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-border grid grid-cols-3 gap-2">
          <button onClick={() => { toast.success("Portal link copied"); }} className="h-10 rounded-[6px] border border-border text-xs font-medium hover:bg-muted">Send Portal</button>
          <button onClick={() => { toast.success("WhatsApp opened"); }} className="h-10 rounded-[6px] border border-border text-xs font-medium hover:bg-muted">WhatsApp</button>
          <Link to="/projects/$projectId" params={{ projectId: client.projectId }} onClick={onClose} className="h-10 rounded-[6px] bg-primary text-primary-foreground text-xs font-medium hover:brightness-95 flex items-center justify-center">View Project</Link>
        </div>
      </div>
    </Overlay>
  );
}

function VendorPanel({ vendor, onClose }: { vendor: Vendor; onClose: () => void }) {
  if (!vendor) return null;
  return (
    <Overlay onClose={onClose} align="right">
      <div className="w-[440px] max-w-[100vw] h-full bg-background flex flex-col shadow-2xl">
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl">{vendor.name}</h2>
            <div className="text-xs text-muted-foreground mt-1">{vendor.category} · {vendor.paymentTerms}</div>
          </div>
          <button onClick={onClose} className="h-9 w-9 rounded-[10px] hover:bg-muted flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <InfoRow icon={Phone} label="Phone" value={vendor.phone} />
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Orders" value={String(vendor.orders)} />
            <Stat label="On time" value={`${vendor.onTimePct}%`} tone={vendor.onTimePct >= 90 ? "#7a9e8a" : vendor.onTimePct >= 80 ? "#d4882a" : "#c4685a"} />
            <Stat label="Delays" value={String(vendor.delays)} />
          </div>
          <div className="rounded-[10px] border border-border bg-card p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-3">Project History</div>
            <div className="divide-y divide-border">
              {vendor.history.map((h, i) => (
                <div key={i} className="py-2.5 flex justify-between text-sm">
                  <div><div>{h.project}</div><div className="text-[11px] text-muted-foreground font-mono">{h.date}</div></div>
                  <div className="font-mono">₹{(h.amount / 100000).toFixed(2)}L</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border grid grid-cols-2 gap-2">
          <button onClick={() => { onClose(); toast.success("PO raised"); }} className="h-10 rounded-[6px] border border-border text-sm font-medium hover:bg-muted">Raise PO</button>
          <button onClick={() => { onClose(); toast.success("Payment recorded"); }} className="h-10 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95">Record Payment</button>
        </div>
      </div>
    </Overlay>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="h-8 w-8 rounded-[8px] bg-muted flex items-center justify-center"><Icon className="h-3.5 w-3.5 text-muted-foreground" /></span>
      <div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
        <div className="text-sm mt-0.5">{value}</div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-[10px] border border-border bg-card p-3 text-center">
      <div className="font-display text-2xl tabular-nums" style={{ color: tone }}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function Lightbox({ data, onClose }: { data: { src: string; caption: string }; onClose: () => void }) {
  return (
    <Overlay onClose={onClose}>
      <div className="max-w-4xl w-full">
        <button onClick={onClose} className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"><X className="h-4 w-4" /></button>
        <div className="aspect-[16/10] rounded-[16px] overflow-hidden shadow-2xl" style={{ background: data.src }} />
        <p className="text-center text-white mt-4 font-display text-xl">{data.caption}</p>
      </div>
    </Overlay>
  );
}

export { openModal };
