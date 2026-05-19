import { createFileRoute, redirect } from "@tanstack/react-router";
import { AuthScreen } from "@/components/AuthScreen";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/signup")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : "/",
  }),
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: search.redirect || "/" });
  },
  head: () => ({
    meta: [
      { title: "Create your studio — StudioOS" },
      { name: "description", content: "Create your StudioOS workspace and run your design practice from one place." },
    ],
  }),
  component: () => <AuthScreen mode="signup" />,
});
