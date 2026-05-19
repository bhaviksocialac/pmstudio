import { Clock } from "lucide-react";

/** Tag colour: green ≤ 24h, yellow 1-3d, red > 3d. */
export function freshnessLevel(updatedAt: string | Date | null | undefined): "green" | "yellow" | "red" {
  if (!updatedAt) return "red";
  const ageHrs = (Date.now() - new Date(updatedAt).getTime()) / 3600000;
  if (ageHrs <= 24) return "green";
  if (ageHrs <= 72) return "yellow";
  return "red";
}

const styles = {
  green: { bg: "rgba(122,158,138,0.15)", color: "#5b7d6e", label: "Fresh" },
  yellow: { bg: "rgba(212,136,42,0.15)", color: "#a06520", label: "Aging" },
  red: { bg: "rgba(196,104,90,0.15)", color: "#9a4538", label: "Stale" },
} as const;

export function FreshnessTag({
  updatedAt,
  showLabel = true,
}: {
  updatedAt: string | Date | null | undefined;
  showLabel?: boolean;
}) {
  const level = freshnessLevel(updatedAt);
  const s = styles[level];
  const ageHrs = updatedAt ? Math.round((Date.now() - new Date(updatedAt).getTime()) / 3600000) : null;
  const ageLabel = ageHrs == null ? "—" : ageHrs < 24 ? `${ageHrs}h` : `${Math.round(ageHrs / 24)}d`;
  return (
    <span
      title={level === "red" ? "Refresh before sharing with client" : `Updated ${ageLabel} ago`}
      className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded-[4px]"
      style={{ background: s.bg, color: s.color }}
    >
      <Clock className="h-2.5 w-2.5" />
      {showLabel ? `${s.label} · ${ageLabel}` : ageLabel}
    </span>
  );
}
