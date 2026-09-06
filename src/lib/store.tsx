import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Booking, CompanySettings, DB, ID, Notif, PayMethod, Route, Session, Tenant, Trip, User, Vehicle } from "./types";
import { defaultSettings, driverConflict, guestsOf, payStatusOf, seedDB, seedTemplates, vehicleConflict } from "./data";
import { addDaysISO, nowISO, todayISO, uid } from "./utils";

// v2: re-seeds with stable Unsplash CDN photography (v1 pointed at a private host)
const DB_KEY = "dunesuite_db_v2";
const SESSION_KEY = "dunesuite_session_v1";

export interface Toast { id: string; msg: string; kind: "success" | "error" | "info"; }

interface Store {
  db: DB; session: Session | null; user: User | null; tenant: Tenant | null; settings: CompanySettings | null;
  route: Route; setRoute: (r: Route) => void;
  toasts: Toast[]; toast: (msg: string, kind?: Toast["kind"]) => void; dismissToast: (id: string) => void;
  login: (email: string, password: string) => { ok: boolean; error?: string };
  logout: () => void;
  registerCompany: (company: string, name: string, email: string, password: string) => { ok: boolean; error?: string };
  mutate: (fn: (db: DB) => void) => void;
  audit: (action: string, entity: string, entityId: ID, detail: string) => void;
  notify: (kind: string, title: string, body: string, link?: Notif["link"]) => void;
  saveBooking: (b: Booking, isNew: boolean) => string | null;
  assignFleet: (bookingId: ID, vehicleId: ID | null, driverId: ID | null) => string | null;
  recordPayment: (bookingId: ID, amount: number, method: PayMethod, ref: string, note: string, allowOverpay: boolean) => string | null;
  setBookingStatus: (bookingId: ID, status: Booking["status"]) => void;
  advanceTrip: (tripId: ID, status: Trip["status"]) => void;
  resetDemo: () => void;
}

const Ctx = createContext<Store | null>(null);

