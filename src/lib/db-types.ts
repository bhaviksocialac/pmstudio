import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type DbProfile = Tables<"profiles">;
export type DbProject = Tables<"projects">;
export type DbClient = Tables<"clients">;
export type DbVendor = Tables<"vendors">;

export type ProjectInsert = TablesInsert<"projects">;
export type ClientInsert = TablesInsert<"clients">;
export type VendorInsert = TablesInsert<"vendors">;

export const PHASES = ["Survey", "Design", "Procurement", "Execution", "Finishing", "Handover"] as const;
export type Phase = typeof PHASES[number];

export const healthMap = {
  "on-track": { color: "#7a9e8a", label: "On track", pulse: "", line: "#7a9e8a" },
  attention: { color: "#d4882a", label: "Watch closely", pulse: "pulse-slow", line: "#d4882a" },
  urgent: { color: "#c4685a", label: "Urgent", pulse: "pulse-fast", line: "#c4685a" },
} as const;
