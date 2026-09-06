import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock, Flag, MapPin, MessageCircle, Navigation, Phone, Users, XCircle } from "lucide-react";
import { useStore, useTenant } from "../lib/store";
import type { Booking, BookingStatus, ID, Trip, TripStatus } from "../lib/types";
import { guestsOf, payStatusOf } from "../lib/data";
import { BOOKING_STATUS, PAY_STATUS, TRIP_STATUS, addDaysISO, cx, fmtClock, fmtDate, fmtDateShort, fmtDateTime, fmtWeekday, todayISO } from "../lib/utils";
import { Drawer, EmptyState, Field, SearchBox, StatusPill, Tabs } from "../components/ui";

const TRIP_FLOW: TripStatus[] = ["scheduled", "driver_assigned", "on_the_way", "arrived", "guests_picked_up", "safari_started", "safari_completed", "dropped_off", "completed"];

// Deterministic pin placement for the pickup route map
const hashPos = (s: string, i: number) => {
  let h = 7;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 9973;
  const x = 110 + ((h * 13 + i * 97) % 560);
  const y = 80 + ((h * 7 + i * 61) % 240);
  return { x, y };
};

// ─── Calendar ───────────────────────────────────────────────────────────────
export function CalendarPage() {
  const { db, user, setRoute, assignFleet, toast } = useStore();
  const bookings = useTenant(db.bookings).filter((b) => !["cancelled", "no_show"].includes(b.status));
  const packages = useTenant(db.packages);
  const customers = useTenant(db.customers);
  const vehicles = useTenant(db.vehicles);
  const drivers = useTenant(db.drivers);
  const [view, setView] = useState("month");
  const [cursor, setCursor] = useState(todayISO());
  const [sel, setSel] = useState<Booking | null>(null);
  const [veh, setVeh] = useState(""); const [drv, setDrv] = useState("");
  const role = user!.role;

  useEffect(() => { if (sel) { setVeh(sel.vehicleId ?? ""); setDrv(sel.driverId ?? ""); } }, [sel?.id]);

  const monthDays = useMemo(() => {
    const first = new Date(cursor + "T12:00:00"); first.setDate(1);
    const startOffset = first.getDay();
    const start = addDaysISO(-startOffset, cursor.slice(0, 8) + "01");
    return Array.from({ length: 42 }).map((_, i) => addDaysISO(i, start));
  }, [cursor]);

  const shift = (dir: number) => {
    const d = new Date(cursor + "T12:00:00");
    if (view === "month") d.setMonth(d.getMonth() + dir); else d.setDate(d.getDate() + dir * (view === "week" ? 7 : 1));
    setCursor(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  };

  const weekDays = useMemo(() => {
    const d = new Date(cursor + "T12:00:00"); const wd = d.getDay();
    return Array.from({ length: 7 }).map((_, i) => addDaysISO(i - wd, cursor));
  }, [cursor]);

  const monthLabel = new Date(cursor + "T12:00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const byDate = (d: string) => bookings.filter((b) => b.date === d).sort((a, b) => a.pickupTime.localeCompare(b.pickupTime));

  const Chip = ({ b, full }: { b: Booking; full?: boolean }) => {
    const p = packages.find((x) => x.id === b.packageId);
    return (
      <button onClick={(e) => { e.stopPropagation(); setSel(b); }}
        className="w-full text-left rounded-md px-1.5 py-1 text-[10px] font-extrabold text-white truncate transition-transform hover:scale-[1.03] cursor-pointer shadow-sm"
        style={{ background: p?.accent ?? "#a87520" }}>
        {b.pickupTime} {full ? `· ${customers.find((c) => c.id === b.customerId)?.name ?? ""} · ${guestsOf(b)} pax` : customers.find((c) => c.id === b.customerId)?.name?.split(" ")[0] ?? ""}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Tabs tabs={[{ id: "day", label: "Day" }, { id: "week", label: "Week" }, { id: "month", label: "Month" }]} val={view} onChange={setView} />
        <div className="grow" />
        <div className="flex items-center gap-1">
          <button className="btn btn-outline btn-sm" onClick={() => shift(-1)}><ChevronLeft size={15} /></button>
          <button className="btn btn-dark btn-sm" onClick={() => setCursor(todayISO())}>Today</button>
          <button className="btn btn-outline btn-sm" onClick={() => shift(1)}><ChevronRight size={15} /></button>
        </div>
        <span className="font-display font-bold text-lg text-ink-900 min-w-[160px] text-center">{view === "month" ? monthLabel : fmtDate(view === "day" ? cursor : weekDays[0])}</span>
      </div>

      {view === "month" && (
        <div className="card overflow-hidden anim-rise">
          <div className="grid grid-cols-7 bg-sand-100/80 border-b border-sand-200">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <p key={d} className="th text-center py-2">{d}</p>)}
          </div>
          <div className="grid grid-cols-7">
            {monthDays.map((d, i) => {
              const inMonth = d.slice(0, 7) === cursor.slice(0, 7);
              const items = byDate(d);
              const isToday = d === todayISO();
              return (
                <div key={i} className={cx("min-h-[104px] border-b border-r border-sand-100 p-1.5 space-y-1", !inMonth && "bg-sand-50/70 opacity-55", isToday && "bg-gold-200/25")}>
                  <p className={cx("text-[11px] font-extrabold w-6 h-6 flex items-center justify-center rounded-full", isToday ? "bg-ink-900 text-gold-300" : "text-ink-500")}>{Number(d.slice(8))}</p>
                  {items.slice(0, 3).map((b) => <Chip key={b.id} b={b} />)}
                  {items.length > 3 && <button onClick={() => { setCursor(d); setView("day"); }} className="text-[10px] font-extrabold text-gold-700 hover:underline cursor-pointer">+{items.length - 3} more</button>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(view === "week" || view === "day") && (
        <div className={cx("grid gap-3", view === "week" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-7" : "grid-cols-1")}>
          {(view === "week" ? weekDays : [cursor]).map((d) => {
            const items = byDate(d);
            return (
              <div key={d} className={cx("card p-3 anim-rise", d === todayISO() && "ring-2 ring-gold-400")}>
                <p className="font-display font-bold text-ink-900 text-sm">{fmtWeekday(d)} {fmtDateShort(d)}{d === todayISO() && <span className="chip bg-ink-900 text-gold-300 ml-1.5">today</span>}</p>
                <div className="mt-2 space-y-1.5">
                  {items.map((b) => <Chip key={b.id} b={b} full />)}
                  {items.length === 0 && <p className="text-[11px] font-semibold text-ink-300 py-2 text-center">No safaris</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Drawer open={!!sel} onClose={() => setSel(null)} title={sel?.code ?? ""} sub={sel ? `${fmtDate(sel.date)} · ${fmtClock(sel.pickupTime)} · ${customers.find((c) => c.id === sel.customerId)?.name}` : ""}>
        {sel && (
          <div className="space-y-4">
            <div className="card p-4 text-sm space-y-1.5 font-semibold text-ink-700">
              <p className="flex items-center gap-2"><Flag size={14} className="text-gold-600" />{packages.find((p) => p.id === sel.packageId)?.name}</p>
              <p className="flex items-center gap-2"><MapPin size={14} className="text-gold-600" />{sel.pickupLocation}</p>
              <p className="flex items-center gap-2"><Users size={14} className="text-gold-600" />{guestsOf(sel)} guests ({sel.adults}A · {sel.children}C)</p>
              <p className="flex items-center gap-2"><Clock size={14} className="text-gold-600" />Pickup {fmtClock(sel.pickupTime)}</p>
            </div>
            {(role === "admin" || role === "ops") && !["completed"].includes(sel.status) && (
              <div className="card p-4">
                <h4 className="font-display font-bold text-ink-900 mb-2">Quick reassign</h4>
                <div className="space-y-2.5">
                  <Field label="Vehicle"><select className="input" value={veh} onChange={(e) => setVeh(e.target.value)}><option value="">— none —</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate} · {v.seats} seats</option>)}</select></Field>
                  <Field label="Driver"><select className="input" value={drv} onChange={(e) => setDrv(e.target.value)}><option value="">— none —</option>{drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
                  <button className="btn btn-dark btn-sm w-full" onClick={() => { const err = assignFleet(sel.id, veh || null, drv || null); if (err) toast(err, "error"); else { toast("Assignment saved ✓"); setSel({ ...sel, vehicleId: veh || null, driverId: drv || null }); } }}>Save assignment</button>
                </div>
              </div>
            )}
            <button className="btn btn-outline btn-sm w-full" onClick={() => setRoute({ page: "bookings", params: { open: sel.id } })}>Open full booking →</button>
          </div>
        )}
      </Drawer>
    </div>
  );
}

// ─── Ops board (Kanban) ─────────────────────────────────────────────────────
const COLS: { id: string; label: string; statuses: BookingStatus[]; hint: string }[] = [
  { id: "new", label: "New", statuses: ["inquiry", "pending"], hint: "Inquiries & pending" },
  { id: "confirmed", label: "Confirmed", statuses: ["confirmed", "paid"], hint: "Ready to assign" },
  { id: "assigned", label: "Driver Assigned", statuses: ["assigned"], hint: "Fleet locked" },
  { id: "pickup", label: "Pickup", statuses: ["pickup"], hint: "Driver en route" },
  { id: "safari", label: "Safari", statuses: ["in_progress"], hint: "In the dunes" },
  { id: "done", label: "Completed", statuses: ["completed"], hint: "Today & recent" },
];

export function OpsBoard() {
  const { db, user, setRoute, setBookingStatus, toast } = useStore();
  const today = todayISO();
  const bookings = useTenant(db.bookings);
  const customers = useTenant(db.customers);
  const packages = useTenant(db.packages);
  const vehicles = useTenant(db.vehicles);
  const drivers = useTenant(db.drivers);
  const role = user!.role;
  const [dragId, setDragId] = useState<ID | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  const active = bookings.filter((b) => !["cancelled", "no_show"].includes(b.status));
  const colItems = (col: (typeof COLS)[number]) =>
    active.filter((b) => col.statuses.includes(b.status) && (col.id === "done" ? b.date >= addDaysISO(-2) : b.date >= today))
      .sort((a, b) => a.date.localeCompare(b.date) || a.pickupTime.localeCompare(b.pickupTime));

  const drop = (colId: string) => {
    const b = bookings.find((x) => x.id === dragId);
    setOverCol(null); setDragId(null);
    if (!b || role === "sales") return;
    const col = COLS.find((c) => c.id === colId)!;
    if (col.statuses.includes(b.status)) return;
    if (colId === "assigned" && !b.driverId) { toast("Assign a driver first — open the booking from the board.", "error"); setRoute({ page: "bookings", params: { open: b.id } }); return; }
    if (colId === "new" && b.driverId) { toast("Release the driver before moving back to New.", "error"); return; }
    const target = col.statuses[0];
    setBookingStatus(b.id, target);
    toast(`${b.code} → ${col.label}`, "info");
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-ink-500">Drag bookings across stages. Statuses sync with the booking record — completed and cancelled never appear here. {role === "sales" && <span className="text-clay-600 font-bold">Sales role has read-only board access.</span>}</p>
      <div className="overflow-x-auto pb-2 -mx-4 sm:mx-0 px-4 sm:px-0">
        <div className="flex gap-3 min-w-[1180px]">
          {COLS.map((col) => {
            const items = colItems(col);
            return (
              <div key={col.id}
                onDragOver={(e) => { e.preventDefault(); setOverCol(col.id); }}
                onDragLeave={() => setOverCol((c) => (c === col.id ? null : c))}
                onDrop={() => drop(col.id)}
                className={cx("w-[228px] shrink-0 rounded-xl border p-2 transition-all", overCol === col.id ? "bg-gold-200/40 border-gold-400" : "bg-sand-200/50 border-sand-300/60")}>
                <div className="flex items-center justify-between px-1.5 py-1 mb-1.5">
                  <p className="font-display font-bold text-[15px] text-ink-900">{col.label}</p>
                  <span className="text-[11px] font-extrabold text-ink-400 bg-white/70 rounded-full px-2 py-0.5">{items.length}</span>
                </div>
                <p className="px-1.5 text-[10px] font-bold text-ink-400 uppercase tracking-wide mb-2">{col.hint}</p>
                <div className="space-y-2 min-h-[80px]">
                  {items.map((b) => {
                    const p = packages.find((x) => x.id === b.packageId);
                    const ps = payStatusOf(db, b);
                    return (
                      <div key={b.id} draggable={role !== "sales"} onDragStart={() => setDragId(b.id)}
                        onClick={() => setRoute({ page: "bookings", params: { open: b.id } })}
                        className="card p-3 hover:shadow-float hover:-translate-y-0.5 transition-all cursor-pointer anim-rise border-t-4" style={{ borderTopColor: p?.accent ?? "#a87520" }}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-mono text-[11px] font-bold text-gold-700">{b.code}</p>
                          <StatusPill {...PAY_STATUS[ps]} />
                        </div>
                        <p className="font-extrabold text-[14px] text-ink-900 mt-1">{customers.find((c) => c.id === b.customerId)?.name ?? "Guest"}</p>
                        <p className="text-[11px] font-bold text-ink-500 mt-0.5 flex items-center gap-1"><Users size={11} />{guestsOf(b)} · {p?.name?.split(" ").slice(0, 2).join(" ")}</p>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-sand-100 text-[11px] font-bold text-ink-500">
                          <span className="flex items-center gap-1"><Clock size={11} />{b.date === today ? fmtClock(b.pickupTime) : fmtDateShort(b.date) + " " + b.pickupTime}</span>
                          <span className="text-right">{vehicles.find((v) => v.id === b.vehicleId)?.plate ?? <span className="text-clay-500">no vehicle</span>}<span className="block text-ink-400">{drivers.find((d) => d.id === b.driverId)?.name.split(" ")[0] ?? "no driver"}</span></span>
                        </div>
                      </div>
                    );
                  })}
                  {items.length === 0 && <p className="text-[11px] font-semibold text-ink-300 text-center py-5 border-2 border-dashed border-sand-300 rounded-xl">Drop here</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Pickups ────────────────────────────────────────────────────────────────
export function Pickups() {
  const { db, user, setRoute, advanceTrip, setBookingStatus, toast } = useStore();
  const bookings = useTenant(db.bookings);
  const customers = useTenant(db.customers);
  const packages = useTenant(db.packages);
  const vehicles = useTenant(db.vehicles);
  const drivers = useTenant(db.drivers);
  const trips = useTenant(db.trips);
  const [date, setDate] = useState(todayISO());
  const [view, setView] = useState<"list" | "map">("list");
  const [mapSel, setMapSel] = useState<ID | null>(null);

  const items = useMemo(() => bookings
    .filter((b) => b.date === date && !["cancelled", "no_show", "completed", "inquiry"].includes(b.status))
    .sort((a, b) => a.pickupTime.localeCompare(b.pickupTime)), [bookings, date]);

  const weekStrip = useMemo(() => Array.from({ length: 7 }).map((_, i) => {
    const d = addDaysISO(i);
    return { d, n: bookings.filter((b) => b.date === d && !["cancelled", "no_show", "completed", "inquiry"].includes(b.status)).length };
  }), [bookings]);

  const selB = mapSel ? items.find((b) => b.id === mapSel) : null;

  return (
    <div className="space-y-4">
      {/* Week strip — calendar view */}
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5">
        {weekStrip.map(({ d, n }) => (
          <button key={d} onClick={() => setDate(d)}
            className={cx("card px-1 py-2 text-center transition-all cursor-pointer hover:-translate-y-0.5",
              d === date ? "ring-2 ring-gold-500 bg-gold-200/30" : "hover:shadow-float", d === todayISO() && d !== date && "border-gold-300")}>
            <p className="text-[10px] font-extrabold uppercase tracking-wide text-ink-400">{fmtWeekday(d)}</p>
            <p className={cx("font-display font-black text-lg leading-tight", d === date ? "text-gold-700" : "text-ink-900")}>{Number(d.slice(8))}</p>
            <p className={cx("text-[10px] font-extrabold", n > 0 ? "text-oasis-600" : "text-ink-300")}>{n > 0 ? `${n} pickup${n > 1 ? "s" : ""}` : "—"}</p>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2.5 flex-wrap">
        <Tabs tabs={[{ id: "list", label: "Run sheet" }, { id: "map", label: "Route map" }]} val={view} onChange={(v) => setView(v as "list" | "map")} />
        <input type="date" className="input w-auto font-bold" value={date} onChange={(e) => setDate(e.target.value)} />
        <button className="btn btn-dark btn-sm" onClick={() => setDate(todayISO())}>Today</button>
        <span className="text-xs font-bold text-ink-500 hidden sm:inline">{items.length} pickups · sorted by time</span>
        <div className="grow" />
        <a className="btn btn-outline btn-sm" target="_blank" rel="noreferrer" href="https://www.google.com/maps/search/desert+safari+pickup+dubai"><Navigation size={14} />Open area map</a>
      </div>

      {view === "map" && (
        <div className="card overflow-hidden anim-rise">
          <div className="relative">
            <svg viewBox="0 0 800 420" className="w-full h-auto block" role="img" aria-label="Pickup route map">
              <defs>
                <linearGradient id="mapsky" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f3ecdb" /><stop offset="100%" stopColor="#e9ddc2" />
                </linearGradient>
              </defs>
              <rect width="800" height="420" fill="url(#mapsky)" />
              <path d="M0 300 Q 150 250 300 285 T 620 275 T 800 295 V420 H0 Z" fill="#dbc9a2" />
              <path d="M0 340 Q 200 300 400 330 T 800 325 V420 H0 Z" fill="#c9ae77" />
              <path d="M0 385 Q 250 350 500 375 T 800 365 V420 H0 Z" fill="#b69355" />
              <circle cx="712" cy="64" r="26" fill="#dcae4f" opacity="0.9" />
              <circle cx="712" cy="64" r="38" fill="#dcae4f" opacity="0.2" />
              {/* road from city depot to desert camp */}
              <path d="M40 400 C 160 360 240 300 340 270 S 560 210 700 150" fill="none" stroke="#8a7a55" strokeWidth="7" strokeLinecap="round" opacity="0.55" />
              <path d="M40 400 C 160 360 240 300 340 270 S 560 210 700 150" fill="none" stroke="#faf7ef" strokeWidth="2" strokeDasharray="10 12" strokeLinecap="round" />
              {/* depot + camp markers */}
              <g transform="translate(40 400)">
                <rect x="-16" y="-26" width="32" height="26" rx="5" fill="#1e1811" />
                <rect x="-10" y="-20" width="8" height="8" rx="1.5" fill="#dcae4f" />
                <rect x="2" y="-20" width="8" height="8" rx="1.5" fill="#dcae4f" />
                <text y="16" textAnchor="middle" fontSize="11" fontWeight="800" fill="#3c3021" fontFamily="Manrope">Depot · DXB</text>
              </g>
              <g transform="translate(700 150)">
                <path d="M-22 0 Q 0 -34 22 0 Z" fill="#a87520" />
                <path d="M-10 0 Q 0 -16 10 0 Z" fill="#f3ecdb" />
                <text y="18" textAnchor="middle" fontSize="11" fontWeight="800" fill="#3c3021" fontFamily="Manrope">Desert Camp</text>
              </g>
              {/* pickup pins */}
              {items.map((b, i) => {
                const { x, y } = hashPos(b.pickupLocation, i);
                const t = trips.find((tt) => tt.bookingId === b.id);
                const tone = !t ? "#93825f" : t.status === "on_the_way" ? "#2f7e76" : t.status === "arrived" ? "#46558c" : ["guests_picked_up", "safari_started", "safari_completed", "dropped_off", "completed"].includes(t.status) ? "#3c6447" : "#c8912f";
                const sel = mapSel === b.id;
                return (
                  <g key={b.id} transform={`translate(${x} ${y})`} onClick={() => setMapSel(sel ? null : b.id)} className="cursor-pointer" style={{ transition: "transform .2s" }}>
                    {sel && <circle r="22" fill={tone} opacity="0.18" />}
                    <path d="M0 6 C -11 -6 -9 -22 0 -22 C 9 -22 11 -6 0 6 Z" fill={tone} stroke="#faf7ef" strokeWidth="2" transform={sel ? "scale(1.25)" : undefined} style={{ transition: "transform .15s" }} />
                    <text y="-9" textAnchor="middle" fontSize="10" fontWeight="900" fill="#fff" fontFamily="Manrope" transform={sel ? "scale(1.25)" : undefined}>{i + 1}</text>
                    <title>{`${b.pickupTime} · ${customers.find((c) => c.id === b.customerId)?.name ?? ""} · ${b.pickupLocation}`}</title>
                  </g>
                );
              })}
            </svg>
            {items.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center"><p className="chip bg-ink-900 text-gold-300">No pickups to plot on {fmtDate(date)}</p></div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 border-t border-sand-200 bg-sand-50">
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-ink-400">Legend</span>
            {[["#c8912f", "Awaiting pickup"], ["#2f7e76", "On the way"], ["#46558c", "Arrived"], ["#3c6447", "Picked up / on safari"], ["#93825f", "Not yet assigned"]].map(([c, l]) => (
              <span key={l} className="flex items-center gap-1.5 text-[11px] font-bold text-ink-600"><span className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />{l}</span>
            ))}
            <span className="grow" />
            <span className="text-[11px] font-bold text-ink-400">Tap a pin for actions</span>
          </div>
          {selB && (() => {
            const c = customers.find((x) => x.id === selB.customerId);
            const p = packages.find((x) => x.id === selB.packageId);
            const v = vehicles.find((x) => x.id === selB.vehicleId);
            const d = drivers.find((x) => x.id === selB.driverId);
            const phone = (c?.phone ?? "").replace(/\s/g, "");
            const wa = (c?.whatsapp || c?.phone || "").replace(/[^\d]/g, "");
            return (
              <div className="px-4 py-3.5 border-t border-sand-200 bg-gold-200/15 anim-fade">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="grow min-w-[220px]">
                    <p className="font-extrabold text-ink-900">{items.indexOf(selB) + 1}. {c?.name} <span className="chip bg-sand-200 text-ink-600 ml-1">{fmtClock(selB.pickupTime)}</span></p>
                    <p className="text-[12px] font-bold text-ink-500 mt-0.5 flex items-center gap-1.5"><MapPin size={12} className="text-gold-600" />{selB.pickupLocation} · {p?.name} · {guestsOf(selB)} guests · {v?.plate ?? "vehicle TBC"} · {d?.name ?? "driver TBC"}</p>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    <a className="btn btn-outline btn-sm" href={`tel:${phone}`}><Phone size={13} />Call</a>
                    <a className="btn btn-success btn-sm" target="_blank" rel="noreferrer" href={`https://wa.me/${wa}`}><MessageCircle size={13} />Chat</a>
                    <a className="btn btn-dark btn-sm" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(selB.pickupLocation + ", Dubai, UAE")}`}><Navigation size={13} />Navigate</a>
                    <button className="btn btn-primary btn-sm" onClick={() => setRoute({ page: "bookings", params: { open: selB.id } })}>Booking →</button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {view === "list" && (items.length === 0 ? (
        <div className="card"><EmptyState title={`No pickups on ${fmtDate(date)}`} body="Confirmed and assigned bookings with a pickup time appear here for the daily run sheet." /></div>
      ) : (
        <div className="space-y-3">
          {items.map((b) => {
            const c = customers.find((x) => x.id === b.customerId);
            const p = packages.find((x) => x.id === b.packageId);
            const v = vehicles.find((x) => x.id === b.vehicleId);
            const d = drivers.find((x) => x.id === b.driverId);
            const trip = trips.find((t) => t.bookingId === b.id);
            const phone = (c?.phone ?? "").replace(/\s/g, "");
            const wa = (c?.whatsapp || c?.phone || "").replace(/[^\d]/g, "");
            return (
              <div key={b.id} className="card p-4 anim-rise border-l-4" style={{ borderLeftColor: p?.accent ?? "#a87520" }}>
                <div className="flex flex-wrap items-start gap-4">
                  <div className="w-20 text-center shrink-0">
                    <p className="font-display font-black text-xl text-ink-900">{b.pickupTime}</p>
                    <p className="text-[10px] font-extrabold uppercase tracking-wide text-ink-400">{fmtClock(b.pickupTime).slice(-2)}</p>
                  </div>
                  <div className="grow min-w-[200px]">
                    <p className="font-extrabold text-ink-900">{c?.name} <span className="chip bg-sand-100 text-ink-600 ml-1"><Users size={10} />{guestsOf(b)}</span></p>
                    <p className="text-sm font-semibold text-ink-500 flex items-center gap-1.5 mt-0.5"><MapPin size={13} className="text-gold-600" />{b.pickupLocation}{b.pickupAddress ? ` — ${b.pickupAddress}` : ""}</p>
                    <p className="text-[12px] font-bold text-ink-400 mt-1">{p?.name} · {v ? `${v.plate} (${v.model})` : "vehicle TBC"} · {d?.name ?? "driver TBC"}</p>
                    {b.specialReq && <p className="text-[12px] font-bold text-gold-700 mt-1">📝 {b.specialReq}</p>}
                    {trip && <div className="mt-1.5"><StatusPill {...TRIP_STATUS[trip.status]} /></div>}
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <span className="flex gap-1.5">
                      <a className="btn btn-outline btn-sm" href={`tel:${phone}`}><Phone size={13} />Call</a>
                      <a className="btn btn-success btn-sm" target="_blank" rel="noreferrer" href={`https://wa.me/${wa}`}><MessageCircle size={13} />Chat</a>
                      <a className="btn btn-dark btn-sm" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(b.pickupLocation + ", Dubai, UAE")}`}><Navigation size={13} />Navigate</a>
                    </span>
                    <span className="flex gap-1.5 justify-end flex-wrap">
                      {trip && ["driver_assigned"].includes(trip.status) && <button className="btn btn-primary btn-sm" onClick={() => { advanceTrip(trip.id, "on_the_way"); toast(`Driver en route to ${c?.name?.split(" ")[0]} ✓`); }}>On the way</button>}
                      {trip && trip.status === "on_the_way" && <button className="btn btn-primary btn-sm" onClick={() => { advanceTrip(trip.id, "arrived"); toast("Marked arrived at pickup ✓"); }}>Arrived</button>}
                      {trip && ["arrived", "on_the_way"].includes(trip.status) && <button className="btn btn-success btn-sm" onClick={() => { advanceTrip(trip.id, "guests_picked_up"); toast("Guests picked up — have a great safari! 🌇"); }}>Picked up</button>}
                      {!["completed", "in_progress"].includes(b.status) && (user!.role === "admin" || user!.role === "ops") && (
                        <button className="btn btn-outline btn-sm text-clay-600" onClick={() => { setBookingStatus(b.id, "no_show"); toast("Marked as no-show", "info"); }}><XCircle size={13} />No show</button>
                      )}
                      <button className="btn btn-ghost btn-sm" onClick={() => setRoute({ page: "bookings", params: { open: b.id } })}>Booking →</button>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── Trips ──────────────────────────────────────────────────────────────────
export function Trips() {
  const { db, user, setRoute, advanceTrip, mutate, toast } = useStore();
  const trips = useTenant(db.trips);
  const bookings = useTenant(db.bookings);
  const customers = useTenant(db.customers);
  const drivers = useTenant(db.drivers);
  const vehicles = useTenant(db.vehicles);
  const [filter, setFilter] = useState("active");
  const [sel, setSel] = useState<ID | null>(null);
  const [notes, setNotes] = useState("");

  const list = useMemo(() => trips
    .filter((t) => bookings.some((b) => b.id === t.bookingId))
    .filter((t) => filter === "active" ? t.status !== "completed" : filter === "done" ? t.status === "completed" : true)
    .sort((a, b) => b.id.localeCompare(a.id)), [trips, bookings, filter]);

  const selT = sel ? trips.find((t) => t.id === sel) : null;
  useEffect(() => { if (selT) setNotes(selT.notes); }, [sel]);
  const role = user!.role;
  const canDrive = role === "admin" || role === "ops";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5 flex-wrap">
        <Tabs tabs={[{ id: "active", label: "Active", badge: trips.filter((t) => t.status !== "completed" && bookings.some((b) => b.id === t.bookingId)).length }, { id: "done", label: "Completed" }, { id: "all", label: "All history" }]} val={filter} onChange={setFilter} />
      </div>
      <div className="card overflow-hidden anim-rise">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead className="bg-sand-100/70"><tr>
              <th className="th">Trip</th><th className="th">Booking</th><th className="th">Guest</th><th className="th">Driver</th><th className="th">Vehicle</th><th className="th">Started</th><th className="th">Ended</th><th className="th">Status</th>
            </tr></thead>
            <tbody>
              {list.map((t) => {
                const b = bookings.find((x) => x.id === t.bookingId)!;
                return (
                  <tr key={t.id} onClick={() => setSel(t.id)} className="border-t border-sand-100 hover:bg-sand-50 cursor-pointer transition-colors">
                    <td className="td font-mono font-bold text-gold-700 text-[13px]">TR-{t.id.slice(0, 6).toUpperCase()}</td>
                    <td className="td font-bold">{b.code}<span className="block text-[11px] font-semibold text-ink-400">{fmtDate(b.date)} · {b.pickupTime}</span></td>
                    <td className="td font-bold text-ink-900">{customers.find((c) => c.id === b.customerId)?.name}</td>
                    <td className="td font-semibold">{drivers.find((d) => d.id === t.driverId)?.name ?? "—"}</td>
                    <td className="td font-semibold">{vehicles.find((v) => v.id === t.vehicleId)?.plate ?? "—"}</td>
                    <td className="td font-semibold text-ink-500">{t.startAt ? fmtDateTime(t.startAt) : "—"}</td>
                    <td className="td font-semibold text-ink-500">{t.endAt ? fmtDateTime(t.endAt) : "—"}</td>
                    <td className="td"><StatusPill {...TRIP_STATUS[t.status]} /></td>
                  </tr>
                );
              })}
              {list.length === 0 && <tr><td colSpan={8}><EmptyState title="No trips in this view" body="Trips are created automatically when a driver is assigned to a booking." /></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Drawer open={!!selT} onClose={() => setSel(null)} wide title={selT ? `Trip TR-${selT.id.slice(0, 6).toUpperCase()}` : ""} sub={selT ? (() => { const b = bookings.find((x) => x.id === selT.bookingId); return `${b?.code} · ${fmtDate(b?.date ?? "")} · ${customers.find((c) => c.id === b?.customerId)?.name}`; })() : ""}>
        {selT && (() => {
          const b = bookings.find((x) => x.id === selT.bookingId);
          const idx = TRIP_FLOW.indexOf(selT.status);
          return (
            <div className="space-y-4">
              <div className="card p-4">
                <h4 className="font-display font-bold text-ink-900 mb-3">Trip timeline</h4>
                <div className="space-y-0">
                  {TRIP_FLOW.map((s, i) => (
                    <div key={s} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span className={cx("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0", i < idx ? "bg-moss-600 text-white" : i === idx ? "bg-gold-500 text-ink-950 ring-4 ring-gold-200" : "bg-sand-200 text-ink-400")}>
                          {i < idx ? <Check size={12} /> : i + 1}
                        </span>
                        {i < TRIP_FLOW.length - 1 && <span className={cx("w-0.5 grow min-h-[18px]", i < idx ? "bg-moss-500" : "bg-sand-200")} />}
                      </div>
                      <p className={cx("pb-3 text-sm font-bold", i <= idx ? "text-ink-900" : "text-ink-400")}>{TRIP_STATUS[s].label}{i === idx && <span className="chip bg-gold-200 text-gold-700 ml-2">now</span>}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card p-4">
                <h4 className="font-display font-bold text-ink-900 mb-2">Details</h4>
                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm font-semibold text-ink-700">
                  <p><span className="text-ink-400 text-[10px] font-extrabold uppercase block">Driver</span>{drivers.find((d) => d.id === selT.driverId)?.name}</p>
                  <p><span className="text-ink-400 text-[10px] font-extrabold uppercase block">Vehicle</span>{vehicles.find((v) => v.id === selT.vehicleId)?.plate}</p>
                  <p><span className="text-ink-400 text-[10px] font-extrabold uppercase block">Guests</span>{b ? guestsOf(b) : "—"} ({b?.adults}A · {b?.children}C)</p>
                  <p><span className="text-ink-400 text-[10px] font-extrabold uppercase block">Pickup</span>{b?.pickupLocation}</p>
                  <p><span className="text-ink-400 text-[10px] font-extrabold uppercase block">Start</span>{selT.startAt ? fmtDateTime(selT.startAt) : "—"}</p>
                  <p><span className="text-ink-400 text-[10px] font-extrabold uppercase block">End</span>{selT.endAt ? fmtDateTime(selT.endAt) : "—"}</p>
                </div>
                <Field label="Trip notes" className="mt-3">
                  <textarea className="input min-h-[70px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </Field>
                <button className="btn btn-outline btn-sm mt-2" onClick={() => { mutate((d) => { const t = d.trips.find((x) => x.id === selT.id); if (t) t.notes = notes; }); toast("Trip notes saved ✓"); }}>Save notes</button>
              </div>
              {canDrive && selT.status !== "completed" && (
                <div className="card p-4">
                  <h4 className="font-display font-bold text-ink-900 mb-2">Advance trip</h4>
                  <div className="flex flex-wrap gap-2">
                    {TRIP_FLOW.slice(idx + 1, idx + 2).map((s) => (
                      <button key={s} className="btn btn-primary" onClick={() => { advanceTrip(selT.id, s); toast(`Trip → ${TRIP_STATUS[s].label} ✓`); }}>Mark {TRIP_STATUS[s].label}</button>
                    ))}
                    {idx < TRIP_FLOW.length - 2 && (
                      <button className="btn btn-success" onClick={() => { advanceTrip(selT.id, "completed"); toast("Trip completed ✓"); }}>Skip to completed</button>
                    )}
                  </div>
                </div>
              )}
              {b && <button className="btn btn-outline btn-sm w-full" onClick={() => setRoute({ page: "bookings", params: { open: b.id } })}>Open booking {b.code} →</button>}
            </div>
          );
        })()}
      </Drawer>
    </div>
  );
}

void SearchBox;
