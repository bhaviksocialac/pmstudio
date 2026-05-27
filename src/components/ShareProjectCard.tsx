import { useState } from "react";
import { Share2, MessageCircle, Copy, Check, X } from "lucide-react";
import { toast } from "sonner";

export type ClientInfo = {
  name: string;
  phone: string | null;
  email: string | null;
};

export type ProjectShareInfo = {
  id: string;
  name: string;
  type: string;
  phase: string;
  flatNumber: string | null;
  street: string | null;
  city: string | null;
  pincode: string | null;
  location: string | null;
};

type ShareKey =
  | "siteAddress"
  | "clientName"
  | "clientPhone"
  | "clientEmail"
  | "projectInfo"
  | "currentPhase"
  | "portalLink";

const LABELS: Record<ShareKey, string> = {
  siteAddress: "Site Address",
  clientName: "Client Name",
  clientPhone: "Client Phone",
  clientEmail: "Client Email",
  projectInfo: "Project Name and Type",
  currentPhase: "Current Phase",
  portalLink: "Client Portal Link",
};

const DEFAULT_SELECTED: ShareKey[] = [
  "projectInfo",
  "currentPhase",
];

function buildPortalUrl(projectId: string): string {
  if (typeof window === "undefined") return `/portal/${projectId}`;
  return `${window.location.origin}/portal/${projectId}`;
}

function buildShareMessage(
  project: ProjectShareInfo,
  client: ClientInfo | null,
  selected: Set<ShareKey>,
): string {
  const lines: string[] = [];

  if (selected.has("projectInfo")) {
    lines.push(`Project: ${project.name} (${project.type})`);
  }
  if (selected.has("clientName") && client?.name) {
    lines.push(`Client: ${client.name}`);
  }
  if (selected.has("siteAddress")) {
    const parts = [
      project.flatNumber,
      project.street,
      project.city,
      project.pincode,
    ].filter(Boolean);
    if (parts.length) {
      lines.push(`Site: ${parts.join(", ")}`);
    } else if (project.location) {
      lines.push(`Site: ${project.location}`);
    }
  }
  if (selected.has("currentPhase")) {
    lines.push(`Phase: ${project.phase}`);
  }
  if (selected.has("clientPhone") && client?.phone) {
    lines.push(`Phone: ${client.phone}`);
  }
  if (selected.has("clientEmail") && client?.email) {
    lines.push(`Email: ${client.email}`);
  }
  if (selected.has("portalLink")) {
    lines.push(`Portal: ${buildPortalUrl(project.id)}`);
  }

  return lines.join("\n");
}

export function ShareProjectCard({
  project,
  client,
}: {
  project: ProjectShareInfo;
  client: ClientInfo | null;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<ShareKey>>(new Set(DEFAULT_SELECTED));
  const [copied, setCopied] = useState(false);

  const toggle = (key: ShareKey) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };

  const message = buildShareMessage(project, client, selected);
  const hasSelection = selected.size > 0;

  const handleCopy = async () => {
    if (!hasSelection) {
      toast.error("Select at least one item to share");
      return;
    }
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy");
    }
  };

  const handleWhatsApp = () => {
    if (!hasSelection) {
      toast.error("Select at least one item to share");
      return;
    }
    const text = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  return (
    <>
      <div className="rounded-[16px] bg-card border border-border p-6" style={{ boxShadow: "var(--shadow-card)" }}>
        <h3 className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-3">Share</h3>
        <button
          onClick={() => setOpen(true)}
          className="w-full h-10 rounded-[6px] bg-[#c17f5a] text-white text-sm font-medium inline-flex items-center justify-center gap-1.5 hover:brightness-95 transition-colors"
        >
          <Share2 className="h-3.5 w-3.5" /> Share Project Details
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-[16px] bg-card border border-border shadow-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display text-xl">Share Project Info</h3>
              <button
                onClick={() => setOpen(false)}
                className="h-8 w-8 inline-flex items-center justify-center rounded-[6px] hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-3">What to Share</div>
            <div className="space-y-2 mb-6">
              {(Object.keys(LABELS) as ShareKey[]).map((key) => (
                <label
                  key={key}
                  className="flex items-center gap-3 p-2.5 rounded-[10px] border border-border hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(key)}
                    onChange={() => toggle(key)}
                    className="h-4 w-4 rounded border-border accent-[#c17f5a] shrink-0"
                  />
                  <span className="text-sm">{LABELS[key]}</span>
                </label>
              ))}
            </div>

            {hasSelection && (
              <div className="mb-5">
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Preview</div>
                <div className="rounded-[10px] bg-muted p-3 text-sm whitespace-pre-wrap font-mono text-foreground/80">
                  {message}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleWhatsApp}
                disabled={!hasSelection}
                className="h-10 rounded-[6px] bg-[#25D366] text-white text-sm font-medium inline-flex items-center justify-center gap-1.5 hover:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </button>
              <button
                onClick={handleCopy}
                disabled={!hasSelection}
                className="h-10 rounded-[6px] border border-border bg-card text-sm font-medium inline-flex items-center justify-center gap-1.5 hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {copied ? <Check className="h-4 w-4 text-[#7a9e8a]" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
