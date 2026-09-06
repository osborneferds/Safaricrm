import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCheck, FileText, LayoutGrid, ListFilter, MessageCircle, Phone, Plus, Send, StickyNote, Ticket, UserPlus, Users } from "lucide-react";
import { useStore, useTenant } from "../lib/store";
import type { ID, Lead, LeadSource, LeadStatus, Message } from "../lib/types";
import { LEAD_SOURCES, calcTotal } from "../lib/data";
import { LEAD_STATUS, addDaysISO, cx, daysFromNow, fmtDate, fmtDateShort, fmtTime, money, nowISO, timeAgo, todayISO, uid } from "../lib/utils";
import { Avatar, EmptyState, Field, Modal, SearchBox, StatusPill, Tabs } from "../components/ui";

const PIPE: LeadStatus[] = ["new", "contacted", "quoted", "follow_up", "confirmed", "paid", "completed", "lost"];

const fillTemplate = (body: string, l: Lead, extra: Record<string, string>) =>
  body.replace(/\{(\w+)\}/g, (_, k) => ({
    name: l.name.split(" ")[0], company: extra.company ?? "our team", package: extra.package ?? "desert safari",
    duration: extra.duration ?? "6 hours", price: extra.price ?? "—", adult_price: extra.adultPrice ?? "—", child_price: extra.childPrice ?? "—",
    adults: String(l.adults), children: String(l.children), total: extra.total ?? "—", code: extra.code ?? "—",
    date: l.preferredDate ? fmtDate(l.preferredDate) : "your date", time: extra.time ?? "3:30 PM", location: l.pickupLocation || "your hotel",
    driver: extra.driver ?? "your driver", vehicle: extra.vehicle ?? "4x4", plate: extra.plate ?? "—", driver_phone: extra.driverPhone ?? "—",
    balance: extra.balance ?? "—",
  }[k as string] ?? `{${k}}`));

