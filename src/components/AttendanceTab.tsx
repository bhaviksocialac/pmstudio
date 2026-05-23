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
// MARK ATTENDANCE MODAL — Trade × Worker-Type grid
// ============================================================
const DEFAULT_TRADES = ["Civil", "Carpentry", "Electrical", "Plumbing", "Flooring", "Painting", "HVAC", "Other"];
const DEFAULT_WORKER_TYPES = ["Labour", "Worker", "Supervisor", "Helper", "Wireman", "Foreman", "Technician", "Electrician", "Contractor"];

type TradeEntry = {
  trade: string;
  contractor: string;
  open: boolean;
  types: { name: string; count: number }[];
};

function memKey(projectId: string) { return `att_mem_${projectId}`; }
function readMem(projectId: string): { trades: string[]; typesByTrade: Record<string, string[]> } {
  try {
    const raw = localStorage.getItem(memKey(projectId));
    if (!raw) return { trades: [], typesByTrade: {} };
    return JSON.parse(raw);
  } catch { return { trades: [], typesByTrade: {} }; }
}
function writeMem(projectId: string, data: { trades: string[]; typesByTrade: Record<string, string[]> }) {
  try { localStorage.setItem(memKey(projectId), JSON.stringify(data)); } catch {}
}

function decodeBreakdown(workDone: string | null): { types: { name: string; count: number }[]; contractor: string; notes: string } | null {
  if (!workDone || !workDone.startsWith("MB:")) return null;
  try { return JSON.parse(workDone.slice(3)); } catch { return null; }
}

