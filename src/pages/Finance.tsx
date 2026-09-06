import { useEffect, useMemo, useState } from "react";
import { Banknote, CreditCard, Download, FileText, MessageCircle, Pencil, Plus, Printer, Ticket, Wallet } from "lucide-react";
import { useStore, useTenant } from "../lib/store";
import type { ID, PayMethod, Quotation, QuoteStatus } from "../lib/types";
import { calcTotal, payStatusOf } from "../lib/data";
import { METHOD_LABEL, PAY_STATUS, QUOTE_STATUS, addDaysISO, cx, daysFromNow, downloadCSV, fmtDate, fmtDateTime, money, nowISO, todayISO, uid } from "../lib/utils";
import { EmptyState, Field, Modal, Pager, SearchBox, StatusPill, Tabs } from "../components/ui";

export default function Finance({ initialTab = "payments" }: { initialTab?: "payments" | "quotes" }) {
  const { db, user, route, setRoute } = useStore();
  const [tab, setTab] = useState<string>(initialTab);
  useEffect(() => { if (route.params?.tab) { setTab(route.params.tab); setRoute({ page: route.page }); } }, [route.params]);
  return (
    <div className="space-y-4">
      <Tabs tabs={[{ id: "payments", label: "Payments & Invoices" }, { id: "quotes", label: "Quotations" }]} val={tab} onChange={setTab} />
      {tab === "payments" ? <Payments /> : <Quotations />}
    </div>
  );
}

