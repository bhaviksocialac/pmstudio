import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { evaluateMilestonesInline } from "@/lib/milestones.server";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

const STATUSES = [
  "not_started", "selection_pending", "approval_pending", "quotation_pending",
  "order_placed", "payment_pending", "material_ordered", "material_delivered",
  "wip", "blocked", "done",
] as const;

const WORK_TYPES = [
  "Survey", "Design", "Procurement",
  "Carpentry", "Civil", "Electrical", "False Ceiling", "Flooring",
  "HVAC", "Painting", "Plumbing", "Tiling",
  "Finishing", "Snags", "Handover", "Other",
] as const;

export type ExtractedTask = {
  description: string;
  agency: string | null;
  work_type: string | null;
  work_types: string[];
  areas: string[];
  room: string | null;          // primary single room for per-room rollup
  completion_pct: number;       // 0-100 partial completion ("1 wall pending" → 80)
  status: string;
  priority: "Urgent" | "High" | "Medium" | "Low" | "None";
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  ifr_date: string | null;
  ifa_date: string | null;
  ifc_date: string | null;
  blocked_by: string[];
  notes: string | null;
  duplicate_of: string | null;
};

export type ProcessResult = {
  tasks: ExtractedTask[];
  summary: {
    create_count: number;
    update_count: number;
    agencies: string[];
    rooms: string[];
    delays: number;
    dependencies: number;
    groupUpdates: { group: string; pct: number }[];
  };
  original_language: string;
  english_text: string;
};

const processSchema = z.object({
  projectId: z.string().uuid(),
  text: z.string().min(2).max(8000),
  teamMembers: z.array(z.object({
    name: z.string().min(1).max(120),
    role: z.string().max(60).optional(),
  })).max(50).optional(),
});

