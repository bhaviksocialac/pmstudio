import { Share2 } from "lucide-react";
import { toast } from "sonner";

export function buildPortalUrl(projectId: string): string {
  if (typeof window === "undefined") return `/portal/${projectId}`;
  return `${window.location.origin}/portal/${projectId}`;
}

export async function copyPortalLink(projectId: string) {
  const url = buildPortalUrl(projectId);
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Portal link copied. Share with your client.");
  } catch {
    toast.error("Couldn't copy link. Long-press to copy: " + url);
  }
}

export function SharePortalButton({
  projectId,
  variant = "outline",
  size = "md",
  label = "Share Client Portal",
  className = "",
  stopPropagation = true,
}: {
  projectId: string;
  variant?: "outline" | "solid" | "ghost";
  size?: "sm" | "md";
  label?: string;
  className?: string;
  stopPropagation?: boolean;
}) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-[6px] font-medium transition-colors";
  const sizes = size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm";
  const variants = {
    outline: "border border-border bg-card hover:bg-muted text-foreground",
    solid: "bg-primary text-primary-foreground hover:brightness-95",
    ghost: "text-muted-foreground hover:text-foreground hover:bg-muted",
  }[variant];

  return (
    <button
      type="button"
      onClick={(e) => {
        if (stopPropagation) {
          e.preventDefault();
          e.stopPropagation();
        }
        void copyPortalLink(projectId);
      }}
      className={`${base} ${sizes} ${variants} ${className}`}
    >
      <Share2 className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} /> {label}
    </button>
  );
}
