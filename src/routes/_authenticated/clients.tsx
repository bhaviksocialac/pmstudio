import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Search, Plus, X, Loader2, Pencil, Trash2, Check, Building2, User, MessageCircle, Mail, MessageSquare, Trash } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AddressFields, addressToString, emptyAddress, type AddressValue } from "@/components/AddressFields";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { DbClient } from "@/lib/db-types";

export const Route = createFileRoute("/_authenticated/clients")({
  head: () => ({ meta: [{ title: "Clients — PMStudio" }, { name: "description", content: "Track every client and their project status." }] }),
  component: ClientsPage,
});

type ClientContact = {
  id: string;
  client_id: string;
  name: string;
  designation: string | null;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  tag: string;
  order_index: number;
};

const COUNTRIES = [
  { code: "+91", name: "India", iso: "IN", currency: "INR" },
  { code: "+1", name: "USA", iso: "US", currency: "USD" },
  { code: "+44", name: "UK", iso: "GB", currency: "GBP" },
  { code: "+971", name: "UAE", iso: "AE", currency: "AED" },
  { code: "+65", name: "Singapore", iso: "SG", currency: "SGD" },
  { code: "+61", name: "Australia", iso: "AU", currency: "AUD" },
  { code: "+49", name: "Germany", iso: "DE", currency: "EUR" },
];

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

