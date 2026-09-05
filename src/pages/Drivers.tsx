import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Pencil, Phone, Plus, Star, Truck } from "lucide-react";
import { useStore, useTenant } from "../lib/store";
import type { Driver, DriverStatus, ID, Schedule } from "../lib/types";
import { expiryWarn } from "../lib/data";
import { DRIVER_STATUS, addDaysISO, cx, fmtDate, fmtWeekday, money, nowISO, todayISO, uid } from "../lib/utils";
import { Avatar, Bar, Drawer, EmptyState, Field, Modal, SearchBox, StatusPill } from "../components/ui";

const blank = (tenantId: ID): Driver => ({
  id: uid(), tenantId, name: "", phone: "", whatsapp: "", email: "", licenseNo: "", licenseExpiry: todayISO(),
  visaExpiry: todayISO(), vehicleId: null, status: "available", rating: 4.5, totalTrips: 0, completedTrips: 0,
  notes: "", daysOff: [], joinedAt: todayISO(),
});

export default function Drivers() {
  const { db, user, route, setRoute, mutate, toast, audit } = useStore();
  const drivers = useTenant(db.drivers);
  const vehicles = useTenant(db.vehicles);
  const trips = useTenant(db.trips);
  const bookings = useTenant(db.bookings);
  const schedules = useTenant(db.schedules);
  const reviews = useTenant(db.reviews);
  const role = user!.role;
  const canEdit = role === "admin" || role === "ops";

  const [q, setQ] = useState("");
  const [sel, setSel] = useState<ID | null>(null);
  const [form, setForm] = useState<{ open: boolean; d: Driver | null }>({ open: false, d: null });

  useEffect(() => { if (route.params?.new) { setForm({ open: true, d: blank(user!.tenantId!) }); setRoute({ page: "drivers" }); } }, [route.params]);
  useEffect(() => { if (route.params?.open) { setSel(route.params.open); setRoute({ page: "drivers" }); } }, [route.params]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return drivers.filter((d) => !s || [d.name, d.phone, d.licenseNo, d.email].some((x) => x?.toLowerCase().includes(s)));
  }, [drivers, q]);

  const selD = sel ? drivers.find((d) => d.id === sel) : null;

  const save = (d: Driver) => {
    if (!d.name.trim() || !d.phone.trim()) { toast("Name and phone are required.", "error"); return; }
    const isNew = !drivers.some((x) => x.id === d.id);
    mutate((x) => {
      const i = x.drivers.findIndex((y) => y.id === d.id);
      if (i >= 0) x.drivers[i] = d; else x.drivers.unshift(d);
      if (d.vehicleId) { const v = x.vehicles.find((y) => y.id === d.vehicleId); if (v) v.driverId = d.id; }
    });
    audit(isNew ? "driver.created" : "driver.updated", "Driver", d.id, d.name);
    toast(isNew ? `${d.name} joined the team ✓` : "Driver updated ✓");
    setForm({ open: false, d: null });
  };

  const setStatus = (id: ID, s: DriverStatus) => {
    mutate((d) => { const x = d.drivers.find((y) => y.id === id); if (x) x.status = s; });
    toast(`Driver marked ${DRIVER_STATUS[s].label}`, "info");
  };

  const setShift = (driverId: ID, date: string, shift: Schedule["shift"]) => {
    mutate((d) => {
      const ex = d.schedules.find((s) => s.driverId === driverId && s.date === date);
      if (ex) ex.shift = shift; else d.schedules.push({ id: uid(), tenantId: d.drivers.find((x) => x.id === driverId)!.tenantId, driverId, date, shift });
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="w-full sm:w-72"><SearchBox value={q} onChange={setQ} placeholder="Search drivers…" /></div>
        <div className="grow" />
        {canEdit && <button className="btn btn-primary" onClick={() => setForm({ open: true, d: blank(user!.tenantId!) })}><Plus size={15} />Add Driver</button>}
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((d) => {
          const lic = expiryWarn(d.licenseExpiry);
          const visa = expiryWarn(d.visaExpiry);
          const v = vehicles.find((x) => x.id === d.vehicleId);
          const activeTrip = trips.find((t) => t.driverId === d.id && !["completed"].includes(t.status));
          return (
            <button key={d.id} onClick={() => setSel(d.id)} className="card p-4 text-left hover:-translate-y-0.5 hover:shadow-float transition-all cursor-pointer anim-rise group">
              <div className="flex items-start gap-3">
                <Avatar name={d.name} size={46} color={d.status === "on_trip" ? "#3c6447" : d.status === "available" ? "#a87520" : "#6f5d42"} />
                <div className="min-w-0 grow">
                  <p className="font-display font-bold text-lg text-ink-900 group-hover:text-gold-700 transition-colors truncate">{d.name}</p>
                  <p className="text-[12px] font-bold text-ink-500">Licence {d.licenseNo || "—"}</p>
                </div>
                <StatusPill {...DRIVER_STATUS[d.status]} />
              </div>
              <div className="flex items-center gap-3 mt-3 text-[12px] font-bold text-ink-500">
                <span className="chip bg-gold-200/70 text-gold-700"><Star size={11} fill="currentColor" />{d.rating}</span>
                <span>{d.completedTrips} trips done</span>
                <span className="flex items-center gap-1"><Truck size={12} />{v?.plate ?? "no vehicle"}</span>
              </div>
              <div className="mt-3 pt-3 border-t border-sand-100 flex items-center justify-between gap-2">
                {lic || visa ? (
                  <span className="chip bg-clay-100 text-clay-700"><AlertTriangle size={11} />{lic ? `Licence ${lic.level === "expired" ? "expired" : `${lic.days}d left`}` : `Visa ${visa!.days}d left`}</span>
                ) : <span className="chip bg-moss-100 text-moss-700">Documents OK</span>}
                {activeTrip && <span className="text-[11px] font-extrabold text-oasis-600">on a trip now</span>}
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && <div className="sm:col-span-2 xl:col-span-3 card"><EmptyState title="No drivers found" body="Hire a guide and add them here with licence details." /></div>}
      </div>

      <Drawer open={!!selD} onClose={() => setSel(null)} wide title={selD?.name ?? ""} sub={selD ? `Driver since ${fmtDate(selD.joinedAt)}` : ""}>
        {selD && (() => {
          const lic = expiryWarn(selD.licenseExpiry);
          const visa = expiryWarn(selD.visaExpiry);
          const v = vehicles.find((x) => x.id === selD.vehicleId);
          const dTrips = trips.filter((t) => t.driverId === selD.id).slice(0, 8);
          const dReviews = reviews.filter((r) => bookings.some((b) => b.id === r.bookingId && b.driverId === selD.id));
          const avgRating = dReviews.length ? dReviews.reduce((s, r) => s + r.rating, 0) / dReviews.length : null;
          return (
            <div className="space-y-4">
              {(lic || visa) && (
                <div className="card border-clay-200 bg-clay-100/40 p-3 space-y-1">
                  {lic && <p className="text-sm font-bold text-clay-700 flex items-center gap-2"><AlertTriangle size={14} />Driving licence {lic.level === "expired" ? `expired ${-lic.days} days ago — do not assign trips` : `expires in ${lic.days} days`}</p>}
                  {visa && <p className="text-sm font-bold text-clay-700 flex items-center gap-2"><AlertTriangle size={14} />Visa {visa.level === "expired" ? "expired" : `expires in ${visa.days} days`}</p>}
                </div>
              )}
              <div className="card p-4">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                  <h4 className="font-display font-bold text-ink-900">Driver profile</h4>
                  <div className="flex gap-2">
                    {canEdit && <button className="btn btn-outline btn-sm" onClick={() => setForm({ open: true, d: { ...selD } })}><Pencil size={13} />Edit</button>}
                    <a className="btn btn-success btn-sm" target="_blank" rel="noreferrer" href={`https://wa.me/${(selD.whatsapp || selD.phone).replace(/[^\d]/g, "")}`}><Phone size={13} />WhatsApp</a>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5 text-sm font-semibold text-ink-700">
                  <KV k="Phone" v={selD.phone} /><KV k="WhatsApp" v={selD.whatsapp || selD.phone} />
                  <KV k="Email" v={selD.email || "—"} /><KV k="Licence no." v={selD.licenseNo || "—"} />
                  <KV k="Licence expiry" v={fmtDate(selD.licenseExpiry)} warn={!!lic} />
                  <KV k="Visa expiry" v={fmtDate(selD.visaExpiry)} warn={!!visa} />
                  <KV k="Assigned vehicle" v={v ? `${v.plate} · ${v.make} ${v.model}` : "—"} />
                  <KV k="Rating" v={`★ ${selD.rating} guest rating`} />
                  <KV k="Trips" v={`${selD.completedTrips} completed of ${selD.totalTrips} total`} />
                  <KV k="Days off" v={selD.daysOff.length ? selD.daysOff.map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(", ") : "None"} />
                  <KV k="Notes" v={selD.notes || "—"} />
                  {avgRating !== null && <KV k="Recent reviews" v={`${avgRating.toFixed(1)} ★ average (${dReviews.length})`} />}
                </div>
                {canEdit && (
                  <div className="mt-4 pt-3 border-t border-sand-200">
                    <p className="label">Availability (assigned / on-trip are set automatically by trips)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(["available", "off_duty", "leave"] as const).map((s) => (
                        <button key={s} onClick={() => setStatus(selD.id, s)} className={cx("chip cursor-pointer border transition-all", selD.status === s ? "border-ink-900 ring-1 ring-ink-900" : "border-transparent", DRIVER_STATUS[s].cls)}>{DRIVER_STATUS[s].label}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {canEdit && (
                <div className="card p-4">
                  <h4 className="font-display font-bold text-ink-900 mb-1">Weekly schedule</h4>
                  <p className="text-xs text-ink-500 font-semibold mb-3">Tap a cell to cycle Morning → Evening → Off. This plan feeds the ops board.</p>
                  <div className="grid grid-cols-7 gap-1.5">
                    {Array.from({ length: 7 }).map((_, i) => {
                      const date = addDaysISO(i);
                      const sc = schedules.find((s) => s.driverId === selD.id && s.date === date);
                      const shift = sc?.shift ?? "evening";
                      return (
                        <button key={date} onClick={() => setShift(selD.id, date, shift === "morning" ? "evening" : shift === "evening" ? "off" : "morning")}
                          className={cx("rounded-xl border p-2 text-center transition-all cursor-pointer hover:-translate-y-0.5",
                            shift === "morning" ? "bg-gold-200/70 border-gold-300" : shift === "evening" ? "bg-ink-900 border-ink-900 text-sand-100" : "bg-sand-100 border-sand-200 text-ink-400")}>
                          <span className="block text-[10px] font-extrabold uppercase">{fmtWeekday(date)}</span>
                          <span className={cx("block text-[11px] font-extrabold mt-0.5", shift === "evening" ? "text-gold-300" : shift === "morning" ? "text-gold-700" : "text-ink-300")}>{shift === "off" ? "OFF" : shift === "morning" ? "AM" : "PM"}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="card p-4">
                <h4 className="font-display font-bold text-ink-900 mb-2">Recent trips</h4>
                {dTrips.length === 0 && <p className="text-sm text-ink-400 font-semibold">No trips yet.</p>}
                <div className="space-y-1.5">
                  {dTrips.map((t) => {
                    const b = bookings.find((x) => x.id === t.bookingId);
                    return (
                      <button key={t.id} onClick={() => b && setRoute({ page: "bookings", params: { open: b.id } })} className="w-full flex items-center justify-between gap-2 p-2.5 rounded-lg border border-sand-200 hover:border-gold-400 hover:bg-sand-50 transition-all cursor-pointer text-left">
                        <span className="text-[13px] font-extrabold text-ink-900">{b?.code ?? t.id}<span className="block text-[11px] font-semibold text-ink-400">{b ? `${fmtDate(b.date)} · ${b.pickupLocation}` : ""}</span></span>
                        <span className={cx("chip", t.status === "completed" ? "bg-moss-100 text-moss-700" : "bg-gold-200 text-gold-700")}>{t.status.replace(/_/g, " ")}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}
      </Drawer>

      {form.d && (
        <Modal open onClose={() => setForm({ open: false, d: null })} title={drivers.some((x) => x.id === form.d!.id) ? `Edit ${form.d.name}` : "Add driver"} size="lg"
          footer={<><button className="btn btn-outline" onClick={() => setForm({ open: false, d: null })}>Cancel</button><button className="btn btn-primary" onClick={() => save(form.d!)}>Save driver</button></>}>
          <div className="grid sm:grid-cols-2 gap-3.5">
            <Field label="Full name" req><input className="input" value={form.d.name} onChange={(e) => setForm({ ...form, d: { ...form.d!, name: e.target.value } })} /></Field>
            <Field label="Phone" req><input className="input" value={form.d.phone} onChange={(e) => setForm({ ...form, d: { ...form.d!, phone: e.target.value, whatsapp: form.d!.whatsapp || e.target.value } })} /></Field>
            <Field label="WhatsApp"><input className="input" value={form.d.whatsapp} onChange={(e) => setForm({ ...form, d: { ...form.d!, whatsapp: e.target.value } })} /></Field>
            <Field label="Email"><input className="input" value={form.d.email} onChange={(e) => setForm({ ...form, d: { ...form.d!, email: e.target.value } })} /></Field>
            <Field label="Licence number"><input className="input" value={form.d.licenseNo} onChange={(e) => setForm({ ...form, d: { ...form.d!, licenseNo: e.target.value } })} /></Field>
            <Field label="Licence expiry"><input type="date" className="input" value={form.d.licenseExpiry} onChange={(e) => setForm({ ...form, d: { ...form.d!, licenseExpiry: e.target.value } })} /></Field>
            <Field label="Visa / document expiry"><input type="date" className="input" value={form.d.visaExpiry} onChange={(e) => setForm({ ...form, d: { ...form.d!, visaExpiry: e.target.value } })} /></Field>
            <Field label="Assigned vehicle">
              <select className="input" value={form.d.vehicleId ?? ""} onChange={(e) => setForm({ ...form, d: { ...form.d!, vehicleId: e.target.value || null } })}>
                <option value="">— none —</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate} · {v.make} {v.model}</option>)}
              </select>
            </Field>
            <Field label="Rating"><input type="number" step="0.1" min={0} max={5} className="input" value={form.d.rating} onChange={(e) => setForm({ ...form, d: { ...form.d!, rating: Math.min(5, Math.max(0, Number(e.target.value))) } })} /></Field>
            <Field label="Days off (comma-separated: 0=Sun … 6=Sat)"><input className="input" value={form.d.daysOff.join(",")} onChange={(e) => setForm({ ...form, d: { ...form.d!, daysOff: e.target.value.split(",").map((x) => Number(x.trim())).filter((x) => x >= 0 && x <= 6) } })} /></Field>
            <Field label="Notes" className="sm:col-span-2"><textarea className="input min-h-[64px]" value={form.d.notes} onChange={(e) => setForm({ ...form, d: { ...form.d!, notes: e.target.value } })} /></Field>
          </div>
        </Modal>
      )}
      <span className="hidden"><Bar pct={1} />{money(0)}</span>
    </div>
  );
}

const KV = ({ k, v, warn }: { k: string; v: string; warn?: boolean }) => (
  <div><p className="text-[10px] font-extrabold uppercase tracking-wider text-ink-400">{k}</p><p className={cx("font-bold", warn ? "text-clay-600" : "text-ink-800")}>{v}{warn && <AlertTriangle size={11} className="inline ml-1" />}</p></div>
);
