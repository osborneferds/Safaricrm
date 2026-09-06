import { useMemo } from "react";
import { AlertTriangle, ArrowRight, Banknote, CalendarCheck2, CalendarDays, Car, Clock, CreditCard, FileText, MessageCircle, Palmtree, Plus, Route, Ticket, Truck, UserCheck, UserCog, UserPlus, Users, Wallet } from "lucide-react";
import { useStore, useTenant } from "../lib/store";
import { BOOKING_STATUS, DRIVER_STATUS, PAY_STATUS, VEHICLE_STATUS, cx, daysFromNow, fmtClock, fmtDateShort, money, todayISO } from "../lib/utils";
import { guestsOf, payStatusOf, vehicleIssues, expiryWarn } from "../lib/data";
import { Bar, EmptyState, StatCard, StatusPill } from "../components/ui";
import { ChartCard, DayBars, Donut, FunnelRow, RevArea } from "../components/charts";
import type { PageId } from "../lib/types";

export default function Dashboard() {
  const { db, user, setRoute } = useStore();
  const bookings = useTenant(db.bookings);
  const payments = useTenant(db.payments);
  const leads = useTenant(db.leads);
  const vehicles = useTenant(db.vehicles);
  const drivers = useTenant(db.drivers);
  const packages = useTenant(db.packages);
  const customers = useTenant(db.customers);
  const today = todayISO();
  const settings = db.settings.find((s) => s.tenantId === user?.tenantId);
  const cur = settings?.currency ?? "AED";

  const stats = useMemo(() => {
    const active = bookings.filter((b) => !["cancelled", "no_show"].includes(b.status));
    const todays = active.filter((b) => b.date === today);
    const revenueToday = payments.filter((p) => p.status === "captured" && p.date.slice(0, 10) === today).reduce((s, p) => s + p.amount, 0);
    const pendingPay = active.reduce((s, b) => s + Math.max(0, b.total - payments.filter((p) => p.bookingId === b.id && p.status === "captured").reduce((a, p) => a + p.amount, 0)), 0);
    return {
      todayBookings: todays.length,
      todayTrips: db.trips.filter((t) => t.tenantId === user?.tenantId && bookings.some((b) => b.id === t.bookingId && b.date === today)).length,
      pending: active.filter((b) => ["pending", "inquiry"].includes(b.status)).length,
      confirmed: active.filter((b) => ["confirmed", "paid", "assigned"].includes(b.status)).length,
      revenueToday, pendingPay,
      vehAvail: vehicles.filter((v) => v.status === "available").length,
      vehSafari: vehicles.filter((v) => v.status === "on_safari" || v.status === "assigned").length,
      drvAvail: drivers.filter((d) => d.status === "available").length,
      drvDuty: drivers.filter((d) => ["assigned", "on_trip"].includes(d.status)).length,
      newLeads: leads.filter((l) => ["new", "contacted"].includes(l.status)).length,
      followUps: leads.filter((l) => daysFromNow(l.followUpDate) <= 0 && !["completed", "lost", "paid", "confirmed"].includes(l.status)).length,
    };
  }, [bookings, payments, leads, vehicles, drivers, db.trips, today, user]);

  const revenueSeries = useMemo(() => {
    const days: { name: string; v: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      days.push({ name: d.getDate() + " " + d.toLocaleDateString("en-GB", { month: "short" }), v: payments.filter((p) => p.status === "captured" && p.date.slice(0, 10) === iso).reduce((s, p) => s + p.amount, 0) });
    }
    return days;
  }, [payments]);

  const bookingSeries = useMemo(() => {
    const days: { name: string; v: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      days.push({ name: d.getDate() + "", v: bookings.filter((b) => b.date === iso && b.status !== "cancelled").length });
    }
    return days;
  }, [bookings]);

  const pkgPopularity = useMemo(() =>
    packages.map((p) => ({ name: p.name.replace(" Desert Safari", "").replace(" Desert", ""), value: bookings.filter((b) => b.packageId === p.id && !["cancelled", "no_show"].includes(b.status)).length })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value),
  [packages, bookings]);

  const funnel = useMemo(() => {
    const stages = [
      { k: "All leads", n: leads.length },
      { k: "Contacted+", n: leads.filter((l) => l.status !== "new").length },
      { k: "Quoted+", n: leads.filter((l) => ["quoted", "follow_up", "confirmed", "paid", "completed"].includes(l.status)).length },
      { k: "Confirmed+", n: leads.filter((l) => ["confirmed", "paid", "completed"].includes(l.status)).length },
      { k: "Paid", n: leads.filter((l) => ["paid", "completed"].includes(l.status)).length },
    ];
    return stages;
  }, [leads]);

  const todayOps = useMemo(() =>
    bookings.filter((b) => b.date === today && b.status !== "cancelled" && b.status !== "no_show").sort((a, b) => a.pickupTime.localeCompare(b.pickupTime)),
  [bookings, today]);

  const followUps = useMemo(() =>
    leads.filter((l) => daysFromNow(l.followUpDate) <= 0 && !["completed", "lost", "paid", "confirmed"].includes(l.status)).sort((a, b) => a.followUpDate.localeCompare(b.followUpDate)).slice(0, 5),
  [leads]);

  const alerts = useMemo(() => {
    const out: { label: string; level: string; page: PageId; id: string }[] = [];
    vehicles.forEach((v) => vehicleIssues(v).forEach((i) => out.push({ label: `${v.plate} — ${i.label} ${i.warn.level === "expired" ? "expired" : `in ${i.warn.days}d`}`, level: i.warn.level, page: "fleet", id: v.id })));
    drivers.forEach((d) => { const w = expiryWarn(d.licenseExpiry); if (w) out.push({ label: `${d.name} — licence ${w.level === "expired" ? "expired" : `expires in ${w.days}d`}`, level: w.level, page: "drivers", id: d.id }); });
    return out.sort((a, b) => (a.level === "expired" ? -1 : 1) - (b.level === "expired" ? -1 : 1));
  }, [vehicles, drivers]);

  const util = useMemo(() => ({
    veh: vehicles.map((v) => ({ name: v.plate, n: bookings.filter((b) => b.vehicleId === v.id && b.date >= today && !["cancelled"].includes(b.status)).length + bookings.filter((b) => b.vehicleId === v.id && b.status === "completed").length })),
    drv: drivers.map((d) => ({ name: d.name.split(" ")[0], n: d.completedTrips })),
  }), [vehicles, drivers, bookings]);

  const go = (page: PageId, id?: string) => setRoute({ page, params: id ? { open: id } : undefined });

  return (
    <div className="space-y-5">
      {/* Alert strip */}
      {alerts.length > 0 && (
        <div className="card border-clay-200 bg-clay-100/40 p-3 flex items-center gap-3 flex-wrap anim-rise">
          <span className="flex items-center gap-1.5 text-clay-700 font-extrabold text-sm"><AlertTriangle size={16} />{alerts.length} document / maintenance alert{alerts.length > 1 ? "s" : ""}</span>
          <span className="hidden md:block text-xs font-semibold text-clay-600 truncate max-w-md">{alerts[0].label}</span>
          <button className="btn btn-sm btn-danger ml-auto" onClick={() => go(alerts[0].page, alerts[0].id)}>Review now</button>
        </div>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard label="Today's Bookings" value={stats.todayBookings} sub={`${stats.confirmed} confirmed overall`} icon={<CalendarDays size={15} />} onClick={() => go("bookings")} />
        <StatCard label="Today's Trips" value={stats.todayTrips} sub="on the ops board" icon={<Route size={15} />} tone="oasis" onClick={() => go("ops")} />
        <StatCard label="Pending Bookings" value={stats.pending} sub="need confirmation" icon={<Clock size={15} />} tone="ink" onClick={() => go("bookings")} />
        <StatCard label="Confirmed" value={stats.confirmed} sub="ready to assign" icon={<CalendarCheck2 size={15} />} tone="moss" onClick={() => go("bookings")} />
        <StatCard label="Today's Revenue" value={money(stats.revenueToday, cur)} sub="captured payments" icon={<Banknote size={15} />} tone="gold" onClick={() => go("payments")} />
        <StatCard label="Pending Payments" value={money(stats.pendingPay, cur)} sub="outstanding balances" icon={<Wallet size={15} />} tone="clay" onClick={() => go("payments")} alert={stats.pendingPay > 0} />
        <StatCard label="Vehicles Available" value={stats.vehAvail} sub={`${vehicles.length} in fleet`} icon={<Car size={15} />} tone="moss" onClick={() => go("fleet")} />
        <StatCard label="Vehicles on Safari" value={stats.vehSafari} sub="assigned or rolling" icon={<Car size={15} />} tone="ink" onClick={() => go("fleet")} />
        <StatCard label="Drivers Available" value={stats.drvAvail} sub={`${drivers.length} employed`} icon={<UserCheck size={15} />} tone="moss" onClick={() => go("drivers")} />
        <StatCard label="Drivers on Duty" value={stats.drvDuty} sub="assigned or on trip" icon={<Users size={15} />} tone="oasis" onClick={() => go("drivers")} />
        <StatCard label="New Leads" value={stats.newLeads} sub="waiting in CRM" icon={<MessageCircle size={15} />} tone="night" onClick={() => go("crm")} />
        <StatCard label="Follow-ups Due" value={stats.followUps} sub="don't let them cool" icon={<Plus size={15} />} tone="clay" onClick={() => go("crm")} alert={stats.followUps > 0} />
      </div>

      {/* Quick actions */}
      {(() => {
        const role = user!.role;
        const newTo = (page: PageId) => setRoute({ page, params: { new: "1" } });
        const actions = [
          { label: "New Booking", icon: Ticket, show: true, run: () => newTo("bookings"), hot: true },
          { label: "New Lead", icon: MessageCircle, show: role !== "driver", run: () => newTo("crm") },
          { label: "Add Customer", icon: UserPlus, show: role !== "driver", run: () => newTo("customers") },
          { label: "Create Quotation", icon: FileText, show: role === "admin" || role === "sales", run: () => setRoute({ page: "quotations", params: { new: "1" } }) },
          { label: "Record Payment", icon: CreditCard, show: role === "admin" || role === "sales" || role === "ops", run: () => setRoute({ page: "payments", params: { new: "1" } }) },
          { label: "Add Vehicle", icon: Truck, show: role === "admin" || role === "ops", run: () => newTo("fleet") },
          { label: "Add Driver", icon: UserCog, show: role === "admin" || role === "ops", run: () => newTo("drivers") },
          { label: "Add Package", icon: Palmtree, show: role === "admin", run: () => newTo("packages") },
        ].filter((a) => a.show);
        return (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 no-print">
            {actions.map((a) => { const I = a.icon; return (
              <button key={a.label} onClick={a.run}
                className={cx("btn shrink-0 border transition-all hover:-translate-y-0.5",
                  a.hot ? "bg-ink-900 text-gold-300 border-ink-900 hover:bg-ink-800 shadow-lift" : "bg-white/70 border-sand-300 text-ink-700 hover:border-gold-400 hover:text-ink-950")}>
                <Plus size={14} className={a.hot ? "text-gold-400" : "text-gold-600"} /><I size={14} />{a.label}
              </button>
            ); })}
          </div>
        );
      })()}

      {/* Today's operations */}
      <div className="card anim-rise">
        <div className="flex items-center justify-between px-4 sm:px-5 pt-4 pb-3 border-b border-sand-200 flex-wrap gap-2">
          <div>
            <h3 className="font-display font-bold text-lg text-ink-900">Today's Safari Operations</h3>
            <p className="text-xs text-ink-500 font-semibold">{fmtDateShort(today)} · {todayOps.length} active bookings · sorted by pickup time</p>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-outline btn-sm" onClick={() => go("ops")}>Ops board<ArrowRight size={13} /></button>
            <button className="btn btn-primary btn-sm" onClick={() => go("bookings")}><Ticket size={13} />New booking</button>
          </div>
        </div>
        {todayOps.length === 0 ? (
          <EmptyState title="No safaris scheduled today" body="Create a booking or check the calendar for upcoming days." action={<button className="btn btn-dark btn-sm" onClick={() => go("calendar")}>Open calendar</button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px]">
              <thead className="bg-sand-100/70"><tr>
                <th className="th">Booking</th><th className="th">Customer</th><th className="th">Package</th><th className="th">Pickup</th><th className="th">Guests</th><th className="th">Vehicle</th><th className="th">Driver</th><th className="th">Payment</th><th className="th">Status</th>
              </tr></thead>
              <tbody>
                {todayOps.map((b) => {
                  const c = customers.find((x) => x.id === b.customerId);
                  const p = packages.find((x) => x.id === b.packageId);
                  const v = vehicles.find((x) => x.id === b.vehicleId);
                  const d = drivers.find((x) => x.id === b.driverId);
                  const ps = payStatusOf(db, b);
                  return (
                    <tr key={b.id} className="border-t border-sand-100 hover:bg-sand-50 transition-colors cursor-pointer" onClick={() => go("bookings", b.id)}>
                      <td className="td font-mono font-bold text-gold-700 text-[13px]">{b.code}</td>
                      <td className="td font-bold text-ink-900">{c?.name ?? "—"}</td>
                      <td className="td"><span className="chip" style={{ background: (p?.accent ?? "#c8912f") + "22", color: p?.accent ?? "#a87520" }}>{p?.name ?? "—"}</span></td>
                      <td className="td font-bold">{fmtClock(b.pickupTime)}<span className="block text-[11px] font-semibold text-ink-400">{b.pickupLocation}</span></td>
                      <td className="td font-bold">{guestsOf(b)}<span className="block text-[11px] font-semibold text-ink-400">{b.adults}A · {b.children}C</span></td>
                      <td className="td">{v ? <span className="font-bold">{v.plate}</span> : <span className="text-ink-300 font-semibold">—</span>}</td>
                      <td className="td">{d ? <span className="font-bold">{d.name}</span> : <span className="text-ink-300 font-semibold">—</span>}</td>
                      <td className="td"><StatusPill {...PAY_STATUS[ps]} /></td>
                      <td className="td"><StatusPill {...BOOKING_STATUS[b.status]} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-4">
        <ChartCard title="Revenue" sub="Captured payments — last 30 days" h={230}><RevArea data={revenueSeries} /></ChartCard>
        <ChartCard title="Bookings" sub="Safari dates — last 14 days" h={230}><DayBars data={bookingSeries} /></ChartCard>
        <ChartCard title="Package popularity" sub="Active bookings by package" h={230}>
          {pkgPopularity.length ? <div className="grid grid-cols-[1fr_150px] items-center gap-3 h-full">
            <Donut data={pkgPopularity.slice(0, 6)} centerLabel={`${pkgPopularity.reduce((a, x) => a + x.value, 0)}\nbookings`} />
            <div className="space-y-1.5">
              {pkgPopularity.slice(0, 6).map((p, i) => (
                <div key={p.name} className="flex items-center gap-1.5 text-[11px] font-bold text-ink-600">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ["#c8912f", "#2f7e76", "#46558c", "#b4543a", "#b69355", "#3c6447"][i] }} />
                  <span className="truncate">{p.name}</span>
                </div>
              ))}
            </div>
          </div> : <EmptyState compact title="No bookings yet" />}
        </ChartCard>
        <ChartCard title="Lead conversion" sub="CRM pipeline health" h={230}>
          <div className="space-y-2.5 pt-2">
            {funnel.map((f, i) => <FunnelRow key={f.k} label={f.k} value={f.n} max={funnel[0].n || 1} tone={["#46558c", "#2f7e76", "#c8912f", "#a87520", "#3c6447"][i]} />)}
            <p className="text-xs font-bold text-ink-500 pt-2">Conversion rate: <span className="text-moss-600 text-base font-extrabold">{funnel[0].n ? Math.round((funnel[4].n / funnel[0].n) * 100) : 0}%</span> lead → paid</p>
          </div>
        </ChartCard>
      </div>

      {/* Utilization + follow-ups */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card p-4">
          <h4 className="font-display font-bold text-ink-900 mb-1">Vehicle utilization</h4>
          <p className="text-xs text-ink-500 font-semibold mb-3">Trips assigned per vehicle</p>
          <div className="space-y-3">
            {util.veh.map((v) => {
              const max = Math.max(1, ...util.veh.map((x) => x.n));
              return (
                <div key={v.name}>
                  <div className="flex justify-between text-[11px] font-extrabold text-ink-600 mb-1"><span>{v.name}</span><span className="text-ink-400">{v.n} trips</span></div>
                  <Bar pct={(v.n / max) * 100} tone="#a87520" />
                </div>
              );
            })}
            {util.veh.length === 0 && <EmptyState compact title="No vehicles yet" />}
          </div>
        </div>
        <div className="card p-4">
          <h4 className="font-display font-bold text-ink-900 mb-1">Driver utilization</h4>
          <p className="text-xs text-ink-500 font-semibold mb-3">Completed trips all-time</p>
          <div className="space-y-3">
            {util.drv.map((v) => {
              const max = Math.max(1, ...util.drv.map((x) => x.n));
              return (
                <div key={v.name}>
                  <div className="flex justify-between text-[11px] font-extrabold text-ink-600 mb-1"><span>{v.name}</span><span className="text-ink-400">{v.n}</span></div>
                  <Bar pct={(v.n / max) * 100} tone="#2f7e76" />
                </div>
              );
            })}
            {util.drv.length === 0 && <EmptyState compact title="No drivers yet" />}
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-display font-bold text-ink-900">Follow-ups due</h4>
            <button className="text-xs font-bold text-gold-700 hover:text-gold-600 cursor-pointer" onClick={() => go("crm")}>Open CRM →</button>
          </div>
          <p className="text-xs text-ink-500 font-semibold mb-3">Leads waiting for your next move</p>
          <div className="space-y-2">
            {followUps.map((l) => (
              <button key={l.id} onClick={() => go("crm", l.id)} className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-sand-200 bg-white/70 hover:border-gold-400 hover:bg-sand-100 transition-all cursor-pointer text-left">
                <span className={cx("w-2 h-2 rounded-full shrink-0", daysFromNow(l.followUpDate) < 0 ? "bg-clay-500" : "bg-gold-500")} />
                <span className="min-w-0 grow">
                  <span className="block text-[13px] font-extrabold text-ink-900 truncate">{l.name}</span>
                  <span className="block text-[11px] font-semibold text-ink-500">{daysFromNow(l.followUpDate) === 0 ? "Due today" : `${-daysFromNow(l.followUpDate)}d overdue`} · {packages.find((p) => p.id === l.packageId)?.name ?? "Any safari"}</span>
                </span>
                <StatusPill {...(l.status === "new" ? { cls: "bg-night-100 text-night-600", dot: "bg-night-500", label: "New" } : { cls: "bg-sand-200 text-ink-700", dot: "bg-sand-500", label: l.status.replace("_", " ") })} />
              </button>
            ))}
            {followUps.length === 0 && <EmptyState compact title="Pipeline is warm" body="No overdue follow-ups. Nice work." />}
          </div>
        </div>
      </div>

      {/* Fleet status strip */}
      <div className="card p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h4 className="font-display font-bold text-ink-900">Fleet pulse</h4>
          <button className="text-xs font-bold text-gold-700 hover:text-gold-600 cursor-pointer" onClick={() => go("fleet")}>Manage fleet →</button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {(["available", "assigned", "on_safari", "maintenance", "out_of_service"] as const).map((s) => (
            <div key={s} className="rounded-xl border border-sand-200 bg-white/60 p-3">
              <StatusPill {...VEHICLE_STATUS[s]} />
              <p className="font-display text-2xl font-bold text-ink-900 mt-2">{vehicles.filter((v) => v.status === s).length}</p>
              <p className="text-[11px] font-semibold text-ink-400">{vehicles.filter((v) => v.status === s).map((v) => v.plate).slice(0, 2).join(", ") || "—"}</p>
            </div>
          ))}
          <div className="rounded-xl border border-sand-200 bg-white/60 p-3">
            <span className="chip bg-ink-100 text-ink-600"><span className="w-1.5 h-1.5 rounded-full bg-ink-400" />Driver pool</span>
            <p className="font-display text-2xl font-bold text-ink-900 mt-2">{drivers.filter((d) => d.status === "available").length}<span className="text-sm text-ink-400 font-body font-bold">/{drivers.length}</span></p>
            <p className="text-[11px] font-semibold text-ink-400">{DRIVER_STATUS.available.label} now</p>
          </div>
        </div>
      </div>
    </div>
  );
}
