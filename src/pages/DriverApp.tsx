import { useMemo, useState } from "react";
import { CalendarDays, Check, ChevronDown, LogOut, MapPin, MessageCircle, Navigation, Phone, Star, Users, X } from "lucide-react";
import { useStore } from "../lib/store";
import type { Trip } from "../lib/types";
import { TRIP_STATUS, cx, fmtClock, fmtDate, fmtDateShort, todayISO } from "../lib/utils";
import { guestsOf } from "../lib/data";
import { Avatar, EmptyState, StatusPill } from "../components/ui";

const NEXT: Partial<Record<Trip["status"], { to: Trip["status"]; label: string }>> = {
  scheduled: { to: "on_the_way", label: "Start — On the way" },
  driver_assigned: { to: "on_the_way", label: "On the way" },
  on_the_way: { to: "arrived", label: "Arrived at pickup" },
  arrived: { to: "guests_picked_up", label: "Guests picked up" },
  guests_picked_up: { to: "safari_started", label: "Start safari" },
  safari_started: { to: "safari_completed", label: "Safari completed" },
  safari_completed: { to: "dropped_off", label: "Guests dropped off" },
  dropped_off: { to: "completed", label: "Complete trip" },
};

export default function DriverApp() {
  const { db, user, logout, advanceTrip, mutate, toast } = useStore();
  const driver = db.drivers.find((d) => d.id === user!.driverId) ?? db.drivers.find((d) => d.tenantId === user!.tenantId && d.name === user!.name);
  const trips = db.trips.filter((t) => t.driverId === driver?.id);
  const bookings = db.bookings.filter((b) => b.tenantId === user!.tenantId);
  const customers = db.customers;
  const vehicles = db.vehicles;
  const [openId, setOpenId] = useState<string | null>(null);
  const today = todayISO();

  const todayTrips = useMemo(() => trips
    .map((t) => ({ t, b: bookings.find((b) => b.id === t.bookingId) }))
    .filter((x) => x.b && x.b.date === today && x.b.status !== "cancelled")
    .sort((a, b) => a.b!.pickupTime.localeCompare(b.b!.pickupTime)), [trips, bookings, today]);

  const upcoming = useMemo(() => trips
    .map((t) => ({ t, b: bookings.find((b) => b.id === t.bookingId) }))
    .filter((x) => x.b && x.b.date > today && !["cancelled", "no_show"].includes(x.b.status))
    .sort((a, b) => a.b!.date.localeCompare(b.b!.date)).slice(0, 6), [trips, bookings, today]);

  const completedToday = todayTrips.filter((x) => x.t.status === "completed").length;

  if (!driver) return <div className="min-h-screen flex items-center justify-center p-6 dune-bg"><div className="card p-6 max-w-sm text-center"><p className="font-display font-bold text-lg">No driver profile linked</p><p className="text-sm text-ink-500 font-semibold mt-1">Ask your admin to link this login to a driver record.</p><button className="btn btn-dark mt-4" onClick={logout}>Sign out</button></div></div>;

  const vehicle = vehicles.find((v) => v.id === driver.vehicleId);

  return (
    <div className="min-h-screen dune-bg pb-24">
      {/* Header */}
      <div className="bg-ink-900 grain relative text-sand-50 px-4 pt-5 pb-14 rounded-b-3xl">
        <div className="flex items-center gap-3 max-w-xl mx-auto">
          <Avatar name={driver.name} size={44} color="#c8912f" />
          <div className="grow">
            <p className="font-display font-bold text-lg leading-tight">{driver.name}</p>
            <p className="text-[11px] font-bold text-gold-300 uppercase tracking-wider">{vehicle ? `${vehicle.plate} · ${vehicle.model}` : "No vehicle assigned"}</p>
          </div>
          <button className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors cursor-pointer" onClick={logout} aria-label="Sign out"><LogOut size={16} /></button>
        </div>
        <div className="flex items-center gap-2 mt-4 max-w-xl mx-auto">
          <div className="flex gap-1.5 grow bg-white/5 rounded-xl p-1">
            {(["available", "off_duty"] as const).map((s) => (
              <button key={s} onClick={() => { mutate((d) => { const x = d.drivers.find((y) => y.id === driver.id); if (x && !["on_trip", "assigned"].includes(x.status)) x.status = s; }); toast(s === "available" ? "You're available for trips ✓" : "Marked off duty", "info"); }}
                className={cx("grow py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-wide transition-all cursor-pointer",
                  driver.status === s ? (s === "available" ? "bg-moss-600 text-white" : "bg-ink-600 text-sand-100") : "text-sand-200/60")}>
                {s === "available" ? "● Available" : "○ Off duty"}
              </button>
            ))}
          </div>
          <span className="chip bg-gold-500 text-ink-950"><Star size={11} fill="currentColor" />{driver.rating}</span>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 -mt-8 space-y-4">
        {/* Today stats */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="card p-3 text-center"><p className="font-display font-black text-2xl text-ink-900">{todayTrips.length}</p><p className="text-[10px] font-extrabold uppercase tracking-wide text-ink-400">Trips today</p></div>
          <div className="card p-3 text-center"><p className="font-display font-black text-2xl text-moss-600">{completedToday}</p><p className="text-[10px] font-extrabold uppercase tracking-wide text-ink-400">Completed</p></div>
          <div className="card p-3 text-center"><p className="font-display font-black text-2xl text-ink-900">{driver.completedTrips}</p><p className="text-[10px] font-extrabold uppercase tracking-wide text-ink-400">All-time</p></div>
        </div>

        {/* Today's trips */}
        <div>
          <p className="font-display font-bold text-lg text-ink-900 flex items-center gap-2 mb-2"><CalendarDays size={17} className="text-gold-600" />Today's Trips</p>
          {todayTrips.length === 0 && (
            <div className="card"><EmptyState title="No trips assigned today" body="Relax in the shade — operations will assign your next safari here." /></div>
          )}
          <div className="space-y-3">
            {todayTrips.map(({ t, b }) => {
              const c = customers.find((x) => x.id === b!.customerId);
              const open = openId === t.id;
              const next = NEXT[t.status];
              const phone = (c?.phone ?? "").replace(/\s/g, "");
              const wa = (c?.whatsapp || c?.phone || "").replace(/[^\d]/g, "");
              const done = t.status === "completed";
              return (
                <div key={t.id} className={cx("card overflow-hidden anim-rise", done && "opacity-70")}>
                  <button className="w-full p-4 text-left cursor-pointer" onClick={() => setOpenId(open ? null : t.id)}>
                    <div className="flex items-center gap-3">
                      <span className={cx("w-14 h-14 rounded-2xl flex flex-col items-center justify-center shrink-0", done ? "bg-moss-100 text-moss-700" : "bg-ink-900 text-gold-300")}>
                        <span className="font-display font-black text-[15px] leading-none">{b!.pickupTime}</span>
                        <span className="text-[8px] font-extrabold uppercase mt-0.5">{fmtClock(b!.pickupTime).slice(-2)}</span>
                      </span>
                      <span className="grow min-w-0">
                        <span className="flex items-center gap-2"><span className="font-extrabold text-ink-900 truncate">{c?.name}</span><span className="chip bg-sand-100 text-ink-600"><Users size={10} />{guestsOf(b!)}</span></span>
                        <span className="block text-[12px] font-bold text-ink-500 truncate flex items-center gap-1"><MapPin size={11} className="text-gold-600 shrink-0" />{b!.pickupLocation}</span>
                        <span className="mt-1 inline-block"><StatusPill {...TRIP_STATUS[t.status]} /></span>
                      </span>
                      <ChevronDown size={17} className={cx("text-ink-300 transition-transform shrink-0", open && "rotate-180")} />
                    </div>
                  </button>
                  {open && (
                    <div className="px-4 pb-4 space-y-3 anim-fade">
                      {b!.specialReq && <p className="text-[12px] font-bold text-gold-700 bg-gold-200/30 rounded-lg p-2.5">📝 {b!.specialReq}</p>}
                      {b!.pickupAddress && <p className="text-[12px] font-semibold text-ink-500">📍 {b!.pickupAddress}</p>}
                      <div className="grid grid-cols-3 gap-2">
                        <a className="btn btn-outline btn-sm" href={`tel:${phone}`}><Phone size={13} />Call</a>
                        <a className="btn btn-success btn-sm" target="_blank" rel="noreferrer" href={`https://wa.me/${wa}`}><MessageCircle size={13} />WhatsApp</a>
                        <a className="btn btn-dark btn-sm" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(b!.pickupLocation + ", Dubai, UAE")}`}><Navigation size={13} />Navigate</a>
                      </div>
                      {!done && next && (
                        <button className={cx("btn w-full btn-lg", next.to === "completed" ? "btn-success" : "btn-primary")}
                          onClick={() => { advanceTrip(t.id, next.to); toast(next.to === "completed" ? "Trip completed — great work! 🌇" : `Marked: ${TRIP_STATUS[next.to].label} ✓`); }}>
                          <Check size={17} />{next.label}
                        </button>
                      )}
                      {done && <p className="text-center text-sm font-extrabold text-moss-600 py-1">Trip completed ✓</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <div>
            <p className="font-display font-bold text-lg text-ink-900 mb-2">Coming up</p>
            <div className="card divide-y divide-sand-100">
              {upcoming.map(({ t, b }) => (
                <div key={t.id} className="p-3.5 flex items-center gap-3">
                  <span className="w-12 text-center shrink-0">
                    <span className="block font-display font-black text-ink-900">{fmtDateShort(b!.date)}</span>
                    <span className="block text-[10px] font-extrabold text-ink-400">{b!.pickupTime}</span>
                  </span>
                  <span className="grow min-w-0">
                    <span className="block text-[13px] font-extrabold text-ink-900 truncate">{customers.find((x) => x.id === b!.customerId)?.name} · {guestsOf(b!)} guests</span>
                    <span className="block text-[11px] font-bold text-ink-400 truncate">{b!.pickupLocation}</span>
                  </span>
                  <StatusPill {...TRIP_STATUS[t.status]} />
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-[11px] font-bold text-ink-400 pt-2">{fmtDate(today)} · DuneSuite Driver Console · stay safe in the dunes 🌇</p>
      </div>
      <span className="hidden"><X size={1} /></span>
    </div>
  );
}
