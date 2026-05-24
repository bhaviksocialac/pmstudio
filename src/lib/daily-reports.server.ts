import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type ReportSummary = {
  date: string;
  projectName: string;
  workersTotal: number;
  workersByTrade: Record<string, number>;
  tasksDone: { trade: string; items: { title: string; room?: string | null; contractor?: string | null }[] }[];
  tasksUpdated: number;
  photosCount: number;
  snags: { description: string; room?: string | null; priority?: string | null }[];
  issues: string[];
  tomorrow: { title: string; room?: string | null; due_date?: string | null }[];
};

function startEndOfDay(dateISO: string) {
  const start = new Date(`${dateISO}T00:00:00.000Z`).toISOString();
  const end = new Date(`${dateISO}T23:59:59.999Z`).toISOString();
  return { start, end };
}

function tradeOf(t: { work_type?: string | null; phase?: string | null }) {
  return (t.work_type || t.phase || "General").toString();
}

/** Decode the structured worker breakdown the AttendanceTab encodes into work_done. */
function decodeAttendance(work_done: string | null): {
  contractor?: string;
  types?: { name: string; count: number }[];
} | null {
  if (!work_done?.startsWith("MB:")) return null;
  try {
    return JSON.parse(work_done.slice(3));
  } catch {
    return null;
  }
}

export async function gatherReportData(projectId: string, dateISO: string): Promise<{
  ok: true;
  project: { id: string; user_id: string; name: string; client_id: string | null };
  summary: ReportSummary;
} | { ok: false; reason: string }> {
  const { data: project } = await supabaseAdmin
    .from("projects")
    .select("id, user_id, name, client_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { ok: false, reason: "project_not_found" };

  const { start, end } = startEndOfDay(dateISO);
  const tomorrowISO = new Date(new Date(dateISO).getTime() + 86400000).toISOString().slice(0, 10);

  // Tasks updated today (broad — used to detect activity); split into "done today" vs "in-progress"
  const { data: updatedTasks = [] } = await supabaseAdmin
    .from("tasks")
    .select("id, title, work_type, phase, room, contractor, done, status, actual_end, updated_at, due_date")
    .eq("project_id", projectId)
    .gte("updated_at", start)
    .lte("updated_at", end);

  const doneToday = (updatedTasks ?? []).filter(
    (t) => t.done || t.status === "done" || t.actual_end === dateISO,
  );

  const tasksDoneMap = new Map<string, ReportSummary["tasksDone"][number]>();
  for (const t of doneToday) {
    const trade = tradeOf(t);
    if (!tasksDoneMap.has(trade)) tasksDoneMap.set(trade, { trade, items: [] });
    tasksDoneMap.get(trade)!.items.push({ title: t.title, room: t.room, contractor: t.contractor });
  }

  // Attendance today
  const { data: attendance = [] } = await supabaseAdmin
    .from("site_attendance")
    .select("workers_count, work_done")
    .eq("project_id", projectId)
    .eq("attendance_date", dateISO);

  let workersTotal = 0;
  const workersByTrade: Record<string, number> = {};
  for (const a of attendance ?? []) {
    workersTotal += a.workers_count ?? 0;
    const decoded = decodeAttendance(a.work_done);
    if (decoded?.types?.length) {
      const sum = decoded.types.reduce((s, ty) => s + (ty.count || 0), 0);
      const label = decoded.contractor || "Other";
      workersByTrade[label] = (workersByTrade[label] ?? 0) + sum;
    }
  }

  // Photos uploaded today
  const { count: photosCount = 0 } = await supabaseAdmin
    .from("photos")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .gte("created_at", start)
    .lte("created_at", end);

  // Snags raised today
  const { data: snags = [] } = await supabaseAdmin
    .from("snags")
    .select("description, room, priority")
    .eq("project_id", projectId)
    .gte("created_at", start)
    .lte("created_at", end);

  // Pending tasks for tomorrow
  const { data: tomorrowTasks = [] } = await supabaseAdmin
    .from("tasks")
    .select("title, room, due_date, status, done")
    .eq("project_id", projectId)
    .eq("done", false)
    .or(`due_date.eq.${tomorrowISO},status.eq.in_progress`)
    .limit(15);

  const summary: ReportSummary = {
    date: dateISO,
    projectName: project.name,
    workersTotal,
    workersByTrade,
    tasksDone: Array.from(tasksDoneMap.values()),
    tasksUpdated: updatedTasks?.length ?? 0,
    photosCount: photosCount ?? 0,
    snags: (snags ?? []).map((s) => ({
      description: s.description,
      room: s.room,
      priority: s.priority,
    })),
    issues: [],
    tomorrow: (tomorrowTasks ?? []).map((t) => ({
      title: t.title,
      room: t.room,
      due_date: t.due_date,
    })),
  };

  return { ok: true, project, summary };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function buildReportPdf(summary: ReportSummary): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 50;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Daily Site Report", 40, y);
  y += 24;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(110);
  doc.text(summary.projectName, 40, y);
  doc.text(fmtDate(summary.date), pageW - 40, y, { align: "right" });
  y += 8;
  doc.setDrawColor(220);
  doc.line(40, y, pageW - 40, y);
  y += 18;
  doc.setTextColor(30);

  // KPI strip
  doc.setFontSize(10);
  doc.setTextColor(110);
  const kpis = [
    `Workers on site: ${summary.workersTotal}`,
    `Tasks completed: ${summary.tasksDone.reduce((s, g) => s + g.items.length, 0)}`,
    `Photos uploaded: ${summary.photosCount}`,
    `Snags raised: ${summary.snags.length}`,
  ];
  doc.text(kpis.join("    •    "), 40, y);
  y += 20;

  const section = (title: string) => {
    if (y > 760) {
      doc.addPage();
      y = 50;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30);
    doc.text(title, 40, y);
    y += 14;
  };

  // Work done today
  section("Work done today");
  if (summary.tasksDone.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(140);
    doc.text("No tasks were marked complete today.", 40, y);
    y += 18;
  } else {
    for (const group of summary.tasksDone) {
      autoTable(doc, {
        startY: y,
        head: [[group.trade]],
        body: group.items.map((i) => [
          [i.title, i.room ? `(${i.room})` : "", i.contractor ? `— ${i.contractor}` : ""]
            .filter(Boolean)
            .join(" "),
        ]),
        theme: "grid",
        headStyles: { fillColor: [193, 127, 90], textColor: 255, fontStyle: "bold" },
        styles: { fontSize: 10, cellPadding: 6 },
        margin: { left: 40, right: 40 },
      });
      // @ts-expect-error autoTable plugin attaches lastAutoTable
      y = (doc as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;
    }
  }

  // Workers
  section("Attendance");
  const tradeRows = Object.entries(summary.workersByTrade);
  if (tradeRows.length) {
    autoTable(doc, {
      startY: y,
      head: [["Trade / Contractor", "Workers"]],
      body: tradeRows.map(([k, v]) => [k, String(v)]),
      foot: [["Total", String(summary.workersTotal)]],
      theme: "striped",
      headStyles: { fillColor: [60, 60, 60], textColor: 255 },
      footStyles: { fillColor: [240, 235, 225], textColor: 30, fontStyle: "bold" },
      styles: { fontSize: 10, cellPadding: 6 },
      margin: { left: 40, right: 40 },
    });
    // @ts-expect-error plugin
    y = (doc as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(140);
    doc.text(`Total workers present: ${summary.workersTotal}`, 40, y);
    y += 18;
  }

  // Snags
  section("Snags raised today");
  if (summary.snags.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(140);
    doc.text("No new snags reported.", 40, y);
    y += 18;
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Description", "Room", "Priority"]],
      body: summary.snags.map((s) => [s.description, s.room ?? "—", s.priority ?? "—"]),
      theme: "grid",
      headStyles: { fillColor: [196, 104, 90], textColor: 255 },
      styles: { fontSize: 10, cellPadding: 6 },
      margin: { left: 40, right: 40 },
    });
    // @ts-expect-error plugin
    y = (doc as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;
  }

  // Tomorrow
  section("Planned for tomorrow");
  if (summary.tomorrow.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(140);
    doc.text("No tasks scheduled.", 40, y);
    y += 18;
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Task", "Room", "Due"]],
      body: summary.tomorrow.map((t) => [t.title, t.room ?? "—", t.due_date ?? "—"]),
      theme: "grid",
      headStyles: { fillColor: [122, 158, 138], textColor: 255 },
      styles: { fontSize: 10, cellPadding: 6 },
      margin: { left: 40, right: 40 },
    });
  }

  // Footer
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text(
      `${summary.projectName} • ${fmtDate(summary.date)} • Generated by PMStudio`,
      40,
      doc.internal.pageSize.getHeight() - 24,
    );
    doc.text(`Page ${i} of ${pages}`, pageW - 40, doc.internal.pageSize.getHeight() - 24, {
      align: "right",
    });
  }

  return new Uint8Array(doc.output("arraybuffer"));
}