export const processNarrative = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => processSchema.parse(input))
  .handler(async ({ data, context }): Promise<ProcessResult> => {
    const { supabase } = context;

    const { data: profile } = await supabase.from("profiles").select("full_name").maybeSingle();
    const selfName = (profile?.full_name ?? "").trim();
    const teamList = data.teamMembers ?? [];
    const teamNames = Array.from(new Set([
      ...(selfName ? [selfName] : []),
      ...teamList.map((t) => t.name),
    ]));

    // Existing tasks in project for duplicate detection
    const { data: existing } = await supabase
      .from("tasks")
      .select("id,title,description,agency,contractor,areas,area,work_type,status,room")
      .eq("project_id", data.projectId);

    // Project rooms so AI can fan-out "all rooms except X"
    const { data: roomRows } = await supabase
      .from("project_rooms")
      .select("name")
      .eq("project_id", data.projectId);
    const projectRooms = (roomRows ?? []).map((r) => r.name);

    const existingList = (existing ?? []).map((t) => {
      const areas = Array.isArray(t.areas) ? (t.areas as string[]) : (t.area ? [t.area] : []);
      return {
        id: t.id,
        desc: t.description || t.title,
        agency: t.agency || t.contractor || "",
        areas,
        room: (t as { room?: string | null }).room ?? null,
        work_type: t.work_type || "",
      };
    });

    const prompt = `You are extracting structured project tasks from a designer's free-text narrative about an interior project.

DESIGNER (self) NAME: ${selfName || "(unknown)"}
TEAM MEMBERS (designer's own team): ${teamNames.length ? teamNames.join(", ") : "(none)"}
PROJECT ROOMS: ${projectRooms.length ? projectRooms.join(", ") : "(use rooms mentioned in narrative)"}

AGENCY ASSIGNMENT RULES:
- First-person ("I…", "we…", "our team…") → agency = "${selfName || "Designer"}".
- Specific team member name → agency = that name.
- "Client approved / Client said" → agency = "Client".
- Other named person/company → agency = that name verbatim.

LANGUAGE: input may be English / Hindi / Hinglish. Translate to English first. All output in English.

CORE EXTRACTION RULES:
- Every distinct event = ONE task row. ONE TASK PER ROOM.
- "Plaster done in Living Room, Kitchen, Bedroom" → 3 tasks (one each), status=done, completion_pct=100.
- "Plaster done except Mandir" or "tiling complete in all rooms except kitchen" → expand using PROJECT ROOMS:
    * one done task (status=done, completion_pct=100) for EACH room in PROJECT ROOMS that is NOT excluded
    * one wip/pending task (status=wip, completion_pct=0) for EACH excluded room
- "Plaster pending in Mandir — 1 wall remaining" or "1 wall left" → status=wip, completion_pct=80, notes="1 wall pending"
- "3 of 4 walls done" → completion_pct = round(3/4*100) = 75
- "half done" → completion_pct=50; "almost done" → 90; "just started" → 10
- room: the SINGLE room for this task (Living Room, Kitchen, Mandir, …). areas = [room] mirror.
- "started" → status=wip, actual_start=date if given, completion_pct=10 unless stated otherwise
- "completed/done" → status=done, completion_pct=100, actual_end=date if given
- "quotation pending/given" → status=quotation_pending
- "selection pending" → status=selection_pending
- Date DD.MM.YYYY → ISO YYYY-MM-DD
- A pending due to B → blocked_by includes B's description
- priority default Medium; Urgent only if narrative says so
- status: one of ${STATUSES.join(", ")}
- work_type: one of ${WORK_TYPES.join(", ")}

IFR/IFA/IFC DATE DETECTION:
- IFR: "sent for review", "shared drawing"
- IFA: "sent for approval", "client approved"
- IFC: "issued for construction", "given to contractor", "construction started"

WORK TYPE KEYWORDS (work_types may be multi):
- site visit/measurement/survey/recce → Survey
- drawing/design/concept/3D/render/IFR/IFA/IFC/approval → Design
- quotation/quote/PO/purchase order/order placed/delivery/payment/material ordered → Procurement
- tiles/grouting → Tiling
- flooring/wooden/marble/laminate → Flooring
- electrical/conduit/wiring/MCB → Electrical
- plumbing/pipes/CPVC/drainage → Plumbing
- plaster/masonry/brickwork/RCC/demolition → Civil
- carpentry/wardrobe/modular → Carpentry
- painting/primer/putty → Painting
- false ceiling/gypsum/POP ceiling → False Ceiling
- AC/HVAC/duct → HVAC
- snag/touch-up/cleaning/deep clean/polish → Snags
- handover/keys handed/documents handed/final payment received → Handover
"work_type" = first of "work_types".

Return JSON:
{
  "english_text": "...",
  "original_language": "english"|"hindi"|"hinglish",
  "tasks": [
    {
      "description": "Plaster pending in Mandir",
      "agency": "Jangir" | "Client" | null,
      "work_type": "Civil",
      "work_types": ["Civil"],
      "areas": ["Mandir"],
      "room": "Mandir",
      "completion_pct": 80,
      "status": "wip",
      "priority": "Medium",
      "planned_start": null, "planned_end": null,
      "actual_start": null, "actual_end": null,
      "ifr_date": null, "ifa_date": null, "ifc_date": null,
      "blocked_by": [],
      "notes": "1 wall pending near entrance"
    }
  ]
}

NARRATIVE:
"""
${data.text}
"""`;


    const res = await fetch(AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      if (res.status === 429) throw new Error("Rate limit hit. Try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted.");
      throw new Error(`AI error ${res.status}`);
    }
    const json = await res.json();
    const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}");

    const rawTasks = (parsed.tasks ?? []) as Partial<ExtractedTask>[];

    // Duplicate detection: same description ~ same agency ~ overlapping area
    const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().trim().replace(/\s+/g, " ");
    const tasks: ExtractedTask[] = rawTasks.map((t) => {
      const description = (t.description ?? "").trim();
      const agency = t.agency || null;
      const areas = Array.isArray(t.areas) ? t.areas.filter(Boolean) : [];
      const wtsRaw = Array.isArray((t as { work_types?: unknown }).work_types)
        ? ((t as { work_types?: unknown }).work_types as unknown[]).filter(Boolean).map(String)
        : (t.work_type ? [t.work_type] : []);
      const work_types = Array.from(new Set(wtsRaw.map((s) => s.trim()).filter(Boolean)));
      const wt = work_types[0] || t.work_type || null;

      const roomVal = ((t as { room?: string | null }).room ?? null) || areas[0] || null;
      const cpRaw = (t as { completion_pct?: unknown }).completion_pct;
      let completion_pct = typeof cpRaw === "number" ? Math.max(0, Math.min(100, Math.round(cpRaw))) : 0;
      if (((t.status as string) ?? "") === "done") completion_pct = 100;
      else if (((t.status as string) ?? "") === "wip" && completion_pct === 0) completion_pct = 50;

      let dupId: string | null = null;
      for (const ex of existingList) {
        const sameDesc = norm(ex.desc).includes(norm(description).slice(0, 30)) ||
          norm(description).includes(norm(ex.desc).slice(0, 30));
        const sameAgency = norm(ex.agency) === norm(agency ?? "");
        const sameRoom = !roomVal || !ex.room || norm(ex.room) === norm(roomVal);
        const overlapArea = areas.length === 0 || ex.areas.length === 0 ||
          areas.some((a) => ex.areas.map(norm).includes(norm(a)));
        const sameWorkType = !wt || !ex.work_type || norm(wt) === norm(ex.work_type);
        if (sameDesc && sameAgency && (sameRoom || overlapArea) && sameWorkType) {
          dupId = ex.id;
          break;
        }
      }

      return {
        description,
        agency,
        work_type: wt,
        work_types,
        areas,
        room: roomVal,
        completion_pct,
        status: (t.status as string) ?? "not_started",
        priority: (t.priority as ExtractedTask["priority"]) ?? "Medium",
        planned_start: t.planned_start ?? null,
        planned_end: t.planned_end ?? null,
        actual_start: t.actual_start ?? null,
        actual_end: t.actual_end ?? null,
        ifr_date: t.ifr_date ?? null,
        ifa_date: t.ifa_date ?? null,
        ifc_date: t.ifc_date ?? null,
        blocked_by: Array.isArray(t.blocked_by) ? t.blocked_by : [],
        notes: t.notes ?? null,
        duplicate_of: dupId,
      };
    });

    // Compute summary
    const agencies = Array.from(new Set(tasks.map((t) => t.agency).filter(Boolean) as string[]));
    const rooms = Array.from(new Set(tasks.flatMap((t) => t.areas)));
    const delays = tasks.filter((t) =>
      t.planned_end && t.actual_end && t.actual_end > t.planned_end
    ).length;
    const dependencies = tasks.filter((t) => t.blocked_by.length > 0).length;
    const updates = tasks.filter((t) => t.duplicate_of).length;
    const creates = tasks.length - updates;

    return {
      tasks,
      summary: {
        create_count: creates,
        update_count: updates,
        agencies,
        rooms,
        delays,
        dependencies,
        groupUpdates: [],
      },
      original_language: parsed.original_language ?? "english",
      english_text: parsed.english_text ?? data.text,
    };
  });

