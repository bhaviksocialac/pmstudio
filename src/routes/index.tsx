import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import {
  Menu, X, Phone, Truck, IndianRupee, Sparkles, Smartphone,
  FileText, Bell, Star, ArrowRight, Check, Heart,
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
      <Nav />
      <Hero />
      <Problem />
      <Solution />
      <HowItWorks />
      <Pricing />
      <Waitlist />
      <Footer />
    </div>
  );
}

/* -------------------- NAV -------------------- */
function Nav() {
  const [open, setOpen] = useState(false);
  const links = [
    { label: "Features", href: "#solution" },
    { label: "Pricing", href: "#pricing" },
    { label: "About", href: "#waitlist" },
  ];
  return (
    <nav className="sticky top-0 z-50 bg-[#faf8f5]/85 backdrop-blur border-b border-[#e8e2d8]">
      <div className="max-w-6xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="font-display text-2xl tracking-tight" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
          PMStudio
        </Link>
        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <a key={l.label} href={l.href} className="text-sm text-[#3d3530] hover:text-[#c17f5a] transition">
              {l.label}
            </a>
          ))}
          <Link
            to="/signup"
            className="inline-flex items-center h-10 px-5 rounded-md bg-[#c17f5a] text-white font-medium hover:bg-[#a86a48] transition shadow-sm"
          >
            Start Free
          </Link>
        </div>
        <button className="md:hidden p-2" onClick={() => setOpen((o) => !o)} aria-label="Menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div className="md:hidden border-t border-[#e8e2d8] px-5 py-4 space-y-3 bg-[#faf8f5]">
          {links.map((l) => (
            <a key={l.label} href={l.href} className="block text-[#3d3530]" onClick={() => setOpen(false)}>
              {l.label}
            </a>
          ))}
          <Link to="/signup" className="block w-full text-center h-10 leading-10 rounded-md bg-[#c17f5a] text-white font-medium">
            Start Free
          </Link>
        </div>
      )}
    </nav>
  );
}

/* -------------------- HERO -------------------- */
function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-5 md:px-8 pt-16 md:pt-24 pb-16 md:pb-24 grid md:grid-cols-2 gap-12 items-center">
        <div className="animate-fade-up" style={{ animationDuration: "0.6s" }}>
          <h1
            className="font-display leading-[1.05] text-[44px] md:text-[64px] tracking-tight text-[#1a1612]"
            style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 500 }}
          >
            Run your interior design studio <em className="text-[#c17f5a] not-italic">like a pro</em>
          </h1>
          <p className="mt-6 text-lg text-[#5a4f48] max-w-xl leading-relaxed">
            Project management, client portal, vendor tracking and AI communication — built specifically for Indian interior designers.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 h-12 px-6 rounded-md bg-[#c17f5a] text-white font-medium hover:bg-[#a86a48] transition shadow-lg shadow-[#c17f5a]/20"
            >
              Start Free — No credit card <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#how"
              className="inline-flex items-center h-12 px-6 rounded-md border border-[#1a1612]/15 text-[#1a1612] font-medium hover:bg-[#1a1612]/5 transition"
            >
              See how it works
            </a>
          </div>
          <div className="mt-8 flex items-center gap-3 text-sm text-[#6b5f58]">
            <div className="flex">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} className="h-4 w-4 fill-[#d4a574] text-[#d4a574]" />
              ))}
            </div>
            <span>Trusted by interior designers across India</span>
          </div>
        </div>
        <div className="animate-fade-up" style={{ animationDuration: "0.8s", animationDelay: "0.15s" }}>
          <div className="relative">
            <div
              className="absolute -inset-8 rounded-full opacity-50 blur-3xl"
              style={{ background: "radial-gradient(circle, #c17f5a 0%, transparent 70%)" }}
            />
            <img
              src={heroImage}
              alt="PMStudio dashboard on a laptop"
              className="relative rounded-xl shadow-2xl w-full"
              loading="eager"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------- PROBLEM -------------------- */
