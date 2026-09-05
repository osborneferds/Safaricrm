import { useMemo } from "react";
import { Building2, Crown, Power, Ticket, TrendingUp, Users2 } from "lucide-react";
import { useStore } from "../lib/store";
import type { PlanId } from "../lib/types";
import { PLANS } from "../lib/data";
import { cx, daysFromNow, fmtDate, money, timeAgo } from "../lib/utils";
import { Bar, StatusPill } from "../components/ui";

export default function AdminConsole() {
  const { db, mutate, toast, audit } = useStore();

  const stats = useMemo(() => {
    const active = db.tenants.filter((t) => t.active);
    return {
      tenants: db.tenants.length,
      active: active.length,
      users: db.users.filter((u) => u.tenantId).length,
      bookings: db.bookings.length,
      mrr: active.reduce((s, t) => s + (t.planStatus === "trial" ? 0 : PLANS[t.plan].price), 0),
      leads: db.leads.length,
    };
  }, [db]);

  const setPlan = (tid: string, p: PlanId) => {
    mutate((d) => { const t = d.tenants.find((x) => x.id === tid); if (t) t.plan = p; });
    audit("tenant.plan", "Tenant", tid, `Plan → ${p}`);
    toast("Tenant plan updated", "info");
  };
  const setActive = (tid: string, v: boolean) => {
    mutate((d) => { const t = d.tenants.find((x) => x.id === tid); if (t) t.active = v; });
    audit(v ? "tenant.activated" : "tenant.suspended", "Tenant", tid, v ? "Company activated" : "Company suspended");
    toast(v ? "Company activated" : "Company suspended — their users can no longer sign in.", "info");
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <Kpi icon={<Building2 size={15} />} k="Companies" v={String(stats.tenants)} />
        <Kpi icon={<TrendingUp size={15} />} k="Active tenants" v={String(stats.active)} />
        <Kpi icon={<Users2 size={15} />} k="Platform users" v={String(stats.users)} />
        <Kpi icon={<Ticket size={15} />} k="Bookings (all)" v={String(stats.bookings)} />
        <Kpi icon={<Crown size={15} />} k="MRR" v={money(stats.mrr, "AED")} />
        <Kpi icon={<Ticket size={15} />} k="Leads (all)" v={String(stats.leads)} />
      </div>

      <div className="card p-4">
        <h4 className="font-display font-bold text-ink-900 mb-1">Bookings per company</h4>
        <p className="text-xs text-ink-500 font-semibold mb-3">Tenant-isolated workspaces — data below is aggregate only.</p>
        <div className="space-y-3">
          {db.tenants.map((t) => {
            const n = db.bookings.filter((b) => b.tenantId === t.id).length;
            const max = Math.max(1, ...db.tenants.map((x) => db.bookings.filter((b) => b.tenantId === x.id).length));
            return (
              <div key={t.id}>
                <div className="flex justify-between text-[12px] font-extrabold text-ink-700 mb-1"><span>{t.name}</span><span className="text-ink-400">{n} bookings</span></div>
                <Bar pct={(n / max) * 100} tone={t.active ? "#a87520" : "#b4543a"} />
              </div>
            );
          })}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-sand-200 flex items-center justify-between">
          <p className="font-display font-bold text-ink-900">All companies</p>
          <span className="text-xs font-bold text-ink-400">Strict row-level tenant isolation enforced at the data layer</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px]">
            <thead className="bg-sand-100/70"><tr>
              <th className="th">Company</th><th className="th">Plan</th><th className="th">Status</th><th className="th">Users</th><th className="th">Bookings</th><th className="th">Leads</th><th className="th">Created</th><th className="th">Actions</th>
            </tr></thead>
            <tbody>
              {db.tenants.map((t) => (
                <tr key={t.id} className={cx("border-t border-sand-100", !t.active && "opacity-60")}>
                  <td className="td"><span className="font-extrabold text-ink-900">{t.name}</span><span className="block text-[11px] font-semibold text-ink-400">/{t.slug}</span></td>
                  <td className="td">
                    <select className="input w-auto py-1 text-xs font-bold" value={t.plan} onChange={(e) => setPlan(t.id, e.target.value as PlanId)}>
                      {(Object.keys(PLANS) as PlanId[]).map((p) => <option key={p} value={p}>{PLANS[p].name}</option>)}
                    </select>
                  </td>
                  <td className="td">
                    <StatusPill cls={t.active ? "bg-moss-100 text-moss-700" : "bg-clay-100 text-clay-700"} dot={t.active ? "bg-moss-500" : "bg-clay-500"} label={t.active ? (t.planStatus === "trial" ? `trial · ${Math.max(0, daysFromNow(t.trialEnds))}d` : t.planStatus) : "suspended"} />
                  </td>
                  <td className="td font-bold">{db.users.filter((u) => u.tenantId === t.id).length}</td>
                  <td className="td font-bold">{db.bookings.filter((b) => b.tenantId === t.id).length}</td>
                  <td className="td font-bold">{db.leads.filter((l) => l.tenantId === t.id).length}</td>
                  <td className="td font-semibold text-ink-500">{fmtDate(t.createdAt)}<span className="block text-[10px] text-ink-300 font-bold">{timeAgo(t.createdAt + "T09:00:00")}</span></td>
                  <td className="td">
                    <button className={cx("btn btn-sm", t.active ? "btn-outline text-clay-600" : "btn-success")} onClick={() => setActive(t.id, !t.active)}>
                      <Power size={13} />{t.active ? "Suspend" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-4">
        <h4 className="font-display font-bold text-ink-900 mb-2">Multi-tenant security model</h4>
        <div className="grid sm:grid-cols-3 gap-3 text-sm font-semibold text-ink-600">
          <div className="rounded-xl border border-sand-200 bg-white/70 p-3.5"><p className="font-extrabold text-ink-900 mb-1">🔐 Row-level isolation</p>Every query carries the tenant key; Company A can never read Company B's customers, bookings, drivers or payments.</div>
          <div className="rounded-xl border border-sand-200 bg-white/70 p-3.5"><p className="font-extrabold text-ink-900 mb-1">🛂 Role authorization</p>Every protected endpoint re-checks role + tenant from the signed session — never the frontend alone.</div>
          <div className="rounded-xl border border-sand-200 bg-white/70 p-3.5"><p className="font-extrabold text-ink-900 mb-1">📜 Full audit trail</p>Logins, assignments, payments and permission changes are recorded with user, time and device context.</div>
        </div>
      </div>
    </div>
  );
}

const Kpi = ({ icon, k, v }: { icon: React.ReactNode; k: string; v: string }) => (
  <div className="card p-4">
    <div className="flex items-center justify-between"><p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-500">{k}</p><span className="w-8 h-8 rounded-lg bg-gold-200/60 text-gold-700 flex items-center justify-center">{icon}</span></div>
    <p className="font-display text-[24px] font-bold text-ink-900 leading-tight mt-1">{v}</p>
  </div>
);
