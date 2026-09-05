import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, ClipboardCheck, Fuel, Gauge, Pencil, Plus, Truck, Wrench } from "lucide-react";
import { useStore, useTenant } from "../lib/store";
import type { ID, Inspection, Vehicle, VehicleStatus } from "../lib/types";
import { INSPECTION_ITEMS, vehicleIssues } from "../lib/data";
import { VEHICLE_STATUS, cx, daysFromNow, fmtDate, fmtDateShort, money, nowISO, todayISO, uid } from "../lib/utils";
import { Bar, Drawer, EmptyState, Field, Modal, SearchBox, StatusPill, Toggle } from "../components/ui";

const blank = (tenantId: ID): Vehicle => ({
  id: uid(), tenantId, plate: "", type: "4x4 SUV", make: "Nissan", model: "Patrol", year: new Date().getFullYear(),
  color: "", seats: 7, status: "available", driverId: null, insuranceExpiry: todayISO(), regExpiry: todayISO(),
  permitExpiry: todayISO(), lastService: todayISO(), nextService: todayISO(), mileage: 0, notes: "",
});

export default function Fleet() {
  const { db, user, route, setRoute, mutate, toast, audit } = useStore();
  const vehicles = useTenant(db.vehicles);
  const drivers = useTenant(db.drivers);
  const inspections = useTenant(db.inspections);
  const bookings = useTenant(db.bookings);
  const role = user!.role;
  const canEdit = role === "admin" || role === "ops";

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [sel, setSel] = useState<ID | null>(null);
  const [form, setForm] = useState<{ open: boolean; v: Vehicle | null }>({ open: false, v: null });
  const [inspOpen, setInspOpen] = useState<ID | null>(null);

  useEffect(() => { if (route.params?.new) { setForm({ open: true, v: blank(user!.tenantId!) }); setRoute({ page: "fleet" }); } }, [route.params]);
  useEffect(() => { if (route.params?.open) { setSel(route.params.open); setRoute({ page: "fleet" }); } }, [route.params]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return vehicles
      .filter((v) => status === "all" || v.status === status)
      .filter((v) => !s || [v.plate, v.make, v.model, v.color].some((x) => x.toLowerCase().includes(s)));
  }, [vehicles, q, status]);

  const selV = sel ? vehicles.find((v) => v.id === sel) : null;

  const save = (v: Vehicle) => {
    if (!v.plate.trim()) { toast("Registration plate is required.", "error"); return; }
    if (v.seats < 1) { toast("Seating capacity must be at least 1.", "error"); return; }
    const isNew = !vehicles.some((x) => x.id === v.id);
    mutate((d) => {
      const i = d.vehicles.findIndex((x) => x.id === v.id);
      if (i >= 0) d.vehicles[i] = v; else d.vehicles.unshift(v);
    });
    audit(isNew ? "vehicle.created" : "vehicle.updated", "Vehicle", v.id, v.plate);
    toast(isNew ? `${v.plate} added to fleet ✓` : "Vehicle updated ✓");
    setForm({ open: false, v: null });
  };

  const setStatusOf = (id: ID, s: VehicleStatus) => {
    mutate((d) => { const v = d.vehicles.find((x) => x.id === id); if (v) v.status = s; });
    audit("vehicle.status", "Vehicle", id, `Status → ${s.replace("_", " ")}`);
    toast(`Vehicle marked ${VEHICLE_STATUS[s].label}`, "info");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="w-full sm:w-72"><SearchBox value={q} onChange={setQ} placeholder="Search plate, make, model…" /></div>
        <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          {Object.entries(VEHICLE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <div className="grow" />
        {canEdit && <button className="btn btn-primary" onClick={() => setForm({ open: true, v: blank(user!.tenantId!) })}><Plus size={15} />Add Vehicle</button>}
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((v) => {
          const issues = vehicleIssues(v);
          const drv = drivers.find((d) => d.id === v.driverId);
          const util = bookings.filter((b) => b.vehicleId === v.id && b.status === "completed").length;
          return (
            <button key={v.id} onClick={() => setSel(v.id)} className="card p-4 text-left hover:-translate-y-0.5 hover:shadow-float transition-all cursor-pointer anim-rise group">
              <div className="flex items-start justify-between gap-2">
                <span className="w-11 h-11 rounded-xl bg-ink-900 text-gold-300 flex items-center justify-center"><Truck size={20} /></span>
                <StatusPill {...VEHICLE_STATUS[v.status]} />
              </div>
              <p className="font-display font-bold text-lg text-ink-900 mt-3 group-hover:text-gold-700 transition-colors">{v.make} {v.model}</p>
              <p className="text-sm font-bold text-ink-500">{v.plate} · {v.year} · {v.color}</p>
              <div className="flex items-center gap-3 mt-3 text-[12px] font-bold text-ink-500">
                <span className="chip bg-sand-100 text-ink-600">{v.seats} seats</span>
                <span className="flex items-center gap-1"><Gauge size={12} />{v.mileage.toLocaleString()} km</span>
                <span className="flex items-center gap-1"><Fuel size={12} />{util} trips</span>
              </div>
              <div className="mt-3 pt-3 border-t border-sand-100 flex items-center justify-between">
                <span className="text-[12px] font-bold text-ink-500">{drv ? `🧑‍✈️ ${drv.name}` : "No driver linked"}</span>
                {issues.length > 0
                  ? <span className="chip bg-clay-100 text-clay-700"><AlertTriangle size={11} />{issues.length} alert{issues.length > 1 ? "s" : ""}</span>
                  : <span className="chip bg-moss-100 text-moss-700">Docs OK</span>}
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && <div className="sm:col-span-2 xl:col-span-3 card"><EmptyState title="No vehicles match" body="Add a 4x4 to start building the fleet." /></div>}
      </div>

      {/* Detail drawer */}
      <Drawer open={!!selV} onClose={() => setSel(null)} wide title={selV ? `${selV.make} ${selV.model}` : ""} sub={selV ? `${selV.plate} · ${selV.year} · ${selV.color}` : ""}>
        {selV && (() => {
          const issues = vehicleIssues(selV);
          const vInsp = inspections.filter((i) => i.vehicleId === selV.id).sort((a, b) => b.date.localeCompare(a.date));
          return (
            <div className="space-y-4">
              {issues.length > 0 && (
                <div className="card border-clay-200 bg-clay-100/40 p-3 space-y-1">
                  {issues.map((i) => (
                    <p key={i.label} className="text-sm font-bold text-clay-700 flex items-center gap-2"><AlertTriangle size={14} />{i.label}: {i.warn.level === "expired" ? `${-i.warn.days} days overdue` : `expires in ${i.warn.days} days`}</p>
                  ))}
                </div>
              )}
              <div className="card p-4">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                  <h4 className="font-display font-bold text-ink-900">Vehicle profile</h4>
                  <div className="flex gap-2">
                    {canEdit && <button className="btn btn-outline btn-sm" onClick={() => setForm({ open: true, v: { ...selV } })}><Pencil size={13} />Edit</button>}
                    {canEdit && <button className="btn btn-dark btn-sm" onClick={() => setInspOpen(selV.id)}><ClipboardCheck size={13} />New inspection</button>}
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5 text-sm font-semibold text-ink-700">
                  <KV k="Type" v={selV.type} /><KV k="Seats" v={`${selV.seats} passengers`} />
                  <KV k="Mileage" v={`${selV.mileage.toLocaleString()} km`} />
                  <KV k="Assigned driver" v={drivers.find((d) => d.id === selV.driverId)?.name ?? "—"} />
                  <KV k="Insurance expiry" v={fmtDate(selV.insuranceExpiry)} warn={daysFromNow(selV.insuranceExpiry) <= 30} />
                  <KV k="Registration expiry" v={fmtDate(selV.regExpiry)} warn={daysFromNow(selV.regExpiry) <= 30} />
                  <KV k="Permit expiry" v={fmtDate(selV.permitExpiry)} warn={daysFromNow(selV.permitExpiry) <= 30} />
                  <KV k="Last service" v={fmtDate(selV.lastService)} />
                  <KV k="Next service" v={fmtDate(selV.nextService)} warn={daysFromNow(selV.nextService) <= 7} />
                  <KV k="Notes" v={selV.notes || "—"} />
                </div>
                {canEdit && (
                  <div className="mt-4 pt-3 border-t border-sand-200">
                    <p className="label">Set status</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(["available", "assigned", "on_safari", "maintenance", "out_of_service"] as const).map((s) => (
                        <button key={s} onClick={() => setStatusOf(selV.id, s)} className={cx("chip cursor-pointer border transition-all", selV.status === s ? "border-ink-900 ring-1 ring-ink-900" : "border-transparent hover:ring-1 hover:ring-sand-300", VEHICLE_STATUS[s].cls)}>{VEHICLE_STATUS[s].label}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="card p-4">
                <h4 className="font-display font-bold text-ink-900 mb-2">Inspection history</h4>
                {vInsp.length === 0 && <p className="text-sm text-ink-400 font-semibold">No inspections recorded yet — run the daily checklist before the first trip.</p>}
                <div className="space-y-2.5">
                  {vInsp.map((i) => (
                    <div key={i.id} className={cx("rounded-xl border p-3", i.passed ? "border-moss-200 bg-moss-100/30" : "border-clay-200 bg-clay-100/30")}>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-extrabold text-ink-900">{fmtDate(i.date)} · {i.by}</p>
                        <span className={cx("chip", i.passed ? "bg-moss-200 text-moss-700" : "bg-clay-200 text-clay-700")}>{i.passed ? "Passed" : "Needs attention"}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {i.items.map((it) => (
                          <span key={it.key} className={cx("chip", it.ok ? "bg-white/70 text-moss-700" : "bg-white/70 text-clay-700")} title={it.note}>{it.ok ? "✓" : "✗"} {it.label}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}
      </Drawer>

      {form.v && (
        <Modal open onClose={() => setForm({ open: false, v: null })} title={vehicles.some((x) => x.id === form.v!.id) ? `Edit ${form.v.plate}` : "Add vehicle"} size="lg"
          footer={<><button className="btn btn-outline" onClick={() => setForm({ open: false, v: null })}>Cancel</button><button className="btn btn-primary" onClick={() => save(form.v!)}>Save vehicle</button></>}>
          <div className="grid sm:grid-cols-2 gap-3.5">
            <Field label="Registration plate" req><input className="input" value={form.v.plate} onChange={(e) => setForm({ ...form, v: { ...form.v!, plate: e.target.value } })} placeholder="DXB 12345" /></Field>
            <Field label="Vehicle type"><input className="input" value={form.v.type} onChange={(e) => setForm({ ...form, v: { ...form.v!, type: e.target.value } })} /></Field>
            <Field label="Make"><input className="input" value={form.v.make} onChange={(e) => setForm({ ...form, v: { ...form.v!, make: e.target.value } })} /></Field>
            <Field label="Model"><input className="input" value={form.v.model} onChange={(e) => setForm({ ...form, v: { ...form.v!, model: e.target.value } })} /></Field>
            <Field label="Year"><input type="number" className="input" value={form.v.year} onChange={(e) => setForm({ ...form, v: { ...form.v!, year: Number(e.target.value) } })} /></Field>
            <Field label="Color"><input className="input" value={form.v.color} onChange={(e) => setForm({ ...form, v: { ...form.v!, color: e.target.value } })} /></Field>
            <Field label="Seating capacity" req><input type="number" min={1} className="input" value={form.v.seats} onChange={(e) => setForm({ ...form, v: { ...form.v!, seats: Math.max(1, Number(e.target.value)) } })} /></Field>
            <Field label="Mileage (km)"><input type="number" min={0} className="input" value={form.v.mileage} onChange={(e) => setForm({ ...form, v: { ...form.v!, mileage: Math.max(0, Number(e.target.value)) } })} /></Field>
            <Field label="Status">
              <select className="input" value={form.v.status} onChange={(e) => setForm({ ...form, v: { ...form.v!, status: e.target.value as VehicleStatus } })}>
                {Object.entries(VEHICLE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Field>
            <Field label="Assigned driver">
              <select className="input" value={form.v.driverId ?? ""} onChange={(e) => setForm({ ...form, v: { ...form.v!, driverId: e.target.value || null } })}>
                <option value="">— none —</option>
                {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
            <Field label="Insurance expiry"><input type="date" className="input" value={form.v.insuranceExpiry} onChange={(e) => setForm({ ...form, v: { ...form.v!, insuranceExpiry: e.target.value } })} /></Field>
            <Field label="Registration expiry"><input type="date" className="input" value={form.v.regExpiry} onChange={(e) => setForm({ ...form, v: { ...form.v!, regExpiry: e.target.value } })} /></Field>
            <Field label="Permit expiry"><input type="date" className="input" value={form.v.permitExpiry} onChange={(e) => setForm({ ...form, v: { ...form.v!, permitExpiry: e.target.value } })} /></Field>
            <Field label="Last service"><input type="date" className="input" value={form.v.lastService} onChange={(e) => setForm({ ...form, v: { ...form.v!, lastService: e.target.value } })} /></Field>
            <Field label="Next service"><input type="date" className="input" value={form.v.nextService} onChange={(e) => setForm({ ...form, v: { ...form.v!, nextService: e.target.value } })} /></Field>
            <Field label="Notes"><input className="input" value={form.v.notes} onChange={(e) => setForm({ ...form, v: { ...form.v!, notes: e.target.value } })} /></Field>
          </div>
        </Modal>
      )}

      {inspOpen && <InspectionForm vehicleId={inspOpen} onClose={() => setInspOpen(null)} onDone={(rec) => {
        mutate((d) => { d.inspections.unshift(rec); });
        audit("vehicle.inspection", "Vehicle", inspOpen, rec.passed ? "Daily inspection passed" : "Inspection flagged items");
        toast(rec.passed ? "Inspection passed ✓" : "Inspection saved — items flagged for attention.", rec.passed ? "success" : "info");
        setInspOpen(null);
      }} />}
    </div>
  );
}

const KV = ({ k, v, warn }: { k: string; v: string; warn?: boolean }) => (
  <div><p className="text-[10px] font-extrabold uppercase tracking-wider text-ink-400">{k}</p><p className={cx("font-bold", warn ? "text-clay-600" : "text-ink-800")}>{v}{warn && <AlertTriangle size={11} className="inline ml-1" />}</p></div>
);

function InspectionForm({ vehicleId, onClose, onDone }: { vehicleId: ID; onClose: () => void; onDone: (i: Inspection) => void }) {
  const { db, user } = useStore();
  const v = db.vehicles.find((x) => x.id === vehicleId)!;
  const [items, setItems] = useState(INSPECTION_ITEMS.map((i) => ({ ...i, ok: true, note: "" })));
  const passed = items.every((i) => i.ok);
  return (
    <Modal open onClose={onClose} title="Daily vehicle inspection" sub={`${v.plate} · ${v.make} ${v.model} · ${fmtDateShort(todayISO())}`} size="lg"
      footer={<><button className="btn btn-outline" onClick={onClose}>Cancel</button>
        <button className={cx("btn", passed ? "btn-success" : "btn-dark")} onClick={() => onDone({ id: uid(), tenantId: v.tenantId, vehicleId, date: todayISO(), by: user!.name, items: items.map(({ note, ...it }) => ({ ...it, note: note || undefined })), passed })}>
          <ClipboardCheck size={14} />Save inspection
        </button></>}>
      <div className="space-y-2">
        {items.map((it, idx) => (
          <div key={it.key} className="flex items-center gap-3 rounded-xl border border-sand-200 bg-white/70 p-2.5">
            <span className={cx("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", it.ok ? "bg-moss-100 text-moss-600" : "bg-clay-100 text-clay-600")}>
              {it.key === "fuel" ? <Fuel size={15} /> : it.key === "engine" ? <Wrench size={15} /> : it.key === "tires" ? <Gauge size={15} /> : <CalendarClock size={15} />}
            </span>
            <div className="grow">
              <p className="text-sm font-extrabold text-ink-800">{it.label}</p>
              {!it.ok && <input className="input mt-1 py-1 text-xs" placeholder="What's wrong?" value={it.note} onChange={(e) => setItems(items.map((x, j) => j === idx ? { ...x, note: e.target.value } : x))} />}
            </div>
            <Toggle on={it.ok} onChange={(v2) => setItems(items.map((x, j) => j === idx ? { ...x, ok: v2 } : x))} />
          </div>
        ))}
        <p className={cx("text-sm font-extrabold", passed ? "text-moss-600" : "text-clay-600")}>{passed ? "All checks passed — vehicle is safari-ready." : `${items.filter((i) => !i.ok).length} item(s) flagged for the workshop.`}</p>
      </div>
    </Modal>
  );
}
void money; void Bar;