export async function generateAndStoreReport(projectId: string, dateISO: string) {
  // Idempotent: skip if a report already exists
  const { data: existing } = await supabaseAdmin
    .from("site_reports")
    .select("id, pdf_url")
    .eq("project_id", projectId)
    .eq("report_date", dateISO)
    .maybeSingle();
  if (existing?.pdf_url) {
    return { ok: true, skipped: "exists", id: existing.id, pdf_url: existing.pdf_url };
  }

  const res = await gatherReportData(projectId, dateISO);
  if (!res.ok) return { ok: false, error: res.reason };
  const { project, summary } = res;

  const pdf = buildReportPdf(summary);
  const path = `${project.user_id}/${project.id}/reports/${dateISO}.pdf`;
  const { error: upErr } = await supabaseAdmin.storage
    .from("project-photos")
    .upload(path, pdf, { contentType: "application/pdf", upsert: true });
  if (upErr) return { ok: false, error: upErr.message };
  const { data: pub } = supabaseAdmin.storage.from("project-photos").getPublicUrl(path);
  const pdf_url = pub.publicUrl;

  const summaryJson = {
    workersTotal: summary.workersTotal,
    tasksCompleted: summary.tasksDone.reduce((s, g) => s + g.items.length, 0),
    photos: summary.photosCount,
    snags: summary.snags.length,
    tomorrow: summary.tomorrow.length,
  };

  if (existing) {
    await supabaseAdmin
      .from("site_reports")
      .update({
        pdf_url,
        summary: summaryJson,
        workers_present: summary.workersTotal,
        work_done: summary.tasksDone.map((g) => `${g.trade}: ${g.items.length}`).join(", "),
        auto_generated: true,
      })
      .eq("id", existing.id);
    return { ok: true, id: existing.id, pdf_url };
  }

  const { data: ins, error: insErr } = await supabaseAdmin
    .from("site_reports")
    .insert({
      user_id: project.user_id,
      project_id: project.id,
      report_date: dateISO,
      workers_present: summary.workersTotal,
      work_done: summary.tasksDone.map((g) => `${g.trade}: ${g.items.length}`).join(", "),
      issues: summary.snags.length ? `${summary.snags.length} new snag(s)` : null,
      photo_urls: [],
      pdf_url,
      summary: summaryJson,
      auto_generated: true,
    })
    .select("id")
    .single();
  if (insErr) return { ok: false, error: insErr.message };
  return { ok: true, id: ins!.id, pdf_url };
}
