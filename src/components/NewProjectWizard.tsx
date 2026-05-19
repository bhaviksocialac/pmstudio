import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useServerFn } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import {
  X, Loader2, ChevronRight, ChevronLeft, Check, Share2, Send, Sparkles, Upload, Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  PHASES,
  computePhaseSchedule,
  DEFAULT_BUDGET_BREAKDOWN,
  type Phase,
} from "@/lib/db-types";
import { parseBoq } from "@/lib/boq.functions";

const PROPERTY_TYPES = [
  { value: "residential_apartment", label: "Residential Apartment" },
  { value: "independent_villa", label: "Independent Villa" },
  { value: "penthouse", label: "Penthouse" },
  { value: "commercial_office", label: "Commercial Office" },
  { value: "retail_shop", label: "Retail Shop" },
  { value: "restaurant", label: "Restaurant" },
  { value: "hotel_room", label: "Hotel Room" },
  { value: "other", label: "Other" },
] as const;

const PROPERTY_VALUES = PROPERTY_TYPES.map((p) => p.value) as readonly string[];

function labelForType(value: string) {
  return PROPERTY_TYPES.find((p) => p.value === value)?.label
    ?? (value === "residential" ? "Residential Apartment" : value === "commercial" ? "Commercial Office" : "Other");
}

const getBasicsSchema = () =>
  z.object({
    name: z.string().trim().min(1, "Name is required").max(120),
    location: z.string().trim().max(200).optional(),
    phase: z.enum(PHASES),
    budget: z.coerce.number().min(0).max(100000),
    type: z.string().refine((v) => PROPERTY_VALUES.includes(v), "Invalid property type"),
    start_date: z.string().min(1, "Start date is required"),
    client_name: z.string().trim().max(120).optional(),
    client_email: z.string().trim().email().optional().or(z.literal("")),
  });

type Step = 1 | 2 | 3 | 4;

interface Basics {
  name: string;
  location: string;
  phase: Phase;
  budget: string;
  type: string;
  start_date: string;
  client_name: string;
  client_email: string;
}

interface BudgetRow {
  category: string;
  percentage: number;
  amount: number;
}

