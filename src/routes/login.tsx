import { createFileRoute, redirect } from "@tanstack/react-router";
import { AuthScreen } from "@/components/AuthScreen";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : "/",
  }),
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: search.redirect || "/" });
  },
  head: () => ({
    meta: [
      { title: "Sign in — PMStudio" },
      { name: "description", content: "Sign in to your PMStudio design command centre." },
    ],
  }),
  component: () => <AuthScreen mode="login" />,
});