function ClientsPage() {
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<DbClient | null>(null);
  const [deleting, setDeleting] = useState<DbClient | null>(null);
  const qc = useQueryClient();

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DbClient[];
    },
  });
  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(q.toLowerCase()) ||
    (c.contact_person ?? "").toLowerCase().includes(q.toLowerCase())
  );

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Client deleted");
      setDeleting(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <AppShell>
      <main className="px-4 md:px-8 py-8 md:py-10 max-w-[1400px] w-full pb-24 md:pb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-3">People</div>
            <h1 className="font-display text-4xl md:text-5xl">Clients</h1>
            <p className="text-muted-foreground mt-2">{clients.length} client{clients.length === 1 ? "" : "s"} in your book</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clients…" className="h-10 pl-10 pr-3 rounded-[10px] bg-card border border-border text-sm w-56 focus:outline-none focus:ring-2 focus:ring-ring/30" />
            </div>
            <button onClick={() => setAdding(true)} className="h-10 px-4 inline-flex items-center gap-2 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95">
              <Plus className="h-4 w-4" /> Add Client
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-[16px] bg-card border border-border h-64 animate-pulse" />
        ) : filtered.length === 0 ? (
          <Empty onAdd={() => setAdding(true)} />
        ) : (
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((c) => (
              <ClientCard key={c.id} client={c} onEdit={() => setEditing(c)} onDelete={() => setDeleting(c)} />
            ))}
          </section>
        )}
      </main>
      {adding && <ClientModal onClose={() => setAdding(false)} />}
      {editing && <ClientModal client={editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDeleting(null)}>
          <div className="w-full max-w-sm bg-card rounded-[16px] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-2xl mb-2">Delete {deleting.name}?</h3>
            <p className="text-sm text-muted-foreground mb-5">This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleting(null)} className="h-10 px-4 rounded-[6px] border border-border text-sm font-medium hover:bg-muted">Cancel</button>
              <button onClick={() => del.mutate(deleting.id)} disabled={del.isPending} className="h-10 px-5 rounded-[6px] bg-[#c4685a] text-white text-sm font-medium hover:brightness-95 inline-flex items-center gap-2 disabled:opacity-60">
                {del.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function ClientCard({ client, onEdit, onDelete }: { client: DbClient; onEdit: () => void; onDelete: () => void }) {
  const isCompany = client.client_type === "company";
  const displayName = isCompany ? client.name : client.name;
  const initials = displayName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const commIcon = client.communication_pref === "WhatsApp" ? MessageCircle : client.communication_pref === "Email" ? Mail : MessageSquare;
  const CommIcon = commIcon;

  return (
    <div className="rounded-[16px] bg-card border border-border p-5 hover:shadow-md transition-shadow" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <span className={`h-10 w-10 rounded-[10px] ${isCompany ? "bg-[#3b6fa0]" : "bg-[#c17f5a]"} text-white text-sm font-medium flex items-center justify-center flex-shrink-0`}>
            {isCompany ? <Building2 className="h-5 w-5" /> : initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-medium truncate">{displayName}</div>
            {isCompany && client.contact_person && (
              <div className="text-xs text-muted-foreground truncate">{client.contact_person}{client.designation ? ` · ${client.designation}` : ""}</div>
            )}
            <div className="flex items-center gap-2 mt-1.5">
              <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${isCompany ? "bg-[#3b6fa0]/10 text-[#3b6fa0]" : "bg-[#c17f5a]/10 text-[#c17f5a]"}`}>
                {isCompany ? "Company" : "Individual"}
              </span>
              <CommIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{client.language_pref}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 space-y-1 text-xs text-muted-foreground">
        {client.phone && <div className="font-mono">{client.phone_country_code} {client.phone}</div>}
        {client.email && <div className="truncate">{client.email}</div>}
      </div>
      <div className="mt-4 flex justify-end gap-1.5">
        <button onClick={onEdit} className="h-8 px-2.5 rounded-[6px] border border-border text-xs hover:bg-muted inline-flex items-center gap-1">
          <Pencil className="h-3 w-3" /> Edit
        </button>
        <button onClick={onDelete} className="h-8 px-2.5 rounded-[6px] border border-border text-xs text-[#c4685a] hover:bg-[#fff0ee] inline-flex items-center gap-1">
          <Trash2 className="h-3 w-3" /> Delete
        </button>
      </div>
    </div>
  );
}

function Empty({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-[16px] border border-dashed border-border p-16 text-center">
      <h3 className="font-display text-2xl">No clients yet</h3>
      <p className="text-muted-foreground mt-2 mb-6">Add your first client to start tracking relationships.</p>
      <button onClick={onAdd} className="h-10 px-5 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95">+ Add Client</button>
    </div>
  );
}

const baseSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(160),
  email: z.string().trim().email("Valid email is required").max(255),
  phone: z.string().trim().min(1, "Phone is required").max(40),
});

function ClientModal({ onClose, client }: { onClose: () => void; client?: DbClient }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const editing = !!client;

  const [clientType, setClientType] = useState<"individual" | "company">(
    (client?.client_type as "individual" | "company") ?? "individual"
  );
  const [countryCode, setCountryCode] = useState(client?.phone_country_code ?? "+91");
  const [form, setForm] = useState({
    name: client?.name ?? "",
    contact_person: client?.contact_person ?? "",
    designation: client?.designation ?? "",
    email: client?.email ?? "",
    phone: client?.phone ?? "",
    whatsapp: client?.whatsapp ?? "",
    pan: client?.pan ?? "",
    gst: client?.gst ?? "",
    rera: client?.rera ?? "",
    language_pref: client?.language_pref ?? "English",
    communication_pref: client?.communication_pref ?? "Both",
    relationship: client?.relationship ?? "Direct",
    referred_by: client?.referred_by ?? "",
    notes: client?.notes ?? "",
  });
  const [waSameAsPhone, setWaSameAsPhone] = useState(
    !client || (client?.whatsapp ?? "") === (client?.phone ?? "")
  );
  const [addr, setAddr] = useState<AddressValue>({
    flat_number: client?.flat_number ?? "",
    street: client?.street ?? "",
    city: client?.city ?? "",
    state: client?.state ?? "",
    country: client?.country ?? "India",
    pincode: client?.pincode ?? "",
    latitude: client?.latitude ?? null,
    longitude: client?.longitude ?? null,
    ...(client ? {} : emptyAddress),
  });
  const [siteSame, setSiteSame] = useState(client?.site_same_as_registered ?? true);
  const [siteAddr, setSiteAddr] = useState<AddressValue>({
    flat_number: client?.site_flat_number ?? "",
    street: client?.site_street ?? "",
    city: client?.site_city ?? "",
    state: client?.site_state ?? "",
    country: client?.site_country ?? "India",
    pincode: client?.site_pincode ?? "",
    latitude: null,
    longitude: null,
  });

  // Contacts for company
  const { data: contacts = [] } = useQuery({
    queryKey: ["client_contacts", client?.id],
    queryFn: async () => {
      if (!client?.id) return [];
      const { data, error } = await supabase.from("client_contacts").select("*").eq("client_id", client.id).order("order_index");
      if (error) throw error;
      return (data ?? []) as ClientContact[];
    },
    enabled: !!client?.id,
  });
  const [contactDrafts, setContactDrafts] = useState<Partial<ClientContact>[]>([]);
  useEffect(() => { setContactDrafts(contacts); }, [contacts]);

  useEffect(() => {
    if (waSameAsPhone) setForm((f) => ({ ...f, whatsapp: f.phone }));
  }, [waSameAsPhone, form.phone]);

  const selectedCountry = COUNTRIES.find((c) => c.code === countryCode) ?? COUNTRIES[0];

  const panValid = form.pan ? PAN_REGEX.test(form.pan.toUpperCase()) : null;
  const gstValid = form.gst ? GST_REGEX.test(form.gst.toUpperCase()) : null;

  const save = useMutation({
    mutationFn: async () => {
      const parsed = baseSchema.parse({ name: form.name, email: form.email, phone: form.phone });

      if (clientType === "company") {
        if (!form.contact_person.trim()) throw new Error("Contact person is required");
        if (!form.gst.trim()) throw new Error("GST number is required for company");
        if (!form.pan.trim()) throw new Error("PAN number is required");
      } else {
        if (!addr.flat_number.trim()) throw new Error("Flat / Unit number is required");
      }
      if (form.pan && !PAN_REGEX.test(form.pan.toUpperCase())) throw new Error("Invalid PAN format (AAAAA0000A)");
      if (form.gst && !GST_REGEX.test(form.gst.toUpperCase())) throw new Error("Invalid GST format (15 chars)");

      const payload = {
        name: parsed.name,
        email: parsed.email,
        phone: parsed.phone,
        phone_country_code: countryCode,
        currency_code: selectedCountry.currency,
        whatsapp: form.whatsapp || null,
        client_type: clientType,
        contact_person: clientType === "company" ? form.contact_person || null : null,
        designation: clientType === "company" ? form.designation || null : null,
        pan: form.pan ? form.pan.toUpperCase() : null,
        gst: form.gst ? form.gst.toUpperCase() : null,
        rera: form.rera || null,
        language_pref: form.language_pref,
        communication_pref: form.communication_pref,
        relationship: form.relationship,
        referred_by: form.relationship === "Referred" ? form.referred_by || null : null,
        notes: form.notes || null,
        flat_number: addr.flat_number || null,
        street: addr.street || null,
        city: addr.city || null,
        state: addr.state || null,
        country: addr.country || null,
        pincode: addr.pincode || null,
        latitude: addr.latitude,
        longitude: addr.longitude,
        address: addressToString(addr) || null,
        site_same_as_registered: clientType === "company" ? siteSame : true,
        site_flat_number: clientType === "company" && !siteSame ? siteAddr.flat_number || null : null,
        site_street: clientType === "company" && !siteSame ? siteAddr.street || null : null,
        site_city: clientType === "company" && !siteSame ? siteAddr.city || null : null,
        site_state: clientType === "company" && !siteSame ? siteAddr.state || null : null,
        site_country: clientType === "company" && !siteSame ? siteAddr.country || null : null,
        site_pincode: clientType === "company" && !siteSame ? siteAddr.pincode || null : null,
      };

      let clientId = client?.id;
      if (editing) {
        const { error } = await supabase.from("clients").update(payload).eq("id", client!.id);
        if (error) throw error;
        await supabase.from("projects").update({
          flat_number: payload.flat_number,
          street: payload.street,
          city: payload.city,
          state: payload.state,
          country: payload.country,
          pincode: payload.pincode,
          latitude: payload.latitude,
          longitude: payload.longitude,
          location: payload.address,
        }).eq("client_id", client!.id);
      } else {
        const { data: existing } = await supabase.from("clients").select("id").eq("user_id", user!.id).eq("email", parsed.email).maybeSingle();
        if (existing) {
          const { error } = await supabase.from("clients").update(payload).eq("id", existing.id);
          if (error) throw error;
          clientId = existing.id;
          toast.info("Existing client with this email updated");
        } else {
          const { data: inserted, error } = await supabase.from("clients").insert({ user_id: user!.id, ...payload }).select("id").single();
          if (error) throw error;
          clientId = inserted.id;
        }
      }

      // Sync contacts for company
      if (clientType === "company" && clientId) {
        // Delete contacts removed in UI
        const draftIds = contactDrafts.filter((c) => c.id).map((c) => c.id!);
        const toDelete = contacts.filter((c) => !draftIds.includes(c.id)).map((c) => c.id);
        if (toDelete.length) {
          await supabase.from("client_contacts").delete().in("id", toDelete);
        }
        // Upsert remaining
        for (let i = 0; i < contactDrafts.length; i++) {
          const c = contactDrafts[i];
          if (!c.name?.trim()) continue;
          const row = {
            user_id: user!.id,
            client_id: clientId,
            name: c.name.trim(),
            designation: c.designation || null,
            phone: c.phone || null,
            email: c.email || null,
            whatsapp: c.whatsapp || null,
            tag: c.tag || "Other",
            order_index: i,
          };
          if (c.id) {
            await supabase.from("client_contacts").update(row).eq("id", c.id);
          } else {
            await supabase.from("client_contacts").insert(row);
          }
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["client_contacts"] });
      toast.success(editing ? "Client updated" : "Client added");
      onClose();
    },
    onError: (e) => toast.error(e instanceof z.ZodError ? e.issues[0].message : e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-2xl bg-card rounded-[16px] shadow-2xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <h3 className="font-display text-2xl">{editing ? "Edit Client" : "Add Client"}</h3>
          <button onClick={onClose} className="h-9 w-9 rounded-[10px] hover:bg-muted flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Type toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-[10px]">
            <button
              type="button"
              onClick={() => {
                if (clientType !== "individual") {
                  setForm((f) => ({ ...f, name: "", contact_person: "", designation: "" }));
                }
                setClientType("individual");
              }}
              className={`h-10 rounded-[8px] text-sm font-medium inline-flex items-center justify-center gap-2 transition ${clientType === "individual" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
            >
              <User className="h-4 w-4" /> Individual
            </button>
            <button
              type="button"
              onClick={() => {
                if (clientType !== "company") {
                  setForm((f) => ({ ...f, name: "", contact_person: "", designation: "" }));
                }
                setClientType("company");
              }}
              className={`h-10 rounded-[8px] text-sm font-medium inline-flex items-center justify-center gap-2 transition ${clientType === "company" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
            >
              <Building2 className="h-4 w-4" /> Company / Business
            </button>
          </div>

          {/* Names */}
          {clientType === "individual" ? (
            <F label="Full Name" required><input className={ic} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></F>
          ) : (
            <>
              <F label="Company Name" required><input className={ic} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></F>
              <div className="grid grid-cols-2 gap-3">
                <F label="Contact Person" required><input className={ic} value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></F>
                <F label="Designation"><input className={ic} value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} placeholder="Director, PM, Architect…" /></F>
              </div>
            </>
          )}

          {/* Email + Phone */}
          <div className="grid grid-cols-2 gap-3">
            <F label="Email" required><input type="email" className={ic} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@example.com" /></F>
            <F label="Phone" required>
              <div className="flex gap-2">
                <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} className={`${ic} w-24 flex-shrink-0`}>
                  {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                </select>
                <input className={ic} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="98765 43210" />
              </div>
            </F>
          </div>

          {/* WhatsApp */}
          <div>
            <label className="inline-flex items-center gap-2 text-sm mb-2 cursor-pointer">
              <input type="checkbox" checked={waSameAsPhone} onChange={(e) => setWaSameAsPhone(e.target.checked)} className="h-4 w-4 rounded" />
              <span>WhatsApp same as {clientType === "company" ? "company" : ""} phone</span>
            </label>
            {!waSameAsPhone && (
              <input className={ic} value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="WhatsApp number" />
            )}
          </div>

          {/* Tax IDs */}
          <div className="grid grid-cols-2 gap-3">
            <F label={`PAN Number ${clientType === "company" ? "*" : ""}`}>
              <div className="relative">
                <input className={`${ic} uppercase pr-9`} value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })} placeholder="AAAAA0000A" maxLength={10} />
                {panValid === true && <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600" />}
                {panValid === false && <X className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#c4685a]" />}
              </div>
            </F>
            {clientType === "company" && (
              <F label="GST Number" required>
                <div className="relative">
                  <input className={`${ic} uppercase pr-9`} value={form.gst} onChange={(e) => setForm({ ...form, gst: e.target.value.toUpperCase() })} placeholder="22AAAAA0000A1Z5" maxLength={15} />
                  {gstValid === true && <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600" />}
                  {gstValid === false && <X className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#c4685a]" />}
                </div>
              </F>
            )}
          </div>

          {clientType === "company" && form.relationship === "Builder Project" && (
            <F label="RERA Number"><input className={ic} value={form.rera} onChange={(e) => setForm({ ...form, rera: e.target.value })} /></F>
          )}

          {/* Address */}
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-3">
              {clientType === "company" ? "Registered Address" : "Address"}
            </div>
            <AddressFields value={addr} onChange={setAddr} />
          </div>

          {clientType === "company" && (
            <div>
              <label className="inline-flex items-center gap-2 text-sm mb-2 cursor-pointer">
                <input type="checkbox" checked={siteSame} onChange={(e) => setSiteSame(e.target.checked)} className="h-4 w-4 rounded" />
                <span>Site address same as registered address</span>
              </label>
              {!siteSame && (
                <div className="mt-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-3">Site Address</div>
                  <AddressFields value={siteAddr} onChange={setSiteAddr} />
                </div>
              )}
            </div>
          )}

          {/* Preferences */}
          <div className="grid grid-cols-2 gap-3">
            <F label="Language Preference">
              <select className={ic} value={form.language_pref} onChange={(e) => setForm({ ...form, language_pref: e.target.value })}>
                <option>English</option>
                <option>Hindi</option>
              </select>
            </F>
            <F label="Communication Preference">
              <select className={ic} value={form.communication_pref} onChange={(e) => setForm({ ...form, communication_pref: e.target.value })}>
                <option>WhatsApp</option>
                <option>Email</option>
                <option>Both</option>
              </select>
            </F>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <F label="Relationship">
              <select className={ic} value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })}>
                <option>Direct</option>
                <option>Referred</option>
                <option>Builder Project</option>
                <option>Repeat Client</option>
              </select>
            </F>
            {form.relationship === "Referred" && (
              <F label="Referred By"><input className={ic} value={form.referred_by} onChange={(e) => setForm({ ...form, referred_by: e.target.value })} placeholder="Name" /></F>
            )}
          </div>

          {/* Contacts (company only) */}
          {clientType === "company" && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Additional Contacts</div>
                <button
                  type="button"
                  onClick={() => setContactDrafts([...contactDrafts, { name: "", tag: "Other" }])}
                  className="h-7 px-2.5 rounded-[6px] border border-border text-xs hover:bg-muted inline-flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Add Contact
                </button>
              </div>
              <div className="space-y-3">
                {contactDrafts.map((c, idx) => (
                  <div key={c.id ?? `new-${idx}`} className="p-3 border border-border rounded-[10px] space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input className={ic} placeholder="Name" value={c.name ?? ""} onChange={(e) => updateContact(setContactDrafts, idx, { name: e.target.value })} />
                      <input className={ic} placeholder="Designation" value={c.designation ?? ""} onChange={(e) => updateContact(setContactDrafts, idx, { designation: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <input className={ic} placeholder="Phone" value={c.phone ?? ""} onChange={(e) => updateContact(setContactDrafts, idx, { phone: e.target.value })} />
                      <input className={ic} placeholder="Email" value={c.email ?? ""} onChange={(e) => updateContact(setContactDrafts, idx, { email: e.target.value })} />
                      <input className={ic} placeholder="WhatsApp" value={c.whatsapp ?? ""} onChange={(e) => updateContact(setContactDrafts, idx, { whatsapp: e.target.value })} />
                    </div>
                    <div className="flex items-center gap-2">
                      <select className={`${ic} w-32`} value={c.tag ?? "Other"} onChange={(e) => updateContact(setContactDrafts, idx, { tag: e.target.value })}>
                        <option>Primary</option>
                        <option>Accounts</option>
                        <option>Site</option>
                        <option>Other</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setContactDrafts(contactDrafts.filter((_, i) => i !== idx))}
                        className="ml-auto h-8 w-8 rounded-[6px] hover:bg-muted text-[#c4685a] inline-flex items-center justify-center"
                      >
                        <Trash className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {contactDrafts.length === 0 && (
                  <div className="text-xs text-muted-foreground italic">No additional contacts. Add accounts, site supervisor, decision maker, etc.</div>
                )}
              </div>
            </div>
          )}

          <F label="Notes"><textarea rows={2} className={`${ic} h-auto py-2`} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></F>
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="h-10 px-4 rounded-[6px] border border-border text-sm font-medium hover:bg-muted">Cancel</button>
          <button onClick={() => save.mutate()} disabled={save.isPending} className="h-10 px-5 rounded-[6px] bg-primary text-primary-foreground text-sm font-medium hover:brightness-95 inline-flex items-center gap-2 disabled:opacity-60">
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing ? "Save Changes" : "Save Client"}
          </button>
        </div>
      </div>
    </div>
  );
}

function updateContact(setter: React.Dispatch<React.SetStateAction<Partial<ClientContact>[]>>, idx: number, patch: Partial<ClientContact>) {
  setter((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
}

function F({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return <label className="block"><span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}{required && <span className="text-[#c17f5a] ml-1">*</span>}</span><div className="mt-1.5">{children}</div></label>;
}
const ic = "w-full h-10 px-3 rounded-[10px] bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring/30";
