import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  BarChart3, Bell, CalendarDays, CalendarRange, ChevronDown, Columns, Compass, CreditCard, Crown,
  FileText, LayoutDashboard, LogOut, MapPin, Menu, MessageCircle, Palmtree, Plus, RotateCcw,
  ScrollText, Search, Settings, ShieldCheck, Ticket, TrendingUp, Truck, UserCog, UserPlus, Users,
} from "lucide-react";
import { useStore } from "../lib/store";
import type { PageId, Role, Route } from "../lib/types";
import { cx, daysFromNow, fmtDateTime, timeAgo } from "../lib/utils";
import { Avatar, EmptyState, KeyHint, Modal } from "./ui";

export const Logo = ({ dark }: { dark?: boolean }) => (
  <span className="flex items-center gap-2.5">
    <span className="w-9 h-9 rounded-xl bg-ink-950 border border-gold-500/30 flex items-center justify-center overflow-hidden relative shrink-0">
      <svg viewBox="0 0 32 32" className="w-9 h-9">
        <circle cx="22" cy="10" r="4.5" fill="#DCAE4F" />
        <path d="M0 24c6-6 11-7 16-4s11 2 16-2v14H0z" fill="#C8912F" />
        <path d="M0 27c7-4 13-4 19 0s10 2 13-1v6H0z" fill="#855C18" />
      </svg>
    </span>
    <span className="leading-none">
      <span className={cx("font-display font-black text-[17px] tracking-tight block", dark ? "text-sand-50" : "text-ink-900")}>DuneSuite</span>
      <span className={cx("text-[9px] font-extrabold uppercase tracking-[0.22em] block mt-0.5", dark ? "text-gold-400" : "text-gold-600")}>Safari OS</span>
    </span>
  </span>
);

