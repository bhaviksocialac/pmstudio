import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import {
  Menu, X, Phone, Truck, IndianRupee, Sparkles, Smartphone,
  FileText, Bell, Star, ArrowRight, Check, Heart, CheckCircle2, Receipt,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import heroImage from "@/assets/landing-hero.jpg";
import { PLANS, FEATURE_ROWS, ADDONS, priceFor, formatINR, type BillingCycle } from "@/lib/plans";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PMStudio — Project management for Indian interior designers" },
      {
        name: "description",
        content:
          "Run your interior design studio like a pro. Project management, client portal, vendor tracking and AI communication — built for Indian interior designers.",
      },
      { property: "og:title", content: "PMStudio — Run your interior design studio like a pro" },
      {
        property: "og:description",
        content:
          "AI tasks, branded client portal, vendor tracking. Built specifically for Indian interior designers.",
      },
      { property: "og:image", content: heroImage },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#1a1612] font-sans">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <Hero />

      <Problem />
      <Workflow />
      <Features />
      <SocialProof />
      <Pricing />
      <CTASection />
      <Waitlist />
      <Footer />
    </div>
  );
}


/* -------------------- NAV (dark, over hero) -------------------- */
function Nav() {
  const [open, setOpen] = useState(false);
  const links = [
    { label: "Features", href: "#solution" },
    { label: "Pricing", href: "#pricing" },
    { label: "About", href: "#waitlist" },
  ];
  return (
    <nav className="absolute top-0 inset-x-0 z-50 bg-transparent">
      <div className="max-w-6xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
        <Link
          to="/"
          className="text-2xl tracking-tight text-[#faf8f5]"
          style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 500 }}
        >
          PMStudio
        </Link>
        <div className="hidden md:flex items-center gap-9 absolute left-1/2 -translate-x-1/2">
          {links.map((l) => (
            <a key={l.label} href={l.href} className="text-sm text-[#d8cfc4] hover:text-[#c17f5a] transition">
              {l.label}
            </a>
          ))}
        </div>
        <div className="hidden md:block">
          <Link
            to="/signup"
            className="inline-flex items-center h-10 px-5 rounded-md bg-[#c17f5a] text-white font-medium hover:bg-[#a86a48] transition shadow-sm"
          >
            Get Started
          </Link>
        </div>
        <button className="md:hidden p-2 text-[#faf8f5]" onClick={() => setOpen((o) => !o)} aria-label="Menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div className="md:hidden border-t border-[#3a302a] px-5 py-4 space-y-3 bg-[#1a1612]">
          {links.map((l) => (
            <a key={l.label} href={l.href} className="block text-[#d8cfc4]" onClick={() => setOpen(false)}>
              {l.label}
            </a>
          ))}
          <Link to="/signup" className="block w-full text-center h-10 leading-10 rounded-md bg-[#c17f5a] text-white font-medium">
            Get Started
          </Link>
        </div>
      )}
    </nav>
  );
}

/* -------------------- HERO (dark, live AI demo) -------------------- */
const DEMO_MESSAGE =
  "Ramesh delivered tiles today. Jangir started flooring in living room on 19th. Client approved the wardrobe veneer finish. Electrical conduit in mandir still pending.";

type DemoTask = {
  desc: string;
  agency: string;
  status: string;
  statusColor: string;
  statusBg: string;
  room: string;
  date: string;
};

const DEMO_TASKS: DemoTask[] = [
  { desc: "Tile delivery", agency: "Ramesh", status: "Material Delivered", statusColor: "#2f4a3d", statusBg: "#cfe3d6", room: "Living Room", date: "19 Jan" },
  { desc: "Flooring started", agency: "Civil", status: "WIP", statusColor: "#7a4a32", statusBg: "#f1d9c6", room: "Living Room", date: "19 Jan" },
  { desc: "Wardrobe veneer approval", agency: "Client", status: "Approved", statusColor: "#2f4a3d", statusBg: "#cfe3d6", room: "Master Bedroom", date: "Today" },
  { desc: "Electrical conduit", agency: "Electrician", status: "Blocked", statusColor: "#8a2a1f", statusBg: "#f3d2cd", room: "Mandir", date: "Pending" },
];

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

