import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { WhatsAppGroupsSettings } from "@/components/WhatsAppGroupsSettings";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — PMStudio" },
      { name: "description", content: "Configure WhatsApp groups, integrations, and studio preferences." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <AppShell>
      <main className="px-4 md:px-8 py-8 md:py-10 max-w-[1100px] w-full pb-24 md:pb-10">
        <div className="mb-8">
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-3">Studio</div>
          <h1 className="font-display text-4xl md:text-5xl">Settings</h1>
          <p className="text-muted-foreground mt-2">Connect channels and control routing</p>
        </div>
        <WhatsAppGroupsSettings />
      </main>
    </AppShell>
  );
}
