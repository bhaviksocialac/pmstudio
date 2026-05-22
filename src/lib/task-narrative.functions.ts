import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

const STATUSES = [
  "not_started", "selection_pending", "approval_pending", "quotation_pending",
  "order_placed", "payment_pending", "material_ordered", "material_delivered",
  "wip", "blocked", "done",
] as const;

const WORK_TYPES = [
  "Carpentry", "Civil", "Electrical", "False Ceiling", "Flooring",
  "HVAC", "Painting", "Plumbing", "Tiling", "Other",
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

AGENCY ASSIGNMENT RULES (CRITICAL):
- First-person verbs ("I showed…", "I sent…", "I visited…", "we met…", "our team did…") → agency = "${selfName || "Designer"}" (the designer themselves).
- A specific team member name from the TEAM MEMBERS list → agency = that team member's exact name.
- "Client approved / Client said / client visited" → agency = "Client".
- Any other named person/company (contractor, vendor) → agency = that name verbatim.
- Never leave agency null when a human/agent is clearly responsible.

LANGUAGE: The input may be English, Hindi (Devanagari), or Hinglish (romanised Hindi mixed with English). FIRST translate the entire narrative to clean English. Then extract tasks. All output (descriptions, agency names, areas) must be in English.

EXTRACTION RULES:
- Extract every distinct event as ONE task row. A single sentence may produce multiple tasks.
- "Client approved X" → task with agency = "Client"
- "X delivered tiles" → agency = "X", status = "material_delivered"
- "X started work" → status = "wip", actual_start = the date
- "X completed Y" → status = "done", actual_end = the date
- "quotation pending/given" → status = "quotation_pending"
- "selection pending" → status = "selection_pending"
- "50% payment" / "balance payment" → status = "payment_pending" or "wip" depending on context
- Date format input is DD.MM.YYYY or DD-MM-YYYY → output ISO YYYY-MM-DD
- planned_end: only if narrative says "supposed to complete in N days/weeks" or "need to complete by DATE"
- actual_end: only if narrative says completed/done on DATE
- If task A "pending due to" task B → blocked_by includes B's description
- Per-room partial completion → separate task per room (e.g. "flooring completed in Living Room" and "flooring completed in Kitchen" are TWO tasks)
- areas: ["Living Room"], ["Master Bedroom"], ["Kitchen"], ["Mandir"], ["Bathroom"], etc. Use ["All"] only when narrative says "entire house" AND no per-room detail follows.
- priority: default "Medium". Use "Urgent" only if narrative says urgent.
- work_type: one of ${WORK_TYPES.join(", ")}
- status: one of ${STATUSES.join(", ")}

IFR / IFA / IFC DATE DETECTION (drawing/approval lifecycle):
- IFR (Issue For Review) — keywords: "sent for review", "issued for review", "shared for feedback", "sent to check", "sent floor plan for review", "shared drawing"
- IFA (Issue For Approval) — keywords: "sent for approval", "client approved", "issued for approval", "approval given", "approval pending", "sent layout to client", "sent to client"
- IFC (Issue For Construction) — keywords: "issued for construction", "given to contractor", "construction started", "work issued", "IFC issued", "released to site"
When the narrative contains one of these triggers WITH a date, set ifr_date / ifa_date / ifc_date on the matching task. A single task may have all three across multiple sentences.

WORK TYPE AUTO-DETECTION — a single task may involve MULTIPLE work types. Set "work_types" as an array. Use these keyword cues:
- "tiles", "tiling", "grouting" → Tiling
- "flooring", "wooden floor", "marble floor", "laminate" → Flooring (often paired with Tiling)
- "electrical", "conduit", "wiring", "switchboard", "MCB" → Electrical
- "plumbing", "pipes", "CPVC", "drainage", "sanitary" → Plumbing
- "plaster", "masonry", "brickwork", "RCC", "demolition" → Civil
- "carpentry", "wardrobe", "modular", "shutter", "veneer" → Carpentry
- "painting", "primer", "putty", "POP finish" → Painting
- "false ceiling", "gypsum", "POP ceiling" → False Ceiling
- "AC", "HVAC", "duct", "VRV", "split unit" → HVAC
If unclear, leave work_types as [] and work_type as null. "work_type" should always be the first entry of "work_types" (or null).


Return JSON of shape:
{
  "english_text": "translated narrative",
  "original_language": "english" | "hindi" | "hinglish",
  "tasks": [
    {
      "description": "...",
      "agency": "Ramesh" | "Client" | null,
      "work_type": "Tiling",
      "work_types": ["Tiling", "Flooring"],
      "areas": ["Living Room"],
      "status": "done",
      "priority": "Medium",
      "planned_start": null,
      "planned_end": null,
      "actual_start": null,
      "actual_end": "2026-01-25",
      "ifr_date": null,
      "ifa_date": null,
      "ifc_date": null,
      "blocked_by": [],
      "notes": null
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

      let dupId: string | null = null;
      for (const ex of existingList) {
        const sameDesc = norm(ex.desc).includes(norm(description).slice(0, 30)) ||
          norm(description).includes(norm(ex.desc).slice(0, 30));
        const sameAgency = norm(ex.agency) === norm(agency ?? "");
        const overlapArea = areas.length === 0 || ex.areas.length === 0 ||
          areas.some((a) => ex.areas.map(norm).includes(norm(a)));
        const sameWorkType = !wt || !ex.work_type || norm(wt) === norm(ex.work_type);
        if (sameDesc && sameAgency && overlapArea && sameWorkType) {
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

export const confirmNarrative = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => confirmSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ created: number; updated: number }> => {
    const { supabase, userId } = context;
    let created = 0;
    let updated = 0;

    // First pass: create or update, capture id by description for dependency wiring
    const idByDesc = new Map<string, string>();

    for (const t of data.tasks) {
      const primaryArea = t.areas[0] ?? null;
      const payload = {
        title: t.description.slice(0, 200),
        description: t.description,
        agency: t.agency,
        contractor: t.agency,
        work_type: t.work_type,
        work_types: t.work_types ?? (t.work_type ? [t.work_type] : []),
        area: primaryArea,
        areas: t.areas,
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
        if (!error) {
          updated++;
          idByDesc.set(t.description, t.duplicate_of);
        }
      } else {
        const { data: ins, error } = await supabase.from("tasks").insert({
          ...payload,
          user_id: userId,
          project_id: data.projectId,
        }).select("id").single();
        if (!error && ins) {
          created++;
          idByDesc.set(t.description, ins.id);
        }
      }
    }

    // Second pass: wire dependencies
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

    return { created, updated };
  });