const NAV: { section: string; items: { id: PageId; label: string; icon: typeof Bell }[] }[] = [
  { section: "Overview", items: [{ id: "dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  { section: "Sales & CRM", items: [{ id: "crm", label: "WhatsApp CRM", icon: MessageCircle }, { id: "customers", label: "Customers", icon: Users }, { id: "quotations", label: "Quotations", icon: FileText }] },
  { section: "Operations", items: [{ id: "bookings", label: "Bookings", icon: Ticket }, { id: "calendar", label: "Calendar", icon: CalendarRange }, { id: "ops", label: "Ops Board", icon: Columns }, { id: "pickups", label: "Pickups", icon: MapPin }, { id: "trips", label: "Trips", icon: Compass }] },
  { section: "Fleet & Product", items: [{ id: "fleet", label: "Fleet", icon: Truck }, { id: "drivers", label: "Drivers", icon: UserCog }, { id: "packages", label: "Safari Packages", icon: Palmtree }] },
  { section: "Finance & Insight", items: [{ id: "payments", label: "Payments", icon: CreditCard }, { id: "reports", label: "Reports", icon: BarChart3 }, { id: "analytics", label: "Analytics", icon: TrendingUp }] },
  { section: "Platform", items: [{ id: "settings", label: "Settings", icon: Settings }, { id: "users", label: "Team & Roles", icon: ShieldCheck }, { id: "audit", label: "Audit Log", icon: ScrollText }, { id: "subscription", label: "Subscription", icon: Crown }] },
];

const SUPER_NAV: { id: PageId; label: string; icon: typeof Bell }[] = [
  { id: "admin", label: "Platform Console", icon: ShieldCheck },
  { id: "subscription", label: "Plans & Billing", icon: Crown },
];

const PERMS: Record<Role, PageId[] | "all"> = {
  super_admin: ["admin", "subscription"],
  admin: "all",
  ops: ["dashboard", "bookings", "calendar", "ops", "pickups", "trips", "fleet", "drivers", "packages", "customers", "quotations", "payments", "reports", "analytics", "settings", "users", "audit", "subscription"],
  sales: ["dashboard", "crm", "customers", "bookings", "quotations", "payments", "packages", "calendar", "reports", "analytics", "subscription"],
  driver: [],
};

export const PAGE_TITLES: Record<PageId, string> = {
  dashboard: "Dashboard", bookings: "Bookings", crm: "WhatsApp CRM", customers: "Customers", fleet: "Fleet",
  drivers: "Drivers", packages: "Safari Packages", payments: "Payments & Invoices", quotations: "Quotations",
  calendar: "Calendar", ops: "Operations Board", pickups: "Pickup Board", trips: "Safari Trips",
  reports: "Reports", analytics: "Business Analytics", settings: "Company Settings", users: "Team & Roles",
  audit: "Audit Log", subscription: "Subscription & Billing", admin: "Platform Console", public: "Public Booking Page",
};

const allowed = (role: Role, p: PageId) => PERMS[role] === "all" || (PERMS[role] as PageId[]).includes(p);

function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { db, user, setRoute } = useStore();
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setQ(""); setTimeout(() => inputRef.current?.focus(), 60); } }, [open]);

  const results = useMemo(() => {
    const tid = user?.tenantId;
    if (!q.trim() || !tid) return null;
    const s = q.trim().toLowerCase();
    const has = (...f: (string | undefined)[]) => f.some((x) => x?.toLowerCase().includes(s));
    const book = db.bookings.filter((b) => b.tenantId === tid && (has(b.code, db.customers.find((c) => c.id === b.customerId)?.name, db.packages.find((p) => p.id === b.packageId)?.name))).slice(0, 5);
    return {
      customers: db.customers.filter((c) => c.tenantId === tid && has(c.name, c.phone, c.email, c.country)).slice(0, 4),
      bookings: book,
      leads: db.leads.filter((l) => l.tenantId === tid && has(l.name, l.phone, l.email)).slice(0, 4),
      drivers: db.drivers.filter((d) => d.tenantId === tid && has(d.name, d.phone, d.licenseNo)).slice(0, 4),
      vehicles: db.vehicles.filter((v) => v.tenantId === tid && has(v.plate, v.make, v.model)).slice(0, 4),
      invoices: db.payments.filter((p) => p.tenantId === tid && has(p.invoiceNo, p.ref)).slice(0, 4),
      quotes: db.quotations.filter((x) => x.tenantId === tid && has(x.code, x.partyName)).slice(0, 4),
    };
  }, [q, db, user]);

  const go = (page: PageId, id?: string) => { setRoute({ page, params: id ? { open: id } : undefined }); onClose(); };
  const count = results ? Object.values(results).reduce((a, x) => a + x.length, 0) : 0;

  return (
    <Modal open={open} onClose={onClose} title="Global search" sub="Customers · bookings · leads · drivers · vehicles · invoices · quotations" size="lg">
      <div className="relative mb-4">
        <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
        <input ref={inputRef} className="input pl-10 py-2.5 text-base" placeholder="Try “DS-2026”, a name, phone, plate or invoice…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {!results && (
        <div className="text-center py-8 text-sm text-ink-500">
          <p className="font-semibold text-ink-700 mb-1">Search everything in one keystroke.</p>
          Booking codes like <span className="font-mono font-bold text-gold-700">DS-2026-010019</span> jump straight to the record.
        </div>
      )}
      {results && count === 0 && <EmptyState compact title="No matches" body={`Nothing found for “${q}” in your company workspace.`} />}
      {results && count > 0 && (
        <div className="space-y-4">
          {results.bookings.length > 0 && <Group label="Bookings">{results.bookings.map((b) => <Row key={b.id} title={b.code} sub={`${db.customers.find((c) => c.id === b.customerId)?.name ?? ""} · ${b.date} ${b.pickupTime}`} onClick={() => go("bookings", b.id)} />)}</Group>}
          {results.customers.length > 0 && <Group label="Customers">{results.customers.map((c) => <Row key={c.id} title={c.name} sub={`${c.phone} · ${c.country}`} onClick={() => go("customers", c.id)} />)}</Group>}
          {results.leads.length > 0 && <Group label="Leads">{results.leads.map((l) => <Row key={l.id} title={l.name} sub={`${l.whatsapp} · ${l.source}`} onClick={() => go("crm", l.id)} />)}</Group>}
          {results.drivers.length > 0 && <Group label="Drivers">{results.drivers.map((d) => <Row key={d.id} title={d.name} sub={`Licence ${d.licenseNo}`} onClick={() => go("drivers", d.id)} />)}</Group>}
          {results.vehicles.length > 0 && <Group label="Vehicles">{results.vehicles.map((v) => <Row key={v.id} title={v.plate} sub={`${v.make} ${v.model} · ${v.seats} seats`} onClick={() => go("fleet", v.id)} />)}</Group>}
          {results.invoices.length > 0 && <Group label="Invoices">{results.invoices.map((p) => <Row key={p.id} title={p.invoiceNo} sub={`AED ${p.amount.toLocaleString()} · ${p.ref}`} onClick={() => go("payments", p.bookingId)} />)}</Group>}
          {results.quotes.length > 0 && <Group label="Quotations">{results.quotes.map((x) => <Row key={x.id} title={x.code} sub={`${x.partyName} · AED ${x.total.toLocaleString()}`} onClick={() => go("quotations", x.id)} />)}</Group>}
        </div>
      )}
    </Modal>
  );
}

