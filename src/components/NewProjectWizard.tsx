import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
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
import { sendWelcomeEmail } from "@/lib/emails.functions";
import { AddressFields, emptyAddress, addressToString, type AddressValue } from "@/components/AddressFields";

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

const projectDetailsSchema = z.object({
  name: z.string().trim().min(1, "Project name is required").max(120),
  phase: z.enum(PHASES),
  type: z.string().refine((v) => PROPERTY_VALUES.includes(v), "Invalid property type"),
});

const clientDetailsSchema = z.object({
  client_name: z.string().trim().max(120).optional(),
  client_email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
  client_phone: z.string().trim().max(40).optional(),
  client_whatsapp: z.string().trim().max(40).optional(),
});

const timelineSchema = z.object({
  budget: z.coerce.number().min(0).max(100000),
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().min(1, "End date is required"),
});

type Step = 1 | 2 | 3 | 4 | 5;

interface ProjectDetails {
  name: string;
  phase: Phase;
  type: string;
  address: AddressValue;
}
interface ClientDetails {
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: AddressValue;
}
interface Timeline {
  budget: string;
  start_date: string;
  end_date: string;
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

  const [project, setProject] = useState<ProjectDetails>({
    name: "",
    phase: "Survey",
    type: "residential_apartment",
    address: { ...emptyAddress },
  });
  const [client, setClient] = useState<ClientDetails>({
    name: "",
    email: "",
    phone: "",
    whatsapp: "",
    address: { ...emptyAddress },
  });
  const today = new Date().toISOString().slice(0, 10);
  const defaultEnd = (() => { const d = new Date(); d.setMonth(d.getMonth() + 4); return d.toISOString().slice(0, 10); })();
  const [timeline, setTimeline] = useState<Timeline>({
    budget: "",
    start_date: today,
    end_date: defaultEnd,
  });