export function NewProjectWizard({
  onClose,
  editProjectId,
}: {
  onClose: () => void;
  editProjectId?: string;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const isEdit = Boolean(editProjectId);
  const [step, setStep] = useState<Step>(1);

  const [basics, setBasics] = useState<Basics>({
    name: "",
    location: "",
    phase: "Survey",
    budget: "",
    type: "residential_apartment",
    start_date: new Date().toISOString().slice(0, 10),
    client_name: "",
    client_email: "",
  });

  const [roomsText, setRoomsText] = useState("Living Room, Master Bedroom, Kitchen, Bathrooms");
  const [budgetRows, setBudgetRows] = useState<BudgetRow[]>(
    DEFAULT_BUDGET_BREAKDOWN.map((b) => ({ ...b, amount: 0 })),
  );
  const [boqUsed, setBoqUsed] = useState(false);
  const [parsingBoq, setParsingBoq] = useState(false);
  const [boqFileName, setBoqFileName] = useState<string | null>(null);
  const parseBoqFn = useServerFn(parseBoq);

  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [welcomeMessageId, setWelcomeMessageId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Load existing project data for edit mode
  const editLoad = useQuery({
    queryKey: ["edit-project", editProjectId],
    enabled: !!editProjectId,
    queryFn: async () => {
      const [p, b, r] = await Promise.all([
        supabase.from("projects").select("*").eq("id", editProjectId!).maybeSingle(),
        supabase.from("budget_lines").select("*").eq("project_id", editProjectId!).order("order_index"),
        supabase.from("project_rooms").select("*").eq("project_id", editProjectId!).order("order_index"),
      ]);
      if (p.error) throw p.error;
      if (b.error) throw b.error;
      if (r.error) throw r.error;
      return { project: p.data, budget: b.data ?? [], rooms: r.data ?? [] };
    },
  });

  useEffect(() => {
    if (!editLoad.data?.project) return;
    const p = editLoad.data.project;
    setBasics({
      name: p.name ?? "",
      location: p.location ?? "",
      phase: (p.phase as Phase) ?? "Survey",
      budget: String(p.budget ?? ""),
      type: PROPERTY_VALUES.includes(p.type) ? p.type : "residential_apartment",
      start_date: p.start_date ?? new Date().toISOString().slice(0, 10),
      client_name: "",
      client_email: "",
    });
    if (editLoad.data.budget.length) {
      setBudgetRows(
        editLoad.data.budget.map((b) => ({
          category: b.category,
          percentage: Number(b.percentage),
          amount: Number(b.amount),
        })),
      );
    }
    if (editLoad.data.rooms.length) {
      setRoomsText(editLoad.data.rooms.map((r) => r.name).join(", "));
    }
  }, [editLoad.data]);

  const budgetTotal = Number(basics.budget) || 0;

  const syncBudgetFromTotal = (total: number) => {
    setBudgetRows((rows) => rows.map((r) => ({ ...r, amount: +(total * r.percentage / 100).toFixed(2) })));
  };

  const portalLink = useMemo(
    () => (createdProjectId ? `${window.location.origin}/portal/${createdProjectId}` : ""),
    [createdProjectId],
  );

  const handleBoqUpload = async (file: File) => {
    setParsingBoq(true);
    setBoqFileName(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const fileBase64 = btoa(binary);

      const result = await parseBoqFn({
        data: { fileBase64, filename: file.name, mime: file.type || "application/octet-stream" },
      });

      if (result.total_budget_lakhs > 0) {
        setBasics((b) => ({ ...b, budget: String(result.total_budget_lakhs) }));
      }
      if (result.breakdown.length > 0) {
        const total = result.total_budget_lakhs || result.breakdown.reduce((s, r) => s + r.amount, 0);
        setBudgetRows(
          result.breakdown.map((r) => ({
            category: r.category,
            percentage: r.percentage,
            amount: r.amount > 0 ? r.amount : +(total * (r.percentage / 100)).toFixed(2),
          })),
        );
        setBoqUsed(true);
      }
      if (result.rooms.length > 0) {
        setRoomsText(result.rooms.join(", "));
      }
      toast.success("BOQ parsed successfully");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to parse BOQ");
    } finally {
      setParsingBoq(false);
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      const parsed = getBasicsSchema().parse(basics);
      const roomNames = roomsText.split(",").map((s) => s.trim()).filter(Boolean);

      if (isEdit && editProjectId) {
        // Update path
        const { error: uErr } = await supabase
          .from("projects")
          .update({
            name: parsed.name,
            location: parsed.location || null,
            phase: parsed.phase,
            budget: parsed.budget,
            type: parsed.type,
            start_date: parsed.start_date,
          })
          .eq("id", editProjectId);
        if (uErr) throw uErr;

        // Replace budget lines
        await supabase.from("budget_lines").delete().eq("project_id", editProjectId);
        if (budgetRows.length) {
          const { error: bErr } = await supabase.from("budget_lines").insert(
            budgetRows.map((r, i) => ({
              user_id: user!.id,
              project_id: editProjectId,
              category: r.category,
              percentage: r.percentage,
              amount: r.amount,
              order_index: i,
            })),
          );
          if (bErr) throw bErr;
        }

        // Replace rooms (and their scope items)
        await supabase.from("room_scope_items").delete().eq("project_id", editProjectId);
        await supabase.from("project_rooms").delete().eq("project_id", editProjectId);
        if (roomNames.length) {
          const { error: rErr } = await supabase.from("project_rooms").insert(
            roomNames.map((n, i) => ({
              user_id: user!.id,
              project_id: editProjectId,
              name: n,
              order_index: i,
            })),
          );
          if (rErr) throw rErr;
        }
        return { projectId: editProjectId, draft: "", msgId: null as string | null, edited: true };
      }

      // Create path
      const startDate = new Date(parsed.start_date);
      const schedule = computePhaseSchedule(startDate);
      const handover = schedule[schedule.length - 1].end;

      const { data: project, error: pErr } = await supabase
        .from("projects")
        .insert({
          user_id: user!.id,
          name: parsed.name,
          location: parsed.location || null,
          phase: parsed.phase,
          budget: parsed.budget,
          type: parsed.type,
          start_date: parsed.start_date,
          expected_handover: handover.toISOString().slice(0, 10),
        })
        .select()
        .single();
      if (pErr) throw pErr;
      const projectId = project.id;

      const { error: phErr } = await supabase.from("project_phases").insert(
        schedule.map((s, i) => ({
          user_id: user!.id,
          project_id: projectId,
          phase: s.phase,
          order_index: i,
          start_date: s.start.toISOString().slice(0, 10),
          end_date: s.end.toISOString().slice(0, 10),
          status: i === 0 ? "active" : "planned",
        })),
      );
      if (phErr) throw phErr;

      if (budgetRows.length) {
        const { error: bErr } = await supabase.from("budget_lines").insert(
          budgetRows.map((r, i) => ({
            user_id: user!.id,
            project_id: projectId,
            category: r.category,
            percentage: r.percentage,
            amount: r.amount,
            order_index: i,
          })),
        );
        if (bErr) throw bErr;
      }

      if (roomNames.length) {
        const { error: rErr } = await supabase.from("project_rooms").insert(
          roomNames.map((n, i) => ({
            user_id: user!.id,
            project_id: projectId,
            name: n,
            order_index: i,
          })),
        );
        if (rErr) throw rErr;
      }

      let clientId: string | null = null;
      const clientName = parsed.client_name?.trim();
      const clientEmail = parsed.client_email?.trim();
      if (clientName) {
        const { data: client, error: cErr } = await supabase
          .from("clients")
          .insert({ user_id: user!.id, name: clientName, email: clientEmail || null })
          .select()
          .single();
        if (cErr) throw cErr;
        clientId = client.id;
        await supabase.from("projects").update({ client_id: clientId }).eq("id", projectId);
      }

      const portal = `${window.location.origin}/portal/${projectId}`;
      const draft = `Hi ${clientName || "there"}, your project ${parsed.name} is now set up on PMStudio. You can track progress, approve designs, and view updates anytime at ${portal}.`;
      let msgId: string | null = null;
      if (clientId) {
        const { data: msg } = await supabase
          .from("messages")
          .insert({
            user_id: user!.id,
            thread_with: clientId,
            kind: "client",
            from_me: true,
            body: draft,
            sent_at: new Date().toISOString(),
          })
          .select()
          .single();
        msgId = msg?.id ?? null;
      }

      return { projectId, draft, msgId, edited: false };
    },
    onSuccess: ({ projectId, draft, msgId, edited }) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      if (edited) {
        toast.success("Project updated");
        onClose();
        return;
      }
      setCreatedProjectId(projectId);
      setWelcomeMessage(draft);
      setWelcomeMessageId(msgId);
      setStep(4);
    },
    onError: (e) => {
      toast.error(e instanceof z.ZodError ? e.issues[0].message : e instanceof Error ? e.message : "Failed");
    },
  });

  const deleteProject = useMutation({
    mutationFn: async () => {
      if (!editProjectId) return;
      // Cascade delete dependent tables
      const tables = [
        "tasks", "project_phases", "budget_lines", "room_scope_items",
        "project_rooms", "photos", "invoices", "vendor_deliveries",
        "payment_requests", "approvals",
      ] as const;
      for (const t of tables) {
        await supabase.from(t).delete().eq("project_id", editProjectId);
      }
      const { error } = await supabase.from("projects").delete().eq("id", editProjectId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project deleted");
      onClose();
      navigate({ to: "/projects" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to delete"),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="absolute right-0 top-0 bottom-0 w-full max-w-xl bg-card flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-border flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="font-display text-2xl">
              {step === 4 ? "Project Created" : isEdit ? "Edit Project" : "New Project"}
            </h3>
            {step !== 4 && (
              <div className="flex gap-1.5 mt-2">
                {[1, 2, 3].map((n) => (
                  <span
                    key={n}
                    className="h-1 w-10 rounded-full"
                    style={{ background: step >= (n as Step) ? "#c17f5a" : "var(--muted, #eee)" }}
                  />
                ))}
              </div>
            )}
          </div>
          <button onClick={onClose} className="h-9 w-9 rounded-[10px] hover:bg-muted flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {step === 1 && <BasicsStep basics={basics} setBasics={setBasics} onTotalChange={syncBudgetFromTotal} />}
          {step === 2 && (
            <ScopeStep
              roomsText={roomsText}
              setRoomsText={setRoomsText}
              onUpload={handleBoqUpload}
              parsing={parsingBoq}
              boqFileName={boqFileName}
              boqUsed={boqUsed}
              clearBoq={() => {
                setBoqUsed(false);
                setBoqFileName(null);
              }}
            />
          )}
          {step === 3 && <BudgetStep total={budgetTotal} rows={budgetRows} setRows={setBudgetRows} boqUsed={boqUsed} />}
          {step === 4 && createdProjectId && (
            <SuccessStep
              portalLink={portalLink}
              welcomeMessage={welcomeMessage}
              setWelcomeMessage={setWelcomeMessage}
              welcomeMessageId={welcomeMessageId}
              onView={() => {
                navigate({ to: "/projects/$projectId", params: { projectId: createdProjectId } });
                onClose();
              }}
            />
          )}
        </div>

        {step !== 4 && (
          <div className="px-6 py-4 border-t border-border flex flex-col gap-3 flex-shrink-0">
            <div className="flex justify-between gap-2">
              {step > 1 ? (
                <button
                  onClick={() => setStep((s) => (s - 1) as Step)}
                  className="h-10 px-4 rounded-[6px] border border-border text-sm font-medium hover:bg-muted inline-flex items-center gap-1.5"
                >
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
              ) : <span />}
              {step < 3 ? (
                <button
                  onClick={() => {
                    if (step === 1) {
                      const r = getBasicsSchema().safeParse(basics);
                      if (!r.success) { toast.error(r.error.issues[0].message); return; }
                      if (!boqUsed) syncBudgetFromTotal(Number(basics.budget) || 0);
                    }
                    setStep((s) => (s + 1) as Step);
                  }}
                  className="h-10 px-5 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95 inline-flex items-center gap-1.5"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={() => save.mutate()}
                  disabled={save.isPending}
                  className="h-10 px-5 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95 inline-flex items-center gap-2 disabled:opacity-60"
                >
                  {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isEdit ? "Save Changes" : "Create Project"}
                </button>
              )}
            </div>

            {isEdit && (
              <div className="border-t border-border pt-3">
                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="w-full h-10 px-4 rounded-[6px] border border-[#c4685a]/40 text-[#c4685a] text-sm font-medium hover:bg-[#c4685a]/10 inline-flex items-center justify-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" /> Delete Project
                  </button>
                ) : (
                  <div className="rounded-[10px] border border-[#c4685a]/40 bg-[#c4685a]/5 p-3 space-y-2">
                    <p className="text-sm font-medium">Are you sure? This cannot be undone.</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="flex-1 h-9 rounded-[6px] border border-border text-sm font-medium hover:bg-muted"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => deleteProject.mutate()}
                        disabled={deleteProject.isPending}
                        className="flex-1 h-9 rounded-[6px] bg-[#c4685a] text-white text-sm font-medium hover:brightness-95 inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
                      >
                        {deleteProject.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        Yes, Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Step 1: Basics ---------------- */
function BasicsStep({
  basics,
  setBasics,
  onTotalChange,
}: {
  basics: Basics;
  setBasics: (b: Basics) => void;
  onTotalChange: (t: number) => void;
}) {
  return (
    <div className="space-y-4">
      <Field label="Project name" required>
        <input className={inputCls} value={basics.name} onChange={(e) => setBasics({ ...basics, name: e.target.value })} placeholder="Banyan House" />
      </Field>
      <Field label="Location">
        <input className={inputCls} value={basics.location} onChange={(e) => setBasics({ ...basics, location: e.target.value })} placeholder="Bandra, Mumbai" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phase">
          <select className={inputCls} value={basics.phase} onChange={(e) => setBasics({ ...basics, phase: e.target.value as Phase })}>
            {PHASES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Property type">
          <select className={inputCls} value={basics.type} onChange={(e) => setBasics({ ...basics, type: e.target.value })}>
            {PROPERTY_TYPES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start date" required>
          <input type="date" className={inputCls} value={basics.start_date} onChange={(e) => setBasics({ ...basics, start_date: e.target.value })} />
        </Field>
        <Field label="Budget (in lakhs)">
          <input
            type="number"
            className={inputCls}
            value={basics.budget}
            onChange={(e) => {
              setBasics({ ...basics, budget: e.target.value });
              onTotalChange(Number(e.target.value) || 0);
            }}
            placeholder="50"
          />
        </Field>
      </div>
      <div className="pt-2 border-t border-border">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-3">Client (optional)</div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Client name">
            <input className={inputCls} value={basics.client_name} onChange={(e) => setBasics({ ...basics, client_name: e.target.value })} placeholder="Riya Mehta" />
          </Field>
          <Field label="Client email">
            <input type="email" className={inputCls} value={basics.client_email} onChange={(e) => setBasics({ ...basics, client_email: e.target.value })} placeholder="riya@email.com" />
          </Field>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Step 2: Scope & BOQ ---------------- */
function ScopeStep({
  roomsText,
  setRoomsText,
  onUpload,
  parsing,
  boqFileName,
  boqUsed,
  clearBoq,
}: {
  roomsText: string;
  setRoomsText: (s: string) => void;
  onUpload: (f: File) => void;
  parsing: boolean;
  boqFileName: string | null;
  boqUsed: boolean;
  clearBoq: () => void;
}) {
  return (
    <div className="space-y-5">
      <Field label="Rooms in scope" required>
        <input
          className={inputCls}
          value={roomsText}
          onChange={(e) => setRoomsText(e.target.value)}
          placeholder="Living Room, Master Bedroom, Kitchen, Bathrooms"
        />
        <p className="text-[11px] text-muted-foreground mt-1.5">Separate with commas.</p>
      </Field>

      <div className="rounded-[12px] border border-dashed border-border p-5">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-[#c17f5a]" />
          <span className="text-sm font-medium">Upload BOQ or Quotation</span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          AI reads Excel or PDF and auto-fills budget, breakdown, and rooms. Everything stays editable.
        </p>

        {parsing ? (
          <div className="flex items-center gap-2 text-sm text-[#c17f5a]">
            <Loader2 className="h-4 w-4 animate-spin" />
            AI reading your BOQ...
          </div>
        ) : boqUsed && boqFileName ? (
          <div className="flex items-center justify-between rounded-[8px] bg-[#7a9e8a]/10 px-3 py-2">
            <span className="text-sm inline-flex items-center gap-2">
              <Check className="h-4 w-4 text-[#7a9e8a]" /> {boqFileName}
            </span>
            <button onClick={clearBoq} className="text-xs text-muted-foreground hover:text-foreground">Remove</button>
          </div>
        ) : (
          <label className="inline-flex items-center gap-2 h-10 px-4 rounded-[6px] border border-border text-sm font-medium hover:bg-muted cursor-pointer">
            <Upload className="h-4 w-4" />
            Choose file (Excel or PDF)
            <input
              type="file"
              accept=".xlsx,.xls,.pdf,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>
    </div>
  );
}

/* ---------------- Step 3: Budget ---------------- */
function BudgetStep({
  total,
  rows,
  setRows,
  boqUsed,
}: {
  total: number;
  rows: BudgetRow[];
  setRows: React.Dispatch<React.SetStateAction<BudgetRow[]>>;
  boqUsed: boolean;
}) {
  const sumAmount = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const sumPct = rows.reduce((s, r) => s + Number(r.percentage || 0), 0);

  const updateRow = (i: number, field: "percentage" | "amount" | "category", value: number | string) => {
    setRows((rs) =>
      rs.map((r, idx) => {
        if (idx !== i) return r;
        if (field === "category") return { ...r, category: String(value) };
        if (field === "percentage") {
          const pct = Number(value);
          return { ...r, percentage: pct, amount: total ? +(total * pct / 100).toFixed(2) : r.amount };
        }
        const amount = Number(value);
        const pct = total ? +((amount / total) * 100).toFixed(2) : 0;
        return { ...r, amount, percentage: pct };
      }),
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-display text-lg mb-1">Budget breakdown</h4>
        <p className="text-xs text-muted-foreground">
          {boqUsed ? "Extracted from your BOQ. " : "Auto-filled from total. "}Adjust any line to fit the project.
        </p>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_80px_110px] gap-2 text-[10px] uppercase tracking-wider text-muted-foreground px-3">
          <span>Category</span>
          <span className="text-right">%</span>
          <span className="text-right">Amount (₹L)</span>
        </div>
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_80px_110px] gap-2 items-center">
            <input
              className={`${inputCls} text-sm`}
              value={r.category}
              onChange={(e) => updateRow(i, "category", e.target.value)}
            />
            <input
              type="number"
              className={`${inputCls} text-right tabular-nums`}
              value={r.percentage}
              onChange={(e) => updateRow(i, "percentage", e.target.value)}
            />
            <input
              type="number"
              className={`${inputCls} text-right tabular-nums`}
              value={r.amount}
              onChange={(e) => updateRow(i, "amount", e.target.value)}
            />
          </div>
        ))}
      </div>

      <div className="rounded-[10px] bg-muted p-4 flex items-center justify-between text-sm">
        <span className="font-medium">Total allocated</span>
        <span className="font-mono tabular-nums">
          ₹{sumAmount.toFixed(1)}L · {sumPct.toFixed(0)}%
        </span>
      </div>
      {total > 0 && Math.abs(sumAmount - total) > 0.5 && (
        <p className="text-xs text-[#c4685a]">
          Allocation differs from total budget by ₹{(sumAmount - total).toFixed(1)}L
        </p>
      )}
    </div>
  );
}

/* ---------------- Step 4: Success ---------------- */
function SuccessStep({
  portalLink,
  welcomeMessage,
  setWelcomeMessage,
  welcomeMessageId,
  onView,
}: {
  portalLink: string;
  welcomeMessage: string;
  setWelcomeMessage: (s: string) => void;
  welcomeMessageId: string | null;
  onView: () => void;
}) {
  const [sent, setSent] = useState(false);

  const send = async () => {
    if (!welcomeMessageId) {
      toast.error("Add a client with an email to enable messaging");
      return;
    }
    const { error } = await supabase
      .from("messages")
      .update({ body: welcomeMessage, sent_at: new Date().toISOString() })
      .eq("id", welcomeMessageId);
    if (error) { toast.error(error.message); return; }
    setSent(true);
    toast.success("Welcome message sent");
  };

  return (
    <div className="space-y-6">
      <div className="text-center py-4">
        <div className="h-16 w-16 mx-auto rounded-full bg-[#7a9e8a] flex items-center justify-center mb-4">
          <Check className="h-8 w-8 text-white" strokeWidth={3} />
        </div>
        <h3 className="font-display text-3xl">Project created</h3>
        <p className="text-muted-foreground text-sm mt-2">Timeline, budget, and scope are live.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={onView} className="h-12 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95 inline-flex items-center justify-center gap-2">
          View Project <ChevronRight className="h-4 w-4" />
        </button>
        <button
          onClick={() => { navigator.clipboard?.writeText(portalLink).catch(() => {}); toast.success("Portal link copied"); }}
          className="h-12 rounded-[6px] border border-border text-sm font-medium hover:bg-muted inline-flex items-center justify-center gap-2"
        >
          <Share2 className="h-4 w-4" /> Share Client Portal
        </button>
      </div>
      <div className="rounded-[10px] border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Welcome message draft</div>
          {sent && <span className="text-[10px] uppercase tracking-wider text-[#7a9e8a]">Sent</span>}
        </div>
        <textarea
          value={welcomeMessage}
          onChange={(e) => setWelcomeMessage(e.target.value)}
          rows={5}
          className="w-full px-3 py-2 rounded-[8px] bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 resize-none"
        />
        <button
          onClick={send}
          disabled={sent}
          className="h-9 px-4 rounded-[6px] bg-[#1a1612] text-white text-xs font-medium hover:brightness-110 inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" /> {sent ? "Sent to client" : "Send to Client"}
        </button>
      </div>
    </div>
  );
}

/* ---------------- helpers ---------------- */
function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
        {required && <span className="text-[#c17f5a] ml-1">*</span>}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

const inputCls =
  "w-full h-10 px-3 rounded-[10px] bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring/30";

export { labelForType };
