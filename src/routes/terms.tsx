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

type Section = {
  title: string;
  paragraphs?: string[];
  lists?: { intro?: string; items: string[] }[];
};

const SECTIONS: Section[] = [
  {
    title: "1. Acceptance of Terms",
    paragraphs: [
      "By signing up for or using PMStudio, you confirm that you are at least 18 years old and able to enter into a binding contract. If you use PMStudio on behalf of a studio or company, you confirm you have authority to bind that entity.",
    ],
  },
  {
    title: "2. The Service",
    paragraphs: [
      "PMStudio is a project management platform for interior designers, including project tracking, client portals, vendor management, invoicing, document storage, and AI-assisted features. We may add, change, or remove features over time.",
    ],
  },
  {
    title: "3. Accounts",
    lists: [
      {
        items: [
          "You are responsible for keeping your login credentials secure.",
          "You are responsible for all activity under your account.",
          "You must provide accurate information and keep it updated.",
          "Notify us immediately of any unauthorised use.",
        ],
      },
    ],
  },
  {
    title: "4. Subscription and Billing",
    lists: [
      {
        items: [
          "PMStudio is offered on paid subscription plans (Freelancer, Studio Starter, Studio Pro, Design House) and optional add-ons. Prices are shown in the app.",
          "Subscriptions are billed monthly or yearly in advance through Razorpay.",
          "By subscribing, you authorise us to charge the applicable fees on a recurring basis until you cancel.",
          "We may change pricing with prior notice. Changes apply from your next billing cycle.",
          "Any promotional pricing (such as early-access discounts) applies only for the stated period, after which standard pricing applies.",
          "Applicable taxes (such as GST) may be added.",
        ],
      },
    ],
  },
  {
    title: "5. Cancellation and Refunds",
    lists: [
      {
        items: [
          "You may cancel your subscription at any time from your account settings.",
          "On cancellation, your plan remains active until the end of the current paid period; it will not renew after that.",
          "Fees already paid are generally non-refundable, except where required by law. We may, at our discretion, offer a refund in specific cases.",
        ],
      },
    ],
  },
  {
    title: "6. Your Content and Data",
    lists: [
      {
        items: [
          "You retain ownership of all content and data you add to PMStudio (projects, client details, documents, etc.).",
          "You grant us a limited licence to store and process this content solely to provide the Service to you.",
          "You are responsible for the accuracy and legality of the data you upload, including having the right to store data about your clients and vendors.",
          "Our handling of personal data is described in our Privacy Policy.",
        ],
      },
    ],
  },
  {
    title: "7. Acceptable Use",
    lists: [
      {
        intro: "You agree not to:",
        items: [
          "Use the Service for any unlawful purpose.",
          "Upload content that is illegal, infringing, or harmful.",
          "Attempt to access other users' data or breach security.",
          "Reverse engineer, copy, or resell the Service.",
          "Overload or disrupt the Service or its infrastructure.",
        ],
      },
    ],
    paragraphs: ["We may suspend or terminate accounts that violate these Terms."],
  },
  {
    title: "8. AI Features",
    lists: [
      {
        items: [
          "AI-assisted features generate suggestions (such as tasks, drafts, and extracted invoice data) based on the information you provide.",
          "AI output may contain errors. You are responsible for reviewing and approving any AI-generated content before relying on or sending it.",
          "PMStudio is not liable for decisions made based on AI output.",
        ],
      },
    ],
  },
  {
    title: "9. Third-Party Services",
    paragraphs: [
      "PMStudio integrates with third-party services (such as Razorpay for payments, email and cloud providers, and AI providers). Your use of those services may be subject to their own terms. We are not responsible for third-party services.",
    ],
  },
  {
    title: "10. Availability",
    paragraphs: [
      "We aim to keep PMStudio available and reliable but do not guarantee uninterrupted service. We may perform maintenance, updates, or experience downtime. We are not liable for losses arising from unavailability.",
    ],
  },
  {
    title: "11. Limitation of Liability",
    lists: [
      {
        intro: "To the maximum extent permitted by law:",
        items: [
          "PMStudio is provided \"as is\" without warranties of any kind.",
          "We are not liable for indirect, incidental, or consequential damages, or for loss of profits, data, or business.",
          "Our total liability for any claim is limited to the amount you paid us in the 3 months before the claim.",
        ],
      },
    ],
  },
  {
    title: "12. Indemnity",
    paragraphs: [
      "You agree to indemnify and hold PMStudio harmless from claims arising out of your use of the Service, your content, or your violation of these Terms.",
    ],
  },
  {
    title: "13. Termination",
    paragraphs: [
      "We may suspend or terminate your access if you breach these Terms or fail to pay fees. You may stop using the Service at any time. On termination, your right to use the Service ends, subject to data retention described in the Privacy Policy.",
    ],
  },
  {
    title: "14. Governing Law",
    paragraphs: [
      "These Terms are governed by the laws of India. Any disputes are subject to the exclusive jurisdiction of the courts in Mumbai, Maharashtra.",
    ],
  },
  {
    title: "15. Changes to These Terms",
    paragraphs: [
      "We may update these Terms from time to time. We will post the updated version with a new \"Last updated\" date and notify you of significant changes. Continued use after changes means you accept them.",
    ],
  },
  {
    title: "16. Contact",
    paragraphs: ["PMStudio", "Email: hello@pmstudio.com", "Location: India"],
  },
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
        <h1
          className="font-display text-4xl md:text-5xl mb-4"
          style={{ fontFamily: "'Cormorant Garamond', serif" }}
        >
          Terms of Service
        </h1>
        <p className="text-[#5a4f48] mb-10">Last updated: 30 May 2026</p>
        <p className="text-[#3d3530] leading-relaxed mb-12">
          These Terms of Service ("Terms") govern your use of PMStudio ("the Service"), operated from India. By
          creating an account or using the Service, you agree to these Terms. If you do not agree, do not use the
          Service.
        </p>
        <div className="space-y-10">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h2
                className="font-display text-2xl mb-3 text-[#1a1612]"
                style={{ fontFamily: "'Cormorant Garamond', serif" }}
              >
                {s.title}
              </h2>
              {s.paragraphs?.map((p, i) => (
                <p key={i} className="text-[#3d3530] leading-relaxed mb-3">
                  {p}
                </p>
              ))}
              {s.lists?.map((l, i) => (
                <div key={i} className="mb-3">
                  {l.intro && <p className="text-[#3d3530] leading-relaxed mb-2">{l.intro}</p>}
                  <ul className="list-disc pl-5 space-y-1.5 text-[#3d3530] leading-relaxed">
                    {l.items.map((item, j) => (
                      <li key={j}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ))}
          <p className="text-xs text-[#8a7d74] italic pt-6 border-t border-[#e8e2d8]">
            This document is a general template and not legal advice. Please have it reviewed by a qualified Indian
            legal professional before relying on it.
          </p>
        </div>
      </main>
    </div>
  );
}