function MarkAttendanceModal({ projectId, projectName, projectLocation, contractors, existingToday, onClose }: {
  projectId: string; projectName: string; projectLocation: string | null;
  contractors: Contractor[]; existingToday: Attendance[]; onClose: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const mem = useMemo(() => readMem(projectId), [projectId]);

  // Seed from today's existing rows if any, else from memory, else default trades
  const seed: TradeEntry[] = useMemo(() => {
    if (existingToday.length > 0) {
      const map = new Map<string, TradeEntry>();
      for (const a of existingToday) {
        const bd = decodeBreakdown(a.work_done);
        if (!bd) continue;
        const c = contractors.find((x) => x.id === a.contractor_id);
        const trade = c?.category || "Other";
        const existing = map.get(trade);
        const types = bd.types?.length ? bd.types : [{ name: "Worker", count: a.workers_count || 0 }];
        if (existing) {
          for (const t of types) {
            const ex = existing.types.find((y) => y.name === t.name);
            if (ex) ex.count += t.count; else existing.types.push({ ...t });
          }
        } else {
          map.set(trade, { trade, contractor: bd.contractor || "", open: true, types });
        }
      }
      if (map.size > 0) return Array.from(map.values());
    }
    const trades = mem.trades.length ? mem.trades : DEFAULT_TRADES.slice(0, 4);
    return trades.map((trade) => ({
      trade,
      contractor: "",
      open: false,
      types: (mem.typesByTrade[trade] && mem.typesByTrade[trade].length
        ? mem.typesByTrade[trade]
        : ["Labour", "Supervisor"]
      ).map((name) => ({ name, count: 0 })),
    }));
  }, [existingToday, contractors, mem]);

  const [entries, setEntries] = useState<TradeEntry[]>(seed);
  const [notes, setNotes] = useState<string>(() => {
    const first = existingToday.find((a) => decodeBreakdown(a.work_done)?.notes);
    return first ? (decodeBreakdown(first.work_done)?.notes || "") : "";
  });
  const [addingTrade, setAddingTrade] = useState(false);
  const [newTrade, setNewTrade] = useState("");

  const updateEntry = (i: number, patch: Partial<TradeEntry>) =>
    setEntries((es) => es.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  const updateCount = (i: number, ti: number, delta: number | null, abs?: number) =>
    setEntries((es) => es.map((e, idx) => {
      if (idx !== i) return e;
      const types = e.types.map((t, j) => j === ti
        ? { ...t, count: Math.max(0, abs != null ? abs : t.count + (delta || 0)) }
        : t);
      return { ...e, types };
    }));
  const addType = (i: number, name: string) => {
    const trimmed = name.trim(); if (!trimmed) return;
    setEntries((es) => es.map((e, idx) => idx === i
      ? (e.types.some((t) => t.name.toLowerCase() === trimmed.toLowerCase()) ? e : { ...e, types: [...e.types, { name: trimmed, count: 1 }] })
      : e));
  };
  const removeType = (i: number, ti: number) =>
    setEntries((es) => es.map((e, idx) => idx === i ? { ...e, types: e.types.filter((_, j) => j !== ti) } : e));
  const addTrade = (name: string) => {
    const trimmed = name.trim(); if (!trimmed) return;
    setEntries((es) => es.some((e) => e.trade.toLowerCase() === trimmed.toLowerCase())
      ? es
      : [...es, { trade: trimmed, contractor: "", open: true, types: [{ name: "Worker", count: 0 }] }]);
    setNewTrade(""); setAddingTrade(false);
  };
  const removeTrade = (i: number) => setEntries((es) => es.filter((_, idx) => idx !== i));

  const tradeTotal = (e: TradeEntry) => e.types.reduce((s, t) => s + (t.count || 0), 0);
  const grandTotal = entries.reduce((s, e) => s + tradeTotal(e), 0);
  const activeTrades = entries.filter((e) => tradeTotal(e) > 0);

  const sameAsYesterday = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("site_attendance").select("*")
        .eq("project_id", projectId).lt("attendance_date", today)
        .order("attendance_date", { ascending: false }).limit(50);
      if (error) throw error;
      const rows = (data ?? []) as Attendance[];
      if (rows.length === 0) throw new Error("No previous attendance found");
      const lastDate = rows[0].attendance_date;
      const last = rows.filter((r) => r.attendance_date === lastDate && r.present);
      const map = new Map<string, TradeEntry>();
      for (const a of last) {
        const bd = decodeBreakdown(a.work_done);
        const c = contractors.find((x) => x.id === a.contractor_id);
        const trade = c?.category || "Other";
        const types = bd?.types?.length ? bd.types : [{ name: "Worker", count: a.workers_count || 0 }];
        const ex = map.get(trade);
        if (ex) {
          for (const t of types) {
            const found = ex.types.find((y) => y.name === t.name);
            if (found) found.count += t.count; else ex.types.push({ ...t });
          }
        } else {
          map.set(trade, { trade, contractor: bd?.contractor || "", open: true, types: types.map((t) => ({ ...t })) });
        }
      }
      return { date: lastDate, entries: Array.from(map.values()) };
    },
    onSuccess: (res) => {
      setEntries(res.entries);
      toast.success(`Pre-filled from ${res.date}`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (activeTrades.length === 0) throw new Error("Enter at least one worker count");
      // Resolve / create a contractor per active trade
      const payloads: Array<Record<string, unknown>> = [];
      let tradeCount = 0;
      for (const e of activeTrades) {
        tradeCount++;
        const desired = (e.contractor.trim() || e.trade).trim();
        let contractor = contractors.find(
          (c) => (c.category || "").toLowerCase() === e.trade.toLowerCase() && c.name.toLowerCase() === desired.toLowerCase(),
        );
        if (!contractor) {
          const { data, error } = await supabase.from("project_contractors").insert({
            user_id: user!.id, project_id: projectId, name: desired, category: e.trade, expected_days: 20,
          }).select("*").single();
          if (error) throw error;
          contractor = data as Contractor;
        }
        const total = tradeTotal(e);
        const work = `MB:${JSON.stringify({
          types: e.types.filter((t) => t.count > 0),
          contractor: e.contractor.trim(),
          notes: notes.trim(),
        })}`;
        payloads.push({
          user_id: user!.id, project_id: projectId, contractor_id: contractor.id,
          attendance_date: today, present: true, workers_count: total,
          work_done: work,
        });
      }
      const { error } = await supabase.from("site_attendance").upsert(payloads, { onConflict: "contractor_id,attendance_date" });
      if (error) throw error;
      // Persist memory
      const newMem = {
        trades: Array.from(new Set([...entries.map((e) => e.trade), ...mem.trades])).slice(0, 20),
        typesByTrade: { ...mem.typesByTrade } as Record<string, string[]>,
      };
      for (const e of entries) {
        newMem.typesByTrade[e.trade] = Array.from(new Set([
          ...e.types.map((t) => t.name),
          ...(mem.typesByTrade[e.trade] || []),
        ])).slice(0, 12);
      }
      writeMem(projectId, newMem);
      return { workers: grandTotal, trades: tradeCount };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["site_attendance", projectId] });
      qc.invalidateQueries({ queryKey: ["project_contractors", projectId] });
      toast.success(`Attendance saved — ${res.workers} workers across ${res.trades} trade${res.trades === 1 ? "" : "s"}`);
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-card rounded-t-[20px] sm:rounded-[16px] w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-2xl">Mark Attendance</h2>
            <p className="text-[11px] text-muted-foreground truncate">{today} · {projectName}{projectLocation ? ` · ${projectLocation}` : ""}</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>

        {/* Sticky summary bar */}
        <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total workers today</div>
            <div className="font-display text-2xl tabular-nums">{grandTotal}</div>
          </div>
          <div className="flex-1 min-w-0 text-[11px] text-muted-foreground">
            {activeTrades.length === 0
              ? <span className="italic">No counts entered yet</span>
              : activeTrades.map((e) => `${e.trade}: ${tradeTotal(e)}`).join(" · ")}
          </div>
          <button onClick={() => sameAsYesterday.mutate()} disabled={sameAsYesterday.isPending}
            className="h-8 px-3 rounded-[6px] border border-border text-[11px] font-medium hover:bg-muted inline-flex items-center gap-1.5 disabled:opacity-60">
            {sameAsYesterday.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CalendarIcon className="h-3 w-3" />} Same as yesterday
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-3 flex-1">
          {entries.map((e, i) => {
            const total = tradeTotal(e);
            return (
              <div key={`${e.trade}-${i}`} className="rounded-[10px] border border-border overflow-hidden">
                <button
                  onClick={() => updateEntry(i, { open: !e.open })}
                  className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-muted/40"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-mono text-muted-foreground">{e.open ? "▼" : "▶"}</span>
                    <span className="font-medium text-sm uppercase tracking-wide">{e.trade}</span>
                    {total > 0 && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#7a9e8a]/20 text-[#3d6f5a] font-medium tabular-nums">
                        {total} worker{total === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                  <button onClick={(ev) => { ev.stopPropagation(); removeTrade(i); }} className="text-muted-foreground hover:text-[#c4685a]">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </button>

                {e.open && (
                  <div className="p-3 pt-2 space-y-2 border-t border-border bg-muted/10">
                    <input
                      value={e.contractor}
                      onChange={(ev) => updateEntry(i, { contractor: ev.target.value })}
                      placeholder="Contractor name (optional)"
                      className={`${ic} w-full`}
                    />
                    {e.types.map((t, ti) => (
                      <div key={`${t.name}-${ti}`} className="flex items-center gap-2">
                        <div className="flex-1 text-sm">{t.name}</div>
                        <div className="inline-flex items-center rounded-[6px] border border-border overflow-hidden">
                          <button onClick={() => updateCount(i, ti, -1)} className="h-9 w-9 hover:bg-muted text-base font-medium">−</button>
                          <input
                            type="number" min={0} inputMode="numeric"
                            value={t.count || ""}
                            onChange={(ev) => updateCount(i, ti, null, parseInt(ev.target.value || "0", 10))}
                            className="h-9 w-14 text-center bg-transparent border-x border-border tabular-nums text-sm focus:outline-none"
                          />
                          <button onClick={() => updateCount(i, ti, 1)} className="h-9 w-9 hover:bg-muted text-base font-medium">+</button>
                        </div>
                        <button onClick={() => removeType(i, ti)} className="text-muted-foreground hover:text-[#c4685a]" aria-label="Remove worker type">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    <AddWorkerTypeInline
                      existing={e.types.map((t) => t.name)}
                      suggestions={[...(mem.typesByTrade[e.trade] || []), ...DEFAULT_WORKER_TYPES]}
                      onAdd={(name) => addType(i, name)}
                    />
                  </div>
                )}
              </div>
            );
          })}

          {addingTrade ? (
            <div className="rounded-[10px] border border-dashed border-border p-3 space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Add trade category</div>
              <div className="flex flex-wrap gap-1.5">
                {DEFAULT_TRADES.filter((t) => !entries.some((e) => e.trade.toLowerCase() === t.toLowerCase())).map((t) => (
                  <button key={t} onClick={() => addTrade(t)} className="h-8 px-3 rounded-[6px] border border-border text-xs hover:bg-muted">{t}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={newTrade} onChange={(ev) => setNewTrade(ev.target.value)}
                  placeholder="Custom trade name" className={`${ic} flex-1`}
                  onKeyDown={(ev) => { if (ev.key === "Enter") addTrade(newTrade); }} />
                <button onClick={() => addTrade(newTrade)} disabled={!newTrade.trim()}
                  className="h-10 px-4 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60">Add</button>
                <button onClick={() => { setAddingTrade(false); setNewTrade(""); }}
                  className="h-10 px-3 rounded-[6px] border border-border text-sm hover:bg-muted">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingTrade(true)}
              className="w-full h-11 rounded-[10px] border border-dashed border-border text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground inline-flex items-center justify-center gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add trade category
            </button>
          )}

          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder="Civil team started late today…"
              className={`${ic} w-full mt-1 py-2 h-auto`} />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="h-10 px-4 rounded-[6px] border border-border text-sm font-medium hover:bg-muted">Cancel</button>
          <button onClick={() => submit.mutate()} disabled={grandTotal === 0 || submit.isPending}
            className="h-10 px-5 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95 inline-flex items-center gap-2 disabled:opacity-60">
            {submit.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save Attendance
          </button>
        </div>
      </div>
    </div>
  );
}

function AddWorkerTypeInline({ existing, suggestions, onAdd }: { existing: string[]; suggestions: string[]; onAdd: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  const lowered = new Set(existing.map((s) => s.toLowerCase()));
  const filtered = Array.from(new Set(suggestions)).filter((s) => !lowered.has(s.toLowerCase())).slice(0, 8);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="text-[11px] text-[#c17f5a] hover:underline inline-flex items-center gap-1">
        <Plus className="h-3 w-3" /> Add worker type
      </button>
    );
  }
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1">
        {filtered.map((s) => (
          <button key={s} onClick={() => { onAdd(s); setOpen(false); }}
            className="h-7 px-2 rounded-[6px] border border-border text-[11px] hover:bg-muted">{s}</button>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input value={val} onChange={(e) => setVal(e.target.value)} placeholder="Custom type"
          className={`${ic} flex-1 h-9`}
          onKeyDown={(e) => { if (e.key === "Enter" && val.trim()) { onAdd(val); setVal(""); setOpen(false); } }} />
        <button onClick={() => { if (val.trim()) { onAdd(val); setVal(""); setOpen(false); } }}
          className="h-9 px-3 rounded-[6px] bg-primary text-primary-foreground text-xs font-medium">Add</button>
        <button onClick={() => { setOpen(false); setVal(""); }}
          className="h-9 px-2 rounded-[6px] border border-border text-xs hover:bg-muted">Cancel</button>
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
