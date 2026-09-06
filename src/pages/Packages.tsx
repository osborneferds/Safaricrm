import { useEffect, useState } from "react";
import { Ban, Check, Clock, MapPin, Pencil, Plus, Users, X } from "lucide-react";
import { useStore, useTenant } from "../lib/store";
import type { ID, SafariPackage } from "../lib/types";
import { IMG } from "../lib/data";
import { Confirm, EmptyState, Field, Modal, StatusPill, Toggle, Drawer } from "../components/ui";
import { money, uid } from "../lib/utils";

const blank = (tenantId: ID): SafariPackage => ({
  id: uid(), tenantId, name: "", description: "", duration: "6 hours", adultPrice: 250, childPrice: 150,
  privatePrice: 1600, maxPax: 7, pickup: "3:00 PM – 4:00 PM", includes: [], excludes: [], terms: "", active: true, accent: "#c8912f",
});

const ACCENTS = ["#c8912f", "#a87520", "#2f7e76", "#46558c", "#96402a", "#3c6447", "#855c18", "#b69355"];

export default function Packages() {
  const { db, user, route, setRoute, mutate, toast, audit } = useStore();
  const packages = useTenant(db.packages);
  const bookings = useTenant(db.bookings);
  const settings = db.settings.find((s) => s.tenantId === user?.tenantId);
  const cur = settings?.currency ?? "AED";
  const isAdmin = user!.role === "admin";

  const [form, setForm] = useState<{ open: boolean; p: SafariPackage | null }>({ open: false, p: null });
  const [sel, setSel] = useState<ID | null>(null);
  const [del, setDel] = useState<ID | null>(null);

  useEffect(() => { if (route.params?.new) { setForm({ open: true, p: blank(user!.tenantId!) }); setRoute({ page: "packages" }); } }, [route.params]);

  const save = (p: SafariPackage) => {
    if (!p.name.trim()) { toast("Package name is required.", "error"); return; }
    if (p.adultPrice <= 0) { toast("Adult price must be greater than zero.", "error"); return; }
    const isNew = !packages.some((x) => x.id === p.id);
    mutate((d) => {
      const i = d.packages.findIndex((x) => x.id === p.id);
      if (i >= 0) d.packages[i] = p; else d.packages.unshift(p);
    });
    audit(isNew ? "package.created" : "package.updated", "Package", p.id, p.name);
    toast(isNew ? `${p.name} published ✓` : "Package updated ✓");
    setForm({ open: false, p: null });
  };

  const toggleActive = (id: ID, v: boolean) => {
    mutate((d) => { const p = d.packages.find((x) => x.id === id); if (p) p.active = v; });
    toast(v ? "Package activated" : "Package hidden from booking forms", "info");
  };

  const selP = sel ? packages.find((p) => p.id === sel) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <p className="text-sm font-semibold text-ink-500">Create unlimited safari products — each appears on the booking form and public page.</p>
        <div className="grow" />
        {isAdmin && <button className="btn btn-primary" onClick={() => setForm({ open: true, p: blank(user!.tenantId!) })}><Plus size={15} />Add Package</button>}
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {packages.map((p) => {
          const count = bookings.filter((b) => b.packageId === p.id && !["cancelled", "no_show"].includes(b.status)).length;
          return (
            <div key={p.id} className="card overflow-hidden group hover:-translate-y-0.5 hover:shadow-float transition-all anim-rise flex flex-col">
              <button className="relative h-40 overflow-hidden cursor-pointer" onClick={() => setSel(p.id)}>
                {p.image
                  ? <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  : <div className="w-full h-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${p.accent}33, ${p.accent}11)` }}><span className="font-display font-black text-5xl" style={{ color: p.accent }}>🌇</span></div>}
                <span className="absolute top-2.5 left-2.5 chip bg-ink-950/75 text-gold-300 backdrop-blur-sm"><Clock size={11} />{p.duration}</span>
                {!p.active && <span className="absolute inset-0 bg-ink-950/60 flex items-center justify-center"><span className="chip bg-clay-100 text-clay-700"><Ban size={11} />Inactive — hidden</span></span>}
              </button>
              <div className="p-4 grow flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <button className="text-left cursor-pointer" onClick={() => setSel(p.id)}><h3 className="font-display font-bold text-lg text-ink-900 leading-tight group-hover:text-gold-700 transition-colors">{p.name}</h3></button>
                  <span className="chip shrink-0" style={{ background: p.accent + "22", color: p.accent }}>{count} bookings</span>
                </div>
                <p className="text-[13px] text-ink-500 font-semibold mt-1.5 line-clamp-2 grow">{p.description}</p>
                <div className="flex items-center gap-3 mt-3 text-[12px] font-bold text-ink-500">
                  <span className="flex items-center gap-1"><Users size={12} />max {p.maxPax}</span>
                  <span className="flex items-center gap-1"><MapPin size={12} />{p.pickup}</span>
                </div>
                <div className="flex items-end justify-between mt-3 pt-3 border-t border-sand-100">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-ink-400">Adult / Child</p>
                    <p className="font-display font-black text-xl" style={{ color: p.accent }}>{money(p.adultPrice, cur)} <span className="text-sm font-body font-bold text-ink-400">/ {money(p.childPrice, cur)}</span></p>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      <Toggle on={p.active} onChange={(v) => toggleActive(p.id, v)} />
                      <button className="btn btn-outline btn-sm" onClick={() => setForm({ open: true, p: JSON.parse(JSON.stringify(p)) })}><Pencil size={13} /></button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {packages.length === 0 && <div className="sm:col-span-2 xl:col-span-3 card"><EmptyState title="No packages yet" body="Create your first desert safari product." /></div>}
      </div>

      {/* Detail drawer */}
      <Drawer open={!!selP} onClose={() => setSel(null)} wide title={selP?.name ?? ""} sub={selP ? `${selP.duration} · max ${selP.maxPax} guests per vehicle` : ""}>
        {selP && (
          <div className="space-y-4">
            {selP.image && <img src={selP.image} alt={selP.name} className="rounded-xl w-full h-52 object-cover" />}
            <p className="text-sm font-semibold text-ink-600 leading-relaxed">{selP.description}</p>
            <div className="grid grid-cols-3 gap-3">
              <PriceCard k="Per adult" v={money(selP.adultPrice, cur)} tone={selP.accent} />
              <PriceCard k="Per child" v={money(selP.childPrice, cur)} tone={selP.accent} />
              <PriceCard k="Private vehicle" v={money(selP.privatePrice, cur)} tone={selP.accent} />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="card p-4">
                <h4 className="font-display font-bold text-moss-700 mb-2">Included</h4>
                <ul className="space-y-1.5">{selP.includes.map((i) => <li key={i} className="text-sm font-semibold text-ink-700 flex gap-2"><Check size={15} className="text-moss-600 shrink-0 mt-0.5" />{i}</li>)}</ul>
              </div>
              <div className="card p-4">
                <h4 className="font-display font-bold text-clay-700 mb-2">Not included</h4>
                <ul className="space-y-1.5">{selP.excludes.map((i) => <li key={i} className="text-sm font-semibold text-ink-700 flex gap-2"><X size={15} className="text-clay-500 shrink-0 mt-0.5" />{i}</li>)}</ul>
              </div>
            </div>
            {selP.terms && <p className="text-xs font-semibold text-ink-500 bg-sand-100 rounded-xl p-3">📜 {selP.terms}</p>}
          </div>
        )}
      </Drawer>

      {form.p && (
        <Modal open onClose={() => setForm({ open: false, p: null })} title={packages.some((x) => x.id === form.p!.id) ? `Edit ${form.p.name}` : "New safari package"} size="xl"
          footer={<>
            {packages.some((x) => x.id === form.p!.id) && !bookings.some((b) => b.packageId === form.p!.id) && <button className="btn btn-danger mr-auto" onClick={() => setDel(form.p!.id)}><Ban size={14} />Delete</button>}
            <button className="btn btn-outline" onClick={() => setForm({ open: false, p: null })}>Cancel</button>
            <button className="btn btn-primary" onClick={() => save(form.p!)}>Save package</button>
          </>}>
          <div className="grid sm:grid-cols-2 gap-3.5">
            <Field label="Package name" req><input className="input" value={form.p.name} onChange={(e) => setForm({ ...form, p: { ...form.p!, name: e.target.value } })} placeholder="e.g. Sunset Dune Dinner" /></Field>
            <Field label="Duration"><input className="input" value={form.p.duration} onChange={(e) => setForm({ ...form, p: { ...form.p!, duration: e.target.value } })} /></Field>
            <Field label="Description" className="sm:col-span-2"><textarea className="input min-h-[70px]" value={form.p.description} onChange={(e) => setForm({ ...form, p: { ...form.p!, description: e.target.value } })} /></Field>
            <Field label="Adult price" req><input type="number" min={0} className="input" value={form.p.adultPrice} onChange={(e) => setForm({ ...form, p: { ...form.p!, adultPrice: Number(e.target.value) } })} /></Field>
            <Field label="Child price"><input type="number" min={0} className="input" value={form.p.childPrice} onChange={(e) => setForm({ ...form, p: { ...form.p!, childPrice: Number(e.target.value) } })} /></Field>
            <Field label="Private vehicle price"><input type="number" min={0} className="input" value={form.p.privatePrice} onChange={(e) => setForm({ ...form, p: { ...form.p!, privatePrice: Number(e.target.value) } })} /></Field>
            <Field label="Max passengers / vehicle"><input type="number" min={1} className="input" value={form.p.maxPax} onChange={(e) => setForm({ ...form, p: { ...form.p!, maxPax: Math.max(1, Number(e.target.value)) } })} /></Field>
            <Field label="Pickup window"><input className="input" value={form.p.pickup} onChange={(e) => setForm({ ...form, p: { ...form.p!, pickup: e.target.value } })} /></Field>
            <Field label="Accent color">
              <div className="flex gap-1.5 pt-1.5">{ACCENTS.map((a) => <button key={a} onClick={() => setForm({ ...form, p: { ...form.p!, accent: a } })} className="w-7 h-7 rounded-lg cursor-pointer transition-transform hover:scale-110" style={{ background: a, outline: form.p!.accent === a ? "2px solid #1e1811" : "none", outlineOffset: 2 }} aria-label={a} />)}</div>
            </Field>
            <Field label="Image">
              <select className="input" value={form.p.image ?? ""} onChange={(e) => setForm({ ...form, p: { ...form.p!, image: e.target.value || undefined } })}>
                <option value="">No photo (styled tile)</option>
                <option value={IMG.hero}>Desert convoy at sunset</option>
                <option value={IMG.camp}>Traditional camp at dusk</option>
                <option value={IMG.vip}>VIP private lounge</option>
                <option value={IMG.quad}>Quad biking</option>
                <option value={IMG.morning}>Morning dunes & camel</option>
                <option value={IMG.falcon}>Falconry experience</option>
              </select>
            </Field>
            <Field label="Included services (one per line)" className="sm:col-span-2"><textarea className="input min-h-[80px]" value={form.p.includes.join("\n")} onChange={(e) => setForm({ ...form, p: { ...form.p!, includes: e.target.value.split("\n").filter((x) => x.trim()) } })} /></Field>
            <Field label="Excluded services (one per line)" className="sm:col-span-2"><textarea className="input min-h-[60px]" value={form.p.excludes.join("\n")} onChange={(e) => setForm({ ...form, p: { ...form.p!, excludes: e.target.value.split("\n").filter((x) => x.trim()) } })} /></Field>
            <Field label="Terms & conditions" className="sm:col-span-2"><textarea className="input min-h-[60px]" value={form.p.terms} onChange={(e) => setForm({ ...form, p: { ...form.p!, terms: e.target.value } })} /></Field>
            <div className="sm:col-span-2"><Toggle on={form.p.active} onChange={(v) => setForm({ ...form, p: { ...form.p!, active: v } })} label={form.p.active ? "Active — visible on booking forms" : "Inactive — hidden"} /></div>
          </div>
        </Modal>
      )}

      <Confirm open={!!del} onClose={() => setDel(null)} danger yesLabel="Delete package" title="Delete this package?"
        body="The package will be removed. Bookings already made with it keep their snapshot pricing."
        onYes={() => { if (del) { mutate((d) => { d.packages = d.packages.filter((p) => p.id !== del); }); toast("Package deleted", "info"); setForm({ open: false, p: null }); } }} />
    </div>
  );
}

const PriceCard = ({ k, v, tone }: { k: string; v: string; tone: string }) => (
  <div className="card p-3 text-center">
    <p className="text-[10px] font-extrabold uppercase tracking-wider text-ink-400">{k}</p>
    <p className="font-display font-black text-lg mt-0.5" style={{ color: tone }}>{v}</p>
  </div>
);
void StatusPill;