// ----- Confirm + persist -----

const confirmSchema = z.object({
  projectId: z.string().uuid(),
  tasks: z.array(z.object({
    description: z.string(),
    agency: z.string().nullable(),
    work_type: z.string().nullable(),
    work_types: z.array(z.string()).default([]),
    areas: z.array(z.string()),
    room: z.string().nullable().optional(),
    completion_pct: z.number().int().min(0).max(100).default(0),
    status: z.string(),
    priority: z.string(),
    planned_start: z.string().nullable(),
    planned_end: z.string().nullable(),
    actual_start: z.string().nullable(),
    actual_end: z.string().nullable(),
    ifr_date: z.string().nullable(),
    ifa_date: z.string().nullable(),
    ifc_date: z.string().nullable(),
    blocked_by: z.array(z.string()),
    notes: z.string().nullable(),
    duplicate_of: z.string().nullable(),
  })),
});

// WORK_TYPE → lifecycle phase (mirror of src/lib/phase-sync.ts).
const WT_GROUP: Record<string, string> = {
  Survey: "Survey", Design: "Design", Procurement: "Procurement",
  Civil: "Execution", Electrical: "Execution",
  Plumbing: "Execution", HVAC: "Execution",
  Flooring: "Execution", Tiling: "Execution", Carpentry: "Execution",
  Painting: "Finishing", "False Ceiling": "Finishing",
  Snags: "Finishing", Finishing: "Finishing",
  Handover: "Handover", Other: "Execution",
};

export type ConfirmResult = {
  created: number;
  updated: number;
  groupUpdates: { group: string; delta: number; pct: number }[];
  firedMilestones: { id: string; name: string; invoice_amount: number }[];
};

