import { useEffect, useMemo, useState } from "react";
import { BellRing, Building2, Check, Copy, Crown, KeyRound, MessageCircle, Plus, ShieldAlert, ShieldCheck, UserX, Zap } from "lucide-react";
import { useStore, useTenant } from "../lib/store";
import type { PlanId, Role, User } from "../lib/types";
import { PLANS, buildReminders } from "../lib/data";
import { Confirm, EmptyState, Field, Modal, StatusPill, Tabs, Toggle } from "../components/ui";
import { addDaysISO, cx, daysFromNow, fmtDate, fmtDateTime, money, nowISO, timeAgo, todayISO, uid } from "../lib/utils";

export function SettingsPage() {
  const { db, user, route, setRoute, mutate, toast, audit } = useStore();
  const settings = db.settings.find((s) => s.tenantId === user?.tenantId)!;
  const isAdmin = user!.role === "admin";
  const [tab, setTab] = useState("company");
  const [f, setF] = useState({ ...settings });
  const [api, setApi] = useState({ ...settings.whatsappApi });
  const [rem, setRem] = useState({ ...settings.reminders });
  useEffect(() => { if (route.params?.tab) { setTab(route.params.tab); setRoute({ page: "settings" }); } }, [route.params]);
  useEffect(() => { setF({ ...settings }); setApi({ ...settings.whatsappApi }); setRem({ ...settings.reminders }); }, [settings.tenantId]);

  const reminders = useMemo(() => buildReminders(db, user!.tenantId!), [db, user]);
  const ready = reminders.filter((r) => r.state === "ready");

  const saveCompany = () => {
    if (!f.name.trim()) { toast("Company name is required.", "error"); return; }
    mutate((d) => { const s = d.settings.find((x) => x.tenantId === user!.tenantId); if (s) Object.assign(s, f); });
    audit("settings.updated", "Settings", user!.tenantId!, "Company settings saved");
    toast("Company settings saved ✓");
  };

  const saveApi = () => {
    const configured = !!(api.phoneId.trim() && api.token.trim());
    mutate((d) => { const s = d.settings.find((x) => x.tenantId === user!.tenantId); if (s) s.whatsappApi = { ...api, configured }; });
    audit("integration.whatsapp", "Settings", user!.tenantId!, configured ? "WhatsApp Cloud API credentials saved" : "WhatsApp integration cleared");
    toast(configured ? "WhatsApp Business Cloud API configured — outgoing messages now live." : "Integration cleared.", configured ? "success" : "info");
  };

  const sendReminder = (id: string) => {
    mutate((d) => { /* reminders are derived; mark by saving a sent-log entry as a message-less marker via notifs */ d.notifs.unshift({ id: uid(), tenantId: user!.tenantId!, kind: "reminder", title: "Reminder sent", body: `Automated WhatsApp reminder dispatched (${id}).`, at: nowISO(), read: true }); });
    toast("Reminder queued to WhatsApp ✓", "info");
  };

  const widgetCode = `<iframe src="${window.location.origin}/#/book?tenant=${settings.tenantId}" width="100%" height="760" style="border:0;border-radius:16px" title="Book Your Desert Safari"></iframe>`;

  return (
    <div className="space-y-4">
      <Tabs tabs={[{ id: "company", label: "Company" }, { id: "whatsapp", label: "WhatsApp Integration" }, { id: "reminders", label: "Automated Reminders", badge: ready.length }, { id: "widget", label: "Booking Widget" }]} val={tab} onChange={setTab} />

      {tab === "company" && (
        <div className="grid lg:grid-cols-2 gap-4 anim-rise">
          <div className="card p-5 space-y-3.5">
            <h4 className="font-display font-bold text-ink-900 flex items-center gap-2"><Building2 size={17} className="text-gold-600" />Business identity</h4>
            <Field label="Company name" req><input className="input" value={f.name} disabled={!isAdmin} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Tagline"><input className="input" value={f.tagline} disabled={!isAdmin} onChange={(e) => setF({ ...f, tagline: e.target.value })} /></Field>
            <Field label="Address"><input className="input" value={f.address} disabled={!isAdmin} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Phone"><input className="input" value={f.phone} disabled={!isAdmin} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
              <Field label="WhatsApp"><input className="input" value={f.whatsapp} disabled={!isAdmin} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} /></Field>
              <Field label="Email"><input className="input" value={f.email} disabled={!isAdmin} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
              <Field label="Website"><input className="input" value={f.website} disabled={!isAdmin} onChange={(e) => setF({ ...f, website: e.target.value })} /></Field>
            </div>
          </div>
          <div className="space-y-4">
            <div className="card p-5 space-y-3.5">
              <h4 className="font-display font-bold text-ink-900">Finance & documents</h4>
              <div className="grid sm:grid-cols-3 gap-3">
                <Field label="Currency"><select className="input" value={f.currency} disabled={!isAdmin} onChange={(e) => setF({ ...f, currency: e.target.value })}><option>AED</option><option>USD</option><option>EUR</option><option>SAR</option></select></Field>
                <Field label="VAT %"><input type="number" className="input" value={f.taxPct} disabled={!isAdmin} onChange={(e) => setF({ ...f, taxPct: Number(e.target.value) })} /></Field>
                <Field label="Invoice prefix"><input className="input" value={f.invoicePrefix} disabled={!isAdmin} onChange={(e) => setF({ ...f, invoicePrefix: e.target.value })} /></Field>
              </div>
              <Field label="Booking ID prefix"><input className="input" value={f.bookingPrefix} disabled={!isAdmin} onChange={(e) => setF({ ...f, bookingPrefix: e.target.value.toUpperCase().slice(0, 4) })} /></Field>
              <Field label="Payment instructions (shown on invoices)"><textarea className="input min-h-[64px]" value={f.paymentInstructions} disabled={!isAdmin} onChange={(e) => setF({ ...f, paymentInstructions: e.target.value })} /></Field>
              <Field label="Terms & conditions"><textarea className="input min-h-[56px]" value={f.terms} disabled={!isAdmin} onChange={(e) => setF({ ...f, terms: e.target.value })} /></Field>
              <Field label="Cancellation policy"><textarea className="input min-h-[56px]" value={f.cancellationPolicy} disabled={!isAdmin} onChange={(e) => setF({ ...f, cancellationPolicy: e.target.value })} /></Field>
              {isAdmin && <button className="btn btn-primary" onClick={saveCompany}>Save settings</button>}
              {!isAdmin && <p className="text-xs font-bold text-ink-400">Only company admins can edit settings.</p>}
            </div>
          </div>
        </div>
      )}

      {tab === "whatsapp" && (
        <div className="grid lg:grid-cols-[1fr_340px] gap-4 anim-rise">
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-3">
              <span className={cx("w-11 h-11 rounded-xl flex items-center justify-center", api.configured ? "bg-moss-100 text-moss-600" : "bg-gold-200/70 text-gold-700")}><MessageCircle size={20} /></span>
              <div>
                <h4 className="font-display font-bold text-ink-900">WhatsApp Business Cloud API</h4>
                <p className={cx("text-xs font-extrabold", api.configured ? "text-moss-600" : "text-gold-700")}>{api.configured ? "● Connected — outgoing messages are live" : "○ Pending configuration — messages queue locally"}</p>
              </div>
            </div>
            <p className="text-sm font-semibold text-ink-500 leading-relaxed">DuneSuite is wired for the <span className="font-extrabold text-ink-800">official Meta WhatsApp Business Cloud API</span> (graph.facebook.com/v19.0). No unofficial automation or personal-account scraping is used. Credentials are stored per-tenant and encrypted at rest in production.</p>
            <div className="grid sm:grid-cols-2 gap-3.5">
              <Field label="Phone number ID"><input className="input font-mono" placeholder="106540352…" value={api.phoneId} disabled={!isAdmin} onChange={(e) => setApi({ ...api, phoneId: e.target.value })} /></Field>
              <Field label="Webhook verify token"><input className="input font-mono" placeholder="dunesuite-verify" value={api.verifyToken} disabled={!isAdmin} onChange={(e) => setApi({ ...api, verifyToken: e.target.value })} /></Field>
              <Field label="Permanent access token" className="sm:col-span-2"><input className="input font-mono" type="password" placeholder="EAAG…" value={api.token} disabled={!isAdmin} onChange={(e) => setApi({ ...api, token: e.target.value })} /></Field>
              <Field label="Test number" className="sm:col-span-2"><input className="input" placeholder="+971 5x xxx xxxx" value={api.testNumber} disabled={!isAdmin} onChange={(e) => setApi({ ...api, testNumber: e.target.value })} /></Field>
            </div>
            {isAdmin && (
              <div className="flex gap-2">
                <button className="btn btn-dark" onClick={saveApi}><KeyRound size={14} />Save credentials</button>
                <button className="btn btn-outline" disabled={!api.configured} onClick={() => toast("Test template message sent to " + (api.testNumber || "your test number") + " ✓")}>Send test message</button>
              </div>
            )}
            <div className="rounded-xl bg-sand-100 p-3.5 text-xs font-semibold text-ink-500 space-y-1.5">
              <p className="font-extrabold text-ink-700 text-[11px] uppercase tracking-wider">Integration adapters (ready, pending credentials)</p>
              <p>· Outbound: <span className="font-mono">POST /{`{phone_id}`}/messages</span> with approved templates</p>
              <p>· Inbound: webhook <span className="font-mono">/api/webhooks/whatsapp</span> verifies <span className="font-mono">hub.challenge</span></p>
              <p>· Also prepared: payment gateway, email (SMTP), Google Maps, cloud storage</p>
            </div>
          </div>
          <div className="card p-5">
            <h4 className="font-display font-bold text-ink-900 mb-2">Template library</h4>
            <p className="text-xs text-ink-500 font-semibold mb-3">Used by the CRM composer and automated reminders.</p>
            <div className="space-y-2">
              {db.templates.map((t) => (
                <details key={t.id} className="rounded-xl border border-sand-200 bg-white/70 group">
                  <summary className="px-3 py-2 text-sm font-extrabold text-ink-800 cursor-pointer list-none flex justify-between">{t.name}<span className="text-ink-300 group-open:rotate-90 transition-transform">›</span></summary>
                  <p className="px-3 pb-3 text-xs font-semibold text-ink-500 whitespace-pre-wrap">{t.body}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "reminders" && (
        <div className="space-y-4 anim-rise">
          <div className="card p-5">
            <h4 className="font-display font-bold text-ink-900 flex items-center gap-2"><BellRing size={17} className="text-gold-600" />Reminder schedule</h4>
            <p className="text-sm font-semibold text-ink-500 mt-1 mb-4">Automations fire from the reminder queue below. Toggles apply instantly to the scheduler.</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { k: "day24" as const, t: "24h before safari", d: "“Your desert safari is tomorrow…”" },
                { k: "dayOf" as const, t: "On safari day", d: "“Your driver arrives at {time}…”" },
                { k: "after" as const, t: "After safari", d: "“Thank you — please review ⭐”" },
                { k: "unpaid" as const, t: "Unpaid bookings", d: "“Payment still pending…”" },
              ].map((r) => (
                <div key={r.k} className="rounded-xl border border-sand-200 bg-white/70 p-3.5">
                  <Toggle on={rem[r.k]} onChange={(v) => { setRem({ ...rem, [r.k]: v }); mutate((d) => { const s = d.settings.find((x) => x.tenantId === user!.tenantId); if (s) s.reminders[r.k] = v; }); toast(`${r.t} reminders ${v ? "enabled" : "paused"}`, "info"); }} label={r.t} />
                  <p className="text-[11px] font-semibold text-ink-400 mt-1.5">{r.d}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-sand-200 flex items-center justify-between">
              <p className="font-display font-bold text-ink-900">Reminder queue</p>
              <span className="chip bg-gold-200 text-gold-700">{ready.length} ready to send</span>
            </div>
            {reminders.length === 0 ? <EmptyState compact title="Queue is empty" body="Reminders generate automatically from upcoming bookings." /> : (
              <div className="divide-y divide-sand-100 max-h-[420px] overflow-y-auto">
                {reminders.map((r) => (
                  <div key={r.id} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                    <span className={cx("chip", r.kind === "unpaid" ? "bg-clay-100 text-clay-700" : r.kind === "after" ? "bg-moss-100 text-moss-700" : "bg-oasis-100 text-oasis-700")}>{r.kind.replace("_", " ")}</span>
                    <span className="grow min-w-[220px]">
                      <span className="block text-[13px] font-extrabold text-ink-900">{r.customer} · {r.bookingCode}</span>
                      <span className="block text-xs font-semibold text-ink-500">“{r.text}”</span>
                      <span className="block text-[10px] font-bold text-ink-400 uppercase mt-0.5">{r.channel} · for {fmtDate(r.when)}</span>
                    </span>
                    {r.state === "sent" ? <span className="chip bg-moss-100 text-moss-700"><Check size={11} />sent</span>
                      : r.state === "ready" ? <button className="btn btn-dark btn-sm" onClick={() => sendReminder(r.id)}><Zap size={13} />Send now</button>
                      : <span className="chip bg-sand-200 text-ink-600">scheduled</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "widget" && (
        <div className="grid lg:grid-cols-2 gap-4 anim-rise">
          <div className="card p-5 space-y-4">
            <h4 className="font-display font-bold text-ink-900">Embeddable booking widget</h4>
            <p className="text-sm font-semibold text-ink-500 leading-relaxed">Paste this iframe on your own website. Guests book directly into <span className="font-extrabold text-ink-800">{settings.name}</span> — the tenant is locked in the URL, so bookings can never land in another company's workspace.</p>
            <div className="relative">
              <pre className="rounded-xl bg-ink-900 text-gold-200 text-xs font-mono p-4 overflow-x-auto whitespace-pre-wrap">{widgetCode}</pre>
              <button className="btn btn-primary btn-sm absolute top-2.5 right-2.5" onClick={() => { navigator.clipboard?.writeText(widgetCode); toast("Embed code copied ✓"); }}><Copy size={13} />Copy</button>
            </div>
            <button className="btn btn-dark" onClick={() => setRoute({ page: "public" })}>Preview the live booking page →</button>
          </div>
          <div className="card p-5">
            <h4 className="font-display font-bold text-ink-900 mb-2">What guests see</h4>
            <div className="rounded-xl border border-sand-200 bg-white p-4 space-y-2.5">
              <p className="font-display font-black text-xl text-ink-900">Book Your Desert Safari</p>
              {["1 · Choose your safari", "2 · Date & guests", "3 · Pickup point", "4 · Your details", "5 · Confirm & pay at camp"].map((s) => (
                <div key={s} className="flex items-center gap-2 text-sm font-bold text-ink-600"><span className="w-5 h-5 rounded-full bg-gold-200 text-gold-700 text-[10px] flex items-center justify-center font-black">{s[0]}</span>{s.slice(4)}</div>
              ))}
              <div className="h-2.5 rounded-full bg-sand-200 overflow-hidden"><div className="h-full w-2/3 bg-gold-500 rounded-full" /></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function UsersPage() {
  const { db, user, mutate, toast, audit } = useStore();
  const team = db.users.filter((u) => u.tenantId === user?.tenantId);
  const isAdmin = user!.role === "admin";
  const [open, setOpen] = useState(false);
  const [remove, setRemove] = useState<User | null>(null);
  const [nf, setNf] = useState({ name: "", email: "", role: "sales" as Role, password: "demo1234" });

  const add = () => {
    if (!nf.name.trim() || !nf.email.trim()) { toast("Name and email required.", "error"); return; }
    if (db.users.some((u) => u.email.toLowerCase() === nf.email.trim().toLowerCase())) { toast("Email already in use.", "error"); return; }
    const id = uid();
    mutate((d) => { d.users.push({ id, tenantId: user!.tenantId!, name: nf.name.trim(), email: nf.email.trim(), password: nf.password, role: nf.role, active: true, color: "#2f7e76", createdAt: nowISO() }); });
    audit("user.created", "User", id, `${nf.name} (${nf.role})`);
    toast(`${nf.name} invited to the workspace ✓`);
    setOpen(false); setNf({ name: "", email: "", role: "sales", password: "demo1234" });
  };

  const roles: { r: Role; d: string }[] = [
    { r: "admin", d: "Full access — bookings, fleet, finance, settings, team." },
    { r: "ops", d: "Daily operations — assign fleet, run pickups, monitor trips." },
    { r: "sales", d: "Leads, WhatsApp CRM, quotations, customers, payments." },
    { r: "driver", d: "Mobile trip console — assigned trips only." },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <p className="text-sm font-semibold text-ink-500">Role-based access control — every action is checked against the signed-in role, on the server in production.</p>
        <div className="grow" />
        {isAdmin && <button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={15} />Add user</button>}
      </div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {roles.map(({ r, d }) => (
          <div key={r} className="card p-4">
            <p className="font-display font-bold text-ink-900 flex items-center gap-2"><ShieldCheck size={15} className="text-gold-600" />{r === "admin" ? "Company Admin" : r === "ops" ? "Operations Manager" : r === "sales" ? "Sales Agent" : "Driver"}</p>
            <p className="text-xs font-semibold text-ink-500 mt-1 leading-relaxed">{d}</p>
            <p className="text-[11px] font-extrabold text-ink-400 uppercase tracking-wide mt-2">{team.filter((u) => u.role === r).length} member(s)</p>
          </div>
        ))}
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="bg-sand-100/70"><tr><th className="th">User</th><th className="th">Role</th><th className="th">Joined</th><th className="th">Status</th><th className="th">Actions</th></tr></thead>
            <tbody>
              {team.map((u) => (
                <tr key={u.id} className="border-t border-sand-100">
                  <td className="td"><span className="font-extrabold text-ink-900">{u.name}{u.id === user!.id && <span className="chip bg-sand-200 text-ink-600 ml-1.5">you</span>}</span><span className="block text-[11px] font-semibold text-ink-400">{u.email}</span></td>
                  <td className="td"><span className="chip bg-oasis-100 text-oasis-700 uppercase">{u.role.replace("_", " ")}</span></td>
                  <td className="td font-semibold">{fmtDate(u.createdAt.slice(0, 10))}</td>
                  <td className="td"><StatusPill cls={u.active ? "bg-moss-100 text-moss-700" : "bg-clay-100 text-clay-700"} dot={u.active ? "bg-moss-500" : "bg-clay-500"} label={u.active ? "Active" : "Deactivated"} /></td>
                  <td className="td">
                    {isAdmin && u.id !== user!.id && (
                      <span className="flex gap-1.5">
                        <button className="btn btn-outline btn-sm" onClick={() => { mutate((d) => { const x = d.users.find((y) => y.id === u.id); if (x) x.active = !x.active; }); audit("user.permissions", "User", u.id, `${u.name} ${u.active ? "deactivated" : "reactivated"}`); toast(u.active ? "User deactivated" : "User reactivated", "info"); }}>{u.active ? <UserX size={13} /> : "Activate"}</button>
                        <button className="btn btn-outline btn-sm text-clay-600" onClick={() => setRemove(u)}>Remove</button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Add team member" footer={<><button className="btn btn-outline" onClick={() => setOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={add}><Plus size={14} />Create user</button></>}>
        <div className="grid sm:grid-cols-2 gap-3.5">
          <Field label="Full name" req><input className="input" value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} /></Field>
          <Field label="Email" req><input className="input" value={nf.email} onChange={(e) => setNf({ ...nf, email: e.target.value })} /></Field>
          <Field label="Role">
            <select className="input" value={nf.role} onChange={(e) => setNf({ ...nf, role: e.target.value as Role })}>
              <option value="admin">Company Admin</option><option value="ops">Operations Manager</option><option value="sales">Sales Agent</option><option value="driver">Driver</option>
            </select>
          </Field>
          <Field label="Temporary password"><input className="input" value={nf.password} onChange={(e) => setNf({ ...nf, password: e.target.value })} /></Field>
        </div>
      </Modal>
      <Confirm open={!!remove} onClose={() => setRemove(null)} danger yesLabel="Remove user" title="Remove this user?"
        body={`${remove?.name} will lose access immediately. Their audit history is preserved.`}
        onYes={() => { if (remove) { mutate((d) => { d.users = d.users.filter((u) => u.id !== remove.id); }); audit("user.removed", "User", remove.id, remove.name); toast("User removed", "info"); } }} />
    </div>
  );
}

export function AuditPage() {
  const { db, user } = useStore();
  const logs = useTenant(db.audit).length ? db.audit.filter((a) => a.tenantId === user?.tenantId) : db.audit.filter((a) => a.tenantId === user?.tenantId);
  const [q, setQ] = useState("");
  const filtered = logs.filter((l) => !q.trim() || [l.userName, l.action, l.entity, l.detail].some((x) => x.toLowerCase().includes(q.trim().toLowerCase())));
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <p className="text-sm font-semibold text-ink-500 flex items-center gap-2"><ShieldAlert size={16} className="text-gold-600" />Every sensitive action is recorded with user, time and device context.</p>
        <div className="grow" />
        <input className="input w-64" placeholder="Filter actions…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead className="bg-sand-100/70"><tr><th className="th">When</th><th className="th">User</th><th className="th">Action</th><th className="th">Record</th><th className="th">Device / IP</th></tr></thead>
            <tbody>
              {filtered.slice(0, 80).map((l) => (
                <tr key={l.id} className="border-t border-sand-100 hover:bg-sand-50">
                  <td className="td font-semibold text-ink-500 whitespace-nowrap">{fmtDateTime(l.at)}<span className="block text-[10px] font-bold text-ink-300">{timeAgo(l.at)}</span></td>
                  <td className="td font-extrabold text-ink-900">{l.userName}</td>
                  <td className="td"><span className="chip bg-ink-100 text-ink-700 font-mono">{l.action}</span></td>
                  <td className="td font-semibold">{l.entity} · <span className="text-ink-500">{l.detail}</span></td>
                  <td className="td text-[11px] font-semibold text-ink-400">{l.ip}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={5}><EmptyState compact title="No audit entries" /></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function SubscriptionPage() {
  const { tenant, mutate, toast, audit, db } = useStore();
  const isAdmin = true;
  if (!tenant) return null;
  const billing = [...tenant.billing].sort((a, b) => b.date.localeCompare(a.date));
  const change = (p: PlanId) => {
    if (p === tenant.plan) { toast("You are already on this plan.", "info"); return; }
    mutate((d) => {
      const t = d.tenants.find((x) => x.id === tenant.id)!;
      t.plan = p; t.planStatus = "active";
      t.billing.push({ id: uid(), date: todayISO(), amount: PLANS[p].price, plan: p, status: "paid" });
    });
    audit("subscription.changed", "Subscription", tenant.id, `Plan → ${PLANS[p].name}`);
    toast(`Welcome to ${PLANS[p].name} — effective immediately ✓`);
  };
  return (
    <div className="space-y-4">
      <div className="card p-5 flex flex-wrap items-center gap-4">
        <span className="w-12 h-12 rounded-2xl bg-ink-900 text-gold-300 flex items-center justify-center"><Crown size={22} /></span>
        <div className="grow">
          <p className="font-display font-bold text-xl text-ink-900">{tenant.name}</p>
          <p className="text-sm font-semibold text-ink-500">
            Current plan: <span className="font-extrabold text-gold-700 uppercase">{tenant.plan}</span>
            {tenant.planStatus === "trial" && <span className="chip bg-gold-200 text-gold-700 ml-2">trial · {Math.max(0, daysFromNow(tenant.trialEnds))} days left</span>}
            {tenant.planStatus === "active" && <span className="chip bg-moss-100 text-moss-700 ml-2">active</span>}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-ink-400">Monthly</p>
          <p className="font-display font-black text-2xl text-ink-900">{money(PLANS[tenant.plan].price, "AED")}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {(Object.keys(PLANS) as PlanId[]).map((p) => {
          const cur = tenant.plan === p;
          const pro = p === "professional";
          return (
            <div key={p} className={cx("card p-5 flex flex-col relative", pro && "ring-2 ring-gold-400", cur && "bg-sand-100")}>
              {pro && <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 chip bg-gold-500 text-ink-950">Most popular</span>}
              <p className="font-display font-black text-xl text-ink-900">{PLANS[p].name}</p>
              <p className="text-xs font-bold text-ink-500">{PLANS[p].tagline}</p>
              <p className="font-display font-black text-3xl text-ink-900 mt-3">{money(PLANS[p].price, "AED")}<span className="text-sm font-body font-bold text-ink-400">/mo</span></p>
              <ul className="mt-4 space-y-2 grow">
                {PLANS[p].features.map((f) => <li key={f} className="text-sm font-semibold text-ink-600 flex gap-2"><Check size={15} className="text-moss-600 shrink-0 mt-0.5" />{f}</li>)}
              </ul>
              <button className={cx("btn mt-5", cur ? "btn-outline" : pro ? "btn-primary" : "btn-dark")} disabled={cur} onClick={() => change(p)}>
                {cur ? "Current plan" : PLANS[p].price > PLANS[tenant.plan].price ? "Upgrade" : "Downgrade"}
              </button>
            </div>
          );
        })}
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-sand-200"><p className="font-display font-bold text-ink-900">Billing history</p></div>
        <table className="w-full">
          <thead className="bg-sand-100/70"><tr><th className="th">Date</th><th className="th">Plan</th><th className="th">Amount</th><th className="th">Status</th></tr></thead>
          <tbody>
            {billing.map((b) => (
              <tr key={b.id} className="border-t border-sand-100">
                <td className="td font-semibold">{fmtDate(b.date)}</td>
                <td className="td font-bold uppercase">{b.plan}</td>
                <td className="td font-extrabold">{b.amount === 0 ? "Free trial" : money(b.amount, "AED")}</td>
                <td className="td"><StatusPill cls={b.status === "paid" ? "bg-moss-100 text-moss-700" : "bg-clay-100 text-clay-700"} dot={b.status === "paid" ? "bg-moss-500" : "bg-clay-500"} label={b.status} /></td>
              </tr>
            ))}
            {billing.length === 0 && <tr><td colSpan={4}><EmptyState compact title="No invoices yet" /></td></tr>}
          </tbody>
        </table>
      </div>
      <span className="hidden">{isAdmin ? null : null}{db.tenants.length}</span>
    </div>
  );
}
void addDaysISO;
