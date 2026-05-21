import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Users, MapPin, AlertCircle, Loader2, X, CheckCircle2, XCircle, Trash2, Filter, BarChart3, Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

type Contractor = {
  id: string;
  name: string;
  category: string | null;
  phone: string | null;
  expected_days: number;
};
type Attendance = {
  id: string;
  contractor_id: string;
  attendance_date: string;
  present: boolean;
  workers_count: number;
  work_done: string | null;
  hours_on_site: number | null;
  checked_in_at: string | null;
  check_in_outside_geofence: boolean;
};

type SubTab = "today" | "contractors" | "ledger" | "efficiency";
const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "contractors", label: "Contractors" },
  { id: "ledger", label: "Ledger" },
  { id: "efficiency", label: "Efficiency" },
];

export function AttendanceTab({
  projectId,
  projectName,
  projectLocation,
  projectLat,
  projectLng,
  projectStartDate,
}: {
  projectId: string;
  projectName: string;
  projectLocation: string | null;
  projectLat: number | null;
  projectLng: number | null;
  projectStartDate: string | null;
}) {
  const [sub, setSub] = useState<SubTab>("today");
  const [marking, setMarking] = useState(false);
  const [historyContractor, setHistoryContractor] = useState<Contractor | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  const contractorsQ = useQuery({
    queryKey: ["project_contractors", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_contractors").select("*")
        .eq("project_id", projectId).order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Contractor[];
    },
  });
  const attendanceQ = useQuery({
    queryKey: ["site_attendance", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_attendance").select("*")
        .eq("project_id", projectId).order("attendance_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Attendance[];
    },
  });

  const contractors = contractorsQ.data ?? [];
  const attendance = attendanceQ.data ?? [];
  const byContractor = useMemo(() => {
    const m = new Map<string, Attendance[]>();
    for (const a of attendance) {
      const arr = m.get(a.contractor_id) ?? [];
      arr.push(a);
      m.set(a.contractor_id, arr);
    }
    return m;
  }, [attendance]);

  const todayRows = attendance.filter((a) => a.attendance_date === today);
  const totalWorkers = todayRows.filter((a) => a.present).reduce((s, a) => s + (a.workers_count || 0), 0);
  const sitesActive = todayRows.some((a) => a.present) ? 1 : 0;
  const absentToday = todayRows.filter((a) => !a.present).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl">Site Attendance</h2>
          <p className="text-xs text-muted-foreground">Mark contractor attendance, track manpower, monitor efficiency.</p>
        </div>
        <button onClick={() => setMarking(true)}
          className="h-11 px-5 rounded-[8px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95 inline-flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" /> Mark Today's Attendance
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard icon={<Users className="h-4 w-4" />} label="Total Workers Today" value={`${totalWorkers}`} accent="#7a9e8a" />
        <SummaryCard icon={<MapPin className="h-4 w-4" />} label="Sites Active Today" value={`${sitesActive}`} accent="#c17f5a" />
        <SummaryCard icon={<AlertCircle className="h-4 w-4" />} label="Absent Contractors" value={`${absentToday}`} accent={absentToday > 0 ? "#c4685a" : "#7a9e8a"} highlight={absentToday > 0} />
      </div>

      {/* Sub tabs */}
      <div className="border-b border-border overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {SUB_TABS.map((t) => (
            <button key={t.id} onClick={() => setSub(t.id)}
              className={`px-4 py-2.5 text-xs uppercase tracking-wider font-medium border-b-2 -mb-px transition-colors ${sub === t.id ? "border-[#c17f5a] text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {sub === "today" && (
        <TodayPanel
          contractors={contractors} today={today} attendance={todayRows}
          projectLat={projectLat} projectLng={projectLng} projectId={projectId} onAddClick={() => setMarking(true)}
        />
      )}
      {sub === "contractors" && (
        <ContractorTable contractors={contractors} byContractor={byContractor} today={today}
          onRowClick={(c) => setHistoryContractor(c)} projectId={projectId} />
      )}
      {sub === "ledger" && (
        <LedgerPanel contractors={contractors} attendance={attendance} />
      )}
      {sub === "efficiency" && (
        <EfficiencyPanel contractors={contractors} byContractor={byContractor} projectStartDate={projectStartDate} />
      )}

      {marking && (
        <MarkAttendanceModal
          projectId={projectId} projectName={projectName} projectLocation={projectLocation}
          contractors={contractors} existingToday={todayRows}
          onClose={() => setMarking(false)}
        />
      )}
      {historyContractor && (
        <ContractorHistoryModal
          contractor={historyContractor} attendance={byContractor.get(historyContractor.id) ?? []}
          projectStartDate={projectStartDate} onClose={() => setHistoryContractor(null)}
        />
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value, accent, highlight }: { icon: React.ReactNode; label: string; value: string; accent: string; highlight?: boolean }) {
  return (
    <div className={`rounded-[12px] border p-4 ${highlight ? "bg-[#fdf3f1] border-[#c4685a]/50" : "bg-card border-border"}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className="h-8 w-8 rounded-[8px] flex items-center justify-center" style={{ background: `${accent}22`, color: accent }}>{icon}</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      </div>
      <div className="font-display text-3xl tabular-nums" style={{ color: highlight ? accent : undefined }}>{value}</div>
    </div>
  );
}

// ============================================================
// TODAY
// ============================================================
function TodayPanel({ contractors, today, attendance, projectLat, projectLng, projectId, onAddClick }: {
  contractors: Contractor[]; today: string; attendance: Attendance[];
  projectLat: number | null; projectLng: number | null; projectId: string; onAddClick: () => void;
}) {
  const map = new Map(attendance.map((a) => [a.contractor_id, a]));
  if (contractors.length === 0) {
    return (
      <div className="rounded-[10px] border border-dashed border-border p-8 text-center">
        <p className="text-sm text-muted-foreground mb-3">No contractors added yet for this project.</p>
        <button onClick={onAddClick} className="h-10 px-4 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95 inline-flex items-center gap-2">
          <Plus className="h-3.5 w-3.5" /> Add contractor + mark attendance
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground mb-1">{today} · {attendance.length} of {contractors.length} marked</div>
      {contractors.map((c) => {
        const a = map.get(c.id);
        return (
          <div key={c.id} className="flex items-center justify-between gap-3 rounded-[10px] border border-border bg-card px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm truncate">{c.name}</div>
              <div className="text-[11px] text-muted-foreground">{c.category || "—"}{a?.present && a.workers_count ? ` · ${a.workers_count} workers` : ""}</div>
            </div>
            {a ? (
              a.present ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-[11px] font-medium" style={{ background: "rgba(122,158,138,0.18)", color: "#3d6f5a" }}>
                  <CheckCircle2 className="h-3 w-3" /> Present
                  {a.checked_in_at && <span className="font-mono opacity-70">· {new Date(a.checked_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-[11px] font-medium" style={{ background: "rgba(196,104,90,0.18)", color: "#c4685a" }}>
                  <XCircle className="h-3 w-3" /> Absent
                </span>
              )
            ) : (
              <CheckInButton contractorId={c.id} projectId={projectId} projectLat={projectLat} projectLng={projectLng} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function CheckInButton({ contractorId, projectId, projectLat, projectLng }: { contractorId: string; projectId: string; projectLat: number | null; projectLng: number | null }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [pending, setPending] = useState(false);

  const doCheckIn = async (lat: number | null, lng: number | null, outside: boolean) => {
    const { error } = await supabase.from("site_attendance").insert({
      user_id: user!.id, project_id: projectId, contractor_id: contractorId,
      attendance_date: new Date().toISOString().slice(0, 10),
      present: true, workers_count: 0,
      check_in_lat: lat, check_in_lng: lng, checked_in_at: new Date().toISOString(),
      check_in_outside_geofence: outside,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(outside ? "Checked in (off-site)" : "Checked in on site");
    qc.invalidateQueries({ queryKey: ["site_attendance", projectId] });
  };

  const handle = () => {
    setPending(true);
    if (!navigator.geolocation) {
      toast.message("Location unavailable — checking in without geo");
      doCheckIn(null, null, false).finally(() => setPending(false));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (projectLat == null || projectLng == null) {
          doCheckIn(latitude, longitude, false).finally(() => setPending(false));
          return;
        }
        const dist = haversineMeters(latitude, longitude, projectLat, projectLng);
        if (dist <= 500) {
          doCheckIn(latitude, longitude, false).finally(() => setPending(false));
        } else {
          if (window.confirm(`You appear to be ${Math.round(dist)}m from the project site. Check in anyway?`)) {
            doCheckIn(latitude, longitude, true).finally(() => setPending(false));
          } else setPending(false);
        }
      },
      (err) => {
        toast.error("Location denied: " + err.message);
        setPending(false);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  return (
    <button onClick={handle} disabled={pending}
      className="h-8 px-3 rounded-[6px] border border-border text-[11px] font-medium hover:bg-muted inline-flex items-center gap-1.5 disabled:opacity-60">
      {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <MapPin className="h-3 w-3" />} Check In
    </button>
  );
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ============================================================
// CONTRACTOR TABLE
// ============================================================
function ContractorTable({ contractors, byContractor, today, onRowClick, projectId }: {
  contractors: Contractor[]; byContractor: Map<string, Attendance[]>; today: string;
  onRowClick: (c: Contractor) => void; projectId: string;
}) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_contractors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project_contractors", projectId] }),
  });

  if (contractors.length === 0) {
    return (
      <div className="rounded-[10px] border border-dashed border-border p-8 text-center">
        <p className="text-sm text-muted-foreground mb-3">No contractors yet.</p>
        <button onClick={() => setAdding(true)} className="h-10 px-4 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95 inline-flex items-center gap-2">
          <Plus className="h-3.5 w-3.5" /> Add contractor
        </button>
        {adding && <AddContractorInline projectId={projectId} onDone={() => setAdding(false)} />}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => setAdding(true)} className="h-9 px-3 rounded-[6px] border border-border text-xs font-medium hover:bg-muted inline-flex items-center gap-1.5">
          <Plus className="h-3 w-3" /> Add contractor
        </button>
      </div>
      {adding && <AddContractorInline projectId={projectId} onDone={() => setAdding(false)} />}
      <div className="rounded-[10px] border border-border overflow-x-auto bg-card">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/40">
            <tr>
              <th className="px-4 py-3 text-left">Contractor</th>
              <th className="px-3 py-3 text-left">Category</th>
              <th className="px-3 py-3 text-right">Expected</th>
              <th className="px-3 py-3 text-right">Present</th>
              <th className="px-3 py-3 text-right">Absent</th>
              <th className="px-4 py-3 text-left w-48">Attendance</th>
              <th className="px-3 py-3 text-left">Last seen</th>
              <th className="px-2 py-3" />
            </tr>
          </thead>
          <tbody>
            {contractors.map((c) => {
              const rows = byContractor.get(c.id) ?? [];
              const present = rows.filter((r) => r.present).length;
              const absent = rows.filter((r) => !r.present).length;
              const pct = c.expected_days > 0 ? Math.min(100, Math.round((present / c.expected_days) * 100)) : 0;
              const lastRow = rows[0];
              const tone = pct >= 80 ? "#7a9e8a" : pct >= 60 ? "#d4882a" : "#c4685a";
              return (
                <tr key={c.id} className="border-t border-border hover:bg-muted/40 cursor-pointer" onClick={() => onRowClick(c)}>
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-3 py-3 text-muted-foreground">{c.category || "—"}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{c.expected_days}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{present}</td>
                  <td className="px-3 py-3 text-right tabular-nums" style={{ color: absent > 0 ? "#c4685a" : undefined }}>{absent}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: tone }} />
                      </div>
                      <span className="text-[11px] font-mono tabular-nums" style={{ color: tone, minWidth: 30 }}>{pct}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{lastRow?.attendance_date ?? "—"}{lastRow?.attendance_date === today ? " (today)" : ""}</td>
                  <td className="px-2 py-3">
                    <button onClick={(e) => { e.stopPropagation(); if (confirm(`Remove ${c.name}?`)) del.mutate(c.id); }} className="text-[#c4685a] hover:opacity-70">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AddContractorInline({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState(""); const [category, setCategory] = useState(""); const [days, setDays] = useState(20); const [phone, setPhone] = useState("");
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("project_contractors").insert({
        user_id: user!.id, project_id: projectId, name, category: category || null, phone: phone || null, expected_days: days,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["project_contractors", projectId] }); toast.success("Contractor added"); onDone(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  return (
    <div className="rounded-[10px] border border-border bg-card p-3 grid grid-cols-1 sm:grid-cols-5 gap-2">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name *" className={ic} />
      <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category (Civil, etc.)" className={ic} />
      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className={ic} />
      <input type="number" value={days} onChange={(e) => setDays(parseInt(e.target.value || "0", 10))} placeholder="Expected days" className={ic} />
      <div className="flex gap-1">
        <button onClick={() => add.mutate()} disabled={!name.trim() || add.isPending} className="flex-1 h-10 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60">Add</button>
        <button onClick={onDone} className="h-10 px-3 rounded-[6px] border border-border text-sm hover:bg-muted">Cancel</button>
      </div>
    </div>
  );
}

// ============================================================
// LEDGER
// ============================================================
function LedgerPanel({ contractors, attendance }: { contractors: Contractor[]; attendance: Attendance[] }) {
  const [name, setName] = useState(""); const [category, setCategory] = useState(""); const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const cMap = new Map(contractors.map((c) => [c.id, c]));
  const categories = Array.from(new Set(contractors.map((c) => c.category).filter(Boolean))) as string[];

  const filtered = attendance.filter((a) => {
    const c = cMap.get(a.contractor_id);
    if (!c) return false;
    if (name && !c.name.toLowerCase().includes(name.toLowerCase())) return false;
    if (category && c.category !== category) return false;
    if (from && a.attendance_date < from) return false;
    if (to && a.attendance_date > to) return false;
    return true;
  });

  return (
    <div className="space-y-3">
      <div className="rounded-[10px] border border-border bg-card p-3 flex flex-wrap gap-2 items-center">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Contractor name" className={`${ic} w-40`} />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${ic} w-40`}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${ic} w-40`} />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`${ic} w-40`} />
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} rows</span>
      </div>
      <div className="rounded-[10px] border border-border overflow-x-auto bg-card">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/40">
            <tr>
              <th className="px-3 py-3 text-left">Date</th>
              <th className="px-3 py-3 text-left">Contractor</th>
              <th className="px-3 py-3 text-left">Category</th>
              <th className="px-3 py-3 text-right">Workers</th>
              <th className="px-3 py-3 text-left">Tasks done</th>
              <th className="px-3 py-3 text-right">Hours</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground">No entries match.</td></tr>}
            {filtered.map((a) => {
              const c = cMap.get(a.contractor_id);
              return (
                <tr key={a.id} className="border-t border-border">
                  <td className="px-3 py-2.5 font-mono text-xs">{a.attendance_date}</td>
                  <td className="px-3 py-2.5">{c?.name}{!a.present && <span className="ml-2 text-[10px] text-[#c4685a]">ABSENT</span>}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{c?.category || "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{a.workers_count}</td>
                  <td className="px-3 py-2.5 max-w-xs truncate">{a.work_done || "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{a.hours_on_site ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// EFFICIENCY
// ============================================================
function EfficiencyPanel({ contractors, byContractor, projectStartDate }: {
  contractors: Contractor[]; byContractor: Map<string, Attendance[]>; projectStartDate: string | null;
}) {
  const start = projectStartDate ? new Date(projectStartDate) : null;
  const weeks = start ? Math.floor((Date.now() - start.getTime()) / (7 * 86400000)) : 0;
  if (weeks < 4) {
    return (
      <div className="rounded-[10px] border border-dashed border-border p-8 text-center">
        <BarChart3 className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Need at least 4 weeks of attendance data. Currently {weeks} week{weeks === 1 ? "" : "s"}.</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {contractors.map((c) => {
        const rows = byContractor.get(c.id) ?? [];
        const pct = c.expected_days > 0 ? Math.round((rows.filter((r) => r.present).length / c.expected_days) * 100) : 0;
        const totalWorkers = rows.reduce((s, r) => s + (r.workers_count || 0), 0);
        const daysWorked = rows.filter((r) => r.present).length || 1;
        const avgWorkers = (totalWorkers / daysWorked).toFixed(1);
        const dow = new Array(7).fill(0);
        for (const r of rows.filter((x) => x.present)) dow[new Date(r.attendance_date).getDay()]++;
        const bestDay = dow.indexOf(Math.max(...dow));
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const tone = pct >= 80 ? "#7a9e8a" : pct >= 60 ? "#d4882a" : "#c4685a";
        return (
          <div key={c.id} className="rounded-[12px] border border-border bg-card p-4">
            <div className="flex items-baseline justify-between gap-2 mb-3">
              <div className="font-medium">{c.name}</div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.category || "—"}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="font-display text-2xl tabular-nums" style={{ color: tone }}>{pct}%</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Attendance</div>
              </div>
              <div>
                <div className="font-display text-2xl tabular-nums">{avgWorkers}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg workers/day</div>
              </div>
              <div>
                <div className="font-display text-2xl">{days[bestDay]}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Best day</div>
              </div>
            </div>
            <div className="flex items-end gap-1 mt-4 h-12">
              {dow.map((v, i) => {
                const max = Math.max(1, ...dow);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-[3px]" style={{ height: `${(v / max) * 100}%`, background: tone, opacity: 0.8 }} />
                    <span className="text-[9px] text-muted-foreground">{days[i][0]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// MARK ATTENDANCE MODAL
// ============================================================
function MarkAttendanceModal({ projectId, projectName, projectLocation, contractors, existingToday, onClose }: {
  projectId: string; projectName: string; projectLocation: string | null;
  contractors: Contractor[]; existingToday: Attendance[]; onClose: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const existing = new Map(existingToday.map((a) => [a.contractor_id, a]));

  type Row = { contractorId: string; present: boolean; workers: string; work: string; hours: string };
  const [rows, setRows] = useState<Row[]>(() =>
    contractors.map((c) => {
      const e = existing.get(c.id);
      return {
        contractorId: c.id,
        present: e?.present ?? true,
        workers: e?.workers_count != null ? String(e.workers_count) : "",
        work: e?.work_done ?? "",
        hours: e?.hours_on_site != null ? String(e.hours_on_site) : "",
      };
    }),
  );
  // Stage of newly added contractors so they appear in form immediately
  const [extra, setExtra] = useState<Contractor[]>([]);
  const [newName, setNewName] = useState(""); const [newCat, setNewCat] = useState("");

  const addContractor = useMutation({
    mutationFn: async () => {
      const trimmed = newName.trim();
      if (!trimmed) throw new Error("Name required");
      const { data, error } = await supabase.from("project_contractors").insert({
        user_id: user!.id, project_id: projectId, name: trimmed, category: newCat.trim() || null, expected_days: 20,
      }).select("*").single();
      if (error) throw error;
      return data as Contractor;
    },
    onSuccess: (c) => {
      setExtra((x) => [...x, c]);
      setRows((r) => [...r, { contractorId: c.id, present: true, workers: "", work: "", hours: "" }]);
      setNewName(""); setNewCat("");
      qc.invalidateQueries({ queryKey: ["project_contractors", projectId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const submit = useMutation({
    mutationFn: async () => {
      const payload = rows.map((r) => ({
        user_id: user!.id, project_id: projectId, contractor_id: r.contractorId,
        attendance_date: today,
        present: r.present,
        workers_count: r.present ? (parseInt(r.workers, 10) || 0) : 0,
        work_done: r.work.trim() || null,
        hours_on_site: r.present && r.hours.trim() !== "" ? Number(r.hours) : null,
      }));
      if (payload.length === 0) return;
      const { error } = await supabase.from("site_attendance").upsert(payload, { onConflict: "contractor_id,attendance_date" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["site_attendance", projectId] });
      toast.success("Attendance saved");
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  // Dedupe in case the refetched contractors list now includes the staged extras
  const seenIds = new Set<string>();
  const all = [...contractors, ...extra].filter((c) => (seenIds.has(c.id) ? false : (seenIds.add(c.id), true)));

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-card rounded-t-[20px] sm:rounded-[16px] w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl">Mark Attendance</h2>
            <p className="text-[11px] text-muted-foreground">{today} · {projectName}{projectLocation ? ` · ${projectLocation}` : ""}</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 overflow-y-auto space-y-3 flex-1">
          {all.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No contractors yet — add one below.</p>}
          {all.map((c, idx) => {
            const r = rows[idx]; if (!r) return null;
            return (
              <div key={c.id} className="rounded-[10px] border border-border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{c.name}</div>
                    <div className="text-[11px] text-muted-foreground">{c.category || "—"}</div>
                  </div>
                  <div className="inline-flex rounded-[6px] border border-border overflow-hidden">
                    <button onClick={() => setRows((rs) => rs.map((x, i) => i === idx ? { ...x, present: true } : x))}
                      className={`px-3 py-1.5 text-xs font-medium ${r.present ? "bg-[#7a9e8a]/20 text-[#3d6f5a]" : "text-muted-foreground"}`}>Present</button>
                    <button onClick={() => setRows((rs) => rs.map((x, i) => i === idx ? { ...x, present: false } : x))}
                      className={`px-3 py-1.5 text-xs font-medium ${!r.present ? "bg-[#c4685a]/20 text-[#c4685a]" : "text-muted-foreground"}`}>Absent</button>
                  </div>
                </div>
                {r.present && (
                  <div className="grid grid-cols-3 gap-2">
                    <input type="number" min={0} value={r.workers} onChange={(e) => setRows((rs) => rs.map((x, i) => i === idx ? { ...x, workers: parseInt(e.target.value || "0", 10) } : x))}
                      placeholder="Workers" className={ic} />
                    <input value={r.work} onChange={(e) => setRows((rs) => rs.map((x, i) => i === idx ? { ...x, work: e.target.value } : x))}
                      placeholder="Work done today" className={`${ic} col-span-2`} />
                  </div>
                )}
              </div>
            );
          })}
          <div className="rounded-[10px] border border-dashed border-border p-3 space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Add contractor on the spot</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" className={ic} />
              <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Category" className={ic} />
              <button onClick={() => addContractor.mutate()} disabled={!newName.trim() || addContractor.isPending}
                className="h-10 rounded-[6px] border border-border text-sm font-medium hover:bg-muted disabled:opacity-60 inline-flex items-center justify-center gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="h-10 px-4 rounded-[6px] border border-border text-sm font-medium hover:bg-muted">Cancel</button>
          <button onClick={() => submit.mutate()} disabled={all.length === 0 || submit.isPending}
            className="h-10 px-5 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95 inline-flex items-center gap-2 disabled:opacity-60">
            {submit.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save Attendance
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// HISTORY (Calendar)
// ============================================================
function ContractorHistoryModal({ contractor, attendance, projectStartDate, onClose }: {
  contractor: Contractor; attendance: Attendance[]; projectStartDate: string | null; onClose: () => void;
}) {
  const map = new Map(attendance.map((a) => [a.attendance_date, a]));
  const start = projectStartDate ? new Date(projectStartDate) : new Date(Date.now() - 60 * 86400000);
  const end = new Date();
  // Build months from start to today
  const months: { y: number; m: number }[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur <= end) { months.push({ y: cur.getFullYear(), m: cur.getMonth() }); cur.setMonth(cur.getMonth() + 1); }

  const present = attendance.filter((a) => a.present).length;
  const absent = attendance.filter((a) => !a.present).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-card rounded-t-[20px] sm:rounded-[16px] w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl">{contractor.name}</h2>
            <p className="text-[11px] text-muted-foreground">{contractor.category || "—"} · {present} present · {absent} absent</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {months.map(({ y, m }) => {
            const first = new Date(y, m, 1);
            const dim = new Date(y, m + 1, 0).getDate();
            const pad = first.getDay();
            const cells: (number | null)[] = [...Array(pad).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)];
            return (
              <div key={`${y}-${m}`}>
                <div className="font-medium text-sm mb-2">{first.toLocaleDateString("en", { month: "long", year: "numeric" })}</div>
                <div className="grid grid-cols-7 gap-1">
                  {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} className="text-[10px] text-center text-muted-foreground">{d}</div>)}
                  {cells.map((day, i) => {
                    if (day == null) return <div key={i} />;
                    const ds = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const a = map.get(ds);
                    let bg = "transparent"; let color = "var(--muted-foreground)";
                    if (a?.present) { bg = "#7a9e8a"; color = "white"; }
                    else if (a && !a.present) { bg = "#c4685a"; color = "white"; }
                    return <div key={i} className="h-8 rounded-[6px] flex items-center justify-center text-[11px] font-mono" style={{ background: bg, color }}>{day}</div>;
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="px-5 py-3 border-t border-border flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-[3px]" style={{ background: "#7a9e8a" }} /> Present</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-[3px]" style={{ background: "#c4685a" }} /> Absent</span>
        </div>
      </div>
    </div>
  );
}

const ic = "h-10 px-3 rounded-[8px] bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring/30";
