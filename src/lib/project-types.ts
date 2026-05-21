export const PROPERTY_TYPES = [
  { value: "residential_apartment", label: "Residential Apartment" },
  { value: "independent_villa", label: "Independent Villa" },
  { value: "penthouse", label: "Penthouse" },
  { value: "commercial_office", label: "Commercial Office" },
  { value: "retail_shop", label: "Retail Shop" },
  { value: "restaurant", label: "Restaurant" },
  { value: "hotel_room", label: "Hotel Room" },
  { value: "other", label: "Other" },
] as const;

export const PROPERTY_VALUES = PROPERTY_TYPES.map((p) => p.value) as readonly string[];

export function labelForProjectType(value: string | null | undefined): string {
  if (!value) return "Other";
  const m = PROPERTY_TYPES.find((p) => p.value === value);
  if (m) return m.label;
  // Legacy fallbacks
  if (value === "residential") return "Residential Apartment";
  if (value === "commercial") return "Commercial Office";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
