export const phases = ["Survey", "Design", "Procurement", "Execution", "Finishing", "Handover"] as const;
export type Phase = typeof phases[number];

export type Health = "on-track" | "attention" | "urgent";
export type ProjectType = "residential" | "commercial";

export type Project = {
  id: string;
  name: string;
  client: string;
  location: string;
  phase: Phase;
  completion: number;
  spent: number;
  budget: number;
  health: Health;
  type: ProjectType;
  startDate: string;
  expectedHandover: string;
  description: string;
  team: string[];
  vendors: { name: string; scope: string; status: "confirmed" | "pending" | "delayed" | "completed" }[];
  milestones: { label: string; date: string; done: boolean }[];
  gallery: { room: string; items: { caption: string; tone: string }[] }[];
  budgetBreakdown: { category: string; allocated: number; spent: number }[];
  notes: { author: string; date: string; text: string }[];
};

export const projects: Project[] = [
  {
    id: "banyan-house",
    name: "Banyan House",
    client: "Mehra Family",
    location: "Bandra, Mumbai",
    phase: "Execution",
    completion: 62,
    spent: 48,
    budget: 85,
    health: "on-track",
    type: "residential",
    startDate: "12 Jan 2026",
    expectedHandover: "30 Aug 2026",
    description:
      "A 4-BHK sea-facing residence reimagined with warm Indian craft, lime-wash walls and reclaimed teak. Anchored around a central courtyard with a banyan motif.",
    team: ["Bhavik Shah", "Riya Menon", "Aditya Patel"],
    vendors: [
      { name: "Studio Marigold", scope: "Custom furniture", status: "confirmed" },
      { name: "Kohinoor Stone", scope: "Kota & marble flooring", status: "completed" },
      { name: "Lumen Lighting Co.", scope: "Lighting design", status: "pending" },
      { name: "Teakwood Atelier", scope: "Reclaimed teak joinery", status: "confirmed" },
    ],
    milestones: [
      { label: "Site survey complete", date: "15 Jan 2026", done: true },
      { label: "Design sign-off", date: "02 Mar 2026", done: true },
      { label: "Stone & wood procurement", date: "18 Apr 2026", done: true },
      { label: "Civil execution", date: "20 Jun 2026", done: false },
      { label: "Finishing & styling", date: "25 Jul 2026", done: false },
      { label: "Handover", date: "30 Aug 2026", done: false },
    ],
    gallery: [
      { room: "Living Room", items: [
        { caption: "Courtyard view", tone: "linear-gradient(135deg,#c17f5a,#8b5a3c)" },
        { caption: "Lime-wash wall", tone: "linear-gradient(135deg,#e8dcc8,#c4b196)" },
        { caption: "Teak console", tone: "linear-gradient(135deg,#6b4423,#3d2817)" },
      ]},
      { room: "Master Bedroom", items: [
        { caption: "Headboard mockup", tone: "linear-gradient(135deg,#9b6b4a,#5d3a22)" },
        { caption: "Window seat", tone: "linear-gradient(135deg,#d4a574,#a8784f)" },
      ]},
      { room: "Kitchen", items: [
        { caption: "Stone counter", tone: "linear-gradient(135deg,#3a3a38,#1e1e1c)" },
        { caption: "Brass fittings", tone: "linear-gradient(135deg,#c9a84c,#8a6f2a)" },
      ]},
    ],
    budgetBreakdown: [
      { category: "Civil & masonry", allocated: 22, spent: 18 },
      { category: "Joinery & furniture", allocated: 28, spent: 14 },
      { category: "Stone & flooring", allocated: 14, spent: 12 },
      { category: "Lighting", allocated: 8, spent: 2 },
      { category: "Soft furnishing", allocated: 7, spent: 1 },
      { category: "Studio fee", allocated: 6, spent: 1 },
    ],
    notes: [
      { author: "Riya Menon", date: "12 May 2026", text: "Client approved the lime-wash sample 03. Proceeding with full living room application next week." },
      { author: "Bhavik Shah", date: "08 May 2026", text: "Teak shipment cleared customs. Joinery work begins Monday on site." },
      { author: "Aditya Patel", date: "02 May 2026", text: "Banyan motif sketch revision 4 sent for client sign-off." },
    ],

  },
  {
    id: "atelier-14",
    name: "Atelier 14",
    client: "Kapoor & Co.",
    location: "Defence Colony, Delhi",
    phase: "Procurement",
    completion: 38,
    spent: 26,
    budget: 54,
    health: "attention",
    type: "commercial",
    startDate: "04 Feb 2026",
    expectedHandover: "12 Oct 2026",
    description:
      "A boutique law office spanning two floors — quiet luxury, fluted oak panelling, deep green leather and brass detailing. Designed for focus and quiet client conversations.",
    team: ["Bhavik Shah", "Nikhil Rao"],
    vendors: ["Oakcraft", "Brass & Bone", "Verdant Greens"],
    milestones: [
      { label: "Site survey complete", date: "08 Feb 2026", done: true },
      { label: "Design sign-off", date: "22 Mar 2026", done: true },
      { label: "Vendor finalisation", date: "05 May 2026", done: false },
      { label: "Civil execution", date: "10 Jul 2026", done: false },
      { label: "Finishing", date: "20 Sep 2026", done: false },
      { label: "Handover", date: "12 Oct 2026", done: false },
    ],
  },
  {
    id: "coral-studio",
    name: "Coral Studio",
    client: "Iyer Residence",
    location: "Koregaon Park, Pune",
    phase: "Finishing",
    completion: 89,
    spent: 71,
    budget: 72,
    health: "urgent",
    type: "residential",
    startDate: "20 Oct 2025",
    expectedHandover: "28 May 2026",
    description:
      "A coral-toned 3-BHK apartment with curved arches, terrazzo flooring and a sunken living room. Tiles delayed by 3 days — flooring schedule shifted to 18 May.",
    team: ["Bhavik Shah", "Riya Menon"],
    vendors: ["Terrazzo Mumbai", "Curve Joinery", "Lumen Lighting Co."],
    milestones: [
      { label: "Site survey complete", date: "25 Oct 2025", done: true },
      { label: "Design sign-off", date: "10 Dec 2025", done: true },
      { label: "Procurement", date: "02 Feb 2026", done: true },
      { label: "Civil execution", date: "15 Apr 2026", done: true },
      { label: "Finishing & styling", date: "18 May 2026", done: false },
      { label: "Handover", date: "28 May 2026", done: false },
    ],
  },
];

export const healthMap: Record<Health, { color: string; label: string; pulse: string; line: string }> = {
  "on-track": { color: "#7a9e8a", label: "On track", pulse: "", line: "#7a9e8a" },
  attention: { color: "#d4882a", label: "Watch closely", pulse: "pulse-slow", line: "#d4882a" },
  urgent: { color: "#c4685a", label: "Urgent", pulse: "pulse-fast", line: "#c4685a" },
};

export const getProjectById = (id: string) => projects.find((p) => p.id === id);
