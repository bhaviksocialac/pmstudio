export type Client = {
  id: string;
  name: string;
  initials: string;
  projectId: string;
  projectName: string;
  phone: string;
  email: string;
  address: string;
  phase: string;
  budget: number; // in lakhs
  portal: "active" | "sent" | "not-sent";
  lastOpened?: string;
  views?: number;
  approvals?: number;
  notes?: string;
};

export const clients: Client[] = [
  {
    id: "priya-mehta",
    name: "Priya Mehta",
    initials: "PM",
    projectId: "banyan-house",
    projectName: "Mehta Residence",
    phone: "+91 98200 11223",
    email: "priya.mehta@gmail.com",
    address: "12B Banyan Heights, Bandra West, Mumbai 400050",
    phase: "Procurement",
    budget: 14,
    portal: "active",
    lastOpened: "2 hours ago",
    views: 18,
    approvals: 4,
    notes: "Prefers WhatsApp updates. Husband Rohan reviews drawings.",
  },
  {
    id: "rajiv-kapoor",
    name: "Rajiv Kapoor",
    initials: "RK",
    projectId: "atelier-14",
    projectName: "Kapoor Office",
    phone: "+91 99100 44556",
    email: "rajiv@kapoorlaw.in",
    address: "B-14, Defence Colony, Andheri East, Mumbai 400069",
    phase: "Execution",
    budget: 28,
    portal: "sent",
    lastOpened: "Not opened yet",
    views: 0,
    approvals: 2,
    notes: "Very detail-oriented. Cc'd partner Anjali on all approvals.",
  },
  {
    id: "meena-shah",
    name: "Meena Shah",
    initials: "MS",
    projectId: "coral-studio",
    projectName: "Shah Residence",
    phone: "+91 98330 22987",
    email: "meena.shah@outlook.com",
    address: "401 Coral Cove, Juhu Tara Road, Mumbai 400049",
    phase: "Finishing",
    budget: 9.5,
    portal: "active",
    lastOpened: "Yesterday",
    views: 32,
    approvals: 9,
    notes: "Loved the curved arch mockups. Wants extra throws for the bedroom.",
  },
];

export type Vendor = {
  id: string;
  name: string;
  category: string;
  phone: string;
  email?: string;
  rating: number;
  lastUsed: string;
  activeProjects: number;
  paymentTerms: string;
  onTimePct: number;
  delays: number;
  orders: number;
  history: { project: string; amount: number; date: string }[];
  notes?: string;
};

export const vendors: Vendor[] = [
  {
    id: "rajesh-tiles",
    name: "Rajesh Tiles",
    category: "Tiles",
    phone: "+91 98202 33445",
    rating: 4,
    lastUsed: "Mehta Residence",
    activeProjects: 1,
    paymentTerms: "30 days",
    onTimePct: 88,
    delays: 1,
    orders: 12,
    history: [
      { project: "Mehta Residence", amount: 320000, date: "12 Apr 2026" },
      { project: "Shah Residence", amount: 180000, date: "08 Feb 2026" },
    ],
  },
  {
    id: "suresh-electricals",
    name: "Suresh Electricals",
    category: "Electrical",
    phone: "+91 98765 44321",
    rating: 5,
    lastUsed: "Kapoor Office",
    activeProjects: 1,
    paymentTerms: "On delivery",
    onTimePct: 100,
    delays: 0,
    orders: 9,
    history: [
      { project: "Kapoor Office", amount: 280000, date: "02 May 2026" },
      { project: "Mehta Residence", amount: 95000, date: "20 Mar 2026" },
    ],
  },
  {
    id: "kumar-wood",
    name: "Kumar Wood Works",
    category: "Carpentry",
    phone: "+91 97000 11223",
    rating: 3,
    lastUsed: "Shah Residence",
    activeProjects: 1,
    paymentTerms: "Advance 50%",
    onTimePct: 72,
    delays: 2,
    orders: 7,
    history: [
      { project: "Shah Residence", amount: 410000, date: "18 Mar 2026" },
    ],
  },
  {
    id: "ahuja-lighting",
    name: "Ahuja Lighting",
    category: "Lighting",
    phone: "+91 98888 12345",
    rating: 4,
    lastUsed: "Mehta Residence",
    activeProjects: 1,
    paymentTerms: "30 days",
    onTimePct: 95,
    delays: 0,
    orders: 6,
    history: [
      { project: "Mehta Residence", amount: 145000, date: "28 Apr 2026" },
    ],
  },
];

export type Invoice = {
  no: string;
  projectId: string;
  project: string;
  client: string;
  milestone: string;
  amount: number; // rupees
  sent: string;
  due: string;
  status: "paid" | "overdue" | "sent" | "draft";
};

