import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, CreditCard, MapPin, MessageCircle, Users } from "lucide-react";
import { useStore } from "../lib/store";
import { calcTotal } from "../lib/data";
import { cx, fmtDate, money, nowISO, todayISO, uid } from "../lib/utils";
import { IMG } from "../lib/data";

const PICKUPS = ["Atlantis The Palm", "Dubai Marina — Address Hotel", "Downtown — Armani Hotel", "JBR — Rixos", "Al Barsha — Rotana Hotel", "Deira — Hyatt Regency", "Mirdif — City Centre area", "Palm Jumeirah — Anantara", "Business Bay — Executive Towers", "Other (tell us in notes)"];

export default function PublicBooking({ onBack }: { onBack: () => void }) {
  const { db, mutate, toast } = useStore();
  // Widget-compatible: honour ?tenant= (validated against real tenants) and ?embed=1 for iframe use
  const qp = new URLSearchParams(window.location.search);
  const qTenant = qp.get("tenant");
  const tenantId = qTenant && db.tenants.some((t) => t.id === qTenant) ? qTenant : "t1";
  const embed = qp.get("embed") === "1";
  const settings = db.settings.find((s) => s.tenantId === tenantId)!;
  const packages = db.packages.filter((p) => p.tenantId === tenantId && p.active);

  const [step, setStep] = useState(0);
  const [packageId, setPackageId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [pickup, setPickup] = useState(PICKUPS[0]);
  const [guest, setGuest] = useState({ name: "", phone: "", email: "", notes: "" });
  const [payOpt, setPayOpt] = useState("later");
  const [done, setDone] = useState<{ code: string; id: string; total: number } | null>(null);

  const pkg = packages.find((p) => p.id === packageId);
  const calc = useMemo(() => calcTotal(pkg, adults, children, [], 0, settings.taxPct), [pkg, adults, children, settings]);

  const steps = ["Safari", "Date & guests", "Pickup", "Your details", "Confirm"];

  const next = () => {
    if (step === 0 && !packageId) { toast("Choose a safari package first.", "error"); return; }
    if (step === 1 && (!date || adults + children <= 0)) { toast("Pick a date and at least one guest.", "error"); return; }
    if (step === 1 && date < todayISO()) { toast("The safari date can't be in the past.", "error"); return; }
    if (step === 3 && (!guest.name.trim() || !guest.phone.trim())) { toast("Name and phone are required so our driver can find you.", "error"); return; }
    setStep((s) => Math.min(4, s + 1));
  };

  const confirm = () => {
    if (!pkg) return;
    let cid = db.customers.find((c) => c.tenantId === tenantId && c.phone === guest.phone.trim())?.id;
    if (!cid) {
      cid = uid();
      mutate((d) => { d.customers.unshift({ id: cid!, tenantId, name: guest.name.trim(), phone: guest.phone.trim(), whatsapp: guest.phone.trim(), email: guest.email.trim(), country: "—", notes: "Booked via public page.", createdAt: nowISO() }); });
    }
    const code = `${settings.bookingPrefix}-${new Date().getFullYear()}-${String(db.seq + 1).padStart(6, "0")}`;
    const id = uid();
    mutate((d) => {
      d.bookings.unshift({
        id, tenantId, code, customerId: cid!, packageId: pkg.id, date, adults, children,
        pickupLocation: pickup, pickupAddress: guest.notes, pickupTime: "15:30", dropoffLocation: "Same as pickup",
        specialReq: guest.notes, vehicleId: null, driverId: null, addons: [], discount: 0, taxPct: settings.taxPct,
        total: calc.total, source: "Public Booking Page", notes: "Online self-service booking", status: "pending",
        createdAt: nowISO(), createdBy: "public",
      });
      d.seq += 1;
      d.notifs.unshift({ id: uid(), tenantId, kind: "booking", title: `New online booking ${code}`, body: `${guest.name} · ${adults + children} guests · ${pkg.name} on ${fmtDate(date)}`, at: nowISO(), read: false, link: { page: "bookings", id } });
    });
    setDone({ code, id, total: calc.total });
    window.scrollTo({ top: 0 });
  };

  if (done) {
    return (
      <Shell settings={settings.name} onBack={onBack} embed={embed}>
        <div className="max-w-lg mx-auto anim-pop">
          <div className="card p-8 text-center shadow-float">
            <span className="w-16 h-16 rounded-full bg-moss-100 text-moss-600 flex items-center justify-center mx-auto mb-4"><Check size={30} /></span>
            <h2 className="font-display font-black text-3xl text-ink-900">You're going to the desert!</h2>
            <p className="text-sm font-semibold text-ink-500 mt-2">Your booking is confirmed as <span className="font-extrabold text-gold-700">pending</span> — our team will confirm on WhatsApp shortly.</p>
            <div className="rounded-2xl bg-sand-100 p-5 mt-6 text-left space-y-2.5 text-sm font-semibold text-ink-700">
              <p className="flex justify-between"><span className="text-ink-400">Booking ID</span><span className="font-mono font-black text-gold-700">{done.code}</span></p>
              <p className="flex justify-between"><span className="text-ink-400">Safari</span><span className="font-extrabold">{pkg?.name}</span></p>
              <p className="flex justify-between"><span className="text-ink-400">Date</span><span className="font-extrabold">{fmtDate(date)}</span></p>
              <p className="flex justify-between"><span className="text-ink-400">Guests</span><span className="font-extrabold">{adults} adults · {children} children</span></p>
              <p className="flex justify-between"><span className="text-ink-400">Pickup</span><span className="font-extrabold text-right">{pickup} · 3:30 PM</span></p>
              <p className="flex justify-between border-t border-sand-300 pt-2.5"><span className="text-ink-400">Amount</span><span className="font-display font-black text-xl text-ink-900">{money(done.total, settings.currency)}</span></p>
              <p className="flex justify-between"><span className="text-ink-400">Payment</span><span className="font-extrabold text-moss-600">{payOpt === "later" ? "Pay at pickup / camp" : "Card link will be sent"}</span></p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 mt-6">
              <a className="btn btn-success btn-lg grow" target="_blank" rel="noreferrer" href={`https://wa.me/${settings.whatsapp.replace(/[^\d]/g, "")}?text=${encodeURIComponent(`Salam! I just booked ${done.code} — ${pkg?.name} on ${fmtDate(date)} for ${adults + children} guests. Please confirm my pickup. 🌇`)}`}><MessageCircle size={17} />Get confirmation on WhatsApp</a>
            </div>
            <button className="btn btn-ghost mt-3" onClick={() => { setDone(null); setStep(0); setPackageId(""); setGuest({ name: "", phone: "", email: "", notes: "" }); }}>Book another safari</button>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell settings={settings.name} onBack={onBack} embed={embed}>
      <div className="max-w-3xl mx-auto">
        {/* Progress */}
        <div className="flex items-center gap-1.5 mb-6">
          {steps.map((s, i) => (
            <div key={s} className="grow">
              <div className={cx("h-1.5 rounded-full transition-all duration-300", i <= step ? "bg-gold-500" : "bg-sand-300")} />
              <p className={cx("text-[10px] font-extrabold uppercase tracking-wide mt-1.5 hidden sm:block", i === step ? "text-gold-700" : "text-ink-400")}>{s}</p>
            </div>
          ))}
        </div>

        {step === 0 && (
          <div className="anim-rise">
            <h2 className="font-display font-black text-3xl text-ink-900">Book Your Desert Safari</h2>
            <p className="text-sm font-semibold text-ink-500 mt-1 mb-5">Choose your experience — all prices in {settings.currency}, VAT included.</p>
            <div className="grid sm:grid-cols-2 gap-4">
              {packages.map((p) => (
                <button key={p.id} onClick={() => { setPackageId(p.id); }}
                  className={cx("card overflow-hidden text-left transition-all cursor-pointer group hover:-translate-y-0.5 hover:shadow-float", packageId === p.id && "ring-2 ring-gold-500 shadow-float")}>
                  <div className="h-32 relative overflow-hidden">
                    {p.image ? <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> : <div className="w-full h-full flex items-center justify-center" style={{ background: `${p.accent}22` }}><span className="text-4xl">🌇</span></div>}
                    {packageId === p.id && <span className="absolute top-2 right-2 w-7 h-7 rounded-full bg-gold-500 text-ink-950 flex items-center justify-center anim-pop"><Check size={15} /></span>}
                  </div>
                  <div className="p-3.5">
                    <p className="font-display font-bold text-ink-900">{p.name}</p>
                    <p className="text-[11px] font-bold text-ink-400">{p.duration} · pickup {p.pickup}</p>
                    <p className="font-display font-black text-lg mt-1" style={{ color: p.accent }}>{money(p.adultPrice, settings.currency)} <span className="text-xs font-body font-bold text-ink-400">adult · {money(p.childPrice, settings.currency)} child</span></p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="card p-6 anim-rise max-w-xl mx-auto">
            <h2 className="font-display font-black text-2xl text-ink-900 mb-4">When, and how many?</h2>
            <label className="label">Safari date</label>
            <input type="date" min={todayISO()} className="input mb-4" value={date} onChange={(e) => setDate(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Adults</label>
                <div className="flex items-center gap-2"><StepBtn onDec={() => setAdults(Math.max(0, adults - 1))} onInc={() => setAdults(adults + 1)} val={adults} /></div></div>
              <div><label className="label">Children (3–12)</label>
                <div className="flex items-center gap-2"><StepBtn onDec={() => setChildren(Math.max(0, children - 1))} onInc={() => setChildren(children + 1)} val={children} /></div></div>
            </div>
            {pkg && (adults + children) > pkg.maxPax && <p className="text-xs font-bold text-clay-600 mt-3">⚠ Groups above {pkg.maxPax} need multiple vehicles — continue and we'll arrange two 4x4s, or call us.</p>}
            <div className="rounded-xl bg-sand-100 p-3 mt-4 flex justify-between items-center text-sm font-bold text-ink-700">
              <span className="flex items-center gap-1.5"><Users size={15} className="text-gold-600" />{adults + children} guests · {fmtDate(date)}</span>
              <span className="font-display font-black text-lg text-gold-700">{money(calc.total, settings.currency)}</span>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="card p-6 anim-rise max-w-xl mx-auto">
            <h2 className="font-display font-black text-2xl text-ink-900 mb-1">Pickup point</h2>
            <p className="text-sm font-semibold text-ink-500 mb-4">Complimentary hotel pickup between 3:00–4:00 PM.</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {PICKUPS.map((p) => (
                <button key={p} onClick={() => setPickup(p)} className={cx("flex items-center gap-2.5 rounded-xl border p-3 text-left text-sm font-bold transition-all cursor-pointer", pickup === p ? "border-gold-500 bg-gold-200/30 shadow-sm" : "border-sand-200 bg-white/70 hover:border-gold-300")}>
                  <MapPin size={15} className={pickup === p ? "text-gold-600" : "text-ink-300"} />{p}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="card p-6 anim-rise max-w-xl mx-auto">
            <h2 className="font-display font-black text-2xl text-ink-900 mb-4">Who's the lead guest?</h2>
            <div className="space-y-3.5">
              <div><label className="label">Full name *</label><input className="input" value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} placeholder="As on your hotel booking" /></div>
              <div><label className="label">Phone / WhatsApp *</label><input className="input" value={guest.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value })} placeholder="+971 …" /></div>
              <div><label className="label">Email</label><input className="input" value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} placeholder="For your confirmation" /></div>
              <div><label className="label">Special requests</label><textarea className="input min-h-[70px]" value={guest.notes} onChange={(e) => setGuest({ ...guest, notes: e.target.value })} placeholder="Allergies, villa number, birthday surprise…" /></div>
            </div>
          </div>
        )}

        {step === 4 && pkg && (
          <div className="card p-6 anim-rise max-w-xl mx-auto">
            <h2 className="font-display font-black text-2xl text-ink-900 mb-4">Confirm your safari</h2>
            <div className="rounded-2xl bg-sand-100 p-4 space-y-2 text-sm font-semibold text-ink-700">
              <p className="flex justify-between"><span className="text-ink-400">Package</span><span className="font-extrabold">{pkg.name}</span></p>
              <p className="flex justify-between"><span className="text-ink-400">Date</span><span className="font-extrabold">{fmtDate(date)} · pickup ~3:30 PM</span></p>
              <p className="flex justify-between"><span className="text-ink-400">Guests</span><span className="font-extrabold">{adults} adults, {children} children</span></p>
              <p className="flex justify-between"><span className="text-ink-400">Pickup</span><span className="font-extrabold text-right">{pickup}</span></p>
              <p className="flex justify-between"><span className="text-ink-400">Lead guest</span><span className="font-extrabold">{guest.name} · {guest.phone}</span></p>
              <p className="flex justify-between border-t border-sand-300 pt-2"><span className="text-ink-400">VAT {settings.taxPct}% included</span><span className="font-bold">{money(Math.round((calc.total - calc.total / (1 + settings.taxPct / 100)) * 100) / 100, settings.currency)}</span></p>
              <p className="flex justify-between"><span className="font-extrabold text-ink-900 text-base">Total</span><span className="font-display font-black text-2xl text-gold-700">{money(calc.total, settings.currency)}</span></p>
            </div>
            <p className="label mt-5">Payment option</p>
            <div className="grid sm:grid-cols-2 gap-2">
              <button onClick={() => setPayOpt("later")} className={cx("rounded-xl border p-3.5 text-left transition-all cursor-pointer", payOpt === "later" ? "border-gold-500 bg-gold-200/30" : "border-sand-200 bg-white/70 hover:border-gold-300")}>
                <p className="text-sm font-extrabold text-ink-900">Pay later</p>
                <p className="text-[11px] font-bold text-ink-400 mt-0.5">Cash or card to your driver / at camp</p>
              </button>
              <button onClick={() => setPayOpt("card")} className={cx("rounded-xl border p-3.5 text-left transition-all cursor-pointer", payOpt === "card" ? "border-gold-500 bg-gold-200/30" : "border-sand-200 bg-white/70 hover:border-gold-300")}>
                <p className="text-sm font-extrabold text-ink-900 flex items-center gap-1.5"><CreditCard size={14} />Card link by WhatsApp</p>
                <p className="text-[11px] font-bold text-ink-400 mt-0.5">Secure payment link sent to your phone</p>
              </button>
            </div>
            <p className="text-[11px] font-semibold text-ink-400 mt-3">📜 {settings.cancellationPolicy}</p>
            <button className="btn btn-primary btn-lg w-full mt-5" onClick={confirm}>Confirm booking — {money(calc.total, settings.currency)}</button>
          </div>
        )}

        <div className="flex justify-between mt-6">
          {(step > 0 || !embed) && <button className="btn btn-outline" onClick={() => (step === 0 ? onBack() : setStep((s) => s - 1))}><ArrowLeft size={15} />{step === 0 ? "Back" : "Previous"}</button>}
          {step < 4 && <button className="btn btn-dark" onClick={next}>Continue<ArrowRight size={15} /></button>}
        </div>
      </div>
    </Shell>
  );
}

const StepBtn = ({ onDec, onInc, val }: { onDec: () => void; onInc: () => void; val: number }) => (
  <div className="flex items-center gap-1.5">
    <button className="btn btn-outline w-9 h-9 px-0" onClick={onDec}>−</button>
    <span className="w-10 text-center font-display font-black text-xl text-ink-900">{val}</span>
    <button className="btn btn-dark w-9 h-9 px-0" onClick={onInc}>+</button>
  </div>
);

const Shell = ({ children, settings, onBack, embed }: { children: React.ReactNode; settings: string; onBack: () => void; embed?: boolean }) => (
  <div className="min-h-screen dune-bg">
    <header className="sticky top-0 z-40 bg-[#f1ead9]/85 backdrop-blur-md border-b border-sand-300/60 no-print">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
        <img src={IMG.hero} alt="" className="w-8 h-8 rounded-lg object-cover" />
        <div className="leading-tight">
          <p className="font-display font-black text-ink-900">{settings}</p>
          <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-gold-600">powered by DuneSuite</p>
        </div>
        <div className="grow" />
        <span className="chip bg-sand-200 text-ink-600 hidden sm:inline-flex"><CalendarDays size={11} />Instant confirmation</span>
        {!embed && <button className="btn btn-ghost btn-sm" onClick={onBack}>Staff sign-in</button>}
      </div>
    </header>
    <main className="p-4 sm:p-8">{children}</main>
    <footer className="max-w-5xl mx-auto px-4 pb-8 text-center text-[11px] font-bold text-ink-400">
      Bookings land directly in the operator's workspace — this public page is tenant-locked and embeddable as a widget.
    </footer>
  </div>
);
