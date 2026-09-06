import { useState } from "react";
import { ArrowRight, CheckCircle2, Compass, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { useStore } from "../lib/store";
import { Logo } from "../components/Layout";
import { IMG } from "../lib/data";
import { cx, imgFallback } from "../lib/utils";

type Mode = "login" | "register" | "forgot";

const demo = [
  { label: "Company Admin", email: "admin@dunehorizon.ae", role: "Full workspace access" },
  { label: "Operations Manager", email: "ops@dunehorizon.ae", role: "Fleet, drivers, trips" },
  { label: "Sales Agent", email: "sales@dunehorizon.ae", role: "Leads & WhatsApp CRM" },
  { label: "Driver", email: "driver@dunehorizon.ae", role: "Mobile trip console" },
  { label: "Super Admin", email: "super@dunesuite.app", role: "All companies" },
];

export default function Auth({ onPublic }: { onPublic: () => void }) {
  const { login, registerCompany, toast } = useStore();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("admin@dunehorizon.ae");
  const [password, setPassword] = useState("demo1234");
  const [company, setCompany] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = () => {
    setErr(""); setBusy(true);
    setTimeout(() => {
      setBusy(false);
      if (mode === "login") {
        const r = login(email, password);
        if (!r.ok) setErr(r.error ?? "Sign-in failed.");
        else toast("Welcome back — the desert awaits. 🌇");
      } else if (mode === "register") {
        if (!company.trim() || !name.trim() || !email.trim() || password.length < 6) { setErr("Fill every field — password needs at least 6 characters."); return; }
        const r = registerCompany(company.trim(), name.trim(), email, password);
        if (!r.ok) setErr(r.error ?? "Registration failed.");
        else toast("Company workspace created — 14-day Professional trial started.");
      }
    }, 500);
  };

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.15fr_1fr]">
      {/* Desert panel */}
      <div className="relative hidden lg:block overflow-hidden bg-ink-950 grain">
        <img src={IMG.hero} alt="Desert safari convoy at sunset" onError={imgFallback} className="absolute inset-0 w-full h-full object-cover opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/35 to-ink-950/20" />
        <div className="relative h-full flex flex-col justify-between p-10 xl:p-14">
          <Logo dark />
          <div className="max-w-xl anim-rise">
            <p className="text-gold-300 font-extrabold text-xs uppercase tracking-[0.24em] mb-4">Built for UAE safari operators</p>
            <h1 className="font-display text-[44px] xl:text-[54px] leading-[1.04] font-black text-sand-50">
              Every dune,<br />every driver,<br /><span className="text-gold-300">one command deck.</span>
            </h1>
            <p className="text-sand-200/85 text-[15px] leading-relaxed mt-5 max-w-md">
              Lead → WhatsApp → booking → pickup → safari → review. DuneSuite runs the whole journey — fleet, drivers, payments and CRM in one multi-tenant platform.
            </p>
            <div className="flex flex-wrap gap-2 mt-7">
              {["WhatsApp CRM", "Fleet & drivers", "Ops Kanban", "Live pickups", "AED invoicing", "Role-based access"].map((f) => (
                <span key={f} className="chip bg-white/10 text-sand-100 border border-white/15 backdrop-blur-sm"><CheckCircle2 size={11} className="text-gold-300" />{f}</span>
              ))}
            </div>
          </div>
          <p className="text-[11px] font-semibold text-sand-200/50">Tenant-isolated workspaces · every company's data fully sealed from the others.</p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-10 dune-bg min-h-screen lg:min-h-0">
        <div className="w-full max-w-md anim-rise">
          <div className="lg:hidden mb-8 flex justify-center"><Logo /></div>
          <div className="card p-6 sm:p-8 shadow-float">
            <div className="flex items-center gap-2 mb-1">
              {mode === "login" ? <Compass size={20} className="text-gold-600" /> : mode === "register" ? <ShieldCheck size={20} className="text-gold-600" /> : <KeyRound size={20} className="text-gold-600" />}
              <h2 className="font-display text-2xl font-black text-ink-900">
                {mode === "login" ? "Sign in" : mode === "register" ? "Create your company" : "Reset password"}
              </h2>
            </div>
            <p className="text-sm text-ink-500 font-medium mb-5">
              {mode === "login" ? "Back to the dunes. Your workspace kept the engine running."
                : mode === "register" ? "Start a free 14-day Professional trial — no card required."
                : "We'll email you a secure reset link."}
            </p>

            {err && <div className="mb-4 px-3.5 py-2.5 rounded-lg bg-clay-100 border border-clay-200 text-clay-700 text-sm font-bold anim-pop">{err}</div>}
            {sent && mode === "forgot" && (
              <div className="mb-4 px-3.5 py-3 rounded-lg bg-moss-100 border border-moss-200 text-moss-700 text-sm font-bold anim-pop">
                Reset link sent to <span className="underline">{email}</span> (simulated — email adapter is pending configuration in production).
              </div>
            )}

            <div className="space-y-3.5">
              {mode === "register" && (
                <>
                  <div><label className="label">Company name</label><input className="input" placeholder="e.g. Golden Dunes Safari LLC" value={company} onChange={(e) => setCompany(e.target.value)} /></div>
                  <div><label className="label">Your name</label><input className="input" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} /></div>
                </>
              )}
              {mode !== "forgot" || !sent ? (
                <>
                  <div><label className="label">Email</label><div className="relative"><Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" /><input className="input pl-9" type="email" placeholder="you@company.ae" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} /></div></div>
                  {mode !== "forgot" && (
                    <div><label className="label">Password</label><input className="input" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} /></div>
                  )}
                </>
              ) : null}
              <button className="btn btn-primary btn-lg w-full" onClick={submit} disabled={busy}>
                {busy ? "One moment…" : mode === "login" ? "Enter the workspace" : mode === "register" ? "Start free trial" : "Send reset link"}
                {!busy && <ArrowRight size={17} />}
              </button>
            </div>

            <div className="flex items-center justify-between mt-5 text-[13px] font-bold">
              {mode === "login" ? (
                <>
                  <button className="text-gold-700 hover:text-gold-600 cursor-pointer" onClick={() => { setMode("forgot"); setErr(""); setSent(false); }}>Forgot password?</button>
                  <button className="text-ink-600 hover:text-ink-900 cursor-pointer" onClick={() => { setMode("register"); setErr(""); }}>Register a company →</button>
                </>
              ) : (
                <button className="text-gold-700 hover:text-gold-600 cursor-pointer" onClick={() => { setMode("login"); setErr(""); setSent(false); }}>← Back to sign in</button>
              )}
            </div>
          </div>

          {mode === "login" && (
            <div className="card mt-4 p-4">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-ink-400 mb-2.5">Demo workspace · password <span className="text-gold-700">demo1234</span></p>
              <div className="grid gap-1.5">
                {demo.map((d) => (
                  <button key={d.email} onClick={() => { setEmail(d.email); setPassword("demo1234"); setErr(""); }}
                    className={cx("flex items-center justify-between gap-3 px-3 py-2 rounded-lg border text-left transition-all cursor-pointer",
                      email === d.email ? "border-gold-500 bg-gold-200/30 shadow-sm" : "border-sand-200 bg-white/60 hover:border-gold-400 hover:bg-sand-100")}>
                    <span>
                      <span className="block text-[13px] font-extrabold text-ink-900">{d.label}</span>
                      <span className="block text-[11px] text-ink-500 font-semibold">{d.role}</span>
                    </span>
                    <span className="text-[11px] font-bold text-ink-400 hidden sm:block">{d.email}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <button onClick={onPublic} className="w-full mt-4 text-center text-[13px] font-bold text-ink-500 hover:text-gold-700 transition-colors cursor-pointer">
            🌇 Preview the public customer booking page →
          </button>
        </div>
      </div>
    </div>
  );
}
