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

type Section = {
  title: string;
  paragraphs?: string[];
  lists?: { intro?: string; items: string[] }[];
};

const SECTIONS: Section[] = [
  {
    title: "1. Information We Collect",
    lists: [
      {
        intro: "Information you give us directly:",
        items: [
          "Account details: your name, email, phone number, studio name, and password.",
          "Billing details: processed securely through Razorpay. We do not store your card or bank numbers.",
          "Content you add: project details, client information, vendor details, tasks, photos, documents, invoices, and messages you create in the app.",
        ],
      },
      {
        intro: "Information about your clients and vendors:",
        items: [
          "Because PMStudio is a tool for managing projects, you may enter personal data about your clients and vendors (names, phone numbers, email addresses, site addresses, GST/PAN numbers). You are responsible for having a lawful basis to share this data with us. We act as a processor of this data on your behalf.",
        ],
      },
      {
        intro: "Information collected automatically:",
        items: [
          "Log and usage data: device type, browser, IP address, pages visited, and actions taken, used to keep the service secure and working.",
          "Cookies and similar technologies used to keep you logged in and remember preferences.",
        ],
      },
    ],
  },
  {
    title: "2. How We Use Your Information",
    lists: [
      {
        intro: "We use your information to:",
        items: [
          "Provide, operate, and maintain the PMStudio service.",
          "Process payments and manage your subscription.",
          "Power AI features (for example, turning your typed site updates into tasks, reading uploaded invoices, drafting messages). Content you submit to AI features is processed to generate results for you.",
          "Send you service communications (updates, security alerts, billing notices).",
          "Improve the product, fix bugs, and prevent fraud or abuse.",
          "Comply with legal obligations.",
        ],
      },
    ],
    paragraphs: [
      "We do not sell your personal data. We do not show third-party advertising in PMStudio.",
    ],
  },
  {
    title: "3. AI Processing",
    paragraphs: [
      "Some features send your text, documents, or images to AI service providers to generate results (such as extracting tasks or reading invoices). We share only what is needed to perform the task. We do not use your private project content to train public AI models.",
    ],
  },
  {
    title: "4. How We Share Information",
    lists: [
      {
        intro: "We share information only with:",
        items: [
          "Service providers who help us run PMStudio (cloud hosting, database, payment processing via Razorpay, email delivery, AI processing). They may only use the data to perform services for us.",
          "Legal authorities if required by law, court order, or to protect rights and safety.",
          "A successor entity in the event of a merger, acquisition, or sale of assets, under the same protections.",
        ],
      },
    ],
  },
  {
    title: "5. Data Storage and Security",
    lists: [
      {
        items: [
          "Your data is stored on secure managed cloud infrastructure.",
          "We use industry-standard measures (encryption in transit, access controls) to protect your data.",
          "No method of transmission or storage is 100% secure; we cannot guarantee absolute security.",
        ],
      },
    ],
  },
  {
    title: "6. Data Retention",
    paragraphs: [
      "We keep your data for as long as your account is active. If you cancel, we retain data for a limited period to allow reactivation and to meet legal/accounting requirements, after which it is deleted or anonymised. You can request earlier deletion (see your rights below).",
    ],
  },
  {
    title: "7. Your Rights",
    lists: [
      {
        intro: "Subject to applicable Indian law, including the Digital Personal Data Protection Act, 2023, you may:",
        items: [
          "Access the personal data we hold about you.",
          "Correct inaccurate data.",
          "Request deletion of your data.",
          "Withdraw consent where processing is based on consent.",
          "Request a copy of your data (data portability).",
        ],
      },
    ],
    paragraphs: [
      "To exercise any of these, email us at the address in Section 10. We may need to verify your identity before acting.",
    ],
  },
  {
    title: "8. Your Clients' and Vendors' Data",
    paragraphs: [
      "When you add data about other people (your clients, vendors, team), you confirm you have the right to do so. If one of your clients asks us to delete their data, we will direct them to you as the controller of that data, and assist you in responding.",
    ],
  },
  {
    title: "9. Children",
    paragraphs: [
      "PMStudio is a business tool and is not intended for anyone under 18. We do not knowingly collect data from minors.",
    ],
  },
  {
    title: "10. Contact Us",
    paragraphs: [
      "For any privacy questions or requests, contact:",
      "PMStudio\nEmail: hello@pmstudio.com\nLocation: India",
    ],
  },
  {
    title: "11. Changes to This Policy",
    paragraphs: [
      "We may update this policy from time to time. We will post the new version with a revised \"Last updated\" date, and notify you of significant changes.",
    ],
  },
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
        <h1 className="font-display text-4xl md:text-5xl mb-4" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
          Privacy Policy — PMStudio
        </h1>
        <p className="text-[#5a4f48] mb-10">Last updated: 30 May 2026</p>

        <div className="text-[#3d3530] leading-relaxed space-y-6 mb-12">
          <p>
            PMStudio ("we", "us", "our") is a project management platform for interior designers, operated from India.
            This Privacy Policy explains what information we collect, how we use it, and your rights. By using PMStudio
            you agree to this policy.
          </p>
        </div>

        <div className="space-y-10">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h2
                className="font-display text-2xl mb-3 text-[#1a1612]"
                style={{ fontFamily: "'Cormorant Garamond', serif" }}
              >
                {s.title}
              </h2>
              <div className="text-[#3d3530] leading-relaxed space-y-4">
                {s.paragraphs?.map((p, i) => (
                  <p key={`p-${i}`} className="whitespace-pre-line">
                    {p}
                  </p>
                ))}
                {s.lists?.map((list, li) => (
                  <div key={`l-${li}`} className="space-y-2">
                    {list.intro && <p className="font-medium text-[#1a1612]">{list.intro}</p>}
                    <ul className="list-disc pl-6 space-y-1.5">
                      {list.items.map((item, ii) => (
                        <li key={ii}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-16 pt-8 border-t border-[#e8e2d8] text-sm italic text-[#5a4f48]">
          This document is a general template and not legal advice. Please have it reviewed by a qualified Indian legal
          professional before relying on it.
        </p>
      </main>
    </div>
  );
}