export const invoices: Invoice[] = [
  { no: "INV-001", projectId: "banyan-house", project: "Mehta Residence", client: "Priya Mehta", milestone: "Design Approval", amount: 210000, sent: "10 Apr", due: "20 Apr", status: "paid" },
  { no: "INV-002", projectId: "banyan-house", project: "Mehta Residence", client: "Priya Mehta", milestone: "Procurement Start", amount: 350000, sent: "01 May", due: "11 May", status: "paid" },
  { no: "INV-003", projectId: "atelier-14", project: "Kapoor Office", client: "Rajiv Kapoor", milestone: "Civil Completion", amount: 560000, sent: "20 Apr", due: "05 May", status: "overdue" },
  { no: "INV-004", projectId: "coral-studio", project: "Shah Residence", client: "Meena Shah", milestone: "Final Invoice", amount: 950000, sent: "10 May", due: "20 May", status: "sent" },
  { no: "INV-005", projectId: "atelier-14", project: "Kapoor Office", client: "Rajiv Kapoor", milestone: "Design Phase", amount: 420000, sent: "—", due: "—", status: "draft" },
];

export type PaymentRequest = {
  id: string;
  vendor: string;
  scope: string;
  project: string;
  amount: number;
  submitted: string;
};

export const paymentRequests: PaymentRequest[] = [
  { id: "pr-1", vendor: "Ramesh Kumar", scope: "Flooring Work", project: "Mehta Residence", amount: 45000, submitted: "08 May" },
  { id: "pr-2", vendor: "Suresh Electricals", scope: "Final Phase", project: "Kapoor Office", amount: 78000, submitted: "07 May" },
];

export type Conversation = {
  id: string;
  name: string;
  initials: string;
  kind: "client" | "vendor";
  project?: string;
  preview: string;
  time: string;
  unread?: number;
  aiSummary?: boolean;
  messages: { from: "them" | "me"; text: string; time: string }[];
  aiDraft?: string;
};

export const conversations: Conversation[] = [
  {
    id: "priya-mehta",
    name: "Priya Mehta",
    initials: "PM",
    kind: "client",
    project: "Mehta Residence",
    preview: "When will flooring start?",
    time: "11:30am",
    unread: 1,
    messages: [
      { from: "them", text: "Hi Bhavik, just wanted to check when flooring starts?", time: "10:42am" },
      { from: "me", text: "Hi Priya! Tiles arriving 15th May, flooring starts immediately after.", time: "10:50am" },
      { from: "them", text: "When will flooring start? Getting a bit worried 🙏", time: "11:30am" },
    ],
    aiDraft:
      "Hi Priya, tiles are scheduled for delivery on 15th May. Flooring will begin within 24 hours of delivery. I'll send you photos as soon as we start. Everything is on track for the June handover.",
  },
  {
    id: "ramesh-kumar",
    name: "Ramesh Kumar",
    initials: "RK",
    kind: "vendor",
    project: "Mehta Residence",
    preview: "Bhaiya tiles aaj nahi aayi…",
    time: "2:15pm",
    aiSummary: true,
    messages: [
      { from: "them", text: "Bhaiya tiles aaj nahi aayi, supplier ne kaha kal aayegi pakka", time: "2:15pm" },
      { from: "me", text: "Theek hai Ramesh, kal confirm karna mujhe.", time: "2:20pm" },
    ],
  },
  {
    id: "rajiv-kapoor",
    name: "Rajiv Kapoor",
    initials: "RK",
    kind: "client",
    project: "Kapoor Office",
    preview: "Can we change the partition?",
    time: "Yesterday",
    messages: [
      { from: "them", text: "Can we change the partition layout on the east wall?", time: "Yesterday 5:12pm" },
      { from: "me", text: "Sure, sending a revised drawing tomorrow morning.", time: "Yesterday 5:45pm" },
    ],
  },
  {
    id: "suresh-electricals",
    name: "Suresh Electricals",
    initials: "SE",
    kind: "vendor",
    preview: "Payment received, thank you",
    time: "Yesterday",
    messages: [
      { from: "them", text: "Payment received, thank you Bhavik bhai.", time: "Yesterday 11:02am" },
    ],
  },
  {
    id: "meena-shah",
    name: "Meena Shah",
    initials: "MS",
    kind: "client",
    project: "Shah Residence",
    preview: "Photos look amazing!",
    time: "2 days ago",
    messages: [
      { from: "them", text: "Photos look amazing! Loving the coral arch.", time: "Mon 6:30pm" },
      { from: "me", text: "Thank you Meena! More finishing shots coming this week.", time: "Mon 7:01pm" },
    ],
  },
];

export type Notification = {
  id: string;
  title: string;
  time: string;
  tone: "info" | "success" | "warning";
};

export const notifications: Notification[] = [
  { id: "n1", title: "Priya asked about tile costs", time: "2 hours ago", tone: "info" },
  { id: "n2", title: "Invoice ₹3.5L approved", time: "5 hours ago", tone: "success" },
  { id: "n3", title: "Ramesh uploaded 3 site photos", time: "Yesterday", tone: "info" },
  { id: "n4", title: "Shah Residence 91% complete", time: "Yesterday", tone: "success" },
];

export const monthlyRevenue = [
  { month: "Dec", value: 5.2 },
  { month: "Jan", value: 6.4 },
  { month: "Feb", value: 7.1 },
  { month: "Mar", value: 6.8 },
  { month: "Apr", value: 9.2, highlight: true },
  { month: "May", value: 8.4, highlight: true },
];

export const formatINR = (n: number) => {
  if (n >= 100000) return `₹${(n / 100000).toFixed(n % 100000 === 0 ? 0 : 2)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
};
