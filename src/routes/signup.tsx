import { createFileRoute, redirect } from "@tanstack/react-router";
import { AuthScreen } from "@/components/AuthScreen";
import { supabase } from "@/integrations/supabase/client";
import { PLANS } from "@/lib/plans";

const PLAN_KEYS = PLANS.map((p) => p.key) as string[];

export const Route = createFileRoute("/signup")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : "/dashboard",
    plan: typeof s.plan === "string" && PLAN_KEYS.includes(s.plan) ? s.plan : undefined,
  }),
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: search.redirect || "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Create your studio — PMStudio" },
      { name: "description", content: "Create your PMStudio workspace and run your design practice from one place." },
    ],
  }),
  component: () => <AuthScreen mode="signup" />,
});
