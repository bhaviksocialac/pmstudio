import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import {
  X, Loader2, ChevronRight, ChevronLeft, Check, Share2, Send, Plus, Trash2, Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  PHASES,
  computePhaseSchedule,
  DEFAULT_BUDGET_BREAKDOWN,
  DEFAULT_ROOMS,
  DEFAULT_ROOM_ITEMS,
  type Phase,
} from "@/lib/db-types";

const getBasicsSchema = () =>
  z.object({
    name: z.string().trim().min(1, "Name is required").max(120),
    location: z.string().trim().max(200).optional(),
    phase: z.enum(PHASES),
    budget: z.coerce.number().min(0).max(100000),
    type: z.enum(["residential", "commercial"]),
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
  type: "residential" | "commercial";
  start_date: string;
  client_name: string;
  client_email: string;
}

interface BudgetRow {
  category: string;
  percentage: number;
  amount: number;
}

interface RoomDraft {
  name: string;
  items: { label: string; done: boolean }[];
}

export function NewProjectWizard({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);

  const [basics, setBasics] = useState<Basics>({
    name: "",
    location: "",
    phase: "Survey",
    budget: "",
    type: "residential",
    start_date: new Date().toISOString().slice(0, 10),
    client_name: "",
    client_email: "",
  });

  const budgetTotal = Number(basics.budget) || 0;
  const [budgetRows, setBudgetRows] = useState<BudgetRow[]>(
    DEFAULT_BUDGET_BREAKDOWN.map((b) => ({ ...b, amount: 0 })),
  );

  // Recompute amounts whenever budget changes via a recompute helper
  const syncBudgetFromTotal = (total: number) => {
    setBudgetRows((rows) => rows.map((r) => ({ ...r, amount: +(total * r.percentage / 100).toFixed(2) })));
  };

  const [rooms, setRooms] = useState<RoomDraft[]>(
    DEFAULT_ROOMS.map((r) => ({
      name: r,
      items: DEFAULT_ROOM_ITEMS.map((i) => ({ label: i, done: true })),
    })),
  );

  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [welcomeMessageId, setWelcomeMessageId] = useState<string | null>(null);

  const portalLink = useMemo(
    () => (createdProjectId ? `${window.location.origin}/portal/${createdProjectId}` : ""),
    [createdProjectId],
  );

  const create = useMutation({
    mutationFn: async () => {
      const parsed = getBasicsSchema().parse(basics);
      const startDate = new Date(parsed.start_date);
      const schedule = computePhaseSchedule(startDate);
      const handover = schedule[schedule.length - 1].end;

      // 1. Insert project
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

      // 2. Phases
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

      // 3. Budget lines
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

      // 4. Rooms + scope items
      for (let i = 0; i < rooms.length; i++) {
        const r = rooms[i];
        const { data: room, error: rErr } = await supabase
          .from("project_rooms")
          .insert({ user_id: user!.id, project_id: projectId, name: r.name, order_index: i })
          .select()
          .single();
        if (rErr) throw rErr;
        if (r.items.length) {
          const { error: iErr } = await supabase.from("room_scope_items").insert(
            r.items.map((it, j) => ({
              user_id: user!.id,
              project_id: projectId,
              room_id: room.id,
              label: it.label,
              done: it.done,
              order_index: j,
            })),
          );
          if (iErr) throw iErr;
        }
      }

      // 5. Upsert client and link
      let clientId: string | null = null;
      const clientName = parsed.client_name?.trim();
      const clientEmail = parsed.client_email?.trim();
      if (clientName) {
        const { data: client, error: cErr } = await supabase
          .from("clients")
          .insert({
            user_id: user!.id,
            name: clientName,
            email: clientEmail || null,
          })
          .select()
          .single();
        if (cErr) throw cErr;
        clientId = client.id;
        await supabase.from("projects").update({ client_id: clientId }).eq("id", projectId);
      }

      // 6. Draft welcome message
      const portal = `${window.location.origin}/portal/${projectId}`;
      const draft = `Hi ${clientName || "there"}, your project ${parsed.name} is now set up on PMStudio. You can track progress, approve designs, and view updates anytime at ${portal}. Looking forward to creating a beautiful home for you!`;
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

      return { projectId, draft, msgId };
    },
    onSuccess: ({ projectId, draft, msgId }) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      setCreatedProjectId(projectId);
      setWelcomeMessage(draft);
      setWelcomeMessageId(msgId);
      setStep(4);
    },
    onError: (e) => {
      toast.error(e instanceof z.ZodError ? e.issues[0].message : e instanceof Error ? e.message : "Failed");
    },
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[90vh] bg-card rounded-[16px] shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-border flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="font-display text-2xl">{step === 4 ? "Project Created" : "New Project"}</h3>
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
          {step === 1 && (
            <BasicsStep
              basics={basics}
              setBasics={setBasics}
              onTotalChange={(t) => syncBudgetFromTotal(t)}
            />
          )}
          {step === 2 && (
            <BudgetStep total={budgetTotal} rows={budgetRows} setRows={setBudgetRows} />
          )}
          {step === 3 && <RoomsStep rooms={rooms} setRooms={setRooms} />}
          {step === 4 && createdProjectId && (
            <SuccessStep
              projectId={createdProjectId}
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
          <div className="px-6 py-4 border-t border-border flex justify-between gap-2 flex-shrink-0">
            {step > 1 ? (
              <button
                onClick={() => setStep((s) => (s - 1) as Step)}
                className="h-10 px-4 rounded-[6px] border border-border text-sm font-medium hover:bg-muted inline-flex items-center gap-1.5"
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
            ) : (
              <span />
            )}
            {step < 3 ? (
              <button
                onClick={() => {
                  if (step === 1) {
                    const result = getBasicsSchema().safeParse(basics);
                    if (!result.success) {
                      toast.error(result.error.issues[0].message);
                      return;
                    }
                    syncBudgetFromTotal(Number(basics.budget) || 0);
                  }
                  setStep((s) => (s + 1) as Step);
                }}
                className="h-10 px-5 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95 inline-flex items-center gap-1.5"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={() => create.mutate()}
                disabled={create.isPending}
                className="h-10 px-5 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95 inline-flex items-center gap-2 disabled:opacity-60"
              >
                {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create Project
              </button>
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
        <Field label="Type">
          <select className={inputCls} value={basics.type} onChange={(e) => setBasics({ ...basics, type: e.target.value as "residential" | "commercial" })}>
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
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

/* ---------------- Step 2: Budget ---------------- */
function BudgetStep({
  total,
  rows,
  setRows,
}: {
  total: number;
  rows: BudgetRow[];
  setRows: React.Dispatch<React.SetStateAction<BudgetRow[]>>;
}) {
  const sumAmount = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const sumPct = rows.reduce((s, r) => s + Number(r.percentage || 0), 0);

  const updateRow = (i: number, field: "percentage" | "amount", value: number) => {
    setRows((rs) =>
      rs.map((r, idx) => {
        if (idx !== i) return r;
        if (field === "percentage") {
          const pct = value;
          return { ...r, percentage: pct, amount: total ? +(total * pct / 100).toFixed(2) : r.amount };
        }
        const amount = value;
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
          Auto-filled from ₹{total}L total. Adjust any line to fit the project.
        </p>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_90px_120px] gap-2 text-[10px] uppercase tracking-wider text-muted-foreground px-3">
          <span>Category</span>
          <span className="text-right">%</span>
          <span className="text-right">Amount (₹L)</span>
        </div>
        {rows.map((r, i) => (
          <div key={r.category} className="grid grid-cols-[1fr_90px_120px] gap-2 items-center">
            <span className="text-sm font-medium px-3">{r.category}</span>
            <input
              type="number"
              className={`${inputCls} text-right tabular-nums`}
              value={r.percentage}
              onChange={(e) => updateRow(i, "percentage", Number(e.target.value))}
            />
            <input
              type="number"
              className={`${inputCls} text-right tabular-nums`}
              value={r.amount}
              onChange={(e) => updateRow(i, "amount", Number(e.target.value))}
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
      {Math.abs(sumAmount - total) > 0.5 && (
        <p className="text-xs text-[#c4685a]">
          Allocation differs from total budget by ₹{(sumAmount - total).toFixed(1)}L
        </p>
      )}
    </div>
  );
}

/* ---------------- Step 3: Rooms ---------------- */
function RoomsStep({
  rooms,
  setRooms,
}: {
  rooms: RoomDraft[];
  setRooms: React.Dispatch<React.SetStateAction<RoomDraft[]>>;
}) {
  const [newRoom, setNewRoom] = useState("");

  const toggleItem = (rIdx: number, iIdx: number) => {
    setRooms((rs) =>
      rs.map((r, i) =>
        i === rIdx ? { ...r, items: r.items.map((it, j) => (j === iIdx ? { ...it, done: !it.done } : it)) } : r,
      ),
    );
  };

  const removeRoom = (i: number) => setRooms((rs) => rs.filter((_, idx) => idx !== i));

  const addRoom = () => {
    const name = newRoom.trim();
    if (!name) return;
    setRooms((rs) => [
      ...rs,
      { name, items: DEFAULT_ROOM_ITEMS.map((label) => ({ label, done: true })) },
    ]);
    setNewRoom("");
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-display text-lg mb-1">Room-by-room scope</h4>
        <p className="text-xs text-muted-foreground">Check the items included for each room. You can adjust later.</p>
      </div>

      <div className="space-y-3">
        {rooms.map((room, rIdx) => (
          <details key={`${room.name}-${rIdx}`} open className="rounded-[10px] border border-border">
            <summary className="px-4 py-3 cursor-pointer flex items-center justify-between text-sm font-medium">
              <span>{room.name}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  removeRoom(rIdx);
                }}
                className="h-7 w-7 rounded-[6px] hover:bg-muted flex items-center justify-center text-muted-foreground"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </summary>
            <div className="px-4 pb-4 grid grid-cols-2 gap-2">
              {room.items.map((it, iIdx) => (
                <label key={it.label} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={it.done} onChange={() => toggleItem(rIdx, iIdx)} className="accent-[#c17f5a]" />
                  <span>{it.label}</span>
                </label>
              ))}
            </div>
          </details>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          className={inputCls}
          placeholder="Add room (e.g. Study)"
          value={newRoom}
          onChange={(e) => setNewRoom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addRoom();
            }
          }}
        />
        <button onClick={addRoom} className="h-10 px-4 rounded-[6px] border border-border text-sm font-medium hover:bg-muted inline-flex items-center gap-1">
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>
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
  projectId: string;
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
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
    toast.success("Welcome message sent");
  };

  return (
    <div className="space-y-6">
      <div className="text-center py-4">
        <div className="h-16 w-16 mx-auto rounded-full bg-[#7a9e8a] flex items-center justify-center mb-4">
          <Check className="h-8 w-8 text-white" strokeWidth={3} />
        </div>
        <h3 className="font-display text-3xl">Project created in under 8 minutes</h3>
        <p className="text-muted-foreground text-sm mt-2 inline-flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-[#c17f5a]" />
          Timeline, budget breakdown and scope are all live.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onView}
          className="h-12 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95 inline-flex items-center justify-center gap-2"
        >
          View Project <ChevronRight className="h-4 w-4" />
        </button>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(portalLink).catch(() => {});
            toast.success("Portal link copied");
          }}
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