function Payments() {
  const { db, user, route, setRoute, recordPayment, toast } = useStore();
  const tid = user?.tenantId!;
  const bookings = useTenant(db.bookings);
  const payments = useTenant(db.payments);
  const customers = useTenant(db.customers);
  const packages = useTenant(db.packages);
  const settings = db.settings.find((s) => s.tenantId === tid)!;
  const cur = settings.currency;
  const role = user!.role;
  const canFinance = role !== "driver";

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [payFor, setPayFor] = useState<ID | null>(null);
  const [invoiceFor, setInvoiceFor] = useState<ID | null>(null);

  useEffect(() => { if (route.params?.invoice) { setInvoiceFor(route.params.invoice); setRoute({ page: "payments" }); } }, [route.params]);
  useEffect(() => { if (route.params?.new) { const first = bookings.find((b) => b.total - payments.filter((p) => p.bookingId === b.id && p.status === "captured").reduce((s, p) => s + p.amount, 0) > 0 && !["cancelled", "no_show"].includes(b.status)); if (first) setPayFor(first.id); setRoute({ page: "payments" }); } }, [route.params]);

  const rowsData = useMemo(() => bookings
    .filter((b) => !["cancelled"].includes(b.status))
    .map((b) => {
      const paid = payments.filter((p) => p.bookingId === b.id && p.status === "captured").reduce((s, p) => s + p.amount, 0);
      return { b, paid, balance: Math.max(0, b.total - paid), ps: payStatusOf(db, b) };
    })
    .filter((r) => filter === "all" || r.ps === filter)
    .filter((r) => {
      const s = q.trim().toLowerCase();
      const c = customers.find((x) => x.id === r.b.customerId);
      return !s || [r.b.code, c?.name, payments.find((p) => p.bookingId === r.b.id)?.invoiceNo].some((x) => x?.toLowerCase().includes(s));
    })
    .sort((a, b) => b.b.date.localeCompare(a.b.date)), [bookings, payments, customers, filter, q, db]);

  const monthCollected = payments.filter((p) => p.status === "captured" && p.date.slice(0, 7) === todayISO().slice(0, 7)).reduce((s, p) => s + p.amount, 0);
  const outstanding = rowsData.reduce((s, r) => s + r.balance, 0);
  const refunded = payments.filter((p) => p.status === "refunded").reduce((s, p) => s + p.amount, 0);

  const pages = Math.max(1, Math.ceil(rowsData.length / 9));
  const rows = rowsData.slice((page - 1) * 9, page * 9);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MiniStat icon={<Banknote size={16} />} k="Collected this month" v={money(monthCollected, cur)} tone="bg-moss-100 text-moss-600" />
        <MiniStat icon={<Wallet size={16} />} k="Outstanding balances" v={money(outstanding, cur)} tone="bg-clay-100 text-clay-600" />
        <MiniStat icon={<CreditCard size={16} />} k="Refunded" v={money(refunded, cur)} tone="bg-night-100 text-night-600" />
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="w-full sm:w-72"><SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search code, guest, invoice…" /></div>
        <select className="input w-auto" value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }}>
          <option value="all">All payment states</option>
          {Object.entries(PAY_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <div className="grow" />
        <button className="btn btn-outline btn-sm" onClick={() => downloadCSV("payments", ["Booking", "Customer", "Date", "Total", "Paid", "Balance", "Status"], rowsData.map((r) => [r.b.code, customers.find((c) => c.id === r.b.customerId)?.name ?? "", r.b.date, r.b.total, r.paid, r.balance, r.ps]))}><Download size={14} />CSV</button>
      </div>

      <div className="card overflow-hidden anim-rise">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-sand-100/70"><tr>
              <th className="th">Booking</th><th className="th">Customer</th><th className="th">Safari date</th><th className="th">Package</th><th className="th">Total</th><th className="th">Paid</th><th className="th">Balance</th><th className="th">Status</th><th className="th">Actions</th>
            </tr></thead>
            <tbody>
              {rows.map(({ b, paid, balance, ps }) => (
                <tr key={b.id} className="border-t border-sand-100 hover:bg-sand-50 transition-colors">
                  <td className="td font-mono font-bold text-gold-700 text-[13px]">{b.code}</td>
                  <td className="td font-bold text-ink-900">{customers.find((c) => c.id === b.customerId)?.name ?? "—"}</td>
                  <td className="td font-semibold">{fmtDate(b.date)}</td>
                  <td className="td font-semibold text-ink-500">{packages.find((p) => p.id === b.packageId)?.name ?? "—"}</td>
                  <td className="td font-extrabold">{money(b.total, cur)}</td>
                  <td className="td font-bold text-moss-600">{money(paid, cur)}</td>
                  <td className={cx("td font-extrabold", balance > 0 ? "text-clay-600" : "text-ink-300")}>{money(balance, cur)}</td>
                  <td className="td"><StatusPill {...PAY_STATUS[ps]} /></td>
                  <td className="td">
                    <span className="flex gap-1.5">
                      <button className="btn btn-outline btn-sm" onClick={() => setInvoiceFor(b.id)}><Printer size={13} /></button>
                      {canFinance && balance > 0 && !["cancelled", "no_show"].includes(b.status) && <button className="btn btn-success btn-sm" onClick={() => setPayFor(b.id)}>Pay</button>}
                    </span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={9}><EmptyState title="No payment records" /></td></tr>}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-sand-200"><Pager page={page} pages={pages} onPage={setPage} /></div>
      </div>

      {payFor && <QuickPay bookingId={payFor} onClose={() => setPayFor(null)} onDone={(amt, m, ref) => {
        const err = recordPayment(payFor, amt, m, ref, "", false);
        if (err) { toast(err, "error"); return false; }
        toast(`Payment of ${money(amt, cur)} recorded ✓`);
        return true;
      }} />}
      {invoiceFor && <InvoiceDrawer bookingId={invoiceFor} onClose={() => setInvoiceFor(null)} />}
    </div>
  );
}

function QuickPay({ bookingId, onClose, onDone }: { bookingId: ID; onClose: () => void; onDone: (a: number, m: PayMethod, r: string) => boolean }) {
  const { db } = useStore();
  const b = db.bookings.find((x) => x.id === bookingId)!;
  const paid = db.payments.filter((p) => p.bookingId === bookingId && p.status === "captured").reduce((s, p) => s + p.amount, 0);
  const [amount, setAmount] = useState(Math.max(0, b.total - paid));
  const [method, setMethod] = useState<PayMethod>("card");
  const [ref, setRef] = useState("");
  return (
    <Modal open onClose={onClose} title="Record payment" sub={`${b.code} · balance ${money(Math.max(0, b.total - paid))}`}
      footer={<><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-success" onClick={() => { if (onDone(amount, method, ref)) onClose(); }}><CreditCard size={14} />Record</button></>}>
      <div className="grid sm:grid-cols-2 gap-3.5">
        <Field label="Amount"><input type="number" min={0} className="input" value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></Field>
        <Field label="Method"><select className="input" value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>{Object.entries(METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Reference" className="sm:col-span-2"><input className="input" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Transaction ref" /></Field>
      </div>
    </Modal>
  );
}

function InvoiceDrawer({ bookingId, onClose }: { bookingId: ID; onClose: () => void }) {
  const { db, user, mutate, toast, audit } = useStore();
  const b = db.bookings.find((x) => x.id === bookingId)!;
  const c = db.customers.find((x) => x.id === b.customerId);
  const p = db.packages.find((x) => x.id === b.packageId);
  const s = db.settings.find((x) => x.tenantId === user?.tenantId)!;
  const pays = db.payments.filter((x) => x.bookingId === bookingId);
  const inv = pays[0]?.invoiceNo ?? `${s.invoicePrefix}-2026-${String(4200 + db.payments.length)}`;
  const paid = pays.filter((x) => x.status === "captured").reduce((a, x) => a + x.amount, 0);
  const base = (p?.adultPrice ?? 0) * b.adults + (p?.childPrice ?? 0) * b.children;
  const taxable = Math.max(0, base + b.addons.reduce((a, x) => a + x.price, 0) - b.discount);
  const vat = Math.round((b.total - taxable) * 100) / 100;

  return (
    <div className="fixed inset-0 z-50 anim-fade" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-ink-950/60" />
      <div className="absolute inset-0 sm:inset-6 md:inset-10 bg-sand-50 rounded-2xl overflow-hidden flex flex-col anim-pop print-sheet" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 bg-ink-900 text-sand-50 no-print">
          <p className="font-display font-bold">Invoice {inv}</p>
          <div className="flex gap-2">
            <button className="btn btn-primary btn-sm" onClick={() => window.print()}><Printer size={13} />Print / Save PDF</button>
            <a className="btn btn-success btn-sm" target="_blank" rel="noreferrer" href={`https://wa.me/${(c?.whatsapp || c?.phone || "").replace(/[^\d]/g, "")}?text=${encodeURIComponent(`Salam ${c?.name?.split(" ")[0] ?? ""}! Your invoice ${inv} for booking ${b.code} is ready — total ${money(b.total, s.currency)}. ${s.paymentInstructions}`)}`}><MessageCircle size={13} />Send via WhatsApp</a>
            <button className="btn btn-ghost btn-sm text-sand-200" onClick={onClose}>Close</button>
          </div>
        </div>
        <div className="grow overflow-y-auto p-6 sm:p-10 print-hide-scroll">
          <div className="max-w-3xl mx-auto bg-white border border-sand-200 rounded-xl p-8 shadow-lift">
            <div className="flex justify-between items-start gap-4 pb-6 border-b-2 border-ink-900">
              <div>
                <p className="font-display font-black text-2xl text-ink-900">{s.name}</p>
                <p className="text-xs font-semibold text-ink-500 mt-1 leading-relaxed">{s.address}<br />{s.phone} · {s.email}<br />{s.website}</p>
              </div>
              <div className="text-right">
                <p className="font-display font-black text-3xl text-gold-600">INVOICE</p>
                <p className="font-mono font-bold text-sm text-ink-700 mt-1">{inv}</p>
                <p className="text-xs font-semibold text-ink-400">Booking {b.code} · {fmtDate(todayISO())}</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-6 py-5 text-sm">
              <div>
                <p className="label">Billed to</p>
                <p className="font-extrabold text-ink-900">{c?.name}</p>
                <p className="font-semibold text-ink-500">{c?.phone}<br />{c?.email}</p>
              </div>
              <div className="sm:text-right">
                <p className="label">Safari details</p>
                <p className="font-extrabold text-ink-900">{p?.name}</p>
                <p className="font-semibold text-ink-500">{fmtDate(b.date)} · pickup {b.pickupTime}<br />{b.pickupLocation}</p>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="border-y border-sand-200"><th className="th">Item</th><th className="th text-right">Amount</th></tr></thead>
              <tbody>
                <tr><td className="td">{p?.name} — {b.adults} adults × {money(p?.adultPrice ?? 0, s.currency)}</td><td className="td text-right font-bold">{money((p?.adultPrice ?? 0) * b.adults, s.currency)}</td></tr>
                {b.children > 0 && <tr><td className="td">{b.children} children × {money(p?.childPrice ?? 0, s.currency)}</td><td className="td text-right font-bold">{money((p?.childPrice ?? 0) * b.children, s.currency)}</td></tr>}
                {b.addons.map((a, i) => <tr key={i}><td className="td">{a.name}</td><td className="td text-right font-bold">{money(a.price, s.currency)}</td></tr>)}
                {b.discount > 0 && <tr><td className="td">Discount</td><td className="td text-right font-bold text-clay-600">− {money(b.discount, s.currency)}</td></tr>}
                <tr className="border-t border-sand-200"><td className="td font-bold">VAT ({b.taxPct}%)</td><td className="td text-right font-bold">{money(vat, s.currency)}</td></tr>
                <tr className="border-t-2 border-ink-900"><td className="td font-display font-black text-lg">TOTAL</td><td className="td text-right font-display font-black text-xl text-gold-700">{money(b.total, s.currency)}</td></tr>
                <tr><td className="td font-bold text-moss-600">Paid</td><td className="td text-right font-bold text-moss-600">{money(paid, s.currency)}</td></tr>
                <tr><td className="td font-bold text-clay-600">Balance due</td><td className="td text-right font-extrabold text-clay-600">{money(Math.max(0, b.total - paid), s.currency)}</td></tr>
              </tbody>
            </table>
            <div className="mt-6 pt-4 border-t border-sand-200 text-xs font-semibold text-ink-500 space-y-2">
              <p><span className="font-extrabold text-ink-700">Payment instructions:</span> {s.paymentInstructions}</p>
              <p><span className="font-extrabold text-ink-700">Cancellation policy:</span> {s.cancellationPolicy}</p>
              <p className="text-ink-400">TRN 100123456700003 · {s.name} · Generated by DuneSuite</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Quotations() {
  const { db, user, route, setRoute, mutate, toast, audit, saveBooking } = useStore();
  const tid = user?.tenantId!;
  const quotes = useTenant(db.quotations);
  const packages = useTenant(db.packages);
  const customers = useTenant(db.customers);
  const leads = useTenant(db.leads);
  const settings = db.settings.find((s) => s.tenantId === tid)!;
  const cur = settings.currency;

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState<{ open: boolean; qt: Quotation | null }>({ open: false, qt: null });
  const [preview, setPreview] = useState<ID | null>(null);

  useEffect(() => { if (route.params?.new) { setForm({ open: true, qt: null }); setRoute({ page: "quotations" }); } }, [route.params]);
  useEffect(() => { if (route.params?.open) { setPreview(route.params.open); setRoute({ page: "quotations" }); } }, [route.params]);

  const filtered = quotes
    .filter((x) => filter === "all" || x.status === filter)
    .filter((x) => { const s = q.trim().toLowerCase(); return !s || [x.code, x.partyName].some((y) => y.toLowerCase().includes(s)); })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const setStat = (id: ID, st: QuoteStatus) => {
    mutate((d) => { const x = d.quotations.find((y) => y.id === id); if (x) x.status = st; });
    toast(`Quotation marked ${QUOTE_STATUS[st].label}`, "info");
  };

  const convert = (qt: Quotation) => {
    const pkg = packages.find((p) => p.id === qt.packageId);
    let cid = qt.customerId;
    if (!cid) {
      cid = uid();
      mutate((d) => { d.customers.unshift({ id: cid!, tenantId: tid, name: qt.partyName, phone: "", whatsapp: "", email: "", country: "—", notes: "From quotation " + qt.code, createdAt: nowISO() }); });
    }
    const code = `${settings.bookingPrefix}-${new Date().getFullYear()}-${String(db.seq + 1).padStart(6, "0")}`;
    const b = {
      id: uid(), tenantId: tid, code, customerId: cid!, packageId: qt.packageId, date: qt.date,
      adults: qt.adults, children: qt.children, pickupLocation: qt.pickupLocation, pickupAddress: "",
      pickupTime: "15:30", dropoffLocation: "Same as pickup", specialReq: "", vehicleId: null, driverId: null,
      addons: [], discount: qt.discount, taxPct: qt.taxPct, total: qt.total, source: "Quotation " + qt.code,
      notes: qt.notes, status: "confirmed" as const, createdAt: nowISO(), createdBy: user!.id,
    };
    const err = saveBooking(b, true);
    if (err) { toast(err, "error"); return; }
    mutate((d) => { d.seq += 1; const x = d.quotations.find((y) => y.id === qt.id); if (x) x.status = "accepted"; });
    toast(`Booking ${code} created from ${qt.code} ✓`);
    setRoute({ page: "bookings", params: { open: b.id } });
  };

  const pv = preview ? quotes.find((x) => x.id === preview) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="w-full sm:w-72"><SearchBox value={q} onChange={setQ} placeholder="Search quotations…" /></div>
        <select className="input w-auto" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All statuses</option>
          {Object.entries(QUOTE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <div className="grow" />
        <button className="btn btn-primary" onClick={() => setForm({ open: true, qt: null })}><Plus size={15} />Create Quotation</button>
      </div>

      <div className="card overflow-hidden anim-rise">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px]">
            <thead className="bg-sand-100/70"><tr>
              <th className="th">Quotation</th><th className="th">Party</th><th className="th">Package</th><th className="th">Date</th><th className="th">Guests</th><th className="th">Total</th><th className="th">Valid until</th><th className="th">Status</th><th className="th">Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map((x) => (
                <tr key={x.id} className="border-t border-sand-100 hover:bg-sand-50 transition-colors">
                  <td className="td font-mono font-bold text-gold-700 text-[13px]">{x.code}</td>
                  <td className="td font-bold text-ink-900">{x.partyName}</td>
                  <td className="td font-semibold text-ink-500">{packages.find((p) => p.id === x.packageId)?.name ?? "—"}</td>
                  <td className="td font-semibold">{fmtDate(x.date)}</td>
                  <td className="td font-bold">{x.adults + x.children}</td>
                  <td className="td font-extrabold">{money(x.total, cur)}</td>
                  <td className={cx("td font-semibold", daysFromNow(x.validUntil) < 0 && x.status === "sent" ? "text-clay-600" : "")}>{fmtDate(x.validUntil)}{daysFromNow(x.validUntil) < 0 && x.status === "sent" ? " ⚠" : ""}</td>
                  <td className="td"><StatusPill {...QUOTE_STATUS[x.status]} /></td>
                  <td className="td">
                    <span className="flex gap-1.5">
                      <button className="btn btn-outline btn-sm" onClick={() => setPreview(x.id)}><FileText size={13} /></button>
                      {(x.status === "draft" || x.status === "sent") && <button className="btn btn-dark btn-sm" onClick={() => convert(x)}><Ticket size={13} /></button>}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={9}><EmptyState title="No quotations" body="Draft a professional quote and send it over WhatsApp." /></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {form.open && <QuoteForm qt={form.qt} onClose={() => setForm({ open: false, qt: null })} onSave={(x) => {
        const isNew = !quotes.some((y) => y.id === x.id);
        mutate((d) => { const i = d.quotations.findIndex((y) => y.id === x.id); if (i >= 0) d.quotations[i] = x; else d.quotations.unshift(x); });
        audit(isNew ? "quote.created" : "quote.updated", "Quotation", x.id, x.code);
        toast(isNew ? `${x.code} drafted ✓` : "Quotation updated ✓");
        setForm({ open: false, qt: null });
      }} />}

      {pv && (() => {
        const pkg = packages.find((p) => p.id === pv.packageId);
        const c = pv.customerId ? customers.find((x) => x.id === pv.customerId) : null;
        const l = pv.leadId ? leads.find((x) => x.id === pv.leadId) : null;
        const phone = (c?.whatsapp || l?.whatsapp || "").replace(/[^\d]/g, "");
        return (
          <div className="fixed inset-0 z-50 anim-fade" onMouseDown={() => setPreview(null)}>
            <div className="absolute inset-0 bg-ink-950/60" />
            <div className="absolute inset-0 sm:inset-6 md:inset-10 bg-sand-50 rounded-2xl overflow-hidden flex flex-col anim-pop print-sheet" onMouseDown={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-3 bg-ink-900 text-sand-50 no-print flex-wrap gap-2">
                <p className="font-display font-bold">Quotation {pv.code}</p>
                <div className="flex gap-2 flex-wrap">
                  <select className="input w-auto py-1.5 text-xs" value={pv.status} onChange={(e) => setStat(pv.id, e.target.value as QuoteStatus)}>
                    {Object.entries(QUOTE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <button className="btn btn-primary btn-sm" onClick={() => window.print()}><Printer size={13} />Print / PDF</button>
                  {phone && <a className="btn btn-success btn-sm" target="_blank" rel="noreferrer" href={`https://wa.me/${phone}?text=${encodeURIComponent(`Salam ${pv.partyName.split(" ")[0]}! Your desert safari quotation ${pv.code}: ${pkg?.name} on ${fmtDate(pv.date)} for ${pv.adults + pv.children} guests — total ${money(pv.total, cur)} (valid until ${fmtDate(pv.validUntil)}). Shall I reserve it? 🌇`)}`}><MessageCircle size={13} />WhatsApp</a>}
                  {(pv.status === "draft" || pv.status === "sent") && <button className="btn btn-dark btn-sm" onClick={() => convert(pv)}><Ticket size={13} />Convert to booking</button>}
                  <button className="btn btn-ghost btn-sm text-sand-200" onClick={() => setPreview(null)}>Close</button>
                </div>
              </div>
              <div className="grow overflow-y-auto p-6 sm:p-10 print-hide-scroll">
                <div className="max-w-3xl mx-auto bg-white border border-sand-200 rounded-xl p-8 shadow-lift">
                  <div className="flex justify-between items-start gap-4 pb-6 border-b-2 border-ink-900">
                    <div>
                      <p className="font-display font-black text-2xl text-ink-900">{settings.name}</p>
                      <p className="text-xs font-semibold text-ink-500 mt-1">{settings.address} · {settings.phone}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-display font-black text-3xl text-gold-600">QUOTATION</p>
                      <p className="font-mono font-bold text-sm text-ink-700 mt-1">{pv.code}</p>
                      <p className="text-xs font-semibold text-ink-400">Valid until {fmtDate(pv.validUntil)}</p>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-6 py-5 text-sm">
                    <div><p className="label">Prepared for</p><p className="font-extrabold text-ink-900">{pv.partyName}</p>{l && <p className="font-semibold text-ink-500">{l.phone}</p>}</div>
                    <div className="sm:text-right"><p className="label">Experience</p><p className="font-extrabold text-ink-900">{pkg?.name}</p><p className="font-semibold text-ink-500">{fmtDate(pv.date)} · {pv.adults} adults, {pv.children} children<br />Pickup: {pv.pickupLocation}</p></div>
                  </div>
                  <table className="w-full text-sm">
                    <thead><tr className="border-y border-sand-200"><th className="th">Item</th><th className="th text-right">Amount</th></tr></thead>
                    <tbody>
                      <tr><td className="td">{pv.adults} × adult ({money(pkg?.adultPrice ?? 0, cur)})</td><td className="td text-right font-bold">{money((pkg?.adultPrice ?? 0) * pv.adults, cur)}</td></tr>
                      <tr><td className="td">{pv.children} × child ({money(pkg?.childPrice ?? 0, cur)})</td><td className="td text-right font-bold">{money((pkg?.childPrice ?? 0) * pv.children, cur)}</td></tr>
                      {pv.discount > 0 && <tr><td className="td">Discount</td><td className="td text-right font-bold text-clay-600">− {money(pv.discount, cur)}</td></tr>}
                      <tr><td className="td">VAT {pv.taxPct}%</td><td className="td text-right font-bold">{money(Math.round((pv.total - Math.max(0, (pkg?.adultPrice ?? 0) * pv.adults + (pkg?.childPrice ?? 0) * pv.children - pv.discount)) * 100) / 100, cur)}</td></tr>
                      <tr className="border-t-2 border-ink-900"><td className="td font-display font-black text-lg">TOTAL</td><td className="td text-right font-display font-black text-xl text-gold-700">{money(pv.total, cur)}</td></tr>
                    </tbody>
                  </table>
                  {pkg && (
                    <div className="mt-5 grid sm:grid-cols-2 gap-4 text-sm">
                      <div><p className="label">Included</p><ul className="space-y-1">{pkg.includes.map((i) => <li key={i} className="font-semibold text-ink-600">✓ {i}</li>)}</ul></div>
                      <div><p className="label">Terms</p><p className="font-semibold text-ink-500 text-xs leading-relaxed">{settings.terms}<br />{settings.cancellationPolicy}</p></div>
                    </div>
                  )}
                  {pv.notes && <p className="mt-4 text-xs font-semibold text-ink-500 bg-sand-100 rounded-lg p-3">📝 {pv.notes}</p>}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function QuoteForm({ qt, onClose, onSave }: { qt: Quotation | null; onClose: () => void; onSave: (q: Quotation) => void }) {
  const { db, user, toast } = useStore();
  const tid = user?.tenantId!;
  const packages = useTenant(db.packages);
  const customers = useTenant(db.customers);
  const leads = useTenant(db.leads);
  const settings = db.settings.find((s) => s.tenantId === tid)!;
  const [f, setF] = useState<Quotation>(qt ?? {
    id: uid(), tenantId: tid, code: `QT-${new Date().getFullYear()}-${String(4200 + db.quotations.length)}`,
    partyName: "", customerId: null, leadId: null, packageId: packages[0]?.id ?? "", date: todayISO(),
    adults: 2, children: 0, pickupLocation: "", discount: 0, taxPct: settings.taxPct, total: 0,
    status: "draft", validUntil: addDaysISO(7), notes: "", createdAt: nowISO(),
  });
  const pkg = packages.find((p) => p.id === f.packageId);
  const calc = calcTotal(pkg, f.adults, f.children, [], f.discount, f.taxPct);
  return (
    <Modal open onClose={onClose} title={qt ? `Edit ${f.code}` : "New quotation"} size="lg"
      footer={<><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={() => {
        if (!f.partyName.trim()) { toast("Enter the guest or company name.", "error"); return; }
        onSave({ ...f, total: calc.total });
      }}>Save quotation · {money(calc.total, settings.currency)}</button></>}>
      <div className="grid sm:grid-cols-2 gap-3.5">
        <Field label="Party name" req><input className="input" value={f.partyName} onChange={(e) => setF({ ...f, partyName: e.target.value })} placeholder="Guest or company" /></Field>
        <Field label="Link to customer">
          <select className="input" value={f.customerId ?? ""} onChange={(e) => setF({ ...f, customerId: e.target.value || null })}>
            <option value="">— none —</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Link to lead">
          <select className="input" value={f.leadId ?? ""} onChange={(e) => setF({ ...f, leadId: e.target.value || null })}>
            <option value="">— none —</option>{leads.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </Field>
        <Field label="Package">
          <select className="input" value={f.packageId} onChange={(e) => setF({ ...f, packageId: e.target.value })}>
            {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Safari date"><input type="date" className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Valid until"><input type="date" className="input" value={f.validUntil} onChange={(e) => setF({ ...f, validUntil: e.target.value })} /></Field>
        <Field label="Adults"><input type="number" min={0} className="input" value={f.adults} onChange={(e) => setF({ ...f, adults: Math.max(0, Number(e.target.value)) })} /></Field>
        <Field label="Children"><input type="number" min={0} className="input" value={f.children} onChange={(e) => setF({ ...f, children: Math.max(0, Number(e.target.value)) })} /></Field>
        <Field label="Pickup location" className="sm:col-span-2"><input className="input" value={f.pickupLocation} onChange={(e) => setF({ ...f, pickupLocation: e.target.value })} /></Field>
        <Field label="Discount"><input type="number" min={0} className="input" value={f.discount} onChange={(e) => setF({ ...f, discount: Math.max(0, Number(e.target.value)) })} /></Field>
        <Field label="VAT %"><input type="number" min={0} className="input" value={f.taxPct} onChange={(e) => setF({ ...f, taxPct: Math.max(0, Number(e.target.value)) })} /></Field>
        <Field label="Notes" className="sm:col-span-2"><textarea className="input min-h-[60px]" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

const MiniStat = ({ icon, k, v, tone }: { icon: React.ReactNode; k: string; v: string; tone: string }) => (
  <div className="card p-4 flex items-center gap-3">
    <span className={cx("w-10 h-10 rounded-xl flex items-center justify-center", tone)}>{icon}</span>
    <span><span className="block text-[11px] font-extrabold uppercase tracking-wider text-ink-400">{k}</span><span className="font-display font-bold text-xl text-ink-900">{v}</span></span>
  </div>
);
void fmtDateTime; void Download;
