import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Ban, CalendarDays, CreditCard, FileText, MapPin, Pencil, Phone, Plus, Printer, Trash2, Truck, UserCheck, Users } from "lucide-react";
import { useStore, useTenant } from "../lib/store";
import type { Addon, Booking, BookingStatus, ID, PayMethod } from "../lib/types";
import { BOOKING_SOURCES, calcTotal, guestsOf, payStatusOf } from "../lib/data";
import { BOOKING_STATUS, METHOD_LABEL, PAY_STATUS, TRIP_STATUS, cx, fmtClock, fmtDate, fmtDateShort, fmtDateTime, money, nowISO, timeAgo, todayISO, uid } from "../lib/utils";
import { Confirm, Drawer, EmptyState, Field, Modal, Pager, SearchBox, StatusPill } from "../components/ui";

const empty = (tenantId: ID, prefix: string, seq: number): Booking => ({
  id: uid(), tenantId, code: `${prefix}-${new Date().getFullYear()}-${String(seq).padStart(6, "0")}`,
  customerId: "", packageId: "", date: todayISO(), adults: 2, children: 0,
  pickupLocation: "", pickupAddress: "", pickupTime: "15:30", dropoffLocation: "Same as pickup",
  specialReq: "", vehicleId: null, driverId: null, addons: [], discount: 0, taxPct: 5, total: 0,
  source: "Website", notes: "", status: "pending", createdAt: nowISO(), createdBy: "manual",
});