function Hero() {
  const reduced = useReducedMotion();
  const [typed, setTyped] = useState("");
  const [visibleTasks, setVisibleTasks] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (reduced) {
      setTyped(DEMO_MESSAGE);
      setVisibleTasks(DEMO_TASKS.length);
      setShowSummary(true);
      return;
    }

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const schedule = (fn: () => void, ms: number) => {
      const id = setTimeout(() => { if (!cancelled) fn(); }, ms);
      timers.push(id);
    };

    const run = () => {
      setTyped("");
      setVisibleTasks(0);
      setShowSummary(false);
      setFading(false);

      // start typing after 1s
      let i = 0;
      const typeNext = () => {
        if (cancelled) return;
        if (i >= DEMO_MESSAGE.length) return;
        const ch = DEMO_MESSAGE[i];
        i += 1;
        setTyped(DEMO_MESSAGE.slice(0, i));
        // variable speed
        let delay = 38 + Math.random() * 32;
        if (ch === " ") delay = 20;
        if (ch === "." || ch === ",") delay = 260;
        schedule(typeNext, delay);
      };
      schedule(typeNext, 1000);

      // start revealing tasks 500ms after typing begins
      DEMO_TASKS.forEach((_, idx) => {
        schedule(() => setVisibleTasks((v) => Math.max(v, idx + 1)), 1500 + idx * 300);
      });
      // summary after tasks
      schedule(() => setShowSummary(true), 1500 + DEMO_TASKS.length * 300 + 400);

      // loop: fade out then restart
      const totalTypingMs = DEMO_MESSAGE.length * 55 + 1000;
      const holdAfter = Math.max(totalTypingMs, 1500 + DEMO_TASKS.length * 300 + 400) + 3000;
      schedule(() => setFading(true), holdAfter);
      schedule(run, holdAfter + 500);
    };

    run();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [reduced]);

  return (
    <section className="relative overflow-hidden bg-[#1a1612] text-[#faf8f5]">
      {/* subtle warm glow */}
      <div
        aria-hidden
        className="absolute -z-0 top-[-220px] left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full blur-3xl opacity-30 pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(193,127,90,0.55) 0%, transparent 65%)" }}
      />
      <div aria-hidden className="absolute inset-0 grain-overlay opacity-[0.08] pointer-events-none" />

      <Nav />

      <div className="relative max-w-5xl mx-auto px-5 md:px-8 pt-32 md:pt-40 pb-16 md:pb-24 text-center">
        <p
          className="text-[11px] uppercase tracking-[0.32em] text-[#c17f5a] mb-6 fade-soft"
          style={{ animationDelay: "0.1s" }}
        >
          Watch AI in action
        </p>
        <h1
          className="font-display text-[40px] sm:text-[58px] md:text-[76px] leading-[1.05] tracking-[-0.015em] text-[#faf8f5] fade-soft"
          style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 500, animationDelay: "0.25s" }}
        >
          Tell AI what happened.
          <br />
          <span className="text-[#faf8f5]">PMStudio handles</span>
          <br />
          <span className="italic text-[#c17f5a]">the rest.</span>
        </h1>

        {/* Live demo */}
        <div className={`mt-12 max-w-[700px] mx-auto transition-opacity duration-500 ${fading ? "opacity-0" : "opacity-100"}`}>
          {/* Input bar */}
          <div
            className="rounded-2xl border border-[#3a302a] bg-[#26201b] px-5 py-4 text-left shadow-2xl shadow-black/40 fade-soft"
            style={{ animationDelay: "0.6s" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-3.5 w-3.5 text-[#c17f5a]" />
              <span className="text-[10px] uppercase tracking-[0.22em] text-[#c17f5a]">AI Site Update</span>
            </div>
            <div className="text-[15px] md:text-[16px] leading-relaxed text-[#f5ecdf] min-h-[3.5em] whitespace-pre-wrap">
              {typed}
              <span className="inline-block w-[2px] h-[1.05em] align-[-0.18em] bg-[#c17f5a] ml-[1px] blink-cursor" />
            </div>
          </div>

          {/* Task cards */}
          <div className="mt-6 space-y-3">
            {DEMO_TASKS.map((t, i) => (
              <div
                key={i}
                className="task-rise rounded-xl bg-[#faf8f5] text-[#1a1612] px-4 py-3 text-left shadow-lg shadow-black/20"
                style={{
                  visibility: i < visibleTasks ? "visible" : "hidden",
                  animationDelay: "0ms",
                }}
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <span
                    className="text-[10px] font-medium uppercase tracking-[0.12em] px-2 py-1 rounded-full"
                    style={{ color: t.statusColor, background: t.statusBg }}
                  >
                    {t.status}
                  </span>
                  <span className="font-medium text-[14px] md:text-[15px]">{t.desc}</span>
                  <span className="text-[12px] text-[#6b5f58]">· {t.agency}</span>
                  <span className="ml-auto flex items-center gap-3 text-[11px] text-[#6b5f58]">
                    <span className="px-2 py-0.5 rounded bg-[#f1ece4]">{t.room}</span>
                    <span>{t.date}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div
            className={`mt-5 text-[13px] text-[#c17f5a] tracking-wide transition-opacity duration-500 ${showSummary ? "opacity-100" : "opacity-0"}`}
          >
            4 tasks created · 1 dependency detected · 0 manual data entry
          </div>
        </div>

        {/* CTAs */}
        <div
          className="mt-12 flex flex-wrap justify-center gap-3 fade-soft"
          style={{ animationDelay: "0.9s" }}
        >
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 h-12 px-6 rounded-md bg-[#c17f5a] text-white font-medium btn-premium shadow-lg shadow-[#c17f5a]/30 hover:bg-[#a86a48] transition"
          >
            Get Started Free <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#solution"
            className="inline-flex items-center gap-2 h-12 px-6 rounded-md border border-[#faf8f5]/25 text-[#faf8f5] font-medium hover:bg-[#faf8f5]/10 transition"
          >
            See all features ↓
          </a>
        </div>

        <p
          className="mt-6 text-[12px] text-[#8a7e75] fade-soft"
          style={{ animationDelay: "1.05s" }}
        >
          Used by interior designers across India — Mumbai, Delhi, Bangalore, Ahmedabad
        </p>
      </div>

      {/* Gradient fade into off-white problem section */}
      <div
        aria-hidden
        className="h-24 md:h-32 w-full"
        style={{ background: "linear-gradient(180deg, #1a1612 0%, #faf8f5 100%)" }}
      />
    </section>
  );
}

/* -------------------- PROBLEM (off-white, "Sound familiar?") -------------------- */
function Problem() {
  const pains = [
    { icon: Phone, title: "Approval requests buried in 300 messages" },
    { icon: FileText, title: "Budget tracked across 4 different Excel files" },
    { icon: Bell, title: "You find out about delays after they have already happened" },
  ];
  return (
    <section className="relative bg-[#faf8f5] text-[#1a1612] py-20 md:py-28">
      <div className="relative max-w-5xl mx-auto px-5 md:px-8 text-center">
        <Reveal>
          <h2
            className="font-display text-4xl sm:text-5xl md:text-6xl leading-[1.1] text-[#1a1612]"
            style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 500 }}
          >
            Sound familiar?
          </h2>
        </Reveal>
        <div className="mt-14 grid md:grid-cols-3 gap-5 text-left">
          {pains.map((p, i) => (
            <Reveal key={p.title} delay={0.15 + i * 0.12}>
              <div
                className="rounded-2xl bg-white border border-[#ece4d8] border-l-4 p-7 h-full shadow-sm hover:shadow-md transition-shadow"
                style={{ borderLeftColor: "#c17f5a" }}
              >
                <div className="h-10 w-10 rounded-lg bg-[#c17f5a]/12 text-[#c17f5a] flex items-center justify-center mb-5">
                  <p.icon className="h-5 w-5" />
                </div>
                <p className="text-[15px] leading-relaxed text-[#3d3530]">{p.title}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}


/* -------------------- WORKFLOW (animated line) -------------------- */
function Workflow() {
  const steps = ["Create Project", "AI Reads BOQ", "Tasks Created", "Client Approves", "Vendors Tracked", "Project Delivered"];
  const [active, setActive] = useState(false);
  return (
    <section className="py-24 md:py-32 bg-[#faf8f5]">
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-xs uppercase tracking-[0.22em] text-[#c17f5a] mb-3">How it flows</p>
            <h2 className="font-display text-4xl md:text-5xl text-[#1a1612]" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              One workflow, end to end.
            </h2>
          </div>
        </Reveal>
        <div
          ref={(el) => {
            if (!el || active) return;
            const io = new IntersectionObserver(
              (entries) => entries.forEach((e) => { if (e.isIntersecting) { setActive(true); io.disconnect(); } }),
              { threshold: 0.25 },
            );
            io.observe(el);
          }}
          className={`relative ${active ? "draw-line" : ""}`}
        >
          <svg className="hidden md:block absolute left-0 right-0 top-6 w-full h-6 pointer-events-none" viewBox="0 0 1000 24" preserveAspectRatio="none">
            <path className="line-path" d="M 20 12 L 980 12" stroke="#c17f5a" strokeWidth="2" fill="none" strokeLinecap="round" strokeDasharray="6 6" />
          </svg>
          <div className="relative grid grid-cols-2 md:grid-cols-6 gap-6 md:gap-2">
            {steps.map((s, i) => (
              <div
                key={s}
                className={`relative flex flex-col items-center gap-3 ${active ? "step-pop" : "opacity-0"}`}
                style={{ animationDelay: `${0.3 + i * 0.18}s` }}
              >
                <div className="h-12 w-12 shrink-0 rounded-full bg-white border-2 border-[#c17f5a] text-[#c17f5a] flex items-center justify-center font-display text-lg shadow-md relative z-10" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                  {i + 1}
                </div>
                <div className="px-3 py-2 rounded-full bg-white border border-[#e8e2d8] text-[12px] font-medium text-[#1a1612] text-center shadow-sm">
                  {s}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------- FEATURES (alternating) -------------------- */
function Features() {
  const features = [
    { dark: true, title: "AI Task Intelligence", kicker: "Site updates → tasks", body: "Type what happened on site in plain English or Hindi. AI creates every task automatically — with assignees, deadlines, and the right phase.", mock: <AiTaskMock /> },
    { dark: false, title: "Client Portal", kicker: "Your brand. Their phone.", body: "Your client tracks everything on their phone. Approvals, photos, invoices — in one branded portal. No WhatsApp chaos.", mock: <PortalMock /> },
    { dark: true, title: "Vendor Tracking", kicker: "Invoice in. Payment tracked.", body: "Upload their invoice. AI reads it, matches the PO, and tracks every payment automatically.", mock: <InvoiceMock /> },
    { dark: false, title: "Morning Briefing", kicker: "Start the day, sorted.", body: "Every morning PMStudio tells you exactly what to do to keep every project on track. No more surprises.", mock: <BriefingMock /> },
  ];
  return (
    <div id="solution">
      {features.map((f, i) => {
        const textLeft = i % 2 === 0;
        return (
          <section key={f.title} className={`py-24 md:py-32 ${f.dark ? "bg-[#1a1612] text-[#f5ecdf]" : "bg-[#f6efe6] text-[#1a1612]"}`}>
            <div className="max-w-6xl mx-auto px-5 md:px-8 grid md:grid-cols-2 gap-12 md:gap-16 items-center">
              <RevealClass animation={textLeft ? "slide-in-l" : "slide-in-r"} className={textLeft ? "md:order-1" : "md:order-2"}>
                <p className="text-xs uppercase tracking-[0.22em] mb-4 text-[#c17f5a]">{f.kicker}</p>
                <h3 className={`font-display text-3xl md:text-5xl leading-[1.1] mb-5 ${f.dark ? "text-[#f5ecdf]" : "text-[#1a1612]"}`} style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                  {f.title}
                </h3>
                <p className={`text-lg leading-relaxed max-w-md ${f.dark ? "text-[#c9b8a4]" : "text-[#5a4f48]"}`}>{f.body}</p>
              </RevealClass>
              <RevealClass animation={textLeft ? "slide-in-r" : "slide-in-l"} className={textLeft ? "md:order-2" : "md:order-1"}>
                <div className="relative">{f.mock}</div>
              </RevealClass>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function AiTaskMock() {
  return (
    <div className="rounded-2xl bg-[#26201b] border border-[#3a302a] p-5 shadow-2xl">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-4 w-4 text-[#c17f5a]" />
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#c17f5a]">AI Site Update</span>
      </div>
      <div className="rounded-lg bg-[#1a1612] border border-[#3a302a] px-3 py-2 text-[13px] text-[#c9b8a4] mb-4">
        "Saini delivered plywood today, Joinery boys started false ceiling Master B."
      </div>
      <div className="space-y-2">
        {["✓ Plywood marked delivered — Saini Ply", "✓ Task created — False ceiling Master B", "✓ Payment due flagged — ₹48,200"].map((t, i) => (
          <div key={i} className="text-[13px] text-[#f5ecdf] rounded-md bg-[#1a1612] border border-[#3a302a] px-3 py-2 opacity-0"
            style={{ animation: `fade-up 500ms ease-out ${0.3 + i * 0.18}s forwards` }}>
            {t}
          </div>
        ))}
      </div>
    </div>
  );
}

function PortalMock() {
  return (
    <div className="relative mx-auto w-[260px] h-[520px] rounded-[36px] bg-[#1a1612] p-3 shadow-2xl float-soft">
      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-5 bg-[#1a1612] rounded-b-2xl z-10" />
      <div className="rounded-[28px] bg-[#faf8f5] h-full w-full p-4 overflow-hidden">
        <div className="text-[10px] uppercase tracking-[0.18em] text-[#c17f5a]">Mehta Residence</div>
        <div className="font-display text-xl text-[#1a1612] mt-1" style={{ fontFamily: "'Cormorant Garamond', serif" }}>68% complete</div>
        <div className="mt-3 h-1.5 rounded-full bg-[#f1ece4] overflow-hidden">
          <div className="h-full bg-[#c17f5a]" style={{ width: "68%" }} />
        </div>
        <div className="mt-5 space-y-2">
          {["Joinery — Master B", "Painting — Drawing", "Tiles — Kitchen"].map((t, i) => (
            <div key={i} className="rounded-lg bg-white border border-[#e8e2d8] px-3 py-2 text-[12px] text-[#3d3530] flex items-center justify-between">
              <span>{t}</span>
              <CheckCircle2 className="h-3.5 w-3.5 text-[#7a9e8a]" />
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-lg bg-[#c17f5a]/10 border border-[#c17f5a]/30 p-3">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[#c17f5a]">Approval pending</div>
          <div className="text-[12px] text-[#1a1612] mt-1">Master bedroom wardrobe — 3 options</div>
        </div>
      </div>
    </div>
  );
}

function InvoiceMock() {
  return (
    <div className="rounded-2xl bg-[#26201b] border border-[#3a302a] p-5 shadow-2xl">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#c17f5a]">Vendor invoice</span>
        <span className="text-[11px] text-[#7a9e8a] flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Matched</span>
      </div>
      <div className="rounded-lg bg-[#1a1612] border border-dashed border-[#3a302a] p-4 text-center">
        <Receipt className="h-7 w-7 text-[#c17f5a] mx-auto mb-2" />
        <div className="text-[12px] text-[#c9b8a4]">saini_ply_INV3219.pdf</div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-[12px]">
        {[["Vendor", "Saini Ply"], ["Amount", "₹48,200"], ["PO", "PO-0142"], ["Due", "12 Jun"]].map(([k, v]) => (
          <div key={k} className="rounded-md bg-[#1a1612] border border-[#3a302a] px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-[#7a6e63]">{k}</div>
            <div className="text-[#f5ecdf]">{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BriefingMock() {
  return (
    <div className="rounded-2xl bg-white border border-[#e8e2d8] p-6 shadow-2xl">
      <div className="flex items-center gap-2 mb-4">
        <Bell className="h-4 w-4 text-[#c17f5a]" />
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#c17f5a]">Your morning briefing</span>
      </div>
      <div className="font-display text-2xl text-[#1a1612] mb-4" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
        Today, focus on 3 things.
      </div>
      <div className="space-y-2">
        {[{ d: "Approve Mehta wardrobe options", t: "10 min" }, { d: "Chase Saini Ply for delivery", t: "5 min" }, { d: "Send Patel project invoice", t: "2 min" }].map((x, i) => (
          <div key={i} className="flex items-center justify-between rounded-lg bg-[#faf8f5] border border-[#e8e2d8] px-3 py-2.5 text-[13px]">
            <span className="text-[#1a1612]">{x.d}</span>
            <span className="text-[#6b5f58] text-[11px]">{x.t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------- SOCIAL PROOF -------------------- */
function SocialProof() {
  const quotes = [
    { q: "Replaced 3 WhatsApp groups and an Excel sheet on day one.", a: "Ananya R.", c: "Bangalore" },
    { q: "Clients stopped calling me for updates. They just check the portal.", a: "Rohan M.", c: "Mumbai" },
    { q: "Vendor payments finally make sense. AI reads the invoice for me.", a: "Priya K.", c: "Delhi" },
  ];
  const cities = ["Mumbai", "Delhi", "Bangalore", "Hyderabad", "Ahmedabad", "Pune", "Chennai"];
  return (
    <section className="py-24 md:py-32 bg-[#faf8f5]">
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        <Reveal>
          <h2 className="font-display text-4xl md:text-5xl text-center text-[#1a1612] max-w-3xl mx-auto" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Built for how Indian designers actually work.
          </h2>
        </Reveal>
        <div className="mt-16 grid md:grid-cols-3 gap-5">
          {quotes.map((q, i) => (
            <Reveal key={i} delay={i * 0.12}>
              <figure className="rounded-2xl bg-white border border-[#e8e2d8] p-7 h-full card-lift">
                <div className="text-[#c17f5a] text-3xl font-display leading-none mb-3" style={{ fontFamily: "'Cormorant Garamond', serif" }}>"</div>
                <blockquote className="text-[#3d3530] text-[15px] leading-relaxed mb-5">{q.q}</blockquote>
                <figcaption className="text-[13px] text-[#6b5f58]">
                  <span className="text-[#1a1612] font-medium">{q.a}</span> · {q.c}
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
        <Reveal delay={0.3}>
          <div className="mt-16 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-[#8a7e75] text-sm uppercase tracking-[0.22em]">
            {cities.map((c) => (
              <span key={c} className="hover:text-[#c17f5a] transition-colors">{c}</span>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* -------------------- CTA -------------------- */
function CTASection() {
  return (
    <section className="relative bg-[#1a1612] text-[#f5ecdf] py-24 md:py-32 overflow-hidden">
      <div aria-hidden className="absolute inset-0 grain-overlay opacity-[0.10] pointer-events-none" />
      <div aria-hidden className="absolute -bottom-40 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full blur-3xl opacity-30"
        style={{ background: "radial-gradient(circle, rgba(193,127,90,0.55) 0%, transparent 65%)" }} />
      <div className="relative max-w-4xl mx-auto px-5 md:px-8 text-center">
        <Reveal>
          <h2 className="font-display text-4xl sm:text-5xl md:text-6xl leading-[1.1] text-[#f5ecdf]" style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 500 }}>
            Your projects deserve better than
            <br />
            <span className="italic text-[#c17f5a]">WhatsApp and Excel.</span>
          </h2>
        </Reveal>
        <Reveal delay={0.15}>
          <p className="mt-7 text-lg text-[#c9b8a4] max-w-xl mx-auto">
            Run your studio like a pro. Get started in under 10 minutes — no card needed.
          </p>
        </Reveal>
        <Reveal delay={0.25}>
          <div className="mt-9">
            <Link to="/signup" className="inline-flex items-center gap-2 h-13 px-8 py-3.5 rounded-md bg-[#c17f5a] text-white font-medium btn-premium shadow-xl shadow-[#c17f5a]/30">
              Get Started <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* -------------------- PRICING -------------------- */


function Pricing() {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  return (
    <section id="pricing" className="py-20 md:py-28">
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        <h2
          className="font-display text-center text-4xl md:text-5xl text-[#1a1612] mb-4"
          style={{ fontFamily: "'Cormorant Garamond', serif" }}
        >
          Simple pricing. No surprises.
        </h2>
        <p className="text-center text-[#5a4f48] mb-8">Same features in the same order across every plan — pick the size that fits.</p>

        {/* Offer banner */}
        <Reveal>
          <div className="mx-auto mb-10 max-w-3xl rounded-xl border border-[#c17f5a]/30 bg-[#c17f5a]/10 px-6 py-3 text-center text-[#5a4034]">
            <span className="font-medium">Early access</span> — first 3 months at 50% off. Limited to first 100 designers.
          </div>
        </Reveal>

        {/* Cycle toggle */}
        <div className="flex justify-center mb-10">
          <PricingCycleToggle cycle={cycle} onChange={setCycle} />
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch">
          {PLANS.map((p, i) => {
            const effCycle: BillingCycle = cycle === "yearly" && !p.yearly ? "monthly" : cycle;
            const price = priceFor(p, effCycle)!;
            return (
              <Reveal key={p.key} delay={i * 0.1}>
                <div
                  className={`relative rounded-2xl p-7 flex flex-col h-full card-lift ${
                    p.highlight
                      ? "bg-[#1a1612] text-[#faf8f5] border border-[#c17f5a]/40 pulse-glow md:-translate-y-3"
                      : "bg-[#faf8f5] text-[#1a1612] border border-[#e8e2d8]"
                  }`}
                >
                  {p.highlight && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#c17f5a] text-white text-xs uppercase tracking-wider px-3 py-1 rounded-full shadow-md">
                      Most popular
                    </span>
                  )}
                  <div className="text-xs uppercase tracking-[0.18em] opacity-70 mb-1">{p.name}</div>
                  <div className={`text-xs mb-4 ${p.highlight ? "text-[#c9b8a4]" : "text-[#6b5f58]"}`}>{p.tagline}</div>
                  <PriceDisplay amount={price} cycle={effCycle} />
                  <div className={`text-xs min-h-[18px] mb-5 ${p.highlight ? "text-[#c9b8a4]" : "text-[#6b5f58]"}`}>
                    {cycle === "yearly" && p.yearly ? "2 months free" : cycle === "yearly" && !p.yearly ? "Monthly only" : "\u00A0"}
                  </div>
                  <ul className="space-y-2 mb-7 flex-1">
                    {FEATURE_ROWS.map((row, idx) => {
                      const v = row.values[p.key];
                      return (
                        <li
                          key={row.label}
                          className="flex items-start gap-2 text-[13px] leading-snug min-h-[20px] opacity-0"
                          style={{ animation: `fade-up 350ms ease-out ${0.15 + idx * 0.035}s forwards` }}
                        >
                          <span className="mt-0.5 shrink-0">
                            {v === true ? (
                              <Check className={`h-4 w-4 ${p.highlight ? "text-[#c17f5a]" : "text-[#7a9e8a]"}`} />
                            ) : v === false ? (
                              <X className={`h-4 w-4 ${p.highlight ? "text-[#3a302a]" : "text-[#cbc4ba]"}`} />
                            ) : (
                              <Check className={`h-4 w-4 ${p.highlight ? "text-[#c17f5a]" : "text-[#7a9e8a]"}`} />
                            )}
                          </span>
                          <span className={p.highlight ? "text-[#e8dcc9]" : "text-[#3d3530]"}>
                            <span className={p.highlight ? "text-[#c9b8a4]" : "text-[#6b5f58]"}>{row.label}:</span>{" "}
                            {typeof v === "string" ? v : v === true ? "Included" : "—"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <Link
                    to="/signup"
                    className={`text-center h-12 inline-flex items-center justify-center rounded-md font-medium btn-premium ${
                      p.highlight
                        ? "bg-[#c17f5a] text-white"
                        : "bg-[#1a1612] text-[#faf8f5] hover:bg-[#2a2520]"
                    }`}
                  >
                    {p.cta}
                  </Link>
                </div>
              </Reveal>
            );
          })}
        </div>

        {/* Add-ons */}
        <div className="mt-16">
          <h3
            className="font-display text-2xl md:text-3xl text-center text-[#1a1612] mb-8"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            Add-ons
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {ADDONS.map((a, i) => (
              <Reveal key={a.key} delay={i * 0.08}>
                <div className="rounded-xl border border-[#e8e2d8] bg-[#faf8f5] p-5 card-lift h-full">
                  <div
                    className="font-display text-lg text-[#1a1612]"
                    style={{ fontFamily: "'Cormorant Garamond', serif" }}
                  >
                    {a.label}
                  </div>
                  <div className="mt-2 text-[#c17f5a] font-medium">
                    {formatINR(a.price)}
                    <span className="text-[#6b5f58] font-normal text-sm">{a.unit}</span>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function PricingCycleToggle({ cycle, onChange }: { cycle: BillingCycle; onChange: (c: BillingCycle) => void }) {
  return (
    <div className="relative inline-flex items-center bg-[#f1ece4] rounded-full p-1 text-sm border border-[#e8e2d8]">
      <span
        className="absolute top-1 bottom-1 rounded-full bg-[#1a1612] shadow-md transition-all duration-300 ease-out"
        style={{ left: cycle === "monthly" ? 4 : "50%", width: "calc(50% - 4px)" }}
      />
      <button
        type="button"
        onClick={() => onChange("monthly")}
        className={`relative z-10 px-5 h-9 rounded-full transition-colors ${cycle === "monthly" ? "text-[#faf8f5]" : "text-[#5a4f48]"}`}
      >
        Monthly
      </button>
      <button
        type="button"
        onClick={() => onChange("yearly")}
        className={`relative z-10 px-5 h-9 rounded-full transition-colors inline-flex items-center gap-1.5 ${cycle === "yearly" ? "text-[#faf8f5]" : "text-[#5a4f48]"}`}
      >
        Yearly <span className={`text-[10px] ${cycle === "yearly" ? "text-[#e8a87c]" : "text-[#c17f5a]"}`}>2 mo free</span>
      </button>
    </div>
  );
}

function PriceDisplay({ amount, cycle }: { amount: number; cycle: BillingCycle }) {
  // Cross-fade when value changes
  const key = `${amount}-${cycle}`;
  return (
    <div className="flex items-baseline gap-1 mb-1 min-h-[56px]">
      <span
        key={key}
        className="font-display text-5xl tabular-nums animate-fade-up"
        style={{ fontFamily: "'Cormorant Garamond', serif", animationDuration: "320ms" }}
      >
        {formatINR(amount)}
      </span>
      <span className="opacity-70 text-sm">/{cycle === "yearly" ? "yr" : "mo"}</span>
    </div>
  );
}


/* -------------------- WAITLIST -------------------- */
const emailSchema = z.string().trim().email("Enter a valid email").max(255);

function Waitlist() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const countQuery = useQuery({
    queryKey: ["waitlist-count"],
    queryFn: async () => {
      const { count } = await supabase.from("waitlist").select("id", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("waitlist-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "waitlist" }, () => {
        queryClient.invalidateQueries({ queryKey: ["waitlist-count"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const join = useMutation({
    mutationFn: async (rawEmail: string) => {
      const parsed = emailSchema.safeParse(rawEmail);
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const { error } = await supabase.from("waitlist").insert({ email: parsed.data.toLowerCase() });
      if (error && !error.message.toLowerCase().includes("duplicate")) throw error;
    },
    onSuccess: () => {
      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ["waitlist-count"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const baseCount = 200;
  const displayCount = baseCount + (countQuery.data ?? 0);

  return (
    <section id="waitlist" className="bg-[#1a1612] text-[#f3ede3] py-20 md:py-28">
      <div className="max-w-3xl mx-auto px-5 md:px-8 text-center">
        <h2
          className="font-display text-4xl md:text-5xl text-[#f5ecdf] mb-5"
          style={{ fontFamily: "'Cormorant Garamond', serif" }}
        >
          Built for Indian interior designers. By one.
        </h2>
        <p className="text-lg text-[#c9b8a4] leading-relaxed mb-10">
          Bhavik Shah — interior designer from Mumbai — built PMStudio because no tool existed for us.
        </p>

        {submitted ? (
          <div className="inline-flex items-center gap-3 px-6 py-4 rounded-xl bg-[#c17f5a]/15 border border-[#c17f5a]/30 text-[#f5ecdf]">
            <Check className="h-5 w-5 text-[#c17f5a]" />
            You are on the list. We will be in touch soon.
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!join.isPending) join.mutate(email);
            }}
            className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto"
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@studio.com"
              className="flex-1 h-12 px-4 rounded-md bg-[#26201b] border border-[#3a302a] text-[#f3ede3] placeholder:text-[#7a6e63] focus:outline-none focus:border-[#c17f5a] transition"
            />
            <button
              type="submit"
              disabled={join.isPending}
              className="h-12 px-6 rounded-md bg-[#c17f5a] text-white font-medium hover:bg-[#a86a48] transition disabled:opacity-60"
            >
              {join.isPending ? "Joining..." : "Get Early Access"}
            </button>
          </form>
        )}

        <div className="mt-6 text-sm text-[#c9b8a4]">
          Join <span className="text-[#f5ecdf] font-medium">{displayCount}+</span> designers on the waitlist
        </div>
      </div>
    </section>
  );
}

/* -------------------- FOOTER -------------------- */
function Footer() {
  return (
    <footer className="bg-[#faf8f5] border-t border-[#e8e2d8] py-10">
      <div className="max-w-6xl mx-auto px-5 md:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-[#6b5f58]">
        <div
          className="font-display text-xl text-[#1a1612]"
          style={{ fontFamily: "'Cormorant Garamond', serif" }}
        >
          PMStudio
        </div>
        <div className="flex items-center gap-6">
          <Link to="/privacy" className="hover:text-[#c17f5a] transition">Privacy</Link>
          <Link to="/terms" className="hover:text-[#c17f5a] transition">Terms</Link>
          <a href="#waitlist" className="hover:text-[#c17f5a] transition">Contact</a>
        </div>
        <div className="flex items-center gap-1.5">
          Made with <Heart className="h-3.5 w-3.5 fill-[#c17f5a] text-[#c17f5a]" /> in India · © 2026
        </div>
      </div>
    </footer>
  );
}

/* -------------------- helpers -------------------- */
function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const [shown, setShown] = useState(false);
  return (
    <div
      ref={(el) => {
        if (!el || shown) return;
        const io = new IntersectionObserver(
          (entries) => {
            entries.forEach((e) => {
              if (e.isIntersecting) {
                setShown(true);
                io.disconnect();
              }
            });
          },
          { threshold: 0.15 },
        );
        io.observe(el);
      }}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

function RevealClass({ children, animation, className = "" }: { children: React.ReactNode; animation: string; className?: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div
      ref={(el) => {
        if (!el || shown) return;
        const io = new IntersectionObserver(
          (entries) => entries.forEach((e) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }),
          { threshold: 0.2 },
        );
        io.observe(el);
      }}
      className={`${shown ? animation : "opacity-0"} ${className}`}
    >
      {children}
    </div>
  );
}

