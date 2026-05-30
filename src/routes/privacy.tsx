import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — PMStudio" },
      { name: "description", content: "How PMStudio collects, uses, and protects your data." },
    ],
  }),
  component: PrivacyPage,
});

const SECTIONS = [
  { title: "Information We Collect", body: "Placeholder — describe the personal and project data we collect when you sign up and use PMStudio." },
  { title: "How We Use It", body: "Placeholder — explain how data is used to operate the service, send notifications, and improve features." },
  { title: "Data Storage", body: "Placeholder — describe where data is stored, encryption, retention periods, and security practices." },
  { title: "Your Rights", body: "Placeholder — outline rights to access, correct, export, and delete your data." },
  { title: "Contact", body: "Placeholder — provide an email address for privacy enquiries." },
];

function PrivacyPage() {
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
          Privacy Policy
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
