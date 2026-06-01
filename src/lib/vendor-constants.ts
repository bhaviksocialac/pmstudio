// Shared work category constants for the vendor system.
export const DEFAULT_WORK_CATEGORIES = [
  "Civil","Carpentry","Electrical","Plumbing","Flooring","Painting","HVAC",
  "Networking","Tiling","False Ceiling","Furniture","Lighting","Sanitary",
  "Tiles Supply","Hardware Supply","Other",
] as const;

export const PAYMENT_TERM_PRESETS = [
  "100% Advance","50-50","On Completion","30 Days Credit","Custom",
];

export const SCOPE_TAG_LABEL: Record<string, string> = {
  supply_fix: "Supply & Fix",
  supply_only: "Supply Only",
  labour_only: "Labour Only",
  provisional: "Provisional",
  excluded: "Excluded",
};

export const MILESTONE_TRIGGERS: { value: string; label: string }[] = [
  { value: "on_signing", label: "On contract signing" },
  { value: "on_start", label: "On work start" },
  { value: "on_delivery", label: "On delivery" },
  { value: "on_completion", label: "On completion" },
  { value: "custom", label: "Custom" },
];
