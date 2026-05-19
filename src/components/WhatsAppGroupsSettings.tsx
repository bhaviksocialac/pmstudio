import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Check, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

type Kind = "client" | "design" | "execution" | "accounts";
const KINDS: { kind: Kind; defaultLabel: string; hint: string }[] = [
  { kind: "client", defaultLabel: "Client Group", hint: "For client-facing updates" },
  { kind: "design", defaultLabel: "Design Group", hint: "Renders, drawings, mood-boards" },
  { kind: "execution", defaultLabel: "Execution Group", hint: "Site, vendors, deliveries" },
  { kind: "accounts", defaultLabel: "Accounts Group", hint: "Invoices and payments" },
];

type Row = { id: string; kind: Kind; label: string; phone: string | null };

export function WhatsAppGroupsSettings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["whatsapp_groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_groups")
        .select("id, kind, label, phone");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const byKind = new Map(rows.map((r) => [r.kind, r]));

  return (
    <section className="rounded-[16px] bg-card border border-border p-5 md:p-6" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-2 mb-4">
        <div className="h-9 w-9 rounded-[10px] bg-[#25D366]/15 text-[#25D366] flex items-center justify-center">
          <MessageCircle className="h-4 w-4" />
        </div>
        <div>
          <h2 className="font-display text-xl">WhatsApp Groups</h2>
          <p className="text-xs text-muted-foreground">Route the right messages to the right group</p>
        </div>
      </div>
      {isLoading ? (
        <div className="p-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-3">
          {KINDS.map((k) => (
            <GroupRow
              key={k.kind}
              kind={k.kind}
              defaultLabel={k.defaultLabel}
              hint={k.hint}
              existing={byKind.get(k.kind)}
              userId={user!.id}
              onSaved={() => qc.invalidateQueries({ queryKey: ["whatsapp_groups"] })}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function GroupRow({
  kind, defaultLabel, hint, existing, userId, onSaved,
}: {
  kind: Kind; defaultLabel: string; hint: string;
  existing: Row | undefined; userId: string; onSaved: () => void;
}) {
  const [label, setLabel] = useState(existing?.label ?? defaultLabel);
  const [phone, setPhone] = useState(existing?.phone ?? "");

  useEffect(() => {
    setLabel(existing?.label ?? defaultLabel);
    setPhone(existing?.phone ?? "");
  }, [existing, defaultLabel]);

  const save = useMutation({
    mutationFn: async () => {
      const cleanPhone = phone.trim().replace(/[^\d+]/g, "");
      if (label.length > 100) throw new Error("Label too long");
      if (cleanPhone && cleanPhone.length > 20) throw new Error("Phone too long");
      if (existing) {
        const { error } = await supabase
          .from("whatsapp_groups")
          .update({ label: label.trim() || defaultLabel, phone: cleanPhone || null })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("whatsapp_groups").insert({
          user_id: userId,
          kind,
          label: label.trim() || defaultLabel,
          phone: cleanPhone || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(`${defaultLabel} saved`); onSaved(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="rounded-[10px] border border-border bg-background p-4">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-[10px] uppercase tracking-[0.18em] font-mono text-muted-foreground">{kind}</div>
        <div className="text-[11px] text-muted-foreground">{hint}</div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
        <input
          value={label}
          maxLength={100}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Group label"
          className="h-10 px-3 rounded-[8px] border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
        />
        <input
          value={phone}
          maxLength={20}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+91 9876543210"
          className="h-10 px-3 rounded-[8px] border border-border bg-card text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring/30"
        />
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="h-10 px-4 rounded-[6px] bg-primary text-primary-foreground text-xs font-medium inline-flex items-center gap-1.5 hover:brightness-95 disabled:opacity-60"
        >
          {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Save
        </button>
      </div>
    </div>
  );
}