export const confirmNarrative = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => confirmSchema.parse(input))
  .handler(async ({ data, context }): Promise<ConfirmResult> => {
    const { supabase, userId } = context;

    // Snapshot before
    const { data: beforeRows } = await supabase
      .from("tasks").select("status,done,work_type,work_types,completion_pct")
      .eq("project_id", data.projectId);

    let created = 0;
    let updated = 0;
    const idByDesc = new Map<string, string>();

    for (const t of data.tasks) {
      const primaryArea = t.room ?? t.areas[0] ?? null;
      const phase = WT_GROUP[t.work_type ?? ""] ?? null;
      const payload = {
        title: t.description.slice(0, 200),
        description: t.description,
        agency: t.agency,
        contractor: t.agency,
        work_type: t.work_type,
        work_types: t.work_types ?? (t.work_type ? [t.work_type] : []),
        area: primaryArea,
        areas: t.areas,
        room: t.room ?? primaryArea,
        completion_pct: t.completion_pct,
        phase,
        status: t.status,
        priority: t.priority,
        planned_start: t.planned_start,
        planned_end: t.planned_end,
        actual_start: t.actual_start,
        actual_end: t.actual_end,
        ifr_date: t.ifr_date,
        ifa_date: t.ifa_date,
        ifc_date: t.ifc_date,
        start_date: t.actual_start ?? t.planned_start,
        due_date: t.actual_end ?? t.planned_end,
        notes: t.notes,
        done: t.status === "done",
        updated_at: new Date().toISOString(),
      };

      if (t.duplicate_of) {
        const { error } = await supabase.from("tasks").update(payload).eq("id", t.duplicate_of);
        if (!error) { updated++; idByDesc.set(t.description, t.duplicate_of); }
      } else {
        const { data: ins, error } = await supabase.from("tasks").insert({
          ...payload, user_id: userId, project_id: data.projectId,
        }).select("id").single();
        if (!error && ins) { created++; idByDesc.set(t.description, ins.id); }
      }
    }

    // Dependencies
    for (const t of data.tasks) {
      if (!t.blocked_by.length) continue;
      const selfId = idByDesc.get(t.description);
      if (!selfId) continue;
      const depIds: string[] = [];
      for (const dep of t.blocked_by) {
        const id = idByDesc.get(dep) ?? Array.from(idByDesc.entries())
          .find(([d]) => d.toLowerCase().includes(dep.toLowerCase().slice(0, 20)))?.[1];
        if (id) depIds.push(id);
      }
      if (depIds.length) {
        await supabase.from("tasks").update({ depends_on: depIds }).eq("id", selfId);
      }
    }

    // Snapshot after for group-diff toast
    const { data: afterRows } = await supabase
      .from("tasks").select("status,done,work_type,work_types,completion_pct")
      .eq("project_id", data.projectId);

    const groupUpdates = computeGroupDiff(beforeRows ?? [], afterRows ?? []);
    const firedMilestones = await evaluateMilestonesInline(supabase, userId, data.projectId);
    return { created, updated, groupUpdates, firedMilestones };
  });

type Row = { status: string | null; done: boolean | null; work_type: string | null; work_types: unknown; completion_pct: number | null };

function pctOf(r: Row): number {
  if (r.status === "done" || r.done) return 100;
  const c = typeof r.completion_pct === "number" ? r.completion_pct : 0;
  if (c > 0) return Math.min(100, c);
  if (r.status === "wip" || r.status === "in_progress") return 50;
  return 0;
}

function groupPct(rows: Row[]): Map<string, number> {
  const buckets = new Map<string, number[]>();
  rows.forEach((r) => {
    const wts: string[] = Array.isArray(r.work_types) ? (r.work_types as string[]) : (r.work_type ? [r.work_type] : []);
    wts.forEach((wt) => {
      const g = WT_GROUP[wt];
      if (!g) return;
      const arr = buckets.get(g) ?? [];
      arr.push(pctOf(r));
      buckets.set(g, arr);
    });
  });
  const out = new Map<string, number>();
  buckets.forEach((arr, g) => out.set(g, Math.round(arr.reduce((s, n) => s + n, 0) / Math.max(1, arr.length))));
  return out;
}

function computeGroupDiff(before: Row[], after: Row[]) {
  const b = groupPct(before);
  const a = groupPct(after);
  const out: { group: string; delta: number; pct: number }[] = [];
  a.forEach((pct, g) => {
    const prev = b.get(g) ?? 0;
    if (pct !== prev) out.push({ group: g, pct, delta: pct - prev });
  });
  return out;
}