function Problem() {
  const items = [
    {
      icon: Phone,
      title: "Chasing clients on WhatsApp",
      body: "Approvals, updates, invoices — all buried in chat. Nothing is tracked.",
    },
    {
      icon: Truck,
      title: "Vendors never on time",
      body: "Deliveries delayed. Payments forgotten. Projects stuck.",
    },
    {
      icon: IndianRupee,
      title: "No idea where the money went",
      body: "Budget overruns discovered too late. Client disputes with no paper trail.",
    },
  ];
  return (
    <section className="bg-[#f1ece4] py-20 md:py-28">
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        <h2
          className="font-display text-center text-4xl md:text-5xl text-[#1a1612] mb-14"
          style={{ fontFamily: "'Cormorant Garamond', serif" }}
        >
          Sound familiar?
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {items.map((it, i) => (
            <Reveal key={it.title} delay={i * 0.1}>
              <div className="bg-[#faf8f5] rounded-2xl p-8 h-full border border-[#e8e2d8] hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                <div className="h-12 w-12 rounded-xl bg-[#c17f5a]/12 text-[#c17f5a] flex items-center justify-center mb-5">
                  <it.icon className="h-6 w-6" />
                </div>
                <h3
                  className="font-display text-2xl mb-3 text-[#1a1612]"
                  style={{ fontFamily: "'Cormorant Garamond', serif" }}
                >
                  {it.title}
                </h3>
                <p className="text-[#5a4f48] leading-relaxed">{it.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------- SOLUTION -------------------- */
function Solution() {
  const blocks = [
    {
      icon: Sparkles,
      title: "AI Task Intelligence",
      body: "Type a site update in plain English or Hindi. AI creates every task automatically with timelines and assignees.",
    },
    {
      icon: Smartphone,
      title: "Branded Client Portal",
      body: "Clients track progress, approve designs, and view invoices — on their phone. Your studio name, your brand.",
    },
    {
      icon: FileText,
      title: "Smart Vendor Tracking",
      body: "Upload a vendor invoice. AI reads it, matches the PO, and tracks payments automatically.",
    },
    {
      icon: Bell,
      title: "Proactive Alerts",
      body: "PMStudio tells you exactly what to do today to keep every project on track. No more surprises.",
    },
  ];
  return (
    <section id="solution" className="py-20 md:py-28">
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2
            className="font-display text-4xl md:text-5xl text-[#1a1612]"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            PMStudio handles it all
          </h2>
          <p className="mt-5 text-lg text-[#5a4f48] leading-relaxed">
            Tell AI what happened on site. PMStudio creates tasks, updates timelines, drafts client messages — automatically.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {blocks.map((b, i) => (
            <Reveal key={b.title} delay={i * 0.08}>
              <div className="group relative rounded-2xl p-8 bg-[#faf8f5] border border-[#e8e2d8] hover:border-[#c17f5a]/40 hover:shadow-xl transition-all duration-300">
                <div className="flex items-start gap-5">
                  <div className="h-14 w-14 shrink-0 rounded-xl bg-gradient-to-br from-[#c17f5a] to-[#a86a48] text-white flex items-center justify-center shadow-lg shadow-[#c17f5a]/25">
                    <b.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3
                      className="font-display text-2xl text-[#1a1612] mb-2"
                      style={{ fontFamily: "'Cormorant Garamond', serif" }}
                    >
                      {b.title}
                    </h3>
                    <p className="text-[#5a4f48] leading-relaxed">{b.body}</p>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------- HOW IT WORKS -------------------- */
function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Create your project",
      meta: "8 minutes",
      body: "Upload your BOQ. AI sets up the timeline, phases, and budget automatically.",
    },
    {
      n: "02",
      title: "Tell AI what's happening",
      meta: "Plain English or Hindi",
      body: "Type site updates the way you talk. Tasks, snags, and follow-ups get created automatically.",
    },
    {
      n: "03",
      title: "Share with clients",
      meta: "One link",
      body: "Branded portal — clients approve designs, track progress, and pay invoices in one place.",
    },
  ];
  return (
    <section id="how" className="bg-[#f1ece4] py-20 md:py-28">
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        <h2
          className="font-display text-center text-4xl md:text-5xl text-[#1a1612] mb-16"
          style={{ fontFamily: "'Cormorant Garamond', serif" }}
        >
          From chaos to control in 3 steps
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.12}>
              <div className="bg-[#faf8f5] rounded-2xl p-8 h-full border border-[#e8e2d8] relative">
                <div
                  className="absolute -top-5 left-8 font-display text-5xl text-[#c17f5a]"
                  style={{ fontFamily: "'Cormorant Garamond', serif" }}
                >
                  {s.n}
                </div>
                <div className="mt-6">
                  <div className="text-xs uppercase tracking-[0.18em] text-[#c17f5a] mb-2">{s.meta}</div>
                  <h3
                    className="font-display text-2xl mb-3 text-[#1a1612]"
                    style={{ fontFamily: "'Cormorant Garamond', serif" }}
                  >
                    {s.title}
                  </h3>
                  <p className="text-[#5a4f48] leading-relaxed">{s.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
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
          <a href="#" className="hover:text-[#c17f5a] transition">Privacy</a>
          <a href="#" className="hover:text-[#c17f5a] transition">Terms</a>
          <a href="#waitlist" className="hover:text-[#c17f5a] transition">Contact</a>
        </div>
        <div className="flex items-center gap-1.5">
          Made with <Heart className="h-3.5 w-3.5 fill-[#c17f5a] text-[#c17f5a]" /> in Mumbai · © 2026
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
