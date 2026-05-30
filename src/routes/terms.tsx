import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — PMStudio" },
      { name: "description", content: "The terms that govern your use of PMStudio." },
    ],
  }),
  component: TermsPage,
});

const SECTIONS = [
  { title: "Acceptance", body: "Placeholder — by creating an account or using PMStudio you agree to these terms." },
  { title: "Subscription & Billing", body: "Placeholder — describe plan tiers, billing cycles, taxes, and renewal terms." },
  { title: "Acceptable Use", body: "Placeholder — outline what users may and may not do on the platform." },
  { title: "Cancellation & Refunds", body: "Placeholder — describe how to cancel and the refund policy." },
  { title: "Liability", body: "Placeholder — limit of liability and disclaimers." },
  { title: "Governing Law — India", body: "Placeholder — these terms are governed by the laws of India; disputes resolved in Mumbai courts." },
];

function TermsPage() {
  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#1a1612]">
      <link
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <header className="border-b border-[#e8e2d8]">
        <div className="max-w-3xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="font-display text-2xl" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            PMStudio
          </Link>
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-[#5a4f48] hover:text-[#c17f5a]">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-5 md:px-8 py-16 md:py-24">
        <div className="text-xs uppercase tracking-[0.22em] text-[#c17f5a] mb-4">Legal</div>
        <h1 className="font-display text-4xl md:text-5xl mb-6" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
          Terms of Service
        </h1>
        <p className="text-[#5a4f48] mb-12">Last updated: 2026</p>
        <div className="space-y-10">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h2 className="font-display text-2xl mb-3 text-[#1a1612]" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                {s.title}
              </h2>
              <p className="text-[#3d3530] leading-relaxed">{s.body}</p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
