import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Inbox, Info, Search, X } from "lucide-react";
import { useStore } from "../lib/store";
import { cx, initials } from "../lib/utils";

export function Modal({ open, onClose, title, sub, children, size = "md", footer }: {
  open: boolean; onClose: () => void; title: ReactNode; sub?: ReactNode; children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl"; footer?: ReactNode;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  const w = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 anim-fade" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-[2px]" />
      <div className={cx("relative w-full bg-[#fffdf6] rounded-t-2xl sm:rounded-2xl shadow-float anim-pop flex flex-col max-h-[92vh]", w)} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3 border-b border-sand-200">
          <div>
            <h3 className="font-display text-lg font-bold text-ink-900 leading-tight">{title}</h3>
            {sub && <p className="text-xs text-ink-500 mt-0.5">{sub}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-sand-100 text-ink-500 transition-colors cursor-pointer" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 overflow-y-auto grow">{children}</div>
        {footer && <div className="px-5 py-3.5 border-t border-sand-200 flex justify-end gap-2 bg-sand-50 rounded-b-2xl">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, sub, children, wide }: {
  open: boolean; onClose: () => void; title: ReactNode; sub?: ReactNode; children: ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 anim-fade" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-ink-950/50" />
      <div className={cx("absolute right-0 top-0 h-full w-full bg-sand-50 shadow-float anim-slide-r flex flex-col", wide ? "sm:max-w-3xl" : "sm:max-w-xl")} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 px-5 py-4 bg-[#fffdf6] border-b border-sand-200">
          <div>
            <h3 className="font-display text-lg font-bold text-ink-900 leading-tight">{title}</h3>
            {sub && <p className="text-xs text-ink-500 mt-0.5">{sub}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-sand-100 text-ink-500 cursor-pointer" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="grow overflow-y-auto p-5 print-hide-scroll">{children}</div>
      </div>
    </div>
  );
}

export function Confirm({ open, onClose, onYes, title, body, yesLabel = "Confirm", danger }: {
  open: boolean; onClose: () => void; onYes: () => void; title: string; body: ReactNode; yesLabel?: string; danger?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm" footer={
      <>
        <button className="btn btn-outline" onClick={onClose}>Keep it</button>
        <button className={cx("btn", danger ? "btn-danger" : "btn-dark")} onClick={() => { onYes(); onClose(); }}>{yesLabel}</button>
      </>
    }>
      <div className="flex gap-3 items-start">
        {danger && <AlertTriangle size={20} className="text-clay-600 shrink-0 mt-0.5" />}
        <p className="text-sm text-ink-700 leading-relaxed">{body}</p>
      </div>
    </Modal>
  );
}

export const Field = ({ label, children, req, className }: { label: string; children: ReactNode; req?: boolean; className?: string }) => (
  <div className={className}>
    <label className="label">{label}{req && <span className="text-clay-600"> *</span>}</label>
    {children}
  </div>
);

export const Toggle = ({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) => (
  <button type="button" onClick={() => onChange(!on)} className="flex items-center gap-2 cursor-pointer group" aria-pressed={on}>
    <span className={cx("w-9 h-5 rounded-full relative transition-colors duration-200", on ? "bg-moss-600" : "bg-sand-300")}>
      <span className={cx("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200", on ? "left-[18px]" : "left-0.5")} />
    </span>
    {label && <span className="text-sm font-semibold text-ink-700 group-hover:text-ink-900">{label}</span>}
  </button>
);

export const Avatar = ({ name, color, size = 34 }: { name: string; color?: string; size?: number }) => (
  <span className="inline-flex items-center justify-center rounded-full font-extrabold text-white shrink-0 ring-2 ring-white/60"
    style={{ width: size, height: size, background: color ?? "#a87520", fontSize: size * 0.36 }}>{initials(name)}</span>
);

export const StatusPill = ({ cls, label, dot }: { cls: string; label: string; dot: string }) => (
  <span className={cx("chip", cls)}><span className={cx("w-1.5 h-1.5 rounded-full", dot)} />{label}</span>
);

export const EmptyState = ({ title, body, action, compact }: { title: string; body?: string; action?: ReactNode; compact?: boolean }) => (
  <div className={cx("flex flex-col items-center justify-center text-center", compact ? "py-8" : "py-16")}>
    <span className="w-12 h-12 rounded-2xl bg-sand-100 border border-sand-200 flex items-center justify-center text-ink-400 mb-3"><Inbox size={22} /></span>
    <p className="font-display font-bold text-ink-800">{title}</p>
    {body && <p className="text-sm text-ink-500 mt-1 max-w-sm">{body}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const Pager = ({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) => {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center gap-1.5 justify-end">
      <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft size={14} /></button>
      <span className="text-xs font-bold text-ink-500 px-1">Page {page} / {pages}</span>
      <button className="btn btn-outline btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}><ChevronRight size={14} /></button>
    </div>
  );
};

export const Tabs = ({ tabs, val, onChange }: { tabs: { id: string; label: string; badge?: number }[]; val: string; onChange: (id: string) => void }) => (
  <div className="flex gap-1 p-1 bg-sand-200/70 rounded-xl w-fit max-w-full overflow-x-auto">
    {tabs.map((t) => (
      <button key={t.id} onClick={() => onChange(t.id)}
        className={cx("px-3.5 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap transition-all cursor-pointer",
          val === t.id ? "bg-ink-900 text-sand-50 shadow" : "text-ink-600 hover:text-ink-900 hover:bg-sand-100")}>
        {t.label}{typeof t.badge === "number" && <span className={cx("ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full", val === t.id ? "bg-gold-500 text-ink-950" : "bg-sand-300/70 text-ink-700")}>{t.badge}</span>}
      </button>
    ))}
  </div>
);

export const SearchBox = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) => (
  <div className="relative">
    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
    <input className="input pl-9" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? "Search…"} />
  </div>
);

export const StatCard = ({ label, value, sub, icon, tone = "gold", onClick, alert }: {
  label: string; value: ReactNode; sub?: ReactNode; icon: ReactNode; tone?: "gold" | "moss" | "clay" | "oasis" | "night" | "ink"; onClick?: () => void; alert?: boolean;
}) => {
  const tones = {
    gold: "bg-gold-200/60 text-gold-700", moss: "bg-moss-100 text-moss-600", clay: "bg-clay-100 text-clay-600",
    oasis: "bg-oasis-100 text-oasis-600", night: "bg-night-100 text-night-600", ink: "bg-ink-100 text-ink-600",
  }[tone];
  return (
    <button onClick={onClick} className={cx("card p-4 text-left w-full group transition-all duration-200", onClick && "hover:-translate-y-0.5 hover:shadow-float cursor-pointer", alert && "ring-1 ring-clay-200")}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-500">{label}</p>
        <span className={cx("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", tones)}>{icon}</span>
      </div>
      <p className="font-display text-[26px] font-bold text-ink-900 leading-tight mt-1">{value}</p>
      {sub && <p className="text-xs text-ink-500 mt-0.5 font-medium">{sub}</p>}
    </button>
  );
};

export const Bar = ({ pct, tone = "#c8912f" }: { pct: number; tone?: string }) => (
  <div className="h-1.5 rounded-full bg-sand-200 overflow-hidden w-full">
    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, Math.max(2, pct))}%`, background: tone }} />
  </div>
);

export function Toasts() {
  const { toasts, dismissToast } = useStore();
  return (
    <div className="fixed bottom-4 right-4 z-[90] flex flex-col gap-2 w-[min(92vw,380px)] no-print">
      {toasts.map((t) => (
        <div key={t.id} className={cx("anim-slide-r flex items-start gap-2.5 rounded-xl border px-3.5 py-3 shadow-float text-sm font-semibold bg-[#fffdf6]",
          t.kind === "success" && "border-moss-200 text-moss-700",
          t.kind === "error" && "border-clay-200 text-clay-700",
          t.kind === "info" && "border-sand-300 text-ink-700")}>
          {t.kind === "success" ? <CheckCircle2 size={17} className="shrink-0 mt-0.5" /> : t.kind === "error" ? <AlertTriangle size={17} className="shrink-0 mt-0.5" /> : <Info size={17} className="shrink-0 mt-0.5" />}
          <span className="grow leading-snug">{t.msg}</span>
          <button onClick={() => dismissToast(t.id)} className="text-ink-400 hover:text-ink-700 cursor-pointer"><X size={15} /></button>
        </div>
      ))}
    </div>
  );
}

export const KeyHint = ({ children }: { children: ReactNode }) => (
  <kbd className="px-1.5 py-0.5 rounded-md border border-sand-300 bg-sand-100 text-[10px] font-bold text-ink-500">{children}</kbd>
);

export function useDebounced<T>(value: T, ms = 200): T {
  const [v, setV] = useState(value);
  const ref = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => { ref.current = setTimeout(() => setV(value), ms); return () => clearTimeout(ref.current); }, [value, ms]);
  return v;
}