const Group = ({ label, children }: { label: string; children: ReactNode }) => (
  <div>
    <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink-400 mb-1.5">{label}</p>
    <div className="space-y-1">{children}</div>
  </div>
);
const Row = ({ title, sub, onClick }: { title: string; sub: string; onClick: () => void }) => (
  <button onClick={onClick} className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-sand-100 transition-colors text-left cursor-pointer group">
    <span>
      <span className="block text-sm font-bold text-ink-900 group-hover:text-gold-700 transition-colors">{title}</span>
      <span className="block text-xs text-ink-500">{sub}</span>
    </span>
    <span className="text-ink-300 group-hover:text-gold-600 transition-colors"><ChevronDown className="-rotate-90" size={16} /></span>
  </button>
);

export default function Layout({ children }: { children: ReactNode }) {
  const { user, tenant, db, route, setRoute, logout, mutate, resetDemo } = useStore();
  const [mobileNav, setMobileNav] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const role = user!.role;

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearchOpen((v) => !v); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const notifs = useMemo(() => db.notifs.filter((n) => n.tenantId === user?.tenantId).slice(0, 30), [db.notifs, user]);
  const unread = notifs.filter((n) => !n.read).length;

  const quickActions: { label: string; icon: typeof Plus; page: PageId; roles: Role[] }[] = [
    { label: "New Booking", icon: Ticket, page: "bookings", roles: ["admin", "ops", "sales"] },
    { label: "New Lead", icon: MessageCircle, page: "crm", roles: ["admin", "sales", "ops"] },
    { label: "Add Customer", icon: UserPlus, page: "customers", roles: ["admin", "sales", "ops"] },
    { label: "Create Quotation", icon: FileText, page: "quotations", roles: ["admin", "sales"] },
    { label: "Record Payment", icon: CreditCard, page: "payments", roles: ["admin", "sales", "ops"] },
    { label: "Add Driver", icon: UserCog, page: "drivers", roles: ["admin", "ops"] },
    { label: "Add Vehicle", icon: Truck, page: "fleet", roles: ["admin", "ops"] },
    { label: "Add Package", icon: Palmtree, page: "packages", roles: ["admin"] },
  ];
  const visibleQuick = quickActions.filter((a) => a.roles.includes(role) && allowed(role, a.page));

  const nav = (
    <nav className="flex flex-col grow overflow-y-auto py-4 px-3 gap-4">
      {(role === "super_admin" ? [{ section: "Super Admin", items: SUPER_NAV }] : NAV).map((sec) => {
        const items = sec.items.filter((i) => allowed(role, i.id));
        if (!items.length) return null;
        return (
          <div key={sec.section}>
            <p className="px-2.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-ink-400/80 mb-1.5">{sec.section}</p>
            <div className="space-y-0.5">
              {items.map((item) => {
                const active = route.page === item.id;
                const Icon = item.icon;
                return (
                  <button key={item.id} onClick={() => { setRoute({ page: item.id }); setMobileNav(false); }}
                    className={cx("w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-bold transition-all duration-150 cursor-pointer",
                      active ? "bg-gold-500 text-ink-950 shadow-sm" : "text-sand-200/80 hover:text-sand-50 hover:bg-white/5")}>
                    <Icon size={16} className={active ? "" : "text-gold-400/70"} />{item.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );

  const sidebar = (
    <div className="flex flex-col h-full bg-ink-900 grain relative">
      <div className="px-4 pt-5 pb-4 border-b border-white/5"><Logo dark /></div>
      {nav}
      <div className="p-3 border-t border-white/5">
        {tenant && (
          <button onClick={() => setRoute({ page: "subscription" })} className="w-full text-left px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-gold-400">{tenant.plan} · {tenant.planStatus}</p>
            <p className="text-[11px] font-semibold text-sand-200/70 mt-0.5">
              {tenant.planStatus === "trial" ? `${Math.max(0, daysFromNow(tenant.trialEnds))} trial days left` : "Billing monthly"}
            </p>
          </button>
        )}
        <p className="text-[10px] text-ink-500 text-center mt-2.5 font-semibold">{tenant?.name}</p>
      </div>
    </div>
  );

  const demoAccounts = db.users.filter((u) => u.active && u.password === "demo1234");

  return (
    <div className="min-h-screen flex dune-bg">
      <aside className="hidden lg:block w-[228px] shrink-0 fixed inset-y-0 left-0 z-30">{sidebar}</aside>

      {mobileNav && (
        <div className="fixed inset-0 z-50 lg:hidden anim-fade" onClick={() => setMobileNav(false)}>
          <div className="absolute inset-0 bg-ink-950/60" />
          <aside className="absolute left-0 top-0 h-full w-[260px] anim-rise" onClick={(e) => e.stopPropagation()}>{sidebar}</aside>
        </div>
      )}

      <div className="grow lg:pl-[228px] flex flex-col min-w-0">
        <header className="sticky top-0 z-40 bg-[#f1ead9]/85 backdrop-blur-md border-b border-sand-300/60">
          <div className="flex items-center gap-2 px-4 sm:px-6 h-[58px]">
            <button className="lg:hidden btn btn-ghost btn-sm -ml-1" onClick={() => setMobileNav(true)} aria-label="Menu"><Menu size={19} /></button>
            <div className="min-w-0">
              <h1 className="font-display font-bold text-[17px] text-ink-900 truncate leading-tight">{PAGE_TITLES[route.page]}</h1>
              <p className="text-[10px] font-bold text-ink-400 uppercase tracking-wider hidden sm:block">{tenant?.name}</p>
            </div>
            <div className="grow" />
            <button onClick={() => setSearchOpen(true)} className="hidden sm:flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-lg border border-sand-300 bg-white/70 text-sm text-ink-400 hover:border-gold-400 hover:text-ink-600 transition-colors cursor-pointer w-56">
              <Search size={15} /><span className="grow text-left font-semibold">Search…</span><KeyHint>⌘K</KeyHint>
            </button>
            <button onClick={() => setSearchOpen(true)} className="sm:hidden btn btn-ghost btn-sm" aria-label="Search"><Search size={18} /></button>

            {visibleQuick.length > 0 && (
              <div className="relative">
                <button className="btn btn-dark btn-sm sm:btn" onClick={() => setQuickOpen((v) => !v)}><Plus size={16} /><span className="hidden md:inline">Quick add</span><ChevronDown size={13} className={cx("transition-transform", quickOpen && "rotate-180")} /></button>
                {quickOpen && (
                  <div className="absolute right-0 mt-2 w-56 card p-1.5 z-50 anim-pop" onMouseLeave={() => setQuickOpen(false)}>
                    {visibleQuick.map((a) => { const I = a.icon; return (
                      <button key={a.label} onClick={() => { setRoute({ page: a.page, params: { new: "1" } }); setQuickOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-bold text-ink-700 hover:bg-sand-100 hover:text-ink-950 transition-colors cursor-pointer">
                        <I size={15} className="text-gold-600" />{a.label}
                      </button>
                    ); })}
                  </div>
                )}
              </div>
            )}

            <div className="relative">
              <button className="btn btn-ghost btn-sm relative" onClick={() => { setBellOpen((v) => !v); setUserOpen(false); }} aria-label="Notifications">
                <Bell size={18} />
                {unread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-full bg-clay-500 text-white text-[10px] font-extrabold flex items-center justify-center pulse-dot">{unread}</span>}
              </button>
              {bellOpen && (
                <div className="absolute right-0 mt-2 w-[min(92vw,400px)] card z-50 anim-pop overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-sand-200">
                    <p className="font-display font-bold text-ink-900">Notifications</p>
                    <button className="text-xs font-bold text-gold-700 hover:text-gold-600 cursor-pointer" onClick={() => mutate((d) => { d.notifs.forEach((n) => { if (n.tenantId === user?.tenantId) n.read = true; }); })}>Mark all read</button>
                  </div>
                  <div className="max-h-[380px] overflow-y-auto">
                    {notifs.length === 0 && <EmptyState compact title="All quiet in the desert" body="Booking, payment and fleet alerts will land here." />}
                    {notifs.map((n) => (
                      <button key={n.id} onClick={() => { mutate((d) => { const x = d.notifs.find((y) => y.id === n.id); if (x) x.read = true; }); if (n.link) { setRoute({ page: n.link.page as PageId, params: n.link.id ? { open: n.link.id } : undefined }); setBellOpen(false); } }}
                        className={cx("w-full text-left px-4 py-3 border-b border-sand-100 last:border-0 hover:bg-sand-100/70 transition-colors cursor-pointer", !n.read && "bg-gold-200/20")}>
                        <div className="flex items-start gap-2.5">
                          <span className={cx("w-2 h-2 rounded-full mt-1.5 shrink-0", n.read ? "bg-sand-300" : "bg-gold-500")} />
                          <span className="min-w-0">
                            <span className="block text-[13px] font-extrabold text-ink-900 leading-snug">{n.title}</span>
                            <span className="block text-xs text-ink-500 mt-0.5 leading-snug">{n.body}</span>
                            <span className="block text-[10px] font-bold text-ink-400 mt-1 uppercase tracking-wide">{timeAgo(n.at)}</span>
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <button className="flex items-center gap-2 pl-1.5 pr-1 py-1 rounded-lg hover:bg-sand-200/70 transition-colors cursor-pointer" onClick={() => { setUserOpen((v) => !v); setBellOpen(false); }}>
                <Avatar name={user!.name} color={user!.color} size={30} />
                <span className="hidden md:block text-left leading-tight">
                  <span className="block text-[13px] font-extrabold text-ink-900">{user!.name}</span>
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-gold-700">{role.replace("_", " ")}</span>
                </span>
                <ChevronDown size={14} className={cx("text-ink-400 transition-transform hidden md:block", userOpen && "rotate-180")} />
              </button>
              {userOpen && (
                <div className="absolute right-0 mt-2 w-64 card p-2 z-50 anim-pop" onMouseLeave={() => setUserOpen(false)}>
                  <div className="px-2.5 py-2 border-b border-sand-200 mb-1">
                    <p className="text-sm font-extrabold text-ink-900">{user!.name}</p>
                    <p className="text-xs text-ink-500">{user!.email}</p>
                  </div>
                  <button className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm font-bold text-ink-700 hover:bg-sand-100 cursor-pointer" onClick={() => { setRoute({ page: "public" }); setUserOpen(false); }}><CalendarDays size={15} className="text-gold-600" />Public booking page</button>
                  <button className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm font-bold text-ink-700 hover:bg-sand-100 cursor-pointer" onClick={() => { resetDemo(); setUserOpen(false); }}>
                    <RotateCcw size={15} className="text-gold-600" />Reset demo data
                  </button>
                  <div className="border-t border-sand-200 mt-1 pt-1.5 px-2.5 pb-1">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-ink-400 mb-1">Switch demo account</p>
                    <div className="max-h-40 overflow-y-auto space-y-0.5">
                      {demoAccounts.map((a) => (
                        <button key={a.id} disabled={a.id === user!.id} onClick={() => { localStorage.setItem("dunesuite_session_v1", JSON.stringify({ userId: a.id, tenantId: a.tenantId })); window.location.hash = ""; window.location.reload(); }}
                          className="w-full flex items-center gap-2 px-1.5 py-1.5 rounded-lg hover:bg-sand-100 disabled:opacity-40 cursor-pointer text-left">
                          <Avatar name={a.name} color={a.color} size={24} />
                          <span className="min-w-0">
                            <span className="block text-xs font-extrabold text-ink-800 truncate">{a.name}</span>
                            <span className="block text-[10px] font-bold text-ink-400 uppercase">{a.role.replace("_", " ")}{a.tenantId === null ? " · all companies" : ""}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <button className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm font-bold text-clay-600 hover:bg-clay-100/60 mt-1 border-t border-sand-200 pt-2.5 cursor-pointer" onClick={logout}><LogOut size={15} />Sign out</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="grow p-4 sm:p-6 max-w-[1500px] w-full mx-auto" onClick={() => { if (bellOpen) setBellOpen(false); if (quickOpen) setQuickOpen(false); if (userOpen) setUserOpen(false); }}>{children}</main>

        <footer className="px-6 py-4 text-[11px] font-semibold text-ink-400 flex flex-wrap gap-x-4 gap-y-1 justify-between border-t border-sand-300/50">
          <span>DuneSuite · Safari operations platform for the UAE</span>
          <span>Multi-tenant workspace: <span className="text-gold-700 font-extrabold">{tenant?.name}</span> · data isolated per company</span>
        </footer>
      </div>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