  const [roomsText, setRoomsText] = useState("Living Room, Master Bedroom, Kitchen, Bathrooms");
  const [budgetRows, setBudgetRows] = useState<BudgetRow[]>(
    DEFAULT_BUDGET_BREAKDOWN.map((b) => ({ ...b, amount: 0 })),
  );
  const [boqUsed, setBoqUsed] = useState(false);
  const [parsingBoq, setParsingBoq] = useState(false);
  const [boqFileName, setBoqFileName] = useState<string | null>(null);
  const parseBoqFn = useServerFn(parseBoq);
  const sendWelcomeEmailFn = useServerFn(sendWelcomeEmail);

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
        supabase.from("projects").select("*, clients(*)").eq("id", editProjectId!).maybeSingle(),
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
    const p = editLoad.data.project as Record<string, unknown> & { clients?: Record<string, unknown> | null };
    setProject({
      name: (p.name as string) ?? "",
      phase: ((p.phase as Phase) ?? "Survey"),
      type: PROPERTY_VALUES.includes(p.type as string) ? (p.type as string) : "residential_apartment",
      address: {
        flat_number: (p.flat_number as string) ?? "",
        street: (p.street as string) ?? (p.location as string) ?? "",
        city: (p.city as string) ?? "",
        state: (p.state as string) ?? "",
        country: (p.country as string) ?? "",
        pincode: (p.pincode as string) ?? "",
        latitude: (p.latitude as number) ?? null,
        longitude: (p.longitude as number) ?? null,
      },
    });
    setTimeline({
      budget: String(p.budget ?? ""),
      start_date: (p.start_date as string) ?? today,
      end_date: (p.end_date as string) ?? (p.expected_handover as string) ?? defaultEnd,
    });
    const c = p.clients;
    if (c) {
      setClient({
        name: (c.name as string) ?? "",
        email: (c.email as string) ?? "",
        phone: (c.phone as string) ?? "",
        whatsapp: (c.whatsapp as string) ?? "",
        address: {
          flat_number: (c.flat_number as string) ?? "",
          street: (c.street as string) ?? (c.address as string) ?? "",
          city: (c.city as string) ?? "",
          state: (c.state as string) ?? "",
          country: (c.country as string) ?? "",
          pincode: (c.pincode as string) ?? "",
          latitude: (c.latitude as number) ?? null,
          longitude: (c.longitude as number) ?? null,
        },
      });
    }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editLoad.data]);

  const budgetTotal = Number(timeline.budget) || 0;

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
        setTimeline((t) => ({ ...t, budget: String(result.total_budget_lakhs) }));
      }
      if (result.breakdown.length > 0) {
        const total = result.total_budget_lakhs || result.breakdown.reduce((s: number, r: BudgetRow) => s + r.amount, 0);
        setBudgetRows(
          result.breakdown.map((r: BudgetRow) => ({
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

  // Find an existing client by email (preferred) or by exact name to keep records in sync.
  const upsertClient = async (): Promise<string | null> => {
    const name = client.name.trim();
    if (!name) return null;
    const email = client.email.trim();
    const payload: Record<string, unknown> = {
      name,
      email: email || null,
      phone: client.phone.trim() || null,
      whatsapp: client.whatsapp.trim() || null,
      flat_number: client.address.flat_number || null,
      street: client.address.street || null,
      city: client.address.city || null,
      state: client.address.state || null,
      country: client.address.country || null,
      pincode: client.address.pincode || null,
      latitude: client.address.latitude,
      longitude: client.address.longitude,
      address: addressToString(client.address) || null,
    };

    // Try match by email first, then by name (scoped to current user via RLS).
    let existing: { id: string } | null = null;
    if (email) {
      const { data } = await supabase.from("clients").select("id").eq("email", email).maybeSingle();
      existing = data;
    }
    if (!existing) {
      const { data } = await supabase.from("clients").select("id").eq("name", name).maybeSingle();
      existing = data;
    }

    if (existing) {
      const { error } = await supabase.from("clients").update(payload).eq("id", existing.id);
      if (error) throw error;
      return existing.id;
    }
    const { data: created, error: cErr } = await supabase
      .from("clients")
      .insert({ user_id: user!.id, ...payload })
      .select("id")
      .single();
    if (cErr) throw cErr;
    return created.id;
  };

  const save = useMutation({
    mutationFn: async () => {
      const pd = projectDetailsSchema.parse(project);
      const cd = clientDetailsSchema.parse({
        client_name: client.name,
        client_email: client.email,
        client_phone: client.phone,
        client_whatsapp: client.whatsapp,
      });
      const tl = timelineSchema.parse(timeline);
      const roomNames = roomsText.split(",").map((s) => s.trim()).filter(Boolean);
      const projectLocation = addressToString(project.address);

      const projectPayload = {
        name: pd.name,
        phase: pd.phase,
        type: pd.type,
        budget: tl.budget,
        start_date: tl.start_date,
        end_date: tl.end_date,
        expected_handover: tl.end_date,
        location: projectLocation || null,
        flat_number: project.address.flat_number || null,
        street: project.address.street || null,
        city: project.address.city || null,
        state: project.address.state || null,
        country: project.address.country || null,
        pincode: project.address.pincode || null,
        latitude: project.address.latitude,
        longitude: project.address.longitude,
      };

      // Upsert client first so we have the id for both create and edit paths.
      const clientId = await upsertClient();

      if (isEdit && editProjectId) {
        const { error: uErr } = await supabase
          .from("projects")
          .update({ ...projectPayload, client_id: clientId })
          .eq("id", editProjectId);
        if (uErr) throw uErr;

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
      const startDate = new Date(tl.start_date);
      const schedule = computePhaseSchedule(startDate);

      const { data: createdProject, error: pErr } = await supabase
        .from("projects")
        .insert({
          user_id: user!.id,
          client_id: clientId,
          ...projectPayload,
        })
        .select()
        .single();
      if (pErr) throw pErr;
      const projectId = createdProject.id;

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

      const portal = `${window.location.origin}/portal/${projectId}`;
      const draft = `Hi ${client.name || "there"}, your project ${pd.name} is now set up on PMStudio. You can track progress, approve designs, and view updates anytime at ${portal}.`;
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

      if (clientId && cd.client_email) {
        sendWelcomeEmailFn({ data: { projectId } }).catch((e: unknown) => console.warn("welcome email failed", e));
      }

      return { projectId, draft, msgId, edited: false };
    },
    onSuccess: ({ projectId, draft, msgId, edited }) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      if (edited) {
        toast.success("Project updated");
        onClose();
        return;
      }
      setCreatedProjectId(projectId);
      setWelcomeMessage(draft);
      setWelcomeMessageId(msgId);
      setStep(5);
    },
    onError: (e) => {
      toast.error(e instanceof z.ZodError ? e.issues[0].message : e instanceof Error ? e.message : "Failed");
    },
  });

  const deleteProject = useMutation({
    mutationFn: async () => {
      if (!editProjectId) return;
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

  const goNext = () => {
    if (step === 1) {
      const r = projectDetailsSchema.safeParse(project);
      if (!r.success) { toast.error(r.error.issues[0].message); return; }
    }
    if (step === 2) {
      const r = clientDetailsSchema.safeParse({
        client_name: client.name, client_email: client.email,
        client_phone: client.phone, client_whatsapp: client.whatsapp,
      });
      if (!r.success) { toast.error(r.error.issues[0].message); return; }
    }
    if (step === 3) {
      const r = timelineSchema.safeParse(timeline);
      if (!r.success) { toast.error(r.error.issues[0].message); return; }
      if (!boqUsed) syncBudgetFromTotal(Number(timeline.budget) || 0);
    }
    setStep((s) => (s + 1) as Step);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="absolute right-0 top-0 bottom-0 w-full max-w-xl bg-card flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-border flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="font-display text-2xl">
              {step === 5 ? "Project Created" : isEdit ? "Edit Project" : "New Project"}
            </h3>
            {step !== 5 && (
              <div className="flex items-center gap-3 mt-2">
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4].map((n) => (
                    <span
                      key={n}
                      className="h-1 w-8 rounded-full"
                      style={{ background: step >= (n as Step) ? "#c17f5a" : "var(--muted, #eee)" }}
                    />
                  ))}
                </div>
                <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {step === 1 ? "Project details" : step === 2 ? "Client details" : step === 3 ? "Budget & timeline" : "Scope & BOQ"}
                </span>
              </div>
            )}
          </div>
          <button onClick={onClose} className="h-9 w-9 rounded-[10px] hover:bg-muted flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {step === 1 && <ProjectStep project={project} setProject={setProject} />}
          {step === 2 && <ClientStep client={client} setClient={setClient} />}
          {step === 3 && <TimelineStep timeline={timeline} setTimeline={setTimeline} />}
          {step === 4 && (
            <BudgetScopeStep
              roomsText={roomsText}
              setRoomsText={setRoomsText}
              onUpload={handleBoqUpload}
              parsing={parsingBoq}
              boqFileName={boqFileName}
              boqUsed={boqUsed}
              clearBoq={() => { setBoqUsed(false); setBoqFileName(null); }}
              total={budgetTotal}
              rows={budgetRows}
              setRows={setBudgetRows}
            />
          )}
          {step === 5 && createdProjectId && (
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

        {step !== 5 && (
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
              {step < 4 ? (
                <button
                  onClick={goNext}
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

/* ---------------- Step 1: Project Details ---------------- */
function ProjectStep({
  project,
  setProject,
}: {
  project: ProjectDetails;
  setProject: (p: ProjectDetails) => void;
}) {
  return (
    <div className="space-y-5">
      <Field label="Project name" required>
        <input className={inputCls} value={project.name} onChange={(e) => setProject({ ...project, name: e.target.value })} placeholder="Banyan House" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phase">
          <select className={inputCls} value={project.phase} onChange={(e) => setProject({ ...project, phase: e.target.value as Phase })}>
            {PHASES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Property type">
          <select className={inputCls} value={project.type} onChange={(e) => setProject({ ...project, type: e.target.value })}>
            {PROPERTY_TYPES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </Field>
      </div>
      <div className="pt-2 border-t border-border">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-3">Site address</div>
        <AddressFields value={project.address} onChange={(a) => setProject({ ...project, address: a })} />
      </div>
    </div>
  );
}

/* ---------------- Step 2: Client Details ---------------- */
function ClientStep({
  client,
  setClient,
}: {
  client: ClientDetails;
  setClient: (c: ClientDetails) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Full name">
          <input className={inputCls} value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} placeholder="Riya Mehta" />
        </Field>
        <Field label="Email">
          <input type="email" className={inputCls} value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })} placeholder="riya@email.com" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone">
          <input className={inputCls} value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })} placeholder="+91 98765 43210" />
        </Field>
        <Field label="WhatsApp">
          <input className={inputCls} value={client.whatsapp} onChange={(e) => setClient({ ...client, whatsapp: e.target.value })} placeholder="+91 98765 43210" />
        </Field>
      </div>
      <div className="pt-2 border-t border-border">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-3">Client address</div>
        <AddressFields value={client.address} onChange={(a) => setClient({ ...client, address: a })} />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Client info is auto-synced with your Clients page — changes here update the matching client record.
      </p>
    </div>
  );
}

/* ---------------- Step 3: Timeline & Budget total ---------------- */
function TimelineStep({
  timeline,
  setTimeline,
}: {
  timeline: Timeline;
  setTimeline: (t: Timeline) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start date" required>
          <input type="date" className={inputCls} value={timeline.start_date} onChange={(e) => setTimeline({ ...timeline, start_date: e.target.value })} />
        </Field>
        <Field label="End date" required>
          <input type="date" className={inputCls} value={timeline.end_date} onChange={(e) => setTimeline({ ...timeline, end_date: e.target.value })} />
        </Field>
      </div>
      <Field label="Total budget (in lakhs)">
        <input
          type="number"
          className={inputCls}
          value={timeline.budget}
          onChange={(e) => setTimeline({ ...timeline, budget: e.target.value })}
          placeholder="50"
        />
      </Field>
    </div>
  );
}

/* ---------------- Step 4: Scope & Budget breakdown ---------------- */
function BudgetScopeStep({
  roomsText,
  setRoomsText,
  onUpload,
  parsing,
  boqFileName,
  boqUsed,
  clearBoq,
  total,
  rows,
  setRows,
}: {
  roomsText: string;
  setRoomsText: (s: string) => void;
  onUpload: (f: File) => void;
  parsing: boolean;
  boqFileName: string | null;
  boqUsed: boolean;
  clearBoq: () => void;
  total: number;
  rows: BudgetRow[];
  setRows: React.Dispatch<React.SetStateAction<BudgetRow[]>>;
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
    <div className="space-y-6">
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
            <Loader2 className="h-4 w-4 animate-spin" /> AI reading your BOQ...
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

      <div>
        <h4 className="font-display text-lg mb-1">Budget breakdown</h4>
        <p className="text-xs text-muted-foreground mb-3">
          {boqUsed ? "Extracted from your BOQ. " : "Auto-filled from total. "}Adjust any line to fit the project.
        </p>
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_80px_110px] gap-2 text-[10px] uppercase tracking-wider text-muted-foreground px-3">
            <span>Category</span>
            <span className="text-right">%</span>
            <span className="text-right">Amount (₹L)</span>
          </div>
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_80px_110px] gap-2 items-center">
              <input className={`${inputCls} text-sm`} value={r.category} onChange={(e) => updateRow(i, "category", e.target.value)} />
              <input type="number" className={`${inputCls} text-right tabular-nums`} value={r.percentage} onChange={(e) => updateRow(i, "percentage", e.target.value)} />
              <input type="number" className={`${inputCls} text-right tabular-nums`} value={r.amount} onChange={(e) => updateRow(i, "amount", e.target.value)} />
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-[10px] bg-muted p-4 flex items-center justify-between text-sm">
          <span className="font-medium">Total allocated</span>
          <span className="font-mono tabular-nums">
            ₹{sumAmount.toFixed(1)}L · {sumPct.toFixed(0)}%
          </span>
        </div>
        {total > 0 && Math.abs(sumAmount - total) > 0.5 && (
          <p className="text-xs text-[#c4685a] mt-2">
            Allocation differs from total budget by ₹{(sumAmount - total).toFixed(1)}L
          </p>
        )}
      </div>
    </div>
  );
}

/* ---------------- Step 5: Success ---------------- */
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
