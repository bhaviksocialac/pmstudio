import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const idSchema = () => z.object({ projectId: z.string().uuid() });

export const getPortalData = createServerFn({ method: "GET" })
  .inputValidator((input) => idSchema().parse(input))
  .handler(async ({ data }) => {
    const { projectId } = data;
    const admin = supabaseAdmin;

    const { data: project, error: pErr } = await admin
      .from("projects")
      .select("id, name, phase, completion, budget, spent, expected_handover, start_date, client_id, location, type")
      .eq("id", projectId)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!project) return null;

    const [{ data: client }, { data: phases }, { data: budgetLines }, { data: tasks }, { data: photos }, { data: approvals }] =
      await Promise.all([
        project.client_id
          ? admin.from("clients").select("id, name").eq("id", project.client_id).maybeSingle()
          : Promise.resolve({ data: null }),
        admin.from("project_phases").select("phase, order_index, start_date, end_date, status").eq("project_id", projectId).order("order_index"),
        admin.from("budget_lines").select("category, percentage, amount, order_index").eq("project_id", projectId).order("order_index"),
        admin.from("tasks").select("id, title, due_date, done, updated_at").eq("project_id", projectId).order("due_date", { ascending: true }),
        admin.from("photos").select("id, room, caption, storage_path, created_at").eq("project_id", projectId).order("created_at", { ascending: false }),
        admin.from("approvals").select("id, title, status, created_at, approved_at").eq("project_id", projectId).order("created_at", { ascending: false }),
      ]);

    return {
      project: {
        id: project.id,
        name: project.name,
        phase: project.phase,
        completion: project.completion,
        budget: Number(project.budget ?? 0),
        spent: Number(project.spent ?? 0),
        expected_handover: project.expected_handover,
        start_date: project.start_date,
        location: project.location,
        type: project.type,
      },
      client: client ? { name: (client as { name: string }).name } : null,
      phases: phases ?? [],
      budgetLines: budgetLines ?? [],
      tasks: tasks ?? [],
      photos: photos ?? [],
      approvals: approvals ?? [],
    };
  });

const approvalSchema = () =>
  z.object({
    projectId: z.string().uuid(),
    approvalId: z.string().uuid(),
    action: z.enum(["approve", "request_change"]),
    phrase: z.string().optional(),
  });

export const submitApproval = createServerFn({ method: "POST" })
  .inputValidator((input) => approvalSchema().parse(input))
  .handler(async ({ data }) => {
    const admin = supabaseAdmin;

    if (data.action === "approve") {
      const phrase = (data.phrase ?? "").trim().toLowerCase();
      const allowed = ["i approve", "मैं स्वीकार करता हूँ"];
      if (!allowed.includes(phrase)) {
        throw new Error("Confirmation phrase did not match");
      }
    }

    const { data: existing } = await admin
      .from("approvals")
      .select("id")
      .eq("id", data.approvalId)
      .eq("project_id", data.projectId)
      .maybeSingle();
    if (!existing) throw new Error("Approval not found");

    const update =
      data.action === "approve"
        ? { status: "approved" as const, approved_at: new Date().toISOString() }
        : { status: "rejected" as const };

    const { error } = await admin.from("approvals").update(update).eq("id", data.approvalId);
    if (error) throw error;
    return { ok: true };
  });
