import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { WORK_TYPES as DEFAULT_WORK_TYPES } from "@/lib/task-flow";

export type WorkTypeRow = {
  id: string;
  user_id: string;
  name: string;
  is_default_hidden: boolean;
};

/**
 * Loads default work types + user's custom work types from public.work_types.
 * Custom types added here are shared across ALL projects/tasks for that designer.
 *
 * A row with `is_default_hidden = true` and a `name` matching a default value
 * means the designer has hidden that default option from their dropdowns.
 */
export function useWorkTypes() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["work-types", user?.id ?? null],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_types")
        .select("id,user_id,name,is_default_hidden")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as WorkTypeRow[];
    },
    staleTime: 60_000,
  });

  const rows = q.data ?? [];

  const hiddenDefaults = useMemo(() => {
    const s = new Set<string>();
    rows
      .filter((r) => r.is_default_hidden)
      .forEach((r) => s.add(r.name.toLowerCase()));
    return s;
  }, [rows]);

  const customs = useMemo(
    () => rows.filter((r) => !r.is_default_hidden),
    [rows],
  );

  const options = useMemo(() => {
    const defaults = DEFAULT_WORK_TYPES.filter(
      (w) => !hiddenDefaults.has(w.toLowerCase()),
    );
    const customNames = customs
      .map((r) => r.name)
      .filter(
        (n) => !DEFAULT_WORK_TYPES.some((d) => d.toLowerCase() === n.toLowerCase()),
      );
    // de-dupe case-insensitive
    const seen = new Set<string>();
    const out: string[] = [];
    [...defaults, ...customNames].forEach((n) => {
      const k = n.toLowerCase();
      if (seen.has(k)) return;
      seen.add(k);
      out.push(n);
    });
    return out;
  }, [customs, hiddenDefaults]);

  const addMut = useMutation({
    mutationFn: async (rawName: string) => {
      const name = rawName.trim();
      if (!name) throw new Error("Empty");
      if (!user) throw new Error("Not signed in");
      // Skip if already exists for this user (any case)
      const existing = rows.find(
        (r) => r.name.toLowerCase() === name.toLowerCase() && !r.is_default_hidden,
      );
      if (existing) return existing;
      const { data, error } = await supabase
        .from("work_types")
        .insert({ user_id: user.id, name, is_default_hidden: false })
        .select("id,user_id,name,is_default_hidden")
        .single();
      if (error) throw error;
      return data as WorkTypeRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-types", user?.id ?? null] });
    },
    onError: (e) => {
      // Unique violation = already exists, ignore silently
      const msg = e instanceof Error ? e.message : String(e);
      if (!/duplicate|unique/i.test(msg)) toast.error(msg);
    },
  });

  const renameMut = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from("work_types")
        .update({ name: name.trim() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["work-types", user?.id ?? null] }),
  });

  const removeMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("work_types").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["work-types", user?.id ?? null] }),
  });

  const hideDefaultMut = useMutation({
    mutationFn: async ({ name, hide }: { name: string; hide: boolean }) => {
      if (!user) throw new Error("Not signed in");
      if (hide) {
        const { error } = await supabase
          .from("work_types")
          .insert({ user_id: user.id, name, is_default_hidden: true });
        if (error && !/duplicate|unique/i.test(error.message)) throw error;
      } else {
        const row = rows.find(
          (r) => r.is_default_hidden && r.name.toLowerCase() === name.toLowerCase(),
        );
        if (row) {
          const { error } = await supabase.from("work_types").delete().eq("id", row.id);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["work-types", user?.id ?? null] }),
  });

  const addWorkType = useCallback(
    (name: string) => addMut.mutate(name),
    [addMut],
  );

  return {
    isLoading: q.isLoading,
    options,
    customs,
    defaults: DEFAULT_WORK_TYPES as readonly string[],
    hiddenDefaults,
    addWorkType,
    rename: (id: string, name: string) => renameMut.mutateAsync({ id, name }),
    remove: (id: string) => removeMut.mutateAsync(id),
    setDefaultHidden: (name: string, hide: boolean) =>
      hideDefaultMut.mutateAsync({ name, hide }),
  };
}
