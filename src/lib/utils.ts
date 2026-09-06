import type { BookingStatus, DriverStatus, LeadStatus, PayStatus, QuoteStatus, TripStatus, VehicleStatus } from "./types";

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const addDaysISO = (days: number, from?: string) => {
  const d = from ? new Date(from + "T12:00:00") : new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const daysFromNow = (iso: string) =>
  Math.round((new Date(iso + "T12:00:00").getTime() - new Date(todayISO() + "T12:00:00").getTime()) / 86400000);

export const fmtDate = (iso: string) => {
  if (!iso) return "—";
  return new Date(iso + (iso.length <= 10 ? "T12:00:00" : "")).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

export const fmtDateShort = (iso: string) =>
  new Date(iso + (iso.length <= 10 ? "T12:00:00" : "")).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export const fmtWeekday = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short" });

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export const fmtDateTime = (iso: string) => `${fmtDateShort(iso.slice(0, 10))}, ${fmtTime(iso)}`;

export const timeAgo = (iso: string) => {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export const money = (n: number, currency = "AED") =>
  `${currency} ${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

export const nowISO = () => new Date().toISOString();

export const toMin = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };

export const fmtClock = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${ap}`;
};

export const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => aStart < bEnd && bStart < aEnd;

export const downloadCSV = (name: string, headers: string[], rows: (string | number)[][]) => {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name.endsWith(".csv") ? name : `${name}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
};

export const initials = (name: string) =>
  name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");

export const AVATAR_COLORS = ["#a87520", "#4c7c59", "#2f7e76", "#96402a", "#46558c", "#855c18", "#3c6447", "#7c3321"];
export const pickColor = (s: string) => AVATAR_COLORS[Math.abs([...s].reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length];

// ─── Status metadata (label + badge classes) ────────────────────────────────
type Meta = { label: string; cls: string; dot: string };

export const BOOKING_STATUS: Record<BookingStatus, Meta> = {
  inquiry:     { label: "Inquiry",        cls: "bg-night-100 text-night-600",        dot: "bg-night-500" },
  pending:     { label: "Pending",        cls: "bg-gold-200 text-gold-700",          dot: "bg-gold-500" },
  confirmed:   { label: "Confirmed",      cls: "bg-oasis-100 text-oasis-700",        dot: "bg-oasis-500" },
  paid:        { label: "Paid",           cls: "bg-moss-100 text-moss-700",          dot: "bg-moss-500" },
  assigned:    { label: "Assigned",       cls: "bg-sand-200 text-ink-700",           dot: "bg-sand-500" },
  pickup:      { label: "Pickup",         cls: "bg-gold-300 text-ink-800",           dot: "bg-gold-600" },
  in_progress: { label: "On Safari",      cls: "bg-ink-800 text-gold-300",           dot: "bg-gold-400" },
  completed:   { label: "Completed",      cls: "bg-moss-200 text-moss-700",          dot: "bg-moss-600" },
  cancelled:   { label: "Cancelled",      cls: "bg-clay-100 text-clay-700",          dot: "bg-clay-500" },
  no_show:     { label: "No Show",        cls: "bg-ink-100 text-ink-600",            dot: "bg-ink-400" },
};

export const PAY_STATUS: Record<PayStatus, Meta> = {
  unpaid:   { label: "Unpaid",    cls: "bg-clay-100 text-clay-700",  dot: "bg-clay-500" },
  partial:  { label: "Part Paid", cls: "bg-gold-200 text-gold-700",  dot: "bg-gold-500" },
  paid:     { label: "Paid",      cls: "bg-moss-100 text-moss-700",  dot: "bg-moss-500" },
  refunded: { label: "Refunded",  cls: "bg-night-100 text-night-600", dot: "bg-night-500" },
};

export const LEAD_STATUS: Record<LeadStatus, Meta> = {
  new:       { label: "New Lead",  cls: "bg-night-100 text-night-600", dot: "bg-night-500" },
  contacted: { label: "Contacted", cls: "bg-oasis-100 text-oasis-700", dot: "bg-oasis-500" },
  quoted:    { label: "Quoted",    cls: "bg-gold-200 text-gold-700",   dot: "bg-gold-500" },
  follow_up: { label: "Follow-up", cls: "bg-sand-200 text-ink-700",    dot: "bg-sand-500" },
  confirmed: { label: "Confirmed", cls: "bg-oasis-200 text-oasis-700", dot: "bg-oasis-600" },
  paid:      { label: "Paid",      cls: "bg-moss-100 text-moss-700",   dot: "bg-moss-500" },
  completed: { label: "Completed", cls: "bg-moss-200 text-moss-700",   dot: "bg-moss-600" },
  lost:      { label: "Lost",      cls: "bg-clay-100 text-clay-700",   dot: "bg-clay-500" },
};

export const VEHICLE_STATUS: Record<VehicleStatus, Meta> = {
  available:    { label: "Available",   cls: "bg-moss-100 text-moss-700",   dot: "bg-moss-500" },
  assigned:     { label: "Assigned",    cls: "bg-gold-200 text-gold-700",   dot: "bg-gold-500" },
  on_safari:    { label: "On Safari",   cls: "bg-ink-800 text-gold-300",    dot: "bg-gold-400" },
  maintenance:  { label: "Maintenance", cls: "bg-night-100 text-night-600", dot: "bg-night-500" },
  out_of_service:{ label: "Out of Service", cls: "bg-clay-100 text-clay-700", dot: "bg-clay-500" },
};

export const DRIVER_STATUS: Record<DriverStatus, Meta> = {
  available: { label: "Available", cls: "bg-moss-100 text-moss-700",   dot: "bg-moss-500" },
  assigned:  { label: "Assigned",  cls: "bg-gold-200 text-gold-700",   dot: "bg-gold-500" },
  on_trip:   { label: "On Trip",   cls: "bg-ink-800 text-gold-300",    dot: "bg-gold-400" },
  off_duty:  { label: "Off Duty",  cls: "bg-ink-100 text-ink-600",     dot: "bg-ink-400" },
  leave:     { label: "On Leave",  cls: "bg-clay-100 text-clay-700",   dot: "bg-clay-500" },
};

export const TRIP_STATUS: Record<TripStatus, Meta> = {
  scheduled:        { label: "Scheduled",       cls: "bg-night-100 text-night-600", dot: "bg-night-500" },
  driver_assigned:  { label: "Driver Assigned", cls: "bg-gold-200 text-gold-700",   dot: "bg-gold-500" },
  on_the_way:       { label: "On The Way",      cls: "bg-oasis-100 text-oasis-700", dot: "bg-oasis-500" },
  arrived:          { label: "Arrived",         cls: "bg-oasis-200 text-oasis-700", dot: "bg-oasis-600" },
  guests_picked_up: { label: "Guests Picked Up",cls: "bg-sand-200 text-ink-700",    dot: "bg-sand-500" },
  safari_started:   { label: "Safari Started",  cls: "bg-ink-800 text-gold-300",    dot: "bg-gold-400" },
  safari_completed: { label: "Safari Done",     cls: "bg-moss-100 text-moss-700",   dot: "bg-moss-500" },
  dropped_off:      { label: "Dropped Off",     cls: "bg-moss-200 text-moss-700",   dot: "bg-moss-600" },
  completed:        { label: "Completed",       cls: "bg-moss-200 text-moss-700",   dot: "bg-moss-600" },
};

export const QUOTE_STATUS: Record<QuoteStatus, Meta> = {
  draft:    { label: "Draft",    cls: "bg-ink-100 text-ink-600",     dot: "bg-ink-400" },
  sent:     { label: "Sent",     cls: "bg-oasis-100 text-oasis-700", dot: "bg-oasis-500" },
  accepted: { label: "Accepted", cls: "bg-moss-100 text-moss-700",   dot: "bg-moss-500" },
  rejected: { label: "Rejected", cls: "bg-clay-100 text-clay-700",   dot: "bg-clay-500" },
  expired:  { label: "Expired",  cls: "bg-night-100 text-night-600", dot: "bg-night-500" },
};

export const METHOD_LABEL: Record<string, string> = {
  cash: "Cash", card: "Card", bank: "Bank Transfer", online: "Online Payment", other: "Other",
};

// Graceful image fallback — if a photo 404s (offline / blocked CDN), swap in
// an inline SVG dune scene so layouts never break.
export const imgFallback = (e: { currentTarget: HTMLImageElement }) => {
  const el = e.currentTarget;
  if (el.dataset.fb) return;
  el.dataset.fb = "1";
  el.src =
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='1400' height='800'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#f3ecdb'/><stop offset='1' stop-color='#e9c87f'/></linearGradient></defs><rect width='1400' height='800' fill='url(#g)'/><circle cx='1050' cy='170' r='95' fill='#dcae4f'/><path d='M0 520 Q 350 400 700 480 T 1400 460 V800 H0 Z' fill='#c9ae77'/><path d='M0 620 Q 400 520 800 600 T 1400 580 V800 H0 Z' fill='#b69355'/><path d='M0 720 Q 450 640 900 700 T 1400 680 V800 H0 Z' fill='#a87520'/></svg>`,
    );
};