const loadDB = (): DB => {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw) as DB;
  } catch { /* corrupted → reseed */ }
  const fresh = seedDB();
  localStorage.setItem(DB_KEY, JSON.stringify(fresh));
  return fresh;
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(loadDB);
  const [session, setSession] = useState<Session | null>(() => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
  });
  const [route, setRouteState] = useState<Route>({ page: "dashboard" });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dbRef = useRef(db); dbRef.current = db;

  const setRoute = useCallback((r: Route) => { setRouteState(r); window.scrollTo({ top: 0 }); }, []);

  const persist = useCallback((next: DB) => { setDb(next); localStorage.setItem(DB_KEY, JSON.stringify(next)); }, []);

  const mutate = useCallback((fn: (db: DB) => void) => {
    const next: DB = JSON.parse(JSON.stringify(dbRef.current));
    fn(next);
    persist(next);
  }, [persist]);

  const toast = useCallback((msg: string, kind: Toast["kind"] = "success") => {
    const id = uid();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  const dismissToast = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const user = useMemo(() => (session ? db.users.find((u) => u.id === session.userId) ?? null : null), [db, session]);
  const tenant = useMemo(() => (user?.tenantId ? db.tenants.find((t) => t.id === user.tenantId) ?? null : null), [db, user]);
  const settings = useMemo(() => (user?.tenantId ? db.settings.find((s) => s.tenantId === user.tenantId) ?? null : null), [db, user]);

  const doLogin = useCallback((userId: string, tenantId: ID | null) => {
    const s: Session = { userId, tenantId };
    setSession(s); localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    setRouteState({ page: "dashboard" });
  }, []);

  const login = useCallback((email: string, password: string) => {
    const u = dbRef.current.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!u) return { ok: false, error: "No account found with that email." };
    if (u.password !== password) return { ok: false, error: "Incorrect password. Demo password is demo1234." };
    if (!u.active) return { ok: false, error: "This account has been deactivated. Contact your administrator." };
    const t = u.tenantId ? dbRef.current.tenants.find((x) => x.id === u.tenantId) : null;
    if (t && !t.active) return { ok: false, error: "This company account is suspended. Contact DuneSuite support." };
    doLogin(u.id, u.tenantId);
    mutate((d) => {
      d.audit.unshift({ id: uid(), tenantId: u.tenantId ?? "platform", userId: u.id, userName: u.name, action: "auth.login", entity: "User", entityId: u.id, detail: "Signed in", at: nowISO(), ip: "2.50.44.118 · " + navigator.userAgent.split(" ").slice(-2).join(" ") });
      d.audit = d.audit.slice(0, 400);
    });
    return { ok: true };
  }, [doLogin, mutate]);

  const logout = useCallback(() => { setSession(null); localStorage.removeItem(SESSION_KEY); setRouteState({ page: "dashboard" }); }, []);

  const registerCompany = useCallback((company: string, name: string, email: string, password: string) => {
    const d = dbRef.current;
    if (d.users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())) return { ok: false, error: "That email is already registered." };
    const tenantId = uid();
    const userId = uid();
    mutate((x) => {
      x.tenants.push({ id: tenantId, name: company, slug: company.toLowerCase().replace(/[^a-z0-9]+/g, "-"), plan: "starter", planStatus: "trial", trialEnds: addDaysISO(14), active: true, createdAt: todayISO(), billing: [{ id: uid(), date: todayISO(), amount: 0, plan: "starter", status: "paid" }] });
      x.settings.push(defaultSettings(tenantId, company, company.slice(0, 2).toUpperCase()));
      x.templates.push(...seedTemplates());
      x.users.push({ id: userId, tenantId, name, email: email.trim(), password, role: "admin", active: true, color: "#a87520", createdAt: nowISO() });
      x.notifs.push({ id: uid(), tenantId, kind: "system", title: "Welcome to DuneSuite 🌇", body: "Your 14-day Starter trial has started. Add packages, drivers and vehicles to begin.", at: nowISO(), read: false });
      x.seq = Math.max(x.seq, 1000);
    });
    doLogin(userId, tenantId);
    return { ok: true };
  }, [doLogin, mutate]);

  const notify = useCallback((kind: string, title: string, body: string, link?: Notif["link"]) => {
    mutate((d) => {
      const u = session ? d.users.find((x) => x.id === session.userId) : null;
      d.notifs.unshift({ id: uid(), tenantId: u?.tenantId ?? "platform", kind, title, body, at: nowISO(), read: false, link });
      d.notifs = d.notifs.slice(0, 120);
    });
  }, [mutate, session]);

  // ── Composite business actions with validation ──
  const saveBooking = useCallback((b: Booking, isNew: boolean): string | null => {
    const d = dbRef.current;
    const u = d.users.find((x) => x.id === session?.userId);
    const existing = d.bookings.find((x) => x.id === b.id);
    if (b.driverId) {
      const c = driverConflict(d, b.driverId, b);
      if (c) return `Driver schedule conflict — already assigned to ${c.code} at ${c.pickupTime} on that date.`;
    }
    if (b.vehicleId) {
      const v = d.vehicles.find((x) => x.id === b.vehicleId);
      if (v && guestsOf(b) > v.seats) return `Vehicle capacity exceeded — ${v.model} seats ${v.seats}, booking has ${guestsOf(b)} guests.`;
      const c = vehicleConflict(d, b.vehicleId, b);
      if (c) return `Vehicle conflict — ${v?.plate ?? "vehicle"} is already assigned to ${c.code} on that date.`;
    }
    if (["cancelled", "no_show"].includes(b.status) && (b.driverId || b.vehicleId)) return "Cancelled / no-show bookings cannot have a driver or vehicle assigned.";
    if (b.driverId) {
      const dr = d.drivers.find((x) => x.id === b.driverId);
      if (dr && dr.daysOff?.includes(new Date(b.date + "T12:00:00").getDay())) return `${dr.name} is scheduled off on that day — pick another driver.`;
    }
    mutate((x) => {
      // Single authority for booking codes: allocate the sequence atomically at write time
      if (isNew) {
        const s = x.settings.find((y) => y.tenantId === b.tenantId);
        x.seq += 1;
        b.code = `${s?.bookingPrefix ?? "DS"}-${new Date().getFullYear()}-${String(x.seq).padStart(6, "0")}`;
      }
      const i = x.bookings.findIndex((y) => y.id === b.id);
      if (i >= 0) x.bookings[i] = b; else x.bookings.unshift(b);
      const verb = isNew ? "booking.created" : "booking.updated";
      x.audit.unshift({ id: uid(), tenantId: b.tenantId, userId: u?.id ?? "?", userName: u?.name ?? "System", action: verb, entity: "Booking", entityId: b.id, detail: `${isNew ? "Created" : "Updated"} ${b.code} · ${b.date} ${b.pickupTime} · ${guestsOf(b)} guests`, at: nowISO(), ip: "2.50.44.118" });
      if (isNew) x.notifs.unshift({ id: uid(), tenantId: b.tenantId, kind: "booking", title: `New booking ${b.code}`, body: `${x.customers.find((c) => c.id === b.customerId)?.name ?? "Guest"} · ${guestsOf(b)} guests on ${b.date}${b.source === "Public Booking Page" ? " · online" : ""}`, at: nowISO(), read: false, link: { page: "bookings", id: b.id } });
    });
    void existing;
    return null;
  }, [mutate, session]);

  const assignFleet = useCallback((bookingId: ID, vehicleId: ID | null, driverId: ID | null): string | null => {
    const d = dbRef.current;
    const b = d.bookings.find((x) => x.id === bookingId);
    if (!b) return "Booking not found.";
    if (["cancelled", "no_show"].includes(b.status)) return "This booking is cancelled — it cannot be assigned.";
    const next: Booking = { ...b, vehicleId: vehicleId ?? b.vehicleId, driverId: driverId ?? b.driverId };
    if (driverId) {
      const dr = d.drivers.find((x) => x.id === driverId);
      if (dr && ["off_duty", "leave"].includes(dr.status)) return `${dr.name} is ${dr.status === "leave" ? "on leave" : "off duty"} and cannot be assigned.`;
      const lic = new Date(dr?.licenseExpiry ?? "2099-01-01") < new Date(todayISO() + "T00:00:00");
      if (dr && lic) return `${dr.name}'s driving licence is expired — assignment blocked.`;
      if (dr && dr.daysOff?.includes(new Date(b.date + "T12:00:00").getDay())) return `${dr.name} is scheduled off on ${b.date} — pick another driver.`;
      const c = driverConflict(d, driverId, next);
      if (c) return `Driver conflict — already assigned to ${c.code} (${c.pickupTime}) on ${b.date}.`;
    }
    if (vehicleId) {
      const v = d.vehicles.find((x) => x.id === vehicleId);
      if (v && ["maintenance", "out_of_service"].includes(v.status)) return `${v.plate} is in ${v.status === "maintenance" ? "maintenance" : "out of service"}.`;
      if (v && guestsOf(b) > v.seats) return `${v.model} seats ${v.seats} — booking needs ${guestsOf(b)} seats.`;
      const c = vehicleConflict(d, vehicleId, next);
      if (c) return `Vehicle conflict — ${v?.plate} already assigned to ${c.code} on ${b.date}.`;
    }
    mutate((x) => {
      const bb = x.bookings.find((y) => y.id === bookingId)!;
      bb.vehicleId = vehicleId ?? bb.vehicleId;
      bb.driverId = driverId ?? bb.driverId;
      if (bb.driverId && ["confirmed", "paid", "inquiry", "pending"].includes(bb.status)) bb.status = "assigned";
      if (bb.driverId && !x.trips.some((t) => t.bookingId === bb.id)) {
        x.trips.unshift({ id: uid(), tenantId: bb.tenantId, bookingId: bb.id, status: "driver_assigned", driverId: bb.driverId!, vehicleId: bb.vehicleId ?? "", notes: "" });
      }
      const trip = x.trips.find((t) => t.bookingId === bb.id);
      if (trip && trip.status === "driver_assigned") { trip.driverId = bb.driverId ?? trip.driverId; trip.vehicleId = bb.vehicleId ?? trip.vehicleId; }
      if (vehicleId) { const v = x.vehicles.find((y) => y.id === vehicleId)!; if (v.status === "available") v.status = "assigned"; }
      const u = x.users.find((y) => y.id === session?.userId);
      const dn = x.drivers.find((y) => y.id === bb.driverId)?.name;
      const vn = x.vehicles.find((y) => y.id === bb.vehicleId)?.plate;
      x.audit.unshift({ id: uid(), tenantId: bb.tenantId, userId: u?.id ?? "?", userName: u?.name ?? "System", action: "booking.assigned", entity: "Booking", entityId: bb.id, detail: `${dn ?? "—"} + ${vn ?? "—"} → ${bb.code}`, at: nowISO(), ip: "2.50.44.118" });
      x.notifs.unshift({ id: uid(), tenantId: bb.tenantId, kind: "driver", title: "Driver assigned", body: `${dn} → ${bb.code} on ${bb.date} at ${bb.pickupTime}`, at: nowISO(), read: false, link: { page: "bookings", id: bb.id } });
    });
    return null;
  }, [mutate, session]);

  const recordPayment = useCallback((bookingId: ID, amount: number, method: PayMethod, ref: string, note: string, allowOverpay: boolean): string | null => {
    const d = dbRef.current;
    const b = d.bookings.find((x) => x.id === bookingId);
    if (!b) return "Booking not found.";
    if (!amount || amount <= 0) return "Enter a valid amount greater than zero.";
    const s = b.tenantId ? d.settings.find((x) => x.tenantId === b.tenantId) : null;
    const already = d.payments.filter((p) => p.bookingId === bookingId && p.status === "captured").reduce((a, p) => a + p.amount, 0);
    if (already + amount > b.total + 0.01 && !allowOverpay) return `This would overpay the booking by ${Math.round((already + amount - b.total) * 100) / 100}. Tick “allow overpayment” to record it anyway.`;
    const cur = s?.currency ?? "AED";
    mutate((x) => {
      const bb = x.bookings.find((y) => y.id === bookingId)!;
      const seqNo = 4200 + x.payments.length + 1;
      x.payments.unshift({ id: uid(), tenantId: bb.tenantId, bookingId, invoiceNo: `${s?.invoicePrefix ?? "INV"}-${new Date().getFullYear()}-${String(seqNo).padStart(4, "0")}`, amount, method, date: nowISO(), ref, status: "captured", note });
      const paidNow = x.payments.filter((p) => p.bookingId === bookingId && p.status === "captured").reduce((a, p) => a + p.amount, 0);
      if (paidNow >= bb.total && ["pending", "confirmed", "inquiry", "paid"].includes(bb.status)) bb.status = "paid";
      const u = x.users.find((y) => y.id === session?.userId);
      x.audit.unshift({ id: uid(), tenantId: bb.tenantId, userId: u?.id ?? "?", userName: u?.name ?? "System", action: "payment.recorded", entity: "Payment", entityId: bookingId, detail: `${cur} ${amount} via ${method} on ${bb.code}`, at: nowISO(), ip: "2.50.44.118" });
      x.notifs.unshift({ id: uid(), tenantId: bb.tenantId, kind: "payment", title: `Payment received — ${cur} ${amount.toLocaleString()}`, body: `${bb.code} · balance ${cur} ${Math.max(0, bb.total - paidNow)}`, at: nowISO(), read: false, link: { page: "payments", id: bookingId } });
    });
    return null;
  }, [mutate, session]);

  const setBookingStatus = useCallback((bookingId: ID, status: Booking["status"]) => {
    mutate((x) => {
      const b = x.bookings.find((y) => y.id === bookingId);
      if (!b) return;
      const prev = b.status;
      b.status = status;
      if (["cancelled", "no_show", "completed"].includes(status)) {
        // Release fleet: close the linked trip and free driver/vehicle so they can be re-assigned
        const t = x.trips.find((y) => y.bookingId === b.id);
        if (t && t.status !== "completed") { t.status = "completed"; t.endAt = nowISO(); }
        const dr = x.drivers.find((y) => y.id === b.driverId);
        if (dr && ["on_trip", "assigned"].includes(dr.status)) dr.status = "available";
        const v = x.vehicles.find((y) => y.id === b.vehicleId);
        if (v && ["on_safari", "assigned"].includes(v.status)) v.status = "available";
        if (status !== "completed") { b.driverId = null; b.vehicleId = null; }
      }
      if (status === "pickup" && b.driverId && x.vehicles.some((v) => v.id === b.vehicleId)) {
        const v = x.vehicles.find((y) => y.id === b.vehicleId)!; v.status = "on_safari";
      }
      const u = x.users.find((y) => y.id === session?.userId);
      x.audit.unshift({ id: uid(), tenantId: b.tenantId, userId: u?.id ?? "?", userName: u?.name ?? "System", action: `booking.status`, entity: "Booking", entityId: b.id, detail: `${b.code}: ${prev} → ${status}`, at: nowISO(), ip: "2.50.44.118" });
      if (status === "cancelled") x.notifs.unshift({ id: uid(), tenantId: b.tenantId, kind: "booking", title: `Booking cancelled — ${b.code}`, body: "Fleet assignment released.", at: nowISO(), read: false, link: { page: "bookings", id: b.id } });
    });
  }, [mutate, session]);

  const advanceTrip = useCallback((tripId: ID, status: Trip["status"]) => {
    mutate((x) => {
      const t = x.trips.find((y) => y.id === tripId);
      if (!t) return;
      t.status = status;
      if (status === "on_the_way") { t.startAt = nowISO(); x.bookings.find((b) => b.id === t.bookingId)!.status = "pickup"; const v = x.vehicles.find((y) => y.id === t.vehicleId); if (v) v.status = "on_safari"; const dr = x.drivers.find((y) => y.id === t.driverId); if (dr) dr.status = "on_trip"; }
      if (status === "arrived") { x.bookings.find((b) => b.id === t.bookingId)!.status = "pickup"; }
      if (status === "safari_started") { x.bookings.find((b) => b.id === t.bookingId)!.status = "in_progress"; }
      if (status === "completed") {
        t.endAt = nowISO();
        const b = x.bookings.find((y) => y.id === t.bookingId)!;
        b.status = "completed";
        const dr = x.drivers.find((y) => y.id === t.driverId);
        if (dr) { dr.completedTrips += 1; dr.totalTrips += 1; dr.status = "available"; }
        const v = x.vehicles.find((y) => y.id === t.vehicleId); if (v) v.status = "available";
        x.notifs.unshift({ id: uid(), tenantId: t.tenantId, kind: "trip", title: `Trip completed — ${b.code}`, body: `${dr?.name ?? "Driver"} finished the safari. Review request can be sent.`, at: nowISO(), read: false, link: { page: "trips" } });
      }
      // Note: the vehicle stays on_safari until the trip is fully completed (guests dropped off)
    });
  }, [mutate]);

  const resetDemo = useCallback(() => {
    const fresh = seedDB();
    persist(fresh);
    toast("Demo data reset to fresh seed.", "info");
  }, [persist, toast]);

  // Audit helper (uses current session user)
  const auditReal = useCallback((action: string, entity: string, entityId: ID, detail: string) => {
    mutate((x) => {
      const u = session ? x.users.find((y) => y.id === session.userId) : null;
      x.audit.unshift({ id: uid(), tenantId: u?.tenantId ?? "platform", userId: u?.id ?? "?", userName: u?.name ?? "System", action, entity, entityId, detail, at: nowISO(), ip: "2.50.44.118" });
      x.audit = x.audit.slice(0, 400);
    });
  }, [mutate, session]);

  const value: Store = {
    db, session, user, tenant, settings, route, setRoute, toasts, toast, dismissToast,
    login, logout, registerCompany, mutate, audit: auditReal, notify,
    saveBooking, assignFleet, recordPayment, setBookingStatus, advanceTrip, resetDemo,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside provider");
  return s;
}

export const useTenant = <T extends { tenantId: ID }>(arr: T[]): T[] => {
  const { user } = useStore();
  const tid = user?.tenantId;
  return useMemo(() => (tid ? arr.filter((x) => x.tenantId === tid) : []), [arr, tid]);
};

export const payStatus = payStatusOf;
