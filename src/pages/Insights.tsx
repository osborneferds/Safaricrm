import { useMemo, useState } from "react";
import { Download, FileBarChart2, Printer } from "lucide-react";
import { useStore, useTenant } from "../lib/store";
import { bookingPaid, guestsOf, payStatusOf } from "../lib/data";
import { addDaysISO, daysFromNow, downloadCSV, fmtDate, fmtDateShort, money, todayISO } from "../lib/utils";
import { Bar, EmptyState } from "../components/ui";
import { ChartCard, DayBars, Donut, RevArea } from "../components/charts";

const REPORTS = [
  { id: "daily", label: "Daily bookings" }, { id: "weekly", label: "Weekly bookings" }, { id: "monthly", label: "Monthly bookings" },
  { id: "revenue", label: "Revenue report" }, { id: "outstanding", label: "Outstanding payments" }, { id: "packages", label: "Package performance" },
  { id: "drivers", label: "Driver performance" }, { id: "vehicles", label: "Vehicle utilization" }, { id: "conversion", label: "Lead conversion" },
  { id: "cancellations", label: "Cancellation report" }, { id: "customers", label: "Customer report" }, { id: "trips", label: "Trip report" },
];

export function Reports() {
  const { db, user } = useStore();
  const bookings = useTenant(db.bookings);
  const payments = useTenant(db.payments);
  const customers = useTenant(db.customers);
  const packages = useTenant(db.packages);
  const drivers = useTenant(db.drivers);
  const vehicles = useTenant(db.vehicles);
  const leads = useTenant(db.leads);
  const trips = useTenant(db.trips);
  const settings = db.settings.find((s) => s.tenantId === user?.tenantId);
  const cur = settings?.currency ?? "AED";

  const [type, setType] = useState("revenue");
  const [from, setFrom] = useState(addDaysISO(-30));
  const [to, setTo] = useState(addDaysISO(7));
  const [pkgF, setPkgF] = useState("all");
  const [drvF, setDrvF] = useState("all");

  const inRange = (d: string) => d >= from && d <= to;

  const data = useMemo(() => {
    const bs = bookings.filter((b) => inRange(b.date)).filter((b) => pkgF === "all" || b.packageId === pkgF).filter((b) => drvF === "all" || b.driverId === drvF);
    const rows: (string | number)[][] = [];
    let headers: string[] = [];
    switch (type) {
      case "daily": headers = ["Date", "Bookings", "Guests", "Revenue"];
        for (let d = from; d <= to; d = addDaysISO(1, d)) { const day = bs.filter((b) => b.date === d); if (day.length) rows.push([d, day.length, day.reduce((s, b) => s + guestsOf(b), 0), day.reduce((s, b) => s + b.total, 0)]); }
        break;
      case "weekly": headers = ["Week of", "Bookings", "Guests", "Revenue"];
        for (let i = 0; i < 8; i++) { const start = addDaysISO(-7 * i, to); const wk = bs.filter((b) => b.date <= start && b.date > addDaysISO(-7, start)); if (wk.length) rows.unshift([start, wk.length, wk.reduce((s, b) => s + guestsOf(b), 0), wk.reduce((s, b) => s + b.total, 0)]); }
        break;
      case "monthly": headers = ["Month", "Bookings", "Guests", "Revenue"]; {
        const months = new Map<string, { n: number; g: number; r: number }>();
        bs.forEach((b) => { const m = b.date.slice(0, 7); const e = months.get(m) ?? { n: 0, g: 0, r: 0 }; e.n++; e.g += guestsOf(b); e.r += b.total; months.set(m, e); });
        [...months.entries()].sort().forEach(([m, e]) => rows.push([m, e.n, e.g, e.r]));
        break; }
      case "revenue": headers = ["Booking", "Date", "Customer", "Total", "Paid", "Balance", "Status"];
        bs.forEach((b) => { const paid = bookingPaid(db, b.id); rows.push([b.code, b.date, customers.find((c) => c.id === b.customerId)?.name ?? "", b.total, paid, Math.max(0, b.total - paid), payStatusOf(db, b)]); });
        break;
      case "outstanding": headers = ["Booking", "Customer", "Date", "Total", "Balance", "Status"];
        bs.forEach((b) => { const bal = b.total - bookingPaid(db, b.id); if (bal > 0 && !["cancelled", "no_show"].includes(b.status)) rows.push([b.code, customers.find((c) => c.id === b.customerId)?.name ?? "", b.date, b.total, bal, b.status]); });
        break;
      case "packages": headers = ["Package", "Bookings", "Guests", "Revenue", "Avg value"];
        packages.forEach((p) => { const pb = bs.filter((b) => b.packageId === p.id && !["cancelled", "no_show"].includes(b.status)); if (pb.length) rows.push([p.name, pb.length, pb.reduce((s, b) => s + guestsOf(b), 0), pb.reduce((s, b) => s + b.total, 0), Math.round(pb.reduce((s, b) => s + b.total, 0) / pb.length)]); });
        break;
      case "drivers": headers = ["Driver", "Assigned trips", "Completed", "Rating", "Guests carried"];
        drivers.forEach((d) => { const tb = bs.filter((b) => b.driverId === d.id); rows.push([d.name, tb.length, tb.filter((b) => b.status === "completed").length, d.rating, tb.reduce((s, b) => s + guestsOf(b), 0)]); });
        break;
      case "vehicles": headers = ["Vehicle", "Trips", "Guests", "Revenue", "Status"];
        vehicles.forEach((v) => { const vb = bs.filter((b) => b.vehicleId === v.id && !["cancelled", "no_show"].includes(b.status)); rows.push([`${v.plate} ${v.model}`, vb.length, vb.reduce((s, b) => s + guestsOf(b), 0), vb.reduce((s, b) => s + b.total, 0), v.status]); });
        break;
      case "conversion": headers = ["Stage", "Leads", "% of total"]; {
        const stages: [string, (l: typeof leads[number]) => boolean][] = [
          ["All", () => true], ["Contacted+", (l) => l.status !== "new"], ["Quoted+", (l) => ["quoted", "follow_up", "confirmed", "paid", "completed"].includes(l.status)],
          ["Confirmed+", (l) => ["confirmed", "paid", "completed"].includes(l.status)], ["Paid", (l) => ["paid", "completed"].includes(l.status)], ["Lost", (l) => l.status === "lost"],
        ];
        stages.forEach(([n, f]) => { const n2 = leads.filter(f).length; rows.push([n, n2, leads.length ? Math.round((n2 / leads.length) * 100) + "%" : "0%"]); });
        break; }
      case "cancellations": headers = ["Booking", "Customer", "Date", "Value", "Notes"];
        bookings.filter((b) => ["cancelled", "no_show"].includes(b.status) && inRange(b.date)).forEach((b) => rows.push([b.code, customers.find((c) => c.id === b.customerId)?.name ?? "", b.date, b.total, b.status + (b.notes ? " — " + b.notes : "")]));
        break;
      case "customers": headers = ["Customer", "Country", "Bookings", "Total spent", "Last booking"];
        customers.forEach((c) => { const cb = bookings.filter((b) => b.customerId === c.id && b.status !== "cancelled"); rows.push([c.name, c.country, cb.length, cb.reduce((s, b) => s + b.total, 0), cb.map((b) => b.date).sort().slice(-1)[0] ?? "—"]); });
        break;
      case "trips": headers = ["Booking", "Date", "Driver", "Vehicle", "Status"];
        trips.forEach((t) => { const b = bookings.find((x) => x.id === t.bookingId); if (b && inRange(b.date)) rows.push([b.code, b.date, drivers.find((d) => d.id === t.driverId)?.name ?? "", vehicles.find((v) => v.id === t.vehicleId)?.plate ?? "", t.status]); });
        break;
    }
    return { headers, rows };
  }, [type, from, to, pkgF, drvF, bookings, payments, customers, packages, drivers, vehicles, leads, trips, db]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2.5">
        <div><label className="label">Report</label>
          <select className="input w-auto" value={type} onChange={(e) => setType(e.target.value)}>
            {REPORTS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </div>
        <div><label className="label">From</label><input type="date" className="input w-auto" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><label className="label">To</label><input type="date" className="input w-auto" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div><label className="label">Package</label>
          <select className="input w-auto" value={pkgF} onChange={(e) => setPkgF(e.target.value)}><option value="all">All</option>{packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        </div>
        {["drivers", "revenue", "daily"].includes(type) && (
          <div><label className="label">Driver</label>
            <select className="input w-auto" value={drvF} onChange={(e) => setDrvF(e.target.value)}><option value="all">All</option>{drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          </div>
        )}
        <div className="grow" />
        <button className="btn btn-outline btn-sm" onClick={() => downloadCSV(`${type}-report`, data.headers, data.rows)}><Download size={14} />Export CSV</button>
        <button className="btn btn-dark btn-sm" onClick={() => window.print()}><Printer size={14} />Print / PDF</button>
      </div>

      <div className="card overflow-hidden anim-rise print-sheet">
        <div className="px-4 py-3 border-b border-sand-200 flex items-center justify-between no-print">
          <p className="font-display font-bold text-ink-900">{REPORTS.find((r) => r.id === type)?.label}</p>
          <p className="text-xs font-bold text-ink-400">{fmtDate(from)} → {fmtDate(to)} · {data.rows.length} rows</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-sand-100/70"><tr>{data.headers.map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody>
              {data.rows.map((r, i) => (
                <tr key={i} className="border-t border-sand-100 hover:bg-sand-50">
                  {r.map((c, j) => <td key={j} className={typeof c === "number" && j > 0 ? "td font-bold text-right" : "td font-semibold"}>{typeof c === "number" && j === r.length - 1 && ["revenue", "outstanding", "packages", "customers", "daily", "weekly", "monthly"].includes(type) ? money(c, cur) : c}</td>)}
                </tr>
              ))}
              {data.rows.length === 0 && <tr><td colSpan={data.headers.length}><EmptyState compact title="No data for these filters" /></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <span className="hidden"><FileBarChart2 size={1} /></span>
    </div>
  );
}

export function Analytics() {
  const { db, user } = useStore();
  const bookings = useTenant(db.bookings);
  const payments = useTenant(db.payments);
  const leads = useTenant(db.leads);
  const packages = useTenant(db.packages);
  const drivers = useTenant(db.drivers);
  const vehicles = useTenant(db.vehicles);
  const customers = useTenant(db.customers);
  const settings = db.settings.find((s) => s.tenantId === user?.tenantId);
  const cur = settings?.currency ?? "AED";

  const s = useMemo(() => {
    const ok = bookings.filter((b) => !["cancelled", "no_show"].includes(b.status));
    const revenue = payments.filter((p) => p.status === "captured").reduce((a, p) => a + p.amount, 0);
    const cancelled = bookings.filter((b) => ["cancelled", "no_show"].includes(b.status)).length;
    const paidLeads = leads.filter((l) => ["paid", "completed"].includes(l.status)).length;
    const booked = new Set(ok.map((b) => b.customerId));
    const repeat = customers.filter((c) => ok.filter((b) => b.customerId === c.id).length >= 2).length;
    const sources = new Map<string, number>();
    leads.forEach((l) => sources.set(l.source, (sources.get(l.source) ?? 0) + 1));
    return {
      total: ok.length, revenue, avg: ok.length ? Math.round(revenue / ok.length) : 0,
      conv: leads.length ? Math.round((paidLeads / leads.length) * 100) : 0,
      cancelRate: bookings.length ? Math.round((cancelled / bookings.length) * 100) : 0,
      topPkg: [...packages.map((p) => ({ p, n: ok.filter((b) => b.packageId === p.id).length }))].sort((a, b) => b.n - a.n - 0)[0],
      bestDriver: [...drivers].sort((a, b) => b.completedTrips - a.completedTrips)[0],
      vehUtil: vehicles.length ? Math.round((vehicles.filter((v) => ["assigned", "on_safari"].includes(v.status)).length / vehicles.length) * 100) : 0,
      repeat, sources: [...sources.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [bookings, payments, leads, packages, drivers, vehicles, customers]);

  const revSeries = useMemo(() => {
    const days: { name: string; v: number }[] = [];
    for (let i = 59; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      days.push({ name: fmtDateShort(iso), v: payments.filter((p) => p.status === "captured" && p.date.slice(0, 10) === iso).reduce((a, p) => a + p.amount, 0) });
    }
    return days;
  }, [payments]);

  const agentPerf = useMemo(() => db.users.filter((u) => u.tenantId === user?.tenantId && u.role === "sales").map((a) => ({
    name: a.name, n: leads.filter((l) => l.agentId === a.id).length,
    won: leads.filter((l) => l.agentId === a.id && ["paid", "completed", "confirmed"].includes(l.status)).length,
  })), [db.users, leads, user]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <Kpi k="Total bookings" v={String(s.total)} />
        <Kpi k="Revenue (captured)" v={money(s.revenue, cur)} />
        <Kpi k="Avg booking value" v={money(s.avg, cur)} />
        <Kpi k="Lead → paid" v={`${s.conv}%`} />
        <Kpi k="Cancellation rate" v={`${s.cancelRate}%`} bad={s.cancelRate > 15} />
        <Kpi k="Repeat customers" v={String(s.repeat)} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <ChartCard title="Revenue trend" sub="Last 60 days" h={240}><RevArea data={revSeries} /></ChartCard>
        <ChartCard title="Bookings by package" sub="All time, active bookings" h={240}>
          <Donut data={packages.map((p) => ({ name: p.name.split(" ").slice(0, 2).join(" "), value: bookings.filter((b) => b.packageId === p.id && !["cancelled", "no_show"].includes(b.status)).length })).filter((x) => x.value > 0)} centerLabel="share" />
        </ChartCard>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="card p-4">
          <h4 className="font-display font-bold text-ink-900 mb-1">Best performers</h4>
          <p className="text-xs text-ink-500 font-semibold mb-3">Drivers by completed trips</p>
          <div className="space-y-2.5">
            {[...drivers].sort((a, b) => b.completedTrips - a.completedTrips).slice(0, 5).map((d, i) => {
              const max = Math.max(1, drivers.reduce((m, x) => Math.max(m, x.completedTrips), 1));
              return (
                <div key={d.id}>
                  <div className="flex justify-between text-[12px] font-extrabold text-ink-700 mb-1">
                    <span>{i === 0 ? "🏆 " : ""}{d.name}</span><span className="text-ink-400">{d.completedTrips} · ★{d.rating}</span>
                  </div>
                  <Bar pct={(d.completedTrips / max) * 100} tone="#2f7e76" />
                </div>
              );
            })}
          </div>
        </div>
        <div className="card p-4">
          <h4 className="font-display font-bold text-ink-900 mb-1">Sales agents</h4>
          <p className="text-xs text-ink-500 font-semibold mb-3">Leads handled vs won</p>
          {agentPerf.length === 0 && <EmptyState compact title="No sales agents" />}
          <div className="space-y-2.5">
            {agentPerf.map((a) => (
              <div key={a.name} className="rounded-xl border border-sand-200 bg-white/70 p-3">
                <p className="text-[13px] font-extrabold text-ink-900">{a.name} {a.n > 0 && a.won / a.n >= 0.4 && <span className="chip bg-gold-200 text-gold-700 ml-1">top closer</span>}</p>
                <p className="text-[11px] font-bold text-ink-500 mt-0.5">{a.won} won of {a.n} leads · {a.n ? Math.round((a.won / a.n) * 100) : 0}% win rate</p>
                <div className="mt-1.5"><Bar pct={a.n ? (a.won / a.n) * 100 : 0} tone="#c8912f" /></div>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-4">
          <h4 className="font-display font-bold text-ink-900 mb-1">Lead sources</h4>
          <p className="text-xs text-ink-500 font-semibold mb-3">Where inquiries come from</p>
          <div className="space-y-2.5">
            {s.sources.map(([src, n]) => {
              const max = Math.max(1, s.sources[0]?.[1] ?? 1);
              return (
                <div key={src}>
                  <div className="flex justify-between text-[12px] font-extrabold text-ink-700 mb-1"><span className="uppercase tracking-wide text-[10px]">{src.replace("_", " ")}</span><span className="text-ink-400">{n}</span></div>
                  <Bar pct={(n / max) * 100} tone="#46558c" />
                </div>
              );
            })}
            {s.sources.length === 0 && <EmptyState compact title="No leads yet" />}
          </div>
          <div className="mt-4 pt-3 border-t border-sand-200 text-sm font-semibold text-ink-600">
            <p className="flex justify-between"><span>Most popular package</span><span className="font-extrabold text-ink-900">{s.topPkg?.p.name ?? "—"} ({s.topPkg?.n ?? 0})</span></p>
            <p className="flex justify-between mt-1"><span>Best driver</span><span className="font-extrabold text-ink-900">{s.bestDriver?.name ?? "—"}</span></p>
            <p className="flex justify-between mt-1"><span>Fleet on duty now</span><span className="font-extrabold text-ink-900">{s.vehUtil}%</span></p>
          </div>
        </div>
      </div>
      <span className="hidden"><DayBars data={[{ name: "", v: 0 }]} />{daysFromNow(todayISO())}</span>
    </div>
  );
}

const Kpi = ({ k, v, bad }: { k: string; v: string; bad?: boolean }) => (
  <div className="card p-4">
    <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-500">{k}</p>
    <p className={`font-display text-[24px] font-bold leading-tight mt-1 ${bad ? "text-clay-600" : "text-ink-900"}`}>{v}</p>
  </div>
);