export default function Bookings() {
  const { db, user, route, setRoute, mutate, toast, saveBooking, assignFleet, setBookingStatus, recordPayment, audit } = useStore();
  const tid = user?.tenantId!;
  const settings = db.settings.find((s) => s.tenantId === tid)!;
  const bookings = useTenant(db.bookings);
  const customers = useTenant(db.customers);
  const packages = useTenant(db.packages);
  const vehicles = useTenant(db.vehicles);
  const drivers = useTenant(db.drivers);
  const payments = useTenant(db.payments);
  const trips = useTenant(db.trips);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<{ open: boolean; booking: Booking | null; isNew: boolean; paidNow: number; method: PayMethod }>({ open: false, booking: null, isNew: false, paidNow: 0, method: "card" });
  const [sel, setSel] = useState<ID | null>(null);
  const [payModal, setPayModal] = useState<{ open: boolean; bookingId: ID | null }>({ open: false, bookingId: null });
  const [confirmCancel, setConfirmCancel] = useState<ID | null>(null);
  const [vehSel, setVehSel] = useState("");
  const [drvSel, setDrvSel] = useState("");
  const role = user!.role;

  useEffect(() => { if (route.params?.new) { setForm({ open: true, booking: empty(tid, settings.bookingPrefix, db.seq + 1), isNew: true, paidNow: 0, method: "card" }); setRoute({ page: "bookings" }); } }, [route.params]);
  useEffect(() => { if (route.params?.open) { setSel(route.params.open); setRoute({ page: "bookings" }); } }, [route.params]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return bookings
      .filter((b) => status === "all" || b.status === status)
      .filter((b) => (!from || b.date >= from) && (!to || b.date <= to))
      .filter((b) => {
        if (!s) return true;
        const c = customers.find((x) => x.id === b.customerId);
        return [b.code, c?.name, b.pickupLocation, drivers.find((d) => d.id === b.driverId)?.name].some((x) => x?.toLowerCase().includes(s));
      })
      .sort((a, b) => b.date.localeCompare(a.date) || a.pickupTime.localeCompare(b.pickupTime));
  }, [bookings, q, status, from, to, customers, drivers]);

  const pages = Math.max(1, Math.ceil(filtered.length / 9));
  const rows = filtered.slice((page - 1) * 9, page * 9);
  useEffect(() => { if (page > pages) setPage(1); }, [pages, page]);

  const selB = sel ? bookings.find((b) => b.id === sel) ?? null : null;
  useEffect(() => { if (selB) { setVehSel(selB.vehicleId ?? ""); setDrvSel(selB.driverId ?? ""); } }, [sel]);

  const openNew = () => setForm({ open: true, booking: empty(tid, settings.bookingPrefix, db.seq + 1), isNew: true, paidNow: 0, method: "card" });
  const openEdit = (b: Booking) => setForm({ open: true, booking: JSON.parse(JSON.stringify(b)), isNew: false, paidNow: 0, method: "card" });

  const doAssign = () => {
    if (!selB) return;
    const err = assignFleet(selB.id, vehSel || null, drvSel || null);
    if (err) toast(err, "error");
    else { toast(`Fleet assigned to ${selB.code} ✓`); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="w-full sm:w-72"><SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search code, guest, driver…" /></div>
        <select className="input w-auto" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="all">All statuses</option>
          {Object.entries(BOOKING_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <input type="date" className="input w-auto" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
        <input type="date" className="input w-auto" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
        <span className="text-xs font-bold text-ink-500">{filtered.length} bookings</span>
        <div className="grow" />
        <button className="btn btn-outline btn-sm" onClick={() => { setQ(""); setStatus("all"); setFrom(""); setTo(""); }}>Clear</button>
        <button className="btn btn-primary" onClick={openNew}><Plus size={15} />New Booking</button>
      </div>

      <div className="card overflow-hidden anim-rise">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead className="bg-sand-100/70"><tr>
              <th className="th">Booking</th><th className="th">Date</th><th className="th">Customer</th><th className="th">Package</th><th className="th">Guests</th><th className="th">Pickup</th><th className="th">Fleet</th><th className="th">Total</th><th className="th">Payment</th><th className="th">Status</th>
            </tr></thead>
            <tbody>
              {rows.map((b) => {
                const c = customers.find((x) => x.id === b.customerId);
                const p = packages.find((x) => x.id === b.packageId);
                const ps = payStatusOf(db, b);
                const v = vehicles.find((x) => x.id === b.vehicleId);
                const d = drivers.find((x) => x.id === b.driverId);
                return (
                  <tr key={b.id} onClick={() => setSel(b.id)} className={cx("border-t border-sand-100 hover:bg-sand-50 transition-colors cursor-pointer", b.date === todayISO() && !["completed", "cancelled", "no_show"].includes(b.status) && "bg-gold-200/15")}>
                    <td className="td font-mono font-bold text-gold-700 text-[13px]">{b.code}{b.date === todayISO() && <span className="chip bg-ink-900 text-gold-300 ml-1.5">today</span>}</td>
                    <td className="td font-bold">{fmtDateShort(b.date)}<span className="block text-[11px] font-semibold text-ink-400">{fmtClock(b.pickupTime)}</span></td>
                    <td className="td font-bold text-ink-900">{c?.name ?? "—"}</td>
                    <td className="td"><span className="chip" style={{ background: (p?.accent ?? "#c8912f") + "22", color: p?.accent ?? "#a87520" }}>{p?.name ?? "—"}</span></td>
                    <td className="td font-bold">{guestsOf(b)}</td>
                    <td className="td max-w-[180px] truncate">{b.pickupLocation || "—"}</td>
                    <td className="td text-[13px]">{v ? <span className="font-bold">{v.plate}</span> : <span className="text-ink-300">—</span>}{d ? <span className="block text-[11px] font-semibold text-ink-400">{d.name}</span> : null}</td>
                    <td className="td font-extrabold">{money(b.total, settings.currency)}</td>
                    <td className="td"><StatusPill {...PAY_STATUS[ps]} /></td>
                    <td className="td"><StatusPill {...BOOKING_STATUS[b.status]} /></td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={10}><EmptyState title="No bookings match" body="Adjust filters or create a new booking." action={<button className="btn btn-dark btn-sm" onClick={openNew}><Plus size={14} />New booking</button>} /></td></tr>}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-sand-200 flex items-center justify-between">
          <span className="text-xs font-bold text-ink-500">Showing {rows.length} of {filtered.length}</span>
          <Pager page={page} pages={pages} onPage={setPage} />
        </div>
      </div>

      {/* ── Booking form ── */}
      {form.booking && (
        <BookingForm form={form} setForm={setForm} customers={customers} packages={packages} vehicles={vehicles} drivers={drivers}
          onSave={(b, paidNow, method) => {
            const err = saveBooking(b, form.isNew);
            if (err) { toast(err, "error"); return; }
            if (paidNow > 0) {
              const perr = recordPayment(b.id, paidNow, method, "MANUAL", "Recorded with booking", false);
              if (perr) toast(perr, "error");
            }
            toast(form.isNew ? `Booking ${b.code} created ✓` : `Booking ${b.code} updated ✓`);
            setForm({ ...form, open: false });
            setSel(b.id);
          }} />
      )}

      {/* ── Detail drawer ── */}
      <Drawer open={!!selB} onClose={() => setSel(null)} wide
        title={selB ? <span className="flex items-center gap-2.5">{selB.code}<StatusPill {...BOOKING_STATUS[selB.status]} /></span> : ""}
        sub={selB ? `Created ${fmtDateTime(selB.createdAt)} · source ${selB.source}` : ""}>
        {selB && (() => {
          const c = customers.find((x) => x.id === selB.customerId);
          const p = packages.find((x) => x.id === selB.packageId);
          const v = vehicles.find((x) => x.id === selB.vehicleId);
          const d = drivers.find((x) => x.id === selB.driverId);
          const ps = payStatusOf(db, selB);
          const paid = payments.filter((x) => x.bookingId === selB.id && x.status === "captured").reduce((s, x) => s + x.amount, 0);
          const trip = trips.find((t) => t.bookingId === selB.id);
          const editable = !["completed", "cancelled", "no_show"].includes(selB.status);
          return (
            <div className="space-y-4">
              <div className="card p-4 grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <Info icon={<CalendarDays size={14} />} k="Safari date" v={`${fmtDate(selB.date)} · pickup ${fmtClock(selB.pickupTime)}`} />
                <Info icon={<Users size={14} />} k="Guests" v={`${selB.adults} adults · ${selB.children} children (${guestsOf(selB)} total)`} />
                <Info icon={<MapPin size={14} />} k="Pickup" v={`${selB.pickupLocation}${selB.pickupAddress ? " — " + selB.pickupAddress : ""}`} />
                <Info icon={<ArrowRight size={14} />} k="Drop-off" v={selB.dropoffLocation || "Same as pickup"} />
                <Info icon={<FileText size={14} />} k="Package" v={p ? `${p.name} · ${p.duration}` : "—"} />
                <Info icon={<UserCheck size={14} />} k="Customer" v={c ? `${c.name} · ${c.phone}` : "—"} />
                {selB.specialReq && <Info icon={<Plus size={14} />} k="Special requirements" v={selB.specialReq} />}
                {selB.notes && <Info icon={<FileText size={14} />} k="Internal notes" v={selB.notes} />}
              </div>

              {/* Money */}
              <div className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-display font-bold text-ink-900">Pricing</h4>
                  <StatusPill {...PAY_STATUS[ps]} />
                </div>
                <div className="space-y-1.5 text-sm font-semibold text-ink-700">
                  <Row k={`${p?.name ?? "Package"} — ${selB.adults} × adult + ${selB.children} × child`} v={money((p?.adultPrice ?? 0) * selB.adults + (p?.childPrice ?? 0) * selB.children, settings.currency)} />
                  {selB.addons.map((a, i) => <Row key={i} k={a.name} v={money(a.price, settings.currency)} />)}
                  {selB.discount > 0 && <Row k="Discount" v={`− ${money(selB.discount, settings.currency)}`} />}
                  <Row k={`VAT ${selB.taxPct}%`} v={money(Math.round((selB.total / (1 + selB.taxPct / 100)) * (selB.taxPct / 100) * 100) / 100, settings.currency)} />
                  <div className="border-t border-sand-200 pt-2 flex justify-between font-extrabold text-ink-900"><span>Total</span><span>{money(selB.total, settings.currency)}</span></div>
                  <div className="flex justify-between text-moss-600"><span>Paid</span><span>{money(paid, settings.currency)}</span></div>
                  <div className={cx("flex justify-between font-extrabold", selB.total - paid > 0 ? "text-clay-600" : "text-moss-600")}><span>Balance</span><span>{money(Math.max(0, selB.total - paid), settings.currency)}</span></div>
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  {editable && (role === "admin" || role === "sales" || role === "ops") && <button className="btn btn-primary btn-sm" onClick={() => setPayModal({ open: true, bookingId: selB.id })}><CreditCard size={14} />Record payment</button>}
                  <button className="btn btn-outline btn-sm" onClick={() => { setRoute({ page: "payments", params: { invoice: selB.id } }); }}><Printer size={14} />Invoice</button>
                </div>
              </div>

              {/* Fleet */}
              {editable && (role === "admin" || role === "ops") && (
                <div className="card p-4">
                  <h4 className="font-display font-bold text-ink-900 mb-1">Assign vehicle & driver</h4>
                  <p className="text-xs text-ink-500 font-semibold mb-3">Conflict detection runs on save — double-bookings are blocked.</p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label="Vehicle"><select className="input" value={vehSel} onChange={(e) => setVehSel(e.target.value)}>
                      <option value="">— not assigned —</option>
                      {vehicles.filter((x) => !["out_of_service"].includes(x.status)).map((x) => <option key={x.id} value={x.id}>{x.plate} · {x.model} · {x.seats} seats{x.status === "maintenance" ? " (maintenance)" : ""}</option>)}
                    </select></Field>
                    <Field label="Driver"><select className="input" value={drvSel} onChange={(e) => setDrvSel(e.target.value)}>
                      <option value="">— not assigned —</option>
                      {drivers.map((x) => <option key={x.id} value={x.id}>{x.name} · ★{x.rating}{["off_duty", "leave"].includes(x.status) ? ` (${x.status.replace("_", " ")})` : ""}</option>)}
                    </select></Field>
                  </div>
                  {v && guestsOf(selB) > v.seats && <p className="mt-2 text-xs font-bold text-clay-600">⚠ {v.model} seats {v.seats} but this booking has {guestsOf(selB)} guests.</p>}
                  <div className="flex gap-2 mt-3">
                    <button className="btn btn-dark btn-sm" onClick={doAssign}><Truck size={14} />Save assignment</button>
                    {trip && <StatusPill {...TRIP_STATUS[trip.status]} />}
                  </div>
                </div>
              )}

              {/* Payments history */}
              {payments.some((x) => x.bookingId === selB.id) && (
                <div className="card p-4">
                  <h4 className="font-display font-bold text-ink-900 mb-2">Payments</h4>
                  <div className="space-y-1.5">
                    {payments.filter((x) => x.bookingId === selB.id).map((x) => (
                      <div key={x.id} className="flex items-center justify-between text-sm border-b border-sand-100 pb-1.5">
                        <span className="font-bold text-ink-800">{x.invoiceNo} · {METHOD_LABEL[x.method]}<span className="block text-[11px] font-semibold text-ink-400">{fmtDateTime(x.date)}{x.ref ? ` · ${x.ref}` : ""}</span></span>
                        <span className={cx("font-extrabold", x.status === "refunded" ? "text-night-600 line-through" : "text-moss-600")}>{money(x.amount, settings.currency)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {editable && <button className="btn btn-outline btn-sm" onClick={() => openEdit(selB)}><Pencil size={13} />Edit</button>}
                {["inquiry", "pending"].includes(selB.status) && (role === "admin" || role === "sales" || role === "ops") && (
                  <button className="btn btn-success btn-sm" onClick={() => { setBookingStatus(selB.id, "confirmed"); toast(`${selB.code} confirmed ✓`); audit("booking.confirmed", "Booking", selB.id, selB.code); }}>Confirm booking</button>
                )}
                {["confirmed", "assigned", "pickup", "in_progress"].includes(selB.status) && role !== "sales" && (
                  <button className="btn btn-dark btn-sm" onClick={() => { setBookingStatus(selB.id, "completed"); toast(`${selB.code} marked completed`); }}>Mark completed</button>
                )}
                {editable && (role === "admin" || role === "ops") && <button className="btn btn-outline btn-sm text-clay-600 border-clay-200 hover:bg-clay-100/60" onClick={() => setConfirmCancel(selB.id)}><Ban size={13} />Cancel booking</button>}
                {selB.status === "pending" && role !== "sales" && (
                  <button className="btn btn-outline btn-sm" onClick={() => { setBookingStatus(selB.id, "no_show"); toast("Marked as no-show", "info"); }}>Mark no-show</button>
                )}
              </div>
            </div>
          );
        })()}
      </Drawer>

      {/* Record payment modal */}
      {payModal.bookingId && (
        <PayForm bookingId={payModal.bookingId} onClose={() => setPayModal({ open: false, bookingId: null })} recordPayment={recordPayment} currency={settings.currency} />
      )}

      <Confirm open={!!confirmCancel} onClose={() => setConfirmCancel(null)} danger yesLabel="Cancel booking"
        title="Cancel this booking?"
        body="The booking will be marked cancelled and any assigned driver and vehicle will be released back to the pool. This is recorded in the audit log."
        onYes={() => { if (confirmCancel) { setBookingStatus(confirmCancel, "cancelled"); toast("Booking cancelled — fleet released.", "info"); } }} />
    </div>
  );
}

const Info = ({ icon, k, v }: { icon: React.ReactNode; k: string; v: string }) => (
  <div className="flex items-start gap-2.5">
    <span className="w-7 h-7 rounded-lg bg-sand-100 text-gold-700 flex items-center justify-center shrink-0 mt-0.5">{icon}</span>
    <span><span className="block text-[10px] font-extrabold uppercase tracking-wider text-ink-400">{k}</span><span className="block font-bold text-ink-800">{v}</span></span>
  </div>
);
const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between gap-3"><span className="text-ink-500">{k}</span><span className="font-bold text-ink-800">{v}</span></div>
);

function BookingForm({ form, setForm, customers, packages, vehicles, drivers, onSave }: {
  form: { open: boolean; booking: Booking | null; isNew: boolean; paidNow: number; method: PayMethod };
  setForm: (f: typeof form) => void;
  customers: import("../lib/types").Customer[]; packages: import("../lib/types").SafariPackage[];
  vehicles: import("../lib/types").Vehicle[]; drivers: import("../lib/types").Driver[];
  onSave: (b: Booking, paidNow: number, method: PayMethod) => void;
}) {
  const { db, user, toast } = useStore();
  const settings = db.settings.find((s) => s.tenantId === user?.tenantId)!;
  const b = form.booking!;
  const set = (patch: Partial<Booking>) => setForm({ ...form, booking: { ...b, ...patch } });
  const pkg = packages.find((p) => p.id === b.packageId);
  const calc = calcTotal(pkg, b.adults, b.children, b.addons, b.discount, b.taxPct);
  const role = user!.role;
  const canAssign = role === "admin" || role === "ops";

  const submit = () => {
    if (!b.customerId) { toast("Select a customer.", "error"); return; }
    if (!b.packageId) { toast("Choose a safari package.", "error"); return; }
    if (!b.date) { toast("Pick a safari date.", "error"); return; }
    if (b.adults + b.children <= 0) { toast("At least one guest is required.", "error"); return; }
    if (!b.pickupLocation.trim()) { toast("Enter a pickup location.", "error"); return; }
    if (pkg && guestsOf(b) > pkg.maxPax && !b.vehicleId) { toast(`This package fits ${pkg.maxPax} guests per vehicle — assign a bigger vehicle or split the group.`, "error"); return; }
    onSave({ ...b, total: calc.total }, form.isNew ? form.paidNow : 0, form.method);
  };

  return (
    <Modal open={form.open} onClose={() => setForm({ ...form, open: false })} size="xl"
      title={form.isNew ? "New booking" : `Edit ${b.code}`} sub={`${b.code} · generated automatically from your prefix`}
      footer={<><button className="btn btn-outline" onClick={() => setForm({ ...form, open: false })}>Discard</button><button className="btn btn-primary" onClick={submit}>{form.isNew ? "Create booking" : "Save changes"}</button></>}>
      <div className="grid lg:grid-cols-[1fr_290px] gap-5">
        <div className="grid sm:grid-cols-2 gap-3.5 content-start">
          <Field label="Customer" req><select className="input" value={b.customerId} onChange={(e) => set({ customerId: e.target.value })}>
            <option value="">Select customer…</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.phone}</option>)}
          </select></Field>
          <Field label="Safari package" req><select className="input" value={b.packageId} onChange={(e) => set({ packageId: e.target.value })}>
            <option value="">Select package…</option>
            {packages.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name} — {money(p.adultPrice, settings.currency)}/adult</option>)}
          </select></Field>
          <Field label="Safari date" req><input type="date" className="input" value={b.date} onChange={(e) => set({ date: e.target.value })} /></Field>
          <Field label="Pickup time" req><input type="time" className="input" value={b.pickupTime} onChange={(e) => set({ pickupTime: e.target.value })} /></Field>
          <Field label="Adults" req><input type="number" min={0} className="input" value={b.adults} onChange={(e) => set({ adults: Math.max(0, Number(e.target.value)) })} /></Field>
          <Field label="Children"><input type="number" min={0} className="input" value={b.children} onChange={(e) => set({ children: Math.max(0, Number(e.target.value)) })} /></Field>
          <Field label="Pickup location" req className="sm:col-span-2"><input className="input" placeholder="e.g. Atlantis The Palm — main lobby" value={b.pickupLocation} onChange={(e) => set({ pickupLocation: e.target.value })} /></Field>
          <Field label="Pickup address / details" className="sm:col-span-2"><input className="input" placeholder="Villa number, lobby, gate code…" value={b.pickupAddress} onChange={(e) => set({ pickupAddress: e.target.value })} /></Field>
          <Field label="Drop-off location"><input className="input" value={b.dropoffLocation} onChange={(e) => set({ dropoffLocation: e.target.value })} /></Field>
          <Field label="Booking source"><select className="input" value={b.source} onChange={(e) => set({ source: e.target.value })}>{BOOKING_SOURCES.map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Special requirements" className="sm:col-span-2"><input className="input" placeholder="Allergies, wheelchair, birthday surprise…" value={b.specialReq} onChange={(e) => set({ specialReq: e.target.value })} /></Field>
          {canAssign && (
            <>
              <Field label="Vehicle (optional)"><select className="input" value={b.vehicleId ?? ""} onChange={(e) => set({ vehicleId: e.target.value || null })}>
                <option value="">Assign later</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate} · {v.model} · {v.seats} seats</option>)}
              </select></Field>
              <Field label="Driver (optional)"><select className="input" value={b.driverId ?? ""} onChange={(e) => set({ driverId: e.target.value || null })}>
                <option value="">Assign later</option>
                {drivers.map((d) => <option key={d.id} value={d.id}>{d.name} · ★{d.rating}</option>)}
              </select></Field>
            </>
          )}
          <Field label="Status"><select className="input" value={b.status} onChange={(e) => set({ status: e.target.value as BookingStatus })}>
            {Object.entries(BOOKING_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select></Field>
          <Field label="Internal notes"><input className="input" value={b.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>

          <div className="sm:col-span-2">
            <label className="label">Additional services</label>
            <div className="space-y-2">
              {b.addons.map((a, i) => (
                <div key={i} className="flex gap-2">
                  <input className="input" placeholder="e.g. Quad bike 30 min" value={a.name} onChange={(e) => set({ addons: b.addons.map((x, j) => j === i ? { ...x, name: e.target.value } : x) })} />
                  <input className="input w-28" type="number" min={0} value={a.price} onChange={(e) => set({ addons: b.addons.map((x, j) => j === i ? { ...x, price: Number(e.target.value) } : x) })} />
                  <button className="btn btn-ghost text-clay-600" onClick={() => set({ addons: b.addons.filter((_, j) => j !== i) })} aria-label="Remove add-on"><Trash2 size={15} /></button>
                </div>
              ))}
              <button className="btn btn-outline btn-sm" onClick={() => set({ addons: [...b.addons, { name: "", price: 0 } as Addon] })}><Plus size={13} />Add service</button>
            </div>
          </div>
        </div>

        {/* Price panel */}
        <div className="card p-4 h-fit lg:sticky lg:top-0 bg-sand-50">
          <h4 className="font-display font-bold text-ink-900 mb-3">Price summary</h4>
          <div className="space-y-1.5 text-sm font-semibold text-ink-600">
            <Row k={`${b.adults} × adult @ ${money(pkg?.adultPrice ?? 0, settings.currency)}`} v={money((pkg?.adultPrice ?? 0) * b.adults, settings.currency)} />
            <Row k={`${b.children} × child @ ${money(pkg?.childPrice ?? 0, settings.currency)}`} v={money((pkg?.childPrice ?? 0) * b.children, settings.currency)} />
            {b.addons.filter((a) => a.name).map((a, i) => <Row key={i} k={a.name} v={money(a.price, settings.currency)} />)}
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-ink-500">Discount</span>
              <input type="number" min={0} className="input w-24 text-right" value={b.discount} onChange={(e) => set({ discount: Math.max(0, Number(e.target.value)) })} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-ink-500">VAT %</span>
              <input type="number" min={0} className="input w-24 text-right" value={b.taxPct} onChange={(e) => set({ taxPct: Math.max(0, Number(e.target.value)) })} />
            </div>
            <div className="border-t border-sand-300 pt-2.5 mt-2 flex justify-between items-baseline">
              <span className="font-extrabold text-ink-900">Total</span>
              <span className="font-display text-2xl font-black text-gold-700">{money(calc.total, settings.currency)}</span>
            </div>
          </div>
          {form.isNew && (
            <div className="mt-4 pt-4 border-t border-sand-300 space-y-2.5">
              <Field label="Amount paid now"><input type="number" min={0} className="input" value={form.paidNow} onChange={(e) => setForm({ ...form, paidNow: Math.max(0, Number(e.target.value)) })} /></Field>
              <Field label="Payment method"><select className="input" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as PayMethod })}>
                {Object.entries(METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></Field>
              {form.paidNow > 0 && <p className="text-[11px] font-bold text-ink-500">Balance after payment: <span className="text-clay-600">{money(Math.max(0, calc.total - form.paidNow), settings.currency)}</span></p>}
            </div>
          )}
          {pkg && guestsOf(b) > pkg.maxPax && <p className="mt-3 text-[11px] font-bold text-clay-600">⚠ Group of {guestsOf(b)} exceeds the {pkg.maxPax}-guest per-vehicle limit for this package.</p>}
        </div>
      </div>
    </Modal>
  );
}

function PayForm({ bookingId, onClose, recordPayment, currency }: {
  bookingId: ID; onClose: () => void; recordPayment: (b: ID, a: number, m: PayMethod, r: string, n: string, over: boolean) => string | null; currency: string;
}) {
  const { db, toast } = useStore();
  const b = db.bookings.find((x) => x.id === bookingId)!;
  const paid = db.payments.filter((p) => p.bookingId === bookingId && p.status === "captured").reduce((s, p) => s + p.amount, 0);
  const [amount, setAmount] = useState(Math.max(0, b.total - paid));
  const [method, setMethod] = useState<PayMethod>("card");
  const [ref, setRef] = useState("");
  const [note, setNote] = useState("");
  const [over, setOver] = useState(false);
  const submit = () => {
    const err = recordPayment(bookingId, amount, method, ref, note, over);
    if (err) { toast(err, "error"); return; }
    toast(`Payment of ${money(amount, currency)} recorded ✓`);
    onClose();
  };
  return (
    <Modal open onClose={onClose} title="Record payment" sub={`${b.code} · balance ${money(Math.max(0, b.total - paid), currency)}`}
      footer={<><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-success" onClick={submit}><CreditCard size={14} />Record {money(amount, currency)}</button></>}>
      <div className="grid sm:grid-cols-2 gap-3.5">
        <Field label="Amount" req><input type="number" min={0} className="input" value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></Field>
        <Field label="Method"><select className="input" value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>{Object.entries(METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Transaction reference"><input className="input" placeholder="POS slip / transfer ref" value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
        <Field label="Note"><input className="input" placeholder="optional" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <label className="flex items-center gap-2 sm:col-span-2 text-sm font-bold text-ink-700 cursor-pointer">
          <input type="checkbox" checked={over} onChange={(e) => setOver(e.target.checked)} className="accent-[#c8912f] w-4 h-4" />Allow overpayment (records credit on the booking)
        </label>
        {amount > b.total - paid + 0.01 && !over && <p className="sm:col-span-2 text-xs font-bold text-clay-600">Amount exceeds the remaining balance — enable overpayment to continue.</p>}
      </div>
    </Modal>
  );
}

export { PayForm };
export const lastAudit = timeAgo;
