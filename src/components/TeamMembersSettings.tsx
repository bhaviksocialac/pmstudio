import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

const ROLES = ["Designer", "Project Manager", "Site Supervisor", "Draftsman", "Other"] as const;

type TeamMember = { id: string; name: string; role: string };

export function TeamMembersSettings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [role, setRole] = useState<string>("Designer");
  const [saving, setSaving] = useState(false);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data, error } = await supabase.from("team_members").select("id,name,role").order("created_at");
      if (error) throw error;
      return (data ?? []) as TeamMember[];
    },
  });

  const add = async () => {
    if (!name.trim() || !user?.id) return;
    setSaving(true);
    const { error } = await supabase.from("team_members").insert({ user_id: user.id, name: name.trim(), role });
    setSaving(false);
    if (error) return toast.error(error.message);
    setName("");
    qc.invalidateQueries({ queryKey: ["team-members"] });
    toast.success("Team member added");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("team_members").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["team-members"] });
  };

  return (
    <section className="rounded-[16px] bg-card border border-border p-6" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-2 mb-1">
        <Users className="h-4 w-4 text-[#c17f5a]" />
        <h2 className="font-display text-xl">My Team</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Team members appear at the top of every Agency dropdown across all projects.
      </p>

      <div className="flex flex-wrap gap-2 items-end mb-5">
        <div className="flex-1 min-w-[180px]">
          <label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Bhavik"
            className="mt-1 w-full h-9 px-3 rounded-[8px] bg-white border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
        </div>
        <div className="w-[180px]">
          <label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="mt-1 w-full h-9 px-3 rounded-[8px] bg-white border border-border text-sm"
          >
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <button
          onClick={add}
          disabled={!name.trim() || saving}
          className="h-9 px-4 rounded-[8px] bg-[#c17f5a] text-white text-sm font-medium hover:brightness-95 inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add
        </button>
      </div>

      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : members.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No team members yet.</p>
      ) : (
        <ul className="divide-y divide-border border border-border rounded-[10px] overflow-hidden">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between px-3 py-2 bg-white">
              <div className="flex items-center gap-3">
                <span className="inline-block h-2 w-2 rounded-full bg-[#c17f5a]" />
                <span className="text-sm font-medium">{m.name}</span>
                <span className="text-[11px] text-muted-foreground">{m.role}</span>
              </div>
              <button
                onClick={() => remove(m.id)}
                className="h-7 w-7 rounded-[6px] hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-[#8a2a1f]"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
