import { useEffect, useMemo, useState } from "react";
import { Globe, Mail, MessageCircle, Pencil, Phone, Plus, Star, Ticket } from "lucide-react";
import { useStore, useTenant } from "../lib/store";
import type { Customer, ID } from "../lib/types";
import { BOOKING_STATUS, PAY_STATUS, cx, fmtDate, fmtDateShort, money, nowISO, timeAgo, uid } from "../lib/utils";
import { guestsOf, payStatusOf } from "../lib/data";
import { Avatar, Drawer, EmptyState, Field, Modal, Pager, SearchBox, StatusPill } from "../components/ui";

const blank = (tenantId: ID): Customer => ({ id: uid(), tenantId, name: "", phone: "", whatsapp: "", email: "", country: "", notes: "", createdAt: nowISO() });

export default function Customers() {
  const { db, user, route, setRoute, mutate, toast, audit } = useStore();
  const customers = useTenant(db.customers);
  const bookings = useTenant(db.bookings);
  const payments = useTenant(db.payments);
  const leads = useTenant(db.leads);
  const reviews = useTenant(db.reviews);
  const messages = useTenant(db.messages);
  const packages = useTenant(db.packages);
  const settings = db.settings.find((s) => s.tenantId === user?.tenantId);
  const cur = settings?.currency ?? "AED";

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState<ID | null>(null);
  const [form, setForm] = useState<{ open: boolean; c: Customer | null }>({ open: false, c: null });

  useEffect(() => { if (route.params?.new) { setForm({ open: true, c: blank(user!.tenantId!) }); setRoute({ page: "customers" }); } }, [route.params]);
  useEffect(() => { if (route.params?.open) { setSel(route.params.open); setRoute({ page: "customers" }); } }, [route.params]);

  const enriched = useMemo(() => customers.map((c) => {
    const cb = bookings.filter((b) => b.customerId === c.id && b.status !== "cancelled");
    const spend = payments.filter((p) => cb.some((b) => b.id === p.bookingId) && p.status === "captured").reduce((s, p) => s + p.amount, 0);
    const upcoming = cb.filter((b) => b.date >= new Date().toISOString().slice(0, 10) && !["completed"].includes(b.status)).sort((a, b) => a.date.localeCompare(b.date))[0];
    const last = [...cb].sort((a, b) => b.date.localeCompare(a.date))[0];
    return { c, count: cb.length, spend, upcoming, last };
  }).sort((a, b) => b.spend - a.spend), [customers, bookings, payments]);

  const filtered = enriched.filter(({ c }) => {
    const s = q.trim().toLowerCase();
    return !s || [c.name, c.phone, c.email, c.country].some((x) => x?.toLowerCase().includes(s));
  });
  const pages = Math.max(1, Math.ceil(filtered.length / 8));
  const rows = filtered.slice((page - 1) * 8, page * 8);

  const selC = sel ? customers.find((c) => c.id === sel) : null;
  const selData = selC ? enriched.find((e) => e.c.id === selC.id) : null;

  const save = (c: Customer) => {
    if (!c.name.trim() || !c.phone.trim()) { toast("Name and phone are required.", "error"); return; }
    const isNew = !customers.some((x) => x.id === c.id);
    mutate((d) => {
      const i = d.customers.findIndex((x) => x.id === c.id);
      if (i >= 0) d.customers[i] = c; else d.customers.unshift(c);
    });
    audit(isNew ? "customer.created" : "customer.updated", "Customer", c.id, c.name);
    toast(isNew ? `${c.name} added ✓` : "Customer updated ✓");
    setForm({ open: false, c: null });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="w-full sm:w-80"><SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search name, phone, email, country…" /></div>
        <span className="text-xs font-bold text-ink-500">{filtered.length} customers</span>
        <div className="grow" />
        <button className="btn btn-primary" onClick={() => setForm({ open: true, c: blank(user!.tenantId!) })}><Plus size={15} />Add Customer</button>
      </div>

      <div className="card overflow-hidden anim-rise">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead className="bg-sand-100/70"><tr>
              <th className="th">Customer</th><th className="th">Contact</th><th className="th">Country</th><th className="th">Bookings</th><th className="th">Total spent</th><th className="th">Last booking</th><th className="th">Upcoming</th>
            </tr></thead>
            <tbody>
              {rows.map(({ c, count, spend, last, upcoming }) => (
                <tr key={c.id} onClick={() => setSel(c.id)} className="border-t border-sand-100 hover:bg-sand-50 cursor-pointer transition-colors">
                  <td className="td"><span className="flex items-center gap-2.5"><Avatar name={c.name} size={32} /><span className="font-extrabold text-ink-900">{c.name}</span></span></td>
                  <td className="td text-[13px]">{c.phone}<span className="block text-[11px] text-ink-400 font-semibold">{c.email || "—"}</span></td>
                  <td className="td font-semibold">{c.country || "—"}</td>
                  <td className="td font-extrabold">{count}</td>
                  <td className="td font-extrabold text-gold-700">{money(spend, cur)}</td>
                  <td className="td font-semibold">{last ? fmtDateShort(last.date) : "—"}</td>
                  <td className="td">{upcoming ? <span className="chip bg-oasis-100 text-oasis-700"><span className="w-1.5 h-1.5 rounded-full bg-oasis-500" />{fmtDateShort(upcoming.date)}</span> : <span className="text-ink-300 font-semibold">—</span>}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7}><EmptyState title="No customers found" body="Convert leads or add guests manually." action={<button className="btn btn-dark btn-sm" onClick={() => setForm({ open: true, c: blank(user!.tenantId!) })}><Plus size={14} />Add customer</button>} /></td></tr>}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-sand-200 flex items-center justify-between">
          <span className="text-xs font-bold text-ink-500">Showing {rows.length} of {filtered.length}</span>
          <Pager page={page} pages={pages} onPage={setPage} />
        </div>
      </div>

      {/* Profile drawer */}
      <Drawer open={!!selC} onClose={() => setSel(null)} wide title={selC?.name ?? ""} sub={selC ? `Customer since ${fmtDate(selC.createdAt)}` : ""}>
        {selC && selData && (() => {
          const cb = bookings.filter((b) => b.customerId === selC.id);
          const cp = payments.filter((p) => cb.some((b) => b.id === p.bookingId));
          const cl = leads.filter((l) => l.customerId === selC.id || l.email === selC.email || l.phone === selC.phone);
          const cr = reviews.filter((r) => r.customerId === selC.id);
          const convos = messages.filter((m) => cl.some((l) => l.id === m.leadId));
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MiniCard k="Bookings" v={String(selData.count)} />
                <MiniCard k="Total spent" v={money(selData.spend, cur)} />
                <MiniCard k="Last safari" v={selData.last ? fmtDateShort(selData.last.date) : "—"} />
                <MiniCard k="Next safari" v={selData.upcoming ? fmtDateShort(selData.upcoming.date) : "—"} />
              </div>

              <div className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-display font-bold text-ink-900">Contact</h4>
                  <button className="btn btn-outline btn-sm" onClick={() => setForm({ open: true, c: { ...selC } })}><Pencil size={13} />Edit</button>
                </div>
                <div className="grid sm:grid-cols-2 gap-2 text-sm font-semibold text-ink-700">
                  <p className="flex items-center gap-2"><Phone size={14} className="text-gold-600" />{selC.phone}</p>
                  <p className="flex items-center gap-2"><MessageCircle size={14} className="text-moss-600" />{selC.whatsapp || selC.phone}</p>
                  <p className="flex items-center gap-2"><Mail size={14} className="text-oasis-600" />{selC.email || "—"}</p>
                  <p className="flex items-center gap-2"><Globe size={14} className="text-night-500" />{selC.country || "—"}</p>
                </div>
                <div className="flex gap-2 mt-3">
                  <a className="btn btn-outline btn-sm" href={`tel:${selC.phone.replace(/\s/g, "")}`}><Phone size={13} />Call</a>
                  <a className="btn btn-success btn-sm" target="_blank" rel="noreferrer" href={`https://wa.me/${(selC.whatsapp || selC.phone).replace(/[^\d]/g, "")}`}><MessageCircle size={13} />WhatsApp</a>
                </div>
                {selC.notes && <p className="mt-3 text-sm text-ink-600 font-semibold bg-sand-100 rounded-lg p-2.5">📝 {selC.notes}</p>}
              </div>

              {cr.length > 0 && (
                <div className="card p-4">
                  <h4 className="font-display font-bold text-ink-900 mb-2">Reviews</h4>
                  {cr.map((r) => (
                    <div key={r.id} className="border-b border-sand-100 last:border-0 pb-2 mb-2 last:mb-0">
                      <span className="flex items-center gap-1 text-gold-600">{Array.from({ length: r.rating }).map((_, i) => <Star key={i} size={13} fill="currentColor" />)}</span>
                      <p className="text-sm font-semibold text-ink-700 mt-1">“{r.text}”</p>
                      <p className="text-[11px] font-bold text-ink-400 mt-0.5">{fmtDate(r.date)}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="card p-4">
                <h4 className="font-display font-bold text-ink-900 mb-2">Booking history</h4>
                {cb.length === 0 && <p className="text-sm text-ink-400 font-semibold">No bookings yet.</p>}
                <div className="space-y-1.5">
                  {cb.map((b) => (
                    <button key={b.id} className="w-full flex items-center justify-between gap-2 p-2.5 rounded-lg border border-sand-200 hover:border-gold-400 hover:bg-sand-50 transition-all cursor-pointer text-left" onClick={() => setRoute({ page: "bookings", params: { open: b.id } })}>
                      <span>
                        <span className="font-mono text-[12px] font-bold text-gold-700">{b.code}</span>
                        <span className="block text-[13px] font-extrabold text-ink-900">{packages.find((p) => p.id === b.packageId)?.name} · {guestsOf(b)} guests</span>
                        <span className="block text-[11px] font-semibold text-ink-400">{fmtDate(b.date)} · {b.pickupLocation}</span>
                      </span>
                      <span className="text-right shrink-0">
                        <span className="block font-extrabold text-sm">{money(b.total, cur)}</span>
                        <StatusPill {...BOOKING_STATUS[b.status]} />
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="card p-4">
                  <h4 className="font-display font-bold text-ink-900 mb-2">Payments</h4>
                  {cp.length === 0 ? <p className="text-sm text-ink-400 font-semibold">No payments recorded.</p> : (
                    <div className="space-y-1.5 text-sm">
                      {cp.map((p) => (
                        <div key={p.id} className="flex justify-between border-b border-sand-100 last:border-0 pb-1.5">
                          <span className="font-bold text-ink-700">{p.invoiceNo}<span className={cx("block text-[10px] font-extrabold uppercase", p.status === "refunded" ? "text-night-500" : "text-moss-600")}>{p.status}</span></span>
                          <span className="font-extrabold">{money(p.amount, cur)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="card p-4">
                  <h4 className="font-display font-bold text-ink-900 mb-2">Inquiries & WhatsApp</h4>
                  {cl.length === 0 && convos.length === 0 && <p className="text-sm text-ink-400 font-semibold">No inquiries on file.</p>}
                  {cl.map((l) => (
                    <button key={l.id} onClick={() => setRoute({ page: "crm", params: { open: l.id } })} className="w-full text-left p-2 rounded-lg hover:bg-sand-100 cursor-pointer">
                      <span className="text-[13px] font-extrabold text-ink-900 flex items-center gap-1.5"><Ticket size={12} className="text-gold-600" />{l.name} · {l.adults + l.children} guests</span>
                      <span className="text-[11px] font-semibold text-ink-400">{convos.filter((m) => m.leadId === l.id).length} messages · {timeAgo(l.createdAt)}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}
      </Drawer>

      {form.c && (
        <Modal open onClose={() => setForm({ open: false, c: null })} title={customers.some((x) => x.id === form.c!.id) ? "Edit customer" : "Add customer"} size="lg"
          footer={<><button className="btn btn-outline" onClick={() => setForm({ open: false, c: null })}>Cancel</button><button className="btn btn-primary" onClick={() => save(form.c!)}>Save customer</button></>}>
          <div className="grid sm:grid-cols-2 gap-3.5">
            <Field label="Full name" req><input className="input" value={form.c.name} onChange={(e) => setForm({ ...form, c: { ...form.c!, name: e.target.value } })} /></Field>
            <Field label="Phone" req><input className="input" value={form.c.phone} onChange={(e) => setForm({ ...form, c: { ...form.c!, phone: e.target.value } })} /></Field>
            <Field label="WhatsApp"><input className="input" value={form.c.whatsapp} onChange={(e) => setForm({ ...form, c: { ...form.c!, whatsapp: e.target.value } })} /></Field>
            <Field label="Email"><input className="input" value={form.c.email} onChange={(e) => setForm({ ...form, c: { ...form.c!, email: e.target.value } })} /></Field>
            <Field label="Country"><input className="input" value={form.c.country} onChange={(e) => setForm({ ...form, c: { ...form.c!, country: e.target.value } })} /></Field>
            <Field label="Notes" className="sm:col-span-2"><textarea className="input min-h-[70px]" value={form.c.notes} onChange={(e) => setForm({ ...form, c: { ...form.c!, notes: e.target.value } })} /></Field>
          </div>
        </Modal>
      )}
    </div>
  );
}

const MiniCard = ({ k, v }: { k: string; v: string }) => (
  <div className="card p-3 text-center">
    <p className="text-[10px] font-extrabold uppercase tracking-wider text-ink-400">{k}</p>
    <p className="font-display font-bold text-lg text-ink-900 mt-0.5">{v}</p>
  </div>
);
void PAY_STATUS;