export default function CRM() {
  const { db, user, route, setRoute, mutate, toast, saveBooking, audit, settings } = useStore();
  const tid = user?.tenantId!;
  const leads = useTenant(db.leads);
  const messages = useTenant(db.messages);
  const templates = db.templates;
  const packages = useTenant(db.packages);
  const customers = useTenant(db.customers);
  const agents = db.users.filter((u) => u.tenantId === tid && ["sales", "admin"].includes(u.role));
  const [view, setView] = useState("list");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<LeadStatus | "all">("all");
  const [sel, setSel] = useState<ID | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [tpl, setTpl] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (route.params?.new) { setNewOpen(true); setRoute({ page: "crm" }); } }, [route.params]);
  useEffect(() => { if (route.params?.open) { setSel(route.params.open); setRoute({ page: "crm" }); } }, [route.params]);

  const api = settings?.whatsappApi;
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return leads
      .filter((l) => filter === "all" || l.status === filter)
      .filter((l) => !s || [l.name, l.phone, l.email, l.pickupLocation].some((x) => x?.toLowerCase().includes(s)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [leads, q, filter]);

  const lead = sel ? leads.find((l) => l.id === sel) ?? null : null;
  const thread = useMemo(() => messages.filter((m) => m.leadId === sel).sort((a, b) => a.at.localeCompare(b.at)), [messages, sel]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [thread.length, sel]);

  const pkg = lead ? packages.find((p) => p.id === lead.packageId) : null;
  const calc = lead && pkg ? calcTotal(pkg, lead.adults, lead.children, [], 0, settings?.taxPct ?? 5) : null;

  const patchLead = (id: ID, patch: Partial<Lead>) => mutate((d) => { const l = d.leads.find((x) => x.id === id); if (l) Object.assign(l, patch); });

  const send = (text: string, dir: "out" | "note") => {
    if (!lead || !text.trim()) return;
    mutate((d) => {
      d.messages.push({ id: uid(), tenantId: tid, leadId: lead.id, dir, text: text.trim(), at: nowISO(), by: user!.name, status: dir === "out" ? (api?.configured ? "sent" : "queued") : undefined } as Message);
      const l = d.leads.find((x) => x.id === lead.id);
      if (l && l.status === "new" && dir === "out") l.status = "contacted";
    });
    setDraft("");
    if (dir === "out" && !api?.configured) toast("Message queued — will send once WhatsApp Cloud API is connected (Settings → WhatsApp).", "info");
  };

  const convertCustomer = () => {
    if (!lead) return;
    if (lead.customerId) { toast("Lead is already linked to a customer.", "info"); return; }
    const cid = uid();
    mutate((d) => {
      d.customers.unshift({ id: cid, tenantId: tid, name: lead.name, phone: lead.phone, whatsapp: lead.whatsapp, email: lead.email, country: "—", notes: `Converted from lead (${lead.source}).`, createdAt: nowISO(), fromLeadId: lead.id });
      const l = d.leads.find((x) => x.id === lead.id); if (l) l.customerId = cid;
    });
    audit("customer.created", "Customer", cid, `${lead.name} converted from lead`);
    toast(`${lead.name} added to customers ✓`);
  };

  const convertBooking = () => {
    if (!lead || !pkg) { toast("Pick a package on the lead first.", "error"); return; }
    let cid = lead.customerId;
    if (!cid) {
      cid = uid();
      mutate((d) => {
        d.customers.unshift({ id: cid!, tenantId: tid, name: lead.name, phone: lead.phone, whatsapp: lead.whatsapp, email: lead.email, country: "—", notes: "Converted from lead.", createdAt: nowISO(), fromLeadId: lead.id });
        const l = d.leads.find((x) => x.id === lead.id); if (l) l.customerId = cid;
      });
    }
    const code = `${settings?.bookingPrefix ?? "DS"}-${new Date().getFullYear()}-${String(db.seq + 1).padStart(6, "0")}`;
    const booking = {
      id: uid(), tenantId: tid, code, customerId: cid, packageId: pkg.id,
      date: lead.preferredDate || todayISO(), adults: lead.adults, children: lead.children,
      pickupLocation: lead.pickupLocation || "TBC", pickupAddress: "", pickupTime: "15:30",
      dropoffLocation: "Same as pickup", specialReq: "", vehicleId: null, driverId: null,
      addons: [], discount: 0, taxPct: settings?.taxPct ?? 5, total: calc!.total,
      source: `WhatsApp lead (${lead.source})`, notes: `From lead: ${lead.notes}`, status: "pending" as const,
      createdAt: nowISO(), createdBy: user!.id,
    };
    const err = saveBooking(booking, true);
    if (err) { toast(err, "error"); return; }
    mutate((d) => {
      d.seq += 1;
      const l = d.leads.find((x) => x.id === lead.id);
      if (l) { l.bookingId = booking.id; l.status = "confirmed"; }
    });
    toast(`Booking ${code} created from lead ✓`);
    setRoute({ page: "bookings", params: { open: booking.id } });
  };

  const createQuote = () => {
    if (!lead || !pkg) { toast("Pick a package first.", "error"); return; }
    const qcode = `QT-${new Date().getFullYear()}-${String(4200 + db.quotations.length)}`;
    mutate((d) => {
      d.quotations.unshift({ id: uid(), tenantId: tid, code: qcode, partyName: lead.name, customerId: lead.customerId ?? null, leadId: lead.id, packageId: pkg.id, date: lead.preferredDate || todayISO(), adults: lead.adults, children: lead.children, pickupLocation: lead.pickupLocation, discount: 0, taxPct: settings?.taxPct ?? 5, total: calc!.total, status: "draft", validUntil: addDaysISO(7), notes: "", createdAt: nowISO() });
      const l = d.leads.find((x) => x.id === lead.id); if (l && ["new", "contacted"].includes(l.status)) l.status = "quoted";
    });
    audit("quote.created", "Quotation", lead.id, `${qcode} for ${lead.name}`);
    toast(`Quotation ${qcode} drafted ✓`);
    setRoute({ page: "quotations" });
  };

  const extraVars: Record<string, string> = {
    company: settings?.name ?? "our team", package: pkg?.name ?? "desert safari", duration: pkg?.duration ?? "6 hours",
    price: money(pkg?.adultPrice ?? 0, settings?.currency), adultPrice: money(pkg?.adultPrice ?? 0, settings?.currency),
    childPrice: money(pkg?.childPrice ?? 0, settings?.currency), total: money(calc?.total ?? 0, settings?.currency),
  };

  return (
    <div className="space-y-4">
      {/* API banner */}
      <div className={cx("card p-3 flex items-center gap-3 flex-wrap text-sm", api?.configured ? "border-moss-200 bg-moss-100/40" : "border-gold-300 bg-gold-200/25")}>
        <MessageCircle size={17} className={api?.configured ? "text-moss-600" : "text-gold-600"} />
        <p className="font-bold text-ink-800 grow">
          {api?.configured ? "WhatsApp Business Cloud API connected — outgoing messages are live." : "WhatsApp Cloud API pending configuration."}
          {!api?.configured && <span className="block text-xs font-semibold text-ink-500">Messages are queued locally and stored per lead. Connect credentials in Settings → WhatsApp Integration to go live — no unofficial automation is used.</span>}
        </p>
        {!api?.configured && <button className="btn btn-outline btn-sm" onClick={() => setRoute({ page: "settings", params: { tab: "whatsapp" } })}>Configure</button>}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Tabs tabs={[{ id: "list", label: "Conversations" }, { id: "board", label: "Pipeline Board", badge: leads.filter((l) => !["completed", "lost"].includes(l.status)).length }]} val={view} onChange={setView} />
        <div className="grow" />
        <button className="btn btn-primary" onClick={() => setNewOpen(true)}><Plus size={15} />New Lead</button>
      </div>

      {view === "board" ? (
        <div className="overflow-x-auto pb-2 -mx-4 sm:mx-0 px-4 sm:px-0">
          <div className="flex gap-3 min-w-[1180px]">
            {PIPE.map((st) => {
              const items = leads.filter((l) => l.status === st);
              return (
                <div key={st} className="w-[218px] shrink-0 rounded-xl bg-sand-200/50 border border-sand-300/60 p-2"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { const id = e.dataTransfer.getData("lead"); if (id) { patchLead(id, { status: st }); toast(`Lead moved to ${LEAD_STATUS[st].label}`, "info"); } }}>
                  <div className="flex items-center justify-between px-1.5 py-1 mb-1.5">
                    <StatusPill {...LEAD_STATUS[st]} />
                    <span className="text-[11px] font-extrabold text-ink-400">{items.length}</span>
                  </div>
                  <div className="space-y-1.5 min-h-[60px]">
                    {items.map((l) => (
                      <button key={l.id} draggable onDragStart={(e) => e.dataTransfer.setData("lead", l.id)}
                        onClick={() => { setSel(l.id); setView("list"); }}
                        className="w-full text-left card p-2.5 hover:shadow-float hover:-translate-y-0.5 transition-all cursor-grab active:cursor-grabbing anim-rise">
                        <p className="text-[13px] font-extrabold text-ink-900 truncate">{l.name}</p>
                        <p className="text-[11px] font-semibold text-ink-500 mt-0.5">{l.adults + l.children} guests · {packages.find((p) => p.id === l.packageId)?.name?.split(" ")[0] ?? "Any"}</p>
                        <p className="text-[10px] font-bold text-ink-400 mt-1">{daysFromNow(l.followUpDate) <= 0 && !["completed", "lost", "paid"].includes(l.status) ? <span className="text-clay-600">Follow-up {daysFromNow(l.followUpDate) === 0 ? "today" : "overdue"}</span> : `Follow-up ${fmtDateShort(l.followUpDate)}`}</p>
                      </button>
                    ))}
                    {items.length === 0 && <p className="text-[11px] font-semibold text-ink-300 text-center py-4">Drop leads here</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[300px_1fr_290px] gap-4 items-start">
          {/* Lead list */}
          <div className="card overflow-hidden">
            <div className="p-3 border-b border-sand-200 space-y-2">
              <SearchBox value={q} onChange={setQ} placeholder="Search leads…" />
              <div className="flex gap-1 flex-wrap">
                {(["all", "new", "contacted", "quoted", "follow_up"] as const).map((f) => (
                  <button key={f} onClick={() => setFilter(f)} className={cx("chip cursor-pointer transition-colors", filter === f ? "bg-ink-900 text-sand-50" : "bg-sand-100 text-ink-500 hover:bg-sand-200")}>
                    {f === "all" ? "All" : LEAD_STATUS[f].label}
                  </button>
                ))}
              </div>
            </div>
            <div className="max-h-[560px] overflow-y-auto">
              {filtered.map((l) => {
                const last = messages.filter((m) => m.leadId === l.id).slice(-1)[0];
                return (
                  <button key={l.id} onClick={() => setSel(l.id)} className={cx("w-full text-left px-3.5 py-3 border-b border-sand-100 hover:bg-sand-50 transition-colors cursor-pointer", sel === l.id && "bg-gold-200/25 border-l-2 border-l-gold-500")}>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={l.name} size={34} color={LEAD_STATUS[l.status].dot.startsWith("bg-moss") ? "#4c7c59" : LEAD_STATUS[l.status].dot.startsWith("bg-clay") ? "#b4543a" : "#a87520"} />
                      <span className="min-w-0 grow">
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-extrabold text-ink-900 truncate">{l.name}</span>
                          <span className="text-[10px] font-bold text-ink-400 shrink-0">{last ? timeAgo(last.at) : ""}</span>
                        </span>
                        <span className="block text-[11px] font-semibold text-ink-500 truncate">{last ? (last.dir === "note" ? "📝 " + last.text : last.text) : l.whatsapp}</span>
                        <span className="mt-1 inline-block"><StatusPill {...LEAD_STATUS[l.status]} /></span>
                      </span>
                    </div>
                  </button>
                );
              })}
              {filtered.length === 0 && <EmptyState compact title="No leads here" body="New WhatsApp inquiries will appear in this inbox." />}
            </div>
          </div>

          {/* Conversation */}
          <div className="card overflow-hidden flex flex-col h-[620px]">
            {!lead ? (
              <EmptyState title="Select a conversation" body="Pick a lead on the left to open the WhatsApp thread, send templates and convert to a booking." />
            ) : (
              <>
                <div className="px-4 py-3 border-b border-sand-200 bg-[#fffdf6] flex items-center gap-3">
                  <Avatar name={lead.name} size={38} />
                  <div className="min-w-0 grow">
                    <p className="font-extrabold text-ink-900 text-[15px] truncate">{lead.name}</p>
                    <p className="text-[11px] font-semibold text-ink-500">{lead.whatsapp} · {lead.source} · prefers {pkg?.name ?? "any safari"} on {lead.preferredDate ? fmtDateShort(lead.preferredDate) : "—"}</p>
                  </div>
                  <a className="btn btn-outline btn-sm" href={`tel:${lead.phone.replace(/\s/g, "")}`}><Phone size={13} />Call</a>
                </div>
                <div ref={scrollRef} className="grow overflow-y-auto p-4 space-y-2.5" style={{ background: "linear-gradient(180deg,#efe7d2,#e9dec4)" }}>
                  {thread.length === 0 && <p className="text-center text-xs font-bold text-ink-400 py-6">No messages yet — say salam and start the conversation.</p>}
                  {thread.map((m) => m.dir === "note" ? (
                    <div key={m.id} className="flex justify-center anim-rise">
                      <div className="max-w-[85%] rounded-xl bg-gold-200/70 border border-gold-300 px-3 py-2 text-xs font-semibold text-ink-700">
                        <span className="flex items-center gap-1 font-extrabold text-gold-700 text-[10px] uppercase tracking-wide mb-0.5"><StickyNote size={11} />Internal note · {m.by}</span>
                        {m.text}
                      </div>
                    </div>
                  ) : (
                    <div key={m.id} className={cx("flex", m.dir === "out" ? "justify-end" : "justify-start")}>
                      <div className={cx("max-w-[80%] rounded-2xl px-3.5 py-2 shadow-sm anim-pop", m.dir === "out" ? "bg-[#d9f2e0] rounded-br-md" : "bg-white rounded-bl-md")}>
                        <p className="text-[13px] font-semibold text-ink-800 whitespace-pre-wrap leading-relaxed">{m.text}</p>
                        <p className="text-[10px] font-bold text-ink-400 text-right mt-1 flex items-center justify-end gap-1">
                          {fmtTime(m.at)}{m.dir === "out" && <CheckCheck size={12} className={m.status === "read" ? "text-oasis-500" : "text-ink-300"} />}
                        </p>
                      </div>
                    </div>
                  ))}
                  {!api?.configured && thread.some((m) => m.dir === "out" && m.status === "queued") && (
                    <p className="text-center text-[10px] font-bold text-ink-400">Some outgoing messages are queued — WhatsApp API pending in Settings.</p>
                  )}
                </div>
                {/* Composer */}
                <div className="border-t border-sand-200 bg-[#fffdf6] p-3 space-y-2">
                  <div className="flex gap-1.5 flex-wrap items-center">
                    <select className="input w-auto text-xs py-1.5" value={tpl} onChange={(e) => { const t = templates.find((x) => x.id === e.target.value); if (t) { setDraft(fillTemplate(t.body, lead, extraVars)); setTpl(""); } }}>
                      <option value="">📋 Insert template…</option>
                      {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <button className="btn btn-ghost btn-sm" onClick={() => send(draft, "note")} disabled={!draft.trim()}><StickyNote size={13} />Note</button>
                  </div>
                  <div className="flex gap-2">
                    <input className="input" placeholder="Type a WhatsApp message…" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send(draft, "out")} />
                    <button className="btn btn-dark" onClick={() => send(draft, "out")} disabled={!draft.trim()}><Send size={15} /></button>
                  </div>
                  <div className="flex gap-2 flex-wrap pt-1 border-t border-sand-100">
                    <button className="btn btn-outline btn-sm" onClick={convertCustomer}><UserPlus size={13} />To customer</button>
                    <button className="btn btn-outline btn-sm" onClick={createQuote}><FileText size={13} />Quotation</button>
                    <button className="btn btn-success btn-sm" onClick={convertBooking}><Ticket size={13} />Convert to booking</button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Lead info */}
          <div className="space-y-4">
            {!lead ? (
              <div className="card p-4">
                <p className="text-sm font-bold text-ink-700 flex items-center gap-2"><ListFilter size={15} className="text-gold-600" />Lead details</p>
                <p className="text-xs text-ink-500 font-semibold mt-1">Select a lead to edit status, follow-up and details.</p>
              </div>
            ) : (
              <>
                <div className="card p-4 space-y-3">
                  <h4 className="font-display font-bold text-ink-900">Lead details</h4>
                  <Field label="Pipeline status">
                    <select className="input" value={lead.status} onChange={(e) => { patchLead(lead.id, { status: e.target.value as LeadStatus }); toast(`Moved to ${LEAD_STATUS[e.target.value as LeadStatus].label}`, "info"); }}>
                      {PIPE.map((s) => <option key={s} value={s}>{LEAD_STATUS[s].label}</option>)}
                    </select>
                  </Field>
                  <Field label="Follow-up date"><input type="date" className="input" value={lead.followUpDate} onChange={(e) => patchLead(lead.id, { followUpDate: e.target.value })} /></Field>
                  <Field label="Assigned agent">
                    <select className="input" value={lead.agentId ?? ""} onChange={(e) => patchLead(lead.id, { agentId: e.target.value || null })}>
                      <option value="">Unassigned</option>
                      {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Adults"><input type="number" min={0} className="input" value={lead.adults} onChange={(e) => patchLead(lead.id, { adults: Math.max(0, Number(e.target.value)) })} /></Field>
                    <Field label="Children"><input type="number" min={0} className="input" value={lead.children} onChange={(e) => patchLead(lead.id, { children: Math.max(0, Number(e.target.value)) })} /></Field>
                  </div>
                  <Field label="Preferred date"><input type="date" className="input" value={lead.preferredDate} onChange={(e) => patchLead(lead.id, { preferredDate: e.target.value })} /></Field>
                  <Field label="Preferred safari">
                    <select className="input" value={lead.packageId ?? ""} onChange={(e) => patchLead(lead.id, { packageId: e.target.value || null })}>
                      <option value="">Any / undecided</option>
                      {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Pickup location"><input className="input" value={lead.pickupLocation} onChange={(e) => patchLead(lead.id, { pickupLocation: e.target.value })} /></Field>
                  <Field label="Source">
                    <select className="input" value={lead.source} onChange={(e) => patchLead(lead.id, { source: e.target.value as LeadSource })}>
                      {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                    </select>
                  </Field>
                  <Field label="Notes"><textarea className="input min-h-[70px]" value={lead.notes} onChange={(e) => patchLead(lead.id, { notes: e.target.value })} /></Field>
                  {calc && pkg && (
                    <div className="rounded-xl bg-sand-100 p-3 text-sm">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-ink-400 mb-1">Quick quote</p>
                      <p className="font-extrabold text-ink-900">{lead.adults}A × {money(pkg.adultPrice, settings?.currency)} + {lead.children}C × {money(pkg.childPrice, settings?.currency)}</p>
                      <p className="font-display text-xl font-black text-gold-700 mt-0.5">{money(calc.total, settings?.currency)} <span className="text-xs font-body font-bold text-ink-400">incl. VAT</span></p>
                    </div>
                  )}
                  {lead.customerId && <p className="text-xs font-bold text-moss-600 flex items-center gap-1.5"><Users size={13} />Linked customer: {customers.find((c) => c.id === lead.customerId)?.name}</p>}
                  {lead.bookingId && <button className="text-xs font-bold text-gold-700 hover:text-gold-600 cursor-pointer flex items-center gap-1.5" onClick={() => setRoute({ page: "bookings", params: { open: lead.bookingId! } })}><Ticket size={13} />Open linked booking →</button>}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {newOpen && <LeadForm onClose={() => setNewOpen(false)} packages={packages} agents={agents} onCreate={(l) => {
        mutate((d) => { d.leads.unshift(l); d.notifs.unshift({ id: uid(), tenantId: tid, kind: "lead", title: `New lead — ${l.name}`, body: `${l.adults + l.children} guests · ${l.source} · prefers ${fmtDateShort(l.preferredDate)}`, at: nowISO(), read: false, link: { page: "crm", id: l.id } }); });
        audit("lead.created", "Lead", l.id, `New lead: ${l.name}`);
        toast(`Lead ${l.name} added ✓`); setNewOpen(false); setSel(l.id);
      }} />}
    </div>
  );
}

function LeadForm({ onClose, onCreate, packages, agents }: {
  onClose: () => void; onCreate: (l: Lead) => void;
  packages: import("../lib/types").SafariPackage[]; agents: import("../lib/types").User[];
}) {
  const { user } = useStore();
  const [f, setF] = useState({ name: "", phone: "", whatsapp: "", email: "", adults: 2, children: 0, preferredDate: todayISO(), packageId: "", pickupLocation: "", source: "whatsapp" as LeadSource, agentId: user?.id ?? "", notes: "", followUpDate: todayISO() });
  const { toast } = useStore();
  const submit = () => {
    if (!f.name.trim() || !f.phone.trim()) { toast("Name and phone are required.", "error"); return; }
    onCreate({ id: uid(), tenantId: user!.tenantId!, ...f, packageId: f.packageId || null, agentId: f.agentId || null, status: "new", createdAt: nowISO() });
  };
  return (
    <Modal open onClose={onClose} title="New lead" sub="Capture an inquiry before it goes cold" size="lg"
      footer={<><button className="btn btn-outline" onClick={onClose}>Discard</button><button className="btn btn-primary" onClick={submit}><Plus size={14} />Add lead</button></>}>
      <div className="grid sm:grid-cols-2 gap-3.5">
        <Field label="Name" req><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Guest full name" /></Field>
        <Field label="Phone / WhatsApp" req><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value, whatsapp: f.whatsapp || e.target.value })} placeholder="+971 …" /></Field>
        <Field label="Email"><input className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Pickup location"><input className="input" value={f.pickupLocation} onChange={(e) => setF({ ...f, pickupLocation: e.target.value })} placeholder="Hotel / area" /></Field>
        <Field label="Adults"><input type="number" min={0} className="input" value={f.adults} onChange={(e) => setF({ ...f, adults: Math.max(0, Number(e.target.value)) })} /></Field>
        <Field label="Children"><input type="number" min={0} className="input" value={f.children} onChange={(e) => setF({ ...f, children: Math.max(0, Number(e.target.value)) })} /></Field>
        <Field label="Preferred date"><input type="date" className="input" value={f.preferredDate} onChange={(e) => setF({ ...f, preferredDate: e.target.value })} /></Field>
        <Field label="Preferred safari">
          <select className="input" value={f.packageId} onChange={(e) => setF({ ...f, packageId: e.target.value })}>
            <option value="">Undecided</option>
            {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Source">
          <select className="input" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value as LeadSource })}>
            {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
        </Field>
        <Field label="Assigned agent">
          <select className="input" value={f.agentId} onChange={(e) => setF({ ...f, agentId: e.target.value })}>
            <option value="">Unassigned</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <Field label="Follow-up date"><input type="date" className="input" value={f.followUpDate} onChange={(e) => setF({ ...f, followUpDate: e.target.value })} /></Field>
        <Field label="Notes"><input className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
