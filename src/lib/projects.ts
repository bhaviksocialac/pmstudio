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
  vendors: string[];
  milestones: { label: string; date: string; done: boolean }[];
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
    vendors: ["Studio Marigold (Furniture)", "Kohinoor Stone", "Lumen Lighting Co."],
    milestones: [
      { label: "Site survey complete", date: "15 Jan 2026", done: true },
      { label: "Design sign-off", date: "02 Mar 2026", done: true },
      { label: "Stone & wood procurement", date: "18 Apr 2026", done: true },
      { label: "Civil execution", date: "20 Jun 2026", done: false },
      { label: "Finishing & styling", date: "25 Jul 2026", done: false },
      { label: "Handover", date: "30 Aug 2026", done: false },
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
