import type {
  Addon, Booking, CompanySettings, DB, PayStatus, PlanId, ReminderItem, SafariPackage, Template, Vehicle,
} from "./types";
import { addDaysISO, daysFromNow, overlaps, toMin, todayISO, uid } from "./utils";

// ─── Generated photography assets ───────────────────────────────────────────
export const IMG = {
  hero: "https://image.qwenlm.ai/generated-images/95c215dd-14b2-4882-918a-b45dd8e7ee56/_result.png",
  camp: "https://image.qwenlm.ai/generated-images/a38f6bbd-9a37-49e7-9dc2-3a1304430058/_result.png",
  vip: "https://image.qwenlm.ai/generated-images/274cdee5-83d6-4b13-8ddf-a32d70c485ba/_result.png",
  quad: "https://image.qwenlm.ai/generated-images/164eadbf-ca6d-4abf-b82a-4684234b0091/_result.png",
  morning: "https://image.qwenlm.ai/generated-images/06cc14b6-cc2d-4900-bb51-69bcb3d417fb/_result.png",
  falcon: "https://image.qwenlm.ai/generated-images/ebffe20f-3e4b-46f2-874f-0e967f2ae4e8/_result.png",
};

export const INSPECTION_ITEMS = [
  { key: "tires", label: "Tires & pressure" }, { key: "engine", label: "Engine & fluids" },
  { key: "brakes", label: "Brakes" }, { key: "ac", label: "Air conditioning" },
  { key: "belts", label: "Seat belts" }, { key: "lights", label: "Lights & indicators" },
  { key: "fuel", label: "Fuel level" }, { key: "exterior", label: "Exterior condition" },
  { key: "interior", label: "Interior cleanliness" },
];

export const LEAD_SOURCES = ["whatsapp", "website", "instagram", "walk_in", "phone", "agent", "hotel"] as const;
export const BOOKING_SOURCES = ["Website", "WhatsApp", "Phone", "Walk-in", "Hotel Desk", "OTA Partner", "Public Booking Page"];

export const PLANS: Record<PlanId, { name: string; price: number; tagline: string; features: string[] }> = {
  starter: {
    name: "Starter", price: 149, tagline: "For small operators getting organised",
    features: ["Up to 3 staff users", "100 bookings / month", "Customer management", "Booking management", "Basic reports", "Email support"],
  },
  professional: {
    name: "Professional", price: 349, tagline: "Full operations for growing fleets",
    features: ["Up to 15 staff users", "Unlimited bookings", "WhatsApp CRM + pipeline", "Fleet & driver management", "Advanced reports & analytics", "Automated reminders", "Quotations & invoicing"],
  },
  enterprise: {
    name: "Enterprise", price: 799, tagline: "Multi-branch safari groups",
    features: ["Unlimited users", "Multiple branches", "Advanced analytics", "API integrations (WhatsApp Cloud, payments)", "Custom branding & domain", "Priority 24/7 support", "Dedicated success manager"],
  },
};

export const seedTemplates = (): Template[] => [
  { id: "t1", key: "welcome", name: "Welcome message", body: "Salam {name}! Welcome to {company} 🌇 Thank you for your enquiry about our desert safaris. How many guests will be joining, and what date are you planning?" },
  { id: "t2", key: "package", name: "Package details", body: "Here are the details for our {package}:\n• Duration: {duration}\n• Includes dune bashing, camel ride, sandboarding, BBQ dinner & live shows\n• Hotel pickup & drop-off included\n• Price: {price} per adult" },
  { id: "t3", key: "quote", name: "Price quotation", body: "Hi {name}, your quotation is ready 🧾\n{package} on {date}\n{adults} adults × {adult_price} + {children} children × {child_price}\nTotal: {total}\nShall I reserve this for you?" },
  { id: "t4", key: "confirm", name: "Booking confirmation", body: "Your desert safari is confirmed ✅\nBooking ID: {code}\nDate: {date} · Pickup: {time} from {location}\nWe can't wait to host you in the desert!" },
  { id: "t5", key: "payment", name: "Payment reminder", body: "Hi {name}, a gentle reminder that your payment of {balance} for booking {code} is still pending. You can pay by card link, bank transfer or cash to the driver." },
  { id: "t6", key: "pickup", name: "Pickup confirmation", body: "Your pickup is confirmed for {time} from {location} 📍 Our driver will call you 15 minutes before arrival. Please be ready in the hotel lobby." },
  { id: "t7", key: "driver", name: "Driver details", body: "Your driver for {date} is {driver} 🚙 Vehicle: {vehicle} ({plate}). He will reach your pickup point at {time}. Contact: {driver_phone}" },
  { id: "t8", key: "reminder", name: "Safari reminder", body: "Your desert safari is tomorrow 🌇 Pickup at {time} from {location}. Wear comfortable clothes and bring a light jacket for the evening. See you in the dunes!" },
  { id: "t9", key: "thanks", name: "Thank-you message", body: "Thank you for choosing {company}! 🙏 We hope your desert evening was unforgettable. Safe travels and see you again soon!" },
  { id: "t10", key: "review", name: "Review request", body: "Hi {name}! How was your safari? ⭐ We'd love a quick review — it helps other travellers find us. Just reply here or tap the link we sent by email." },
];

export const defaultSettings = (tenantId: string, name: string, prefix: string): CompanySettings => ({
  tenantId, name, tagline: "Desert experiences, run beautifully.",
  address: "Office 204, Al Barsha Heights, Dubai, UAE", phone: "+971 4 555 0182",
  whatsapp: "+971 50 555 0182", email: "hello@dunehorizon.ae", website: "www.dunehorizon.ae",
  currency: "AED", taxPct: 5, invoicePrefix: "INV", bookingPrefix: prefix,
  terms: "Full payment is due 24 hours before the safari. Bookings are transferable to another date subject to availability.",
  cancellationPolicy: "Free cancellation up to 48 hours before pickup. 50% charge within 48 hours. No refund for no-shows.",
  paymentInstructions: "Bank transfer: Emirates NBD · IBAN AE07 0260 0010 1234 5678 900 · Reference: your booking ID. Card links are sent via WhatsApp.",
  reminders: { day24: true, dayOf: true, after: true, unpaid: true },
  whatsappApi: { configured: false, phoneId: "", token: "", verifyToken: "", testNumber: "" },
});

// ─── Derived business helpers ───────────────────────────────────────────────
export const guestsOf = (b: Pick<Booking, "adults" | "children">) => b.adults + b.children;

export const bookingPaid = (db: DB, bookingId: string) =>
  db.payments.filter((p) => p.bookingId === bookingId && p.status === "captured").reduce((s, p) => s + p.amount, 0);

export const payStatusOf = (db: DB, b: Booking): PayStatus => {
  const pays = db.payments.filter((p) => p.bookingId === b.id);
  const paid = bookingPaid(db, b.id);
  if (pays.length > 0 && pays.every((p) => p.status === "refunded")) return "refunded";
  if (paid >= b.total - 0.01) return "paid";
  if (paid > 0) return "partial";
  return "unpaid";
};

export const calcTotal = (pkg: SafariPackage | undefined, adults: number, children: number, addons: Addon[], discount: number, taxPct: number) => {
  const base = (pkg?.adultPrice ?? 0) * adults + (pkg?.childPrice ?? 0) * children;
  const add = addons.reduce((s, a) => s + a.price, 0);
  const afterDisc = Math.max(0, base + add - discount);
  const tax = Math.round(afterDisc * taxPct) / 100;
  return { base, addons: add, afterDisc, tax, total: Math.round((afterDisc + tax) * 100) / 100 };
};

export const nextCode = (db: DB, prefix: string) => `${prefix}-${new Date().getFullYear()}-${String(db.seq).padStart(6, "0")}`;

const safariWindow = (b: Pick<Booking, "pickupTime">) => {
  const s = toMin(b.pickupTime);
  return { s: s - 60, e: s + 420 }; // buffer 1h before pickup → 7h service window
};

export const driverConflict = (db: DB, driverId: string, b: Booking) => {
  const w = safariWindow(b);
  return db.bookings.find((x) =>
    x.id !== b.id && x.tenantId === b.tenantId && x.driverId === driverId && x.date === b.date &&
    !["cancelled", "no_show", "completed"].includes(x.status) &&
    overlaps(w.s, w.e, ...(() => { const o = safariWindow(x); return [o.s, o.e] as const; })())
  ) ?? null;
};

export const vehicleConflict = (db: DB, vehicleId: string, b: Booking) => {
  const w = safariWindow(b);
  return db.bookings.find((x) =>
    x.id !== b.id && x.tenantId === b.tenantId && x.vehicleId === vehicleId && x.date === b.date &&
    !["cancelled", "no_show", "completed"].includes(x.status) &&
    overlaps(w.s, w.e, ...(() => { const o = safariWindow(x); return [o.s, o.e] as const; })())
  ) ?? null;
};

export const expiryWarn = (iso: string): { level: "expired" | "soon"; days: number } | null => {
  const d = daysFromNow(iso);
  if (d < 0) return { level: "expired", days: d };
  if (d <= 30) return { level: "soon", days: d };
  return null;
};

export const vehicleIssues = (v: Vehicle) => {
  const list: { label: string; warn: { level: "expired" | "soon"; days: number } }[] = [];
  (["insuranceExpiry", "regExpiry", "permitExpiry"] as const).forEach((k) => {
    const w = expiryWarn(v[k]);
    if (w) list.push({ label: k === "insuranceExpiry" ? "Insurance" : k === "regExpiry" ? "Registration" : "Permit", warn: w });
  });
  if (daysFromNow(v.nextService) <= 7) list.push({ label: "Service due", warn: { level: daysFromNow(v.nextService) < 0 ? "expired" : "soon", days: daysFromNow(v.nextService) } });
  return list;
};

export const buildReminders = (db: DB, tenantId: string): ReminderItem[] => {
  const t = todayISO();
  const out: ReminderItem[] = [];
  const cust = (id: string) => db.customers.find((c) => c.id === id)?.name ?? "Guest";
  db.bookings.filter((b) => b.tenantId === tenantId && !["cancelled", "no_show"].includes(b.status)).forEach((b) => {
    const delta = daysFromNow(b.date);
    const name = cust(b.customerId);
    if (delta === 1) out.push({ id: `r24-${b.id}`, when: b.date, kind: "24h_before", bookingCode: b.code, customer: name, channel: "WhatsApp · Email", text: `Hi ${name.split(" ")[0]}! Your desert safari is tomorrow 🌇 Pickup at ${b.pickupTime} from ${b.pickupLocation}.`, state: delta <= 0 ? "ready" : "scheduled" });
    if (delta === 0) out.push({ id: `rd0-${b.id}`, when: b.date, kind: "day_of", bookingCode: b.code, customer: name, channel: "WhatsApp", text: `Your driver will arrive at your pickup location at ${b.pickupTime}. Booking ${b.code}.`, state: "ready" });
    if (delta < 0 && b.status === "completed") out.push({ id: `raf-${b.id}`, when: b.date, kind: "after", bookingCode: b.code, customer: name, channel: "WhatsApp · Email", text: `Thank you for joining us, ${name.split(" ")[0]}! Please leave a review ⭐`, state: "sent" });
    const bal = b.total - bookingPaid(db, b.id);
    if (bal > 0 && delta >= 0 && b.status !== "inquiry") out.push({ id: `run-${b.id}`, when: b.date, kind: "unpaid", bookingCode: b.code, customer: name, channel: "WhatsApp", text: `Your booking payment of AED ${bal} is still pending for ${b.code}.`, state: "ready" });
  });
  return out.sort((a, b) => a.when.localeCompare(b.when));
};

// ─── Seed database ──────────────────────────────────────────────────────────
export function seedDB(): DB {
  const T1 = "t1", T2 = "t2";
  const now = new Date().toISOString();
  const iso = (daysAgo: number, h: number, m: number) => {
    const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(h, m, 0, 0);
    return d.toISOString();
  };

  const packages: SafariPackage[] = [
    { id: "p1", tenantId: T1, name: "Evening Desert Safari", description: "The classic Dubai desert evening — dune bashing, camel rides, sandboarding and a BBQ dinner under the stars at our traditional camp.", duration: "6 hours", adultPrice: 250, childPrice: 150, privatePrice: 1650, maxPax: 7, pickup: "3:00 PM – 4:00 PM", includes: ["Hotel pickup & drop-off", "45-min dune bashing", "Camel riding", "Sandboarding", "BBQ dinner & soft drinks", "Tanoura & fire show", "Henna painting"], excludes: ["Quad biking", "Alcoholic beverages", "Falconry photo"], terms: "Not recommended for pregnant guests or guests with back problems.", active: true, image: IMG.hero, accent: "#c8912f" },
    { id: "p2", tenantId: T1, name: "Morning Desert Safari", description: "A serene sunrise run over cool morning dunes with dune bashing, sandboarding and camel rides — back in town before lunch.", duration: "4 hours", adultPrice: 190, childPrice: 120, privatePrice: 1200, maxPax: 7, pickup: "8:00 AM – 9:00 AM", includes: ["Hotel pickup & drop-off", "Dune bashing", "Sandboarding", "Camel ride", "Refreshments"], excludes: ["Breakfast", "Quad biking"], terms: "Morning slots subject to weather conditions.", active: true, image: IMG.morning, accent: "#b69355" },
    { id: "p3", tenantId: T1, name: "Overnight Desert Safari", description: "Sleep under a blanket of stars. Evening safari, BBQ dinner, overnight in the camp with breakfast and a sunrise camel trek.", duration: "18 hours", adultPrice: 420, childPrice: 280, privatePrice: 2600, maxPax: 6, pickup: "3:00 PM – 4:00 PM", includes: ["Full evening safari", "BBQ dinner", "Overnight camp stay", "Breakfast", "Sunrise camel trek", "Stargazing telescope"], excludes: ["Private tent upgrade", "Alcoholic beverages"], terms: "ID required for overnight guests. Sleeping bags provided.", active: true, image: IMG.camp, accent: "#46558c" },
    { id: "p4", tenantId: T1, name: "VIP Private Desert Safari", description: "A private convoy, your own majlis lounge, premium BBQ and dedicated entertainment — the desert, exclusively yours.", duration: "7 hours", adultPrice: 650, childPrice: 450, privatePrice: 4200, maxPax: 6, pickup: "Any time", includes: ["Private Land Cruiser convoy", "Private majlis lounge", "Premium BBQ & beverages", "Private tanoura & fire show", "Falconry experience", "Dedicated host"], excludes: ["Shared camp access"], terms: "Minimum 2 guests. 48-hour notice for special menus.", active: true, image: IMG.vip, accent: "#855c18" },
    { id: "p5", tenantId: T1, name: "Premium Desert Safari", description: "Small-group comfort — fewer guests per vehicle, upgraded dinner buffet and prime camp seating with all classic activities.", duration: "6 hours", adultPrice: 340, childPrice: 220, privatePrice: 2100, maxPax: 5, pickup: "3:00 PM – 4:00 PM", includes: ["Max 5 guests per vehicle", "All classic activities", "Upgraded BBQ buffet", "Premium seating", "Welcome mocktails"], excludes: ["Quad biking", "Private lounge"], terms: "Subject to availability on public holidays.", active: true, image: IMG.falcon, accent: "#2f7e76" },
    { id: "p6", tenantId: T1, name: "Dune Bashing Adventure", description: "Pure adrenaline — 90 minutes of red-dune bashing with photo stops, sandboarding and a falcon photo opportunity.", duration: "3 hours", adultPrice: 160, childPrice: 110, privatePrice: 950, maxPax: 7, pickup: "2:30 PM or 7:00 AM", includes: ["90-min dune bashing", "Sandboarding", "Falcon photo stop", "Water & refreshments"], excludes: ["Camp access", "Dinner"], terms: "Guests must be 5+ years. Not suitable for pregnancy or back issues.", active: true, image: IMG.hero, accent: "#96402a" },
    { id: "p7", tenantId: T1, name: "Quad Bike Desert Ride", description: "Ride your own quad over a marked desert trail with full safety gear and an escort guide. 30 or 60 minute rides.", duration: "2 hours", adultPrice: 220, childPrice: 0, privatePrice: 1300, maxPax: 10, pickup: "Self-drive to site or add transfer", includes: ["Quad bike & fuel", "Helmet & safety gear", "Escort guide", "Refreshments"], excludes: ["Hotel transfer (optional add-on)", "Insurance waiver fee"], terms: "Valid driving licence required for solo riders. 16+ only.", active: true, image: IMG.quad, accent: "#a87520" },
    { id: "p8", tenantId: T1, name: "Desert Camp Experience", description: "Head straight to camp for an evening of culture — falconry, camel rides, henna, shisha lounge and a full BBQ spread.", duration: "5 hours", adultPrice: 200, childPrice: 130, privatePrice: 1400, maxPax: 8, pickup: "4:00 PM – 5:00 PM", includes: ["Camp transfer", "Falconry show", "Camel rides", "Henna & shisha lounge", "BBQ dinner & live shows"], excludes: ["Dune bashing", "Quad biking"], terms: "Great option for guests who prefer to skip dune bashing.", active: true, image: IMG.camp, accent: "#3c6447" },
  ];

  const drivers: import("./types").Driver[] = [
    { id: "dr1", tenantId: T1, name: "Rashid Khan", phone: "+971 50 221 4431", whatsapp: "+971 50 221 4431", email: "rashid@dunehorizon.ae", licenseNo: "DL-774821", licenseExpiry: addDaysISO(210), visaExpiry: addDaysISO(400), vehicleId: "v1", status: "available" as const, rating: 4.9, totalTrips: 412, completedTrips: 401, notes: "Senior guide. Speaks English, Urdu, Arabic. VIP-trained.", daysOff: [5], joinedAt: addDaysISO(-640) },
    { id: "dr2", tenantId: T1, name: "Karim Bouzid", phone: "+971 55 874 2210", whatsapp: "+971 55 874 2210", email: "karim@dunehorizon.ae", licenseNo: "DL-339017", licenseExpiry: addDaysISO(42), visaExpiry: addDaysISO(180), vehicleId: "v2", status: "assigned" as const, rating: 4.7, totalTrips: 268, completedTrips: 259, notes: "Excellent with families. French & Arabic.", daysOff: [0], joinedAt: addDaysISO(-420) },
    { id: "dr3", tenantId: T1, name: "Sanjay Mehta", phone: "+971 52 660 9034", whatsapp: "+971 52 660 9034", email: "sanjay@dunehorizon.ae", licenseNo: "DL-501128", licenseExpiry: addDaysISO(300), visaExpiry: addDaysISO(510), vehicleId: "v3", status: "on_trip" as const, rating: 4.8, totalTrips: 355, completedTrips: 348, notes: "Overnight safari specialist. First-aid certified.", daysOff: [], joinedAt: addDaysISO(-530) },
    { id: "dr4", tenantId: T1, name: "Fatima Zahra", phone: "+971 54 309 7761", whatsapp: "+971 54 309 7761", email: "fatima@dunehorizon.ae", licenseNo: "DL-882340", licenseExpiry: addDaysISO(14), visaExpiry: addDaysISO(260), vehicleId: null, status: "available" as const, rating: 4.9, totalTrips: 190, completedTrips: 188, notes: "Our first female safari guide. Arabic, French, English.", daysOff: [6], joinedAt: addDaysISO(-260) },
    { id: "dr5", tenantId: T1, name: "Ahmed Suleiman", phone: "+971 50 776 4125", whatsapp: "+971 50 776 4125", email: "ahmed@dunehorizon.ae", licenseNo: "DL-640923", licenseExpiry: addDaysISO(-9), visaExpiry: addDaysISO(90), vehicleId: null, status: "off_duty" as const, rating: 4.5, totalTrips: 145, completedTrips: 139, notes: "Licence renewal in progress — do not assign trips.", daysOff: [2, 4], joinedAt: addDaysISO(-720) },
  ];

  const vehicles: Vehicle[] = [
    { id: "v1", tenantId: T1, plate: "DXB 34521", type: "4x4 SUV", make: "Nissan", model: "Patrol Platinum", year: 2023, color: "Desert Sand", seats: 7, status: "available", driverId: "dr1", insuranceExpiry: addDaysISO(240), regExpiry: addDaysISO(310), permitExpiry: addDaysISO(200), lastService: addDaysISO(-40), nextService: addDaysISO(50), mileage: 48210, notes: "Flagship vehicle. Leather interior, fridge." },
    { id: "v2", tenantId: T1, plate: "DXB 78410", type: "4x4 SUV", make: "Toyota", model: "Land Cruiser GXR", year: 2022, color: "Pearl White", seats: 8, status: "assigned", driverId: "dr2", insuranceExpiry: addDaysISO(16), regExpiry: addDaysISO(190), permitExpiry: addDaysISO(120), lastService: addDaysISO(-75), nextService: addDaysISO(15), mileage: 71340, notes: "Family favourite — extra AC vents in rear." },
    { id: "v3", tenantId: T1, plate: "SHJ 12930", type: "4x4 SUV", make: "Nissan", model: "Patrol Safari", year: 2021, color: "Bronze", seats: 7, status: "on_safari", driverId: "dr3", insuranceExpiry: addDaysISO(150), regExpiry: addDaysISO(95), permitExpiry: addDaysISO(60), lastService: addDaysISO(-20), nextService: addDaysISO(70), mileage: 92875, notes: "Night lights & rooftop searchlight fitted." },
    { id: "v4", tenantId: T1, plate: "DXB 55127", type: "4x4 SUV", make: "Toyota", model: "Land Cruiser VXR", year: 2023, color: "Midnight Black", seats: 8, status: "maintenance", driverId: null, insuranceExpiry: addDaysISO(280), regExpiry: addDaysISO(330), permitExpiry: addDaysISO(275), lastService: addDaysISO(-120), nextService: addDaysISO(-4), mileage: 38920, notes: "Suspension service — expected back in 2 days." },
    { id: "v5", tenantId: T1, plate: "DXB 90233", type: "4x4 SUV", make: "Nissan", model: "Patrol Platinum City", year: 2024, color: "Champagne Gold", seats: 7, status: "available", driverId: "dr4", insuranceExpiry: addDaysISO(350), regExpiry: addDaysISO(355), permitExpiry: addDaysISO(340), lastService: addDaysISO(-10), nextService: addDaysISO(80), mileage: 12450, notes: "Newest in fleet. VIP spec." },
    { id: "v6", tenantId: T2, plate: "AUH 44102", type: "4x4 SUV", make: "Toyota", model: "Land Cruiser", year: 2020, color: "White", seats: 8, status: "available", driverId: null, insuranceExpiry: addDaysISO(100), regExpiry: addDaysISO(140), permitExpiry: addDaysISO(90), lastService: addDaysISO(-30), nextService: addDaysISO(60), mileage: 104200, notes: "" },
  ];

  const customers = [
    { id: "c1", tenantId: T1, name: "James Whitfield", phone: "+44 7700 900123", whatsapp: "+44 7700 900123", email: "james.w@gmail.com", country: "United Kingdom", notes: "Returning guest — loved the overnight safari.", createdAt: iso(200, 10, 0) },
    { id: "c2", tenantId: T1, name: "Aisha Al Falasi", phone: "+971 50 111 2233", whatsapp: "+971 50 111 2233", email: "aisha.f@outlook.com", country: "UAE", notes: "Corporate client. Books team outings.", createdAt: iso(160, 12, 0) },
    { id: "c3", tenantId: T1, name: "Hans Mueller", phone: "+49 151 2345 678", whatsapp: "+49 151 2345 678", email: "hans.mueller@web.de", country: "Germany", notes: "", createdAt: iso(120, 9, 0) },
    { id: "c4", tenantId: T1, name: "Priya Sharma", phone: "+91 98200 45671", whatsapp: "+91 98200 45671", email: "priya.sharma@yahoo.com", country: "India", notes: "Vegetarian meals required.", createdAt: iso(90, 15, 0) },
    { id: "c5", tenantId: T1, name: "Chen Wei", phone: "+86 138 0011 2233", whatsapp: "+86 138 0011 2233", email: "chen.wei@qq.com", country: "China", notes: "Prefers Mandarin-speaking guide when possible.", createdAt: iso(75, 11, 0) },
    { id: "c6", tenantId: T1, name: "Sofia Rossi", phone: "+39 333 445 5667", whatsapp: "+39 333 445 5667", email: "sofia.rossi@libero.it", country: "Italy", notes: "Honeymoon couple — VIP upgrades welcomed.", createdAt: iso(60, 17, 0) },
    { id: "c7", tenantId: T1, name: "Mohammed Rahman", phone: "+880 1711 223344", whatsapp: "+880 1711 223344", email: "m.rahman@gmail.com", country: "Bangladesh", notes: "", createdAt: iso(45, 13, 0) },
    { id: "c8", tenantId: T1, name: "Emma Johansson", phone: "+46 70 123 4567", whatsapp: "+46 70 123 4567", email: "emma.j@icloud.com", country: "Sweden", notes: "Allergic to peanuts — inform camp kitchen.", createdAt: iso(30, 16, 0) },
    { id: "c9", tenantId: T1, name: "David Okafor", phone: "+234 803 555 0192", whatsapp: "+234 803 555 0192", email: "david.okafor@gmail.com", country: "Nigeria", notes: "Books for extended family groups (8-12 pax).", createdAt: iso(21, 10, 0) },
    { id: "c10", tenantId: T1, name: "Yuki Tanaka", phone: "+81 90 1234 5678", whatsapp: "+81 90 1234 5678", email: "yuki.tanaka@gmail.com", country: "Japan", notes: "", createdAt: iso(10, 14, 0) },
    { id: "c11", tenantId: T2, name: "Laura Bennett", phone: "+44 7911 123456", whatsapp: "+44 7911 123456", email: "laura.b@gmail.com", country: "United Kingdom", notes: "", createdAt: iso(15, 10, 0) },
    { id: "c12", tenantId: T2, name: "Ivan Petrov", phone: "+7 916 123 4567", whatsapp: "+7 916 123 4567", email: "ivan.p@mail.ru", country: "Russia", notes: "", createdAt: iso(8, 10, 0) },
  ];

  const leads = [
    { id: "l1", tenantId: T1, name: "Oliver Bennett", phone: "+44 7911 220011", whatsapp: "+44 7911 220011", email: "oliver.b@gmail.com", adults: 2, children: 2, preferredDate: addDaysISO(3), packageId: "p1", pickupLocation: "Atlantis The Palm", source: "whatsapp" as const, agentId: "u3", notes: "Family of 4, kids aged 6 & 9. Wants camel ride photos.", followUpDate: addDaysISO(0), status: "quoted" as const, createdAt: iso(2, 10, 24) },
    { id: "l2", tenantId: T1, name: "Marie Dubois", phone: "+33 6 12 34 56 78", whatsapp: "+33 6 12 34 56 78", email: "marie.d@orange.fr", adults: 2, children: 0, preferredDate: addDaysISO(5), packageId: "p4", pickupLocation: "Jumeirah Beach Hotel", source: "instagram" as const, agentId: "u3", notes: "Honeymoon — asked about private VIP option.", followUpDate: addDaysISO(1), status: "contacted" as const, createdAt: iso(1, 18, 5) },
    { id: "l3", tenantId: T1, name: "Rajesh Iyer", phone: "+91 98330 12007", whatsapp: "+91 98330 12007", email: "rajesh.iyer@gmail.com", adults: 6, children: 0, preferredDate: addDaysISO(2), packageId: "p1", pickupLocation: "Al Barsha — Rotana Hotel", source: "website" as const, agentId: "u3", notes: "Corporate team, needs one invoice.", followUpDate: addDaysISO(0), status: "follow_up" as const, createdAt: iso(3, 9, 40) },
    { id: "l4", tenantId: T1, name: "Linda Karlsson", phone: "+46 73 555 0102", whatsapp: "+46 73 555 0102", email: "linda.k@gmail.com", adults: 2, children: 1, preferredDate: addDaysISO(7), packageId: "p3", pickupLocation: "Dubai Marina — Address Hotel", source: "whatsapp" as const, agentId: "u3", notes: "", followUpDate: addDaysISO(2), status: "new" as const, createdAt: iso(0, 8, 55) },
    { id: "l5", tenantId: T1, name: "Tom Anderson", phone: "+1 415 555 0134", whatsapp: "+1 415 555 0134", email: "tom.anderson@gmail.com", adults: 4, children: 0, preferredDate: addDaysISO(4), packageId: "p6", pickupLocation: "Downtown — Hilton", source: "hotel" as const, agentId: null, notes: "Referred by Hilton concierge desk.", followUpDate: addDaysISO(0), status: "new" as const, createdAt: iso(0, 9, 30) },
    { id: "l6", tenantId: T1, name: "Nadia Haddad", phone: "+971 56 220 9911", whatsapp: "+971 56 220 9911", email: "nadia.h@gmail.com", adults: 3, children: 2, preferredDate: addDaysISO(1), packageId: "p1", pickupLocation: "Mirdif — private villa", source: "whatsapp" as const, agentId: "u3", notes: "Villa pickup, gate code shared on WhatsApp.", followUpDate: addDaysISO(-1), status: "confirmed" as const, createdAt: iso(4, 11, 0), customerId: "c2", bookingId: "b-up1" },
    { id: "l7", tenantId: T1, name: "Pablo Garcia", phone: "+34 612 345 678", whatsapp: "+34 612 345 678", email: "pablo.g@gmail.com", adults: 2, children: 0, preferredDate: addDaysISO(-2), packageId: "p2", pickupLocation: "JBR — Rixos", source: "walk_in" as const, agentId: "u3", notes: "", followUpDate: addDaysISO(-3), status: "completed" as const, createdAt: iso(9, 12, 0) },
    { id: "l8", tenantId: T1, name: "Grace Kim", phone: "+82 10 5555 0123", whatsapp: "+82 10 5555 0123", email: "grace.kim@naver.com", adults: 5, children: 0, preferredDate: addDaysISO(9), packageId: "p7", pickupLocation: "Self-drive to site", source: "instagram" as const, agentId: null, notes: "Wants 60-min quad ride, all licensed drivers.", followUpDate: addDaysISO(1), status: "contacted" as const, createdAt: iso(1, 15, 45) },
    { id: "l9", tenantId: T1, name: "Ahmet Yilmaz", phone: "+90 532 555 0147", whatsapp: "+90 532 555 0147", email: "ahmet.y@gmail.com", adults: 2, children: 3, preferredDate: addDaysISO(6), packageId: "p1", pickupLocation: "Deira — Hyatt Regency", source: "agent" as const, agentId: "u3", notes: "Travel agent partner booking, 15% commission.", followUpDate: addDaysISO(2), status: "quoted" as const, createdAt: iso(2, 16, 20) },
    { id: "l10", tenantId: T1, name: "Fatima Noor", phone: "+92 300 555 0186", whatsapp: "+92 300 555 0186", email: "fatima.noor@gmail.com", adults: 2, children: 0, preferredDate: addDaysISO(-5), packageId: "p1", pickupLocation: "Business Bay", source: "phone" as const, agentId: "u3", notes: "Chose competitor on price.", followUpDate: addDaysISO(-6), status: "lost" as const, createdAt: iso(12, 10, 0) },
    { id: "l11", tenantId: T1, name: "Mikkel Jensen", phone: "+45 20 55 50 12", whatsapp: "+45 20 55 50 12", email: "mikkel.j@gmail.com", adults: 2, children: 0, preferredDate: addDaysISO(11), packageId: "p5", pickupLocation: "Palm Jumeirah — Anantara", source: "website" as const, agentId: null, notes: "", followUpDate: addDaysISO(3), status: "new" as const, createdAt: iso(0, 7, 40) },
    { id: "l12", tenantId: T1, name: "Zhang Min", phone: "+86 139 8877 6655", whatsapp: "+86 139 8877 6655", email: "zhang.min@163.com", adults: 8, children: 2, preferredDate: addDaysISO(13), packageId: "p1", pickupLocation: "Two vans — Downtown & JVC", source: "agent" as const, agentId: "u3", notes: "Large group, may need 2 vehicles.", followUpDate: addDaysISO(1), status: "quoted" as const, createdAt: iso(3, 13, 10) },
    { id: "l13", tenantId: T1, name: "Sarah O'Connor", phone: "+353 85 555 0129", whatsapp: "+353 85 555 0129", email: "sarah.oc@gmail.com", adults: 3, children: 1, preferredDate: addDaysISO(4), packageId: "p8", pickupLocation: "The Greens — Emirates", source: "whatsapp" as const, agentId: "u3", notes: "Prefers no dune bashing (elderly mother).", followUpDate: addDaysISO(0), status: "follow_up" as const, createdAt: iso(2, 19, 25) },
    { id: "l14", tenantId: T1, name: "Viktor Novak", phone: "+420 777 555 018", whatsapp: "+420 777 555 018", email: "viktor.n@seznam.cz", adults: 2, children: 0, preferredDate: addDaysISO(8), packageId: "p3", pickupLocation: "JLT — Bonnington", source: "website" as const, agentId: null, notes: "", followUpDate: addDaysISO(2), status: "new" as const, createdAt: iso(0, 11, 15) },
    { id: "l15", tenantId: T1, name: "Amara Diallo", phone: "+221 77 555 0123", whatsapp: "+221 77 555 0123", email: "amara.d@gmail.com", adults: 4, children: 2, preferredDate: addDaysISO(10), packageId: "p1", pickupLocation: "Silicon Oasis — villas", source: "whatsapp" as const, agentId: "u3", notes: "Asked for halal-only BBQ confirmation.", followUpDate: addDaysISO(4), status: "contacted" as const, createdAt: iso(1, 20, 50) },
  ];

  const messages = [
    { id: "m1", tenantId: T1, leadId: "l1", dir: "in" as const, text: "Hi! We're in Dubai next week with our two kids (6 & 9). Do you do evening desert safaris with hotel pickup from Atlantis?", at: iso(2, 10, 24), by: "Oliver Bennett" },
    { id: "m2", tenantId: T1, leadId: "l1", dir: "out" as const, text: "Salam Oliver! Welcome to Dune Horizon 🌇 Yes — our Evening Desert Safari includes pickup from Atlantis at 3:15 PM. It has dune bashing, camel rides, sandboarding and a full BBQ dinner. Kids absolutely love the camel ride photos!", at: iso(2, 10, 31), by: "Daniel Cruz", status: "read" as const },
    { id: "m3", tenantId: T1, leadId: "l1", dir: "in" as const, text: "Sounds perfect. How much for 2 adults + 2 children?", at: iso(2, 10, 33), by: "Oliver Bennett" },
    { id: "m4", tenantId: T1, leadId: "l1", dir: "note" as const, text: "Family looks price-sensitive — offer 10% if booked today. Kids' meals free on this booking.", at: iso(2, 10, 35), by: "Daniel Cruz" },
    { id: "m5", tenantId: T1, leadId: "l1", dir: "out" as const, text: "2 adults × AED 250 + 2 children × AED 150 = AED 800. If you confirm today I can apply a 10% family discount → AED 720 total, all inclusive 🧾", at: iso(2, 10, 40), by: "Daniel Cruz", status: "read" as const },
    { id: "m6", tenantId: T1, leadId: "l1", dir: "in" as const, text: "Nice! Let me just check with my wife and get back to you tomorrow. Is Thursday pickup okay?", at: iso(2, 11, 2), by: "Oliver Bennett" },
    { id: "m7", tenantId: T1, leadId: "l3", dir: "in" as const, text: "Hello, I need a safari for 6 colleagues on business trip. Can you issue one company invoice?", at: iso(3, 9, 40), by: "Rajesh Iyer" },
    { id: "m8", tenantId: T1, leadId: "l3", dir: "out" as const, text: "Hi Rajesh! Absolutely — we handle corporate groups weekly and provide a single VAT invoice. I'll send a formal quotation for 6 adults on the Evening Safari today.", at: iso(3, 9, 52), by: "Daniel Cruz", status: "delivered" as const },
    { id: "m9", tenantId: T1, leadId: "l2", dir: "in" as const, text: "Bonjour! We are on honeymoon 🥂 What is the most romantic option?", at: iso(1, 18, 5), by: "Marie Dubois" },
    { id: "m10", tenantId: T1, leadId: "l2", dir: "out" as const, text: "Congratulations! 💛 Our VIP Private Safari is made for honeymoons — private convoy, your own candle-lit majlis under the stars, and a falconry moment just for you two.", at: iso(1, 18, 18), by: "Daniel Cruz", status: "read" as const },
  ];

  // ── Bookings ──
  let seq = 100180;
  const code = () => `DS-2026-${String(++seq).padStart(6, "0")}`;
  const bookings: Booking[] = [];
  const payments: { id: string; tenantId: string; bookingId: string; invoiceNo: string; amount: number; method: "cash" | "card" | "bank" | "online" | "other"; date: string; ref: string; status: "captured" | "refunded" }[] = [];
  let inv = 4100;
  const pay = (b: Booking, amount: number, method: "cash" | "card" | "bank" | "online" | "other", daysAgo: number) =>
    payments.push({ id: uid(), tenantId: T1, bookingId: b.id, invoiceNo: `INV-2026-${++inv}`, amount, method, date: iso(daysAgo, 12, 0), ref: `TXN-${Math.floor(100000 + Math.random() * 899999)}`, status: "captured" });

  const mk = (o: Partial<Booking> & { customerId: string; packageId: string; date: string; adults: number; children: number; status: Booking["status"]; pickupTime: string; pickupLocation: string }) => {
    const pkg = packages.find((p) => p.id === o.packageId)!;
    const addons = o.addons ?? [];
    const discount = o.discount ?? 0;
    const taxPct = o.taxPct ?? 5;
    const c = calcTotal(pkg, o.adults, o.children, addons, discount, taxPct);
    const b: Booking = {
      id: uid(), tenantId: T1, code: code(), pickupAddress: "", dropoffLocation: "Same as pickup",
      specialReq: "", vehicleId: null, driverId: null, addons, discount, taxPct, total: c.total,
      source: "Website", notes: "", createdAt: iso(Math.max(1, daysFromNow(o.date) * -1 + 3), 10, 0), createdBy: "u3", ...o,
    } as Booking;
    bookings.push(b);
    return b;
  };

  // Past completed (for revenue / history)
  const past: [string, number, number, number][] = [
    ["p1", 2, 2, -1], ["p1", 4, 0, -2], ["p5", 2, 0, -2], ["p2", 2, 1, -3], ["p1", 6, 2, -4],
    ["p4", 2, 0, -5], ["p1", 2, 0, -6], ["p8", 4, 1, -7], ["p1", 2, 3, -9], ["p6", 3, 0, -11],
    ["p3", 2, 0, -13], ["p1", 5, 0, -16], ["p2", 2, 0, -18], ["p1", 2, 2, -21], ["p5", 4, 0, -24],
  ];
  const custIds = ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8", "c9", "c10"];
  past.forEach(([pid, a, ch, d], i) => {
    const b = mk({ customerId: custIds[i % 10], packageId: pid, date: addDaysISO(d), adults: a, children: ch, status: "completed", pickupTime: pid === "p2" ? "08:30" : "15:30", pickupLocation: ["Atlantis The Palm", "Dubai Marina — Address", "Downtown — Armani Hotel", "JBR — Rixos", "Mirdif — private villa"][i % 5], source: ["Website", "WhatsApp", "OTA Partner", "Hotel Desk"][i % 4] });
    b.vehicleId = ["v1", "v2", "v3"][i % 3]; b.driverId = ["dr1", "dr2", "dr3"][i % 3];
    pay(b, b.total, (["card", "online", "cash", "bank"] as const)[i % 4], -d - 1);
  });

  // Cancelled / no-show / refunded
  const cx1 = mk({ customerId: "c7", packageId: "p1", date: addDaysISO(-8), adults: 2, children: 1, status: "cancelled", pickupTime: "15:30", pickupLocation: "Deira — Hyatt Regency", notes: "Cancelled 3 days before — flight change.", discount: 0 });
  pay(cx1, 0, "card", -10); payments.pop(); // no payment
  pay(cx1, cx1.total, "card", -10);
  payments[payments.length - 1].status = "refunded";
  mk({ customerId: "c3", packageId: "p6", date: addDaysISO(-6), adults: 2, children: 0, status: "no_show", pickupTime: "14:30", pickupLocation: "Business Bay — Executive Towers", notes: "Guest unreachable at pickup." });
  const cx2 = mk({ customerId: "c10", packageId: "p2", date: addDaysISO(2), adults: 2, children: 0, status: "cancelled", pickupTime: "08:30", pickupLocation: "JVC — Seasons Community", notes: "Weather advisory — guest requested cancellation." });
  void cx2;

  // Today — live operations
  const bt1 = mk({ customerId: "c1", packageId: "p1", date: todayISO(), adults: 2, children: 2, status: "assigned", pickupTime: "15:30", pickupLocation: "Atlantis The Palm", pickupAddress: "Main lobby, Crescent Road", vehicleId: "v2", driverId: "dr2", source: "WhatsApp", specialReq: "Window seats for kids, camel photos" });
  pay(bt1, bt1.total, "online", 1);
  const bt2 = mk({ customerId: "c4", packageId: "p1", date: todayISO(), adults: 4, children: 0, status: "in_progress", pickupTime: "15:00", pickupLocation: "Al Barsha — Rotana Hotel", vehicleId: "v3", driverId: "dr3", source: "Website", specialReq: "2 vegetarian meals" });
  pay(bt2, bt2.total, "card", 2);
  const bt3 = mk({ customerId: "c8", packageId: "p5", date: todayISO(), adults: 2, children: 1, status: "pickup", pickupTime: "16:00", pickupLocation: "Dubai Marina — Address Hotel", vehicleId: "v1", driverId: "dr1", source: "OTA Partner", specialReq: "Peanut allergy — kitchen informed" });
  pay(bt3, bt3.total, "online", 1);
  const bt4 = mk({ customerId: "c9", packageId: "p8", date: todayISO(), adults: 6, children: 0, status: "pending", pickupTime: "17:00", pickupLocation: "Silicon Oasis — villas", source: "Phone", notes: "Promised to pay cash to driver." });
  void bt4;
  const bt5 = mk({ customerId: "c5", packageId: "p2", date: todayISO(), adults: 2, children: 0, status: "completed", pickupTime: "08:30", pickupLocation: "JBR — Rixos", vehicleId: "v1", driverId: "dr1", source: "Website" });
  pay(bt5, bt5.total, "cash", 0);

  // Upcoming
  const up1 = mk({ customerId: "c2", packageId: "p1", date: addDaysISO(1), adults: 3, children: 2, status: "paid", pickupTime: "15:45", pickupLocation: "Mirdif — private villa", pickupAddress: "Villa 24, Street 8A — gate code 4471", source: "WhatsApp", specialReq: "Gate code shared on WhatsApp" });
  pay(up1, up1.total, "bank", 1);
  const up2 = mk({ customerId: "c6", packageId: "p4", date: addDaysISO(2), adults: 2, children: 0, status: "assigned", pickupTime: "15:15", pickupLocation: "Jumeirah Beach Hotel", vehicleId: "v5", driverId: "dr1", addons: [{ name: "Birthday cake at camp", price: 120 }], source: "Website", specialReq: "Honeymoon — honeymooners!", notes: "VIP setup requested by guest." });
  pay(up2, up2.total, "card", 1);
  const up3 = mk({ customerId: "c3", packageId: "p1", date: addDaysISO(3), adults: 2, children: 0, status: "confirmed", pickupTime: "15:30", pickupLocation: "Downtown — Armani Hotel", source: "Website" });
  pay(up3, Math.round(up3.total / 2), "online", 0);
  const up4 = mk({ customerId: "c7", packageId: "p3", date: addDaysISO(4), adults: 2, children: 0, status: "confirmed", pickupTime: "15:00", pickupLocation: "Business Bay — Executive Towers", source: "WhatsApp" });
  mk({ customerId: "c10", packageId: "p1", date: addDaysISO(5), adults: 2, children: 1, status: "pending", pickupTime: "15:30", pickupLocation: "Palm Jumeirah — Anantara", source: "Hotel Desk" });
  mk({ customerId: "c1", packageId: "p7", date: addDaysISO(6), adults: 2, children: 0, status: "inquiry", pickupTime: "09:00", pickupLocation: "Self-drive — Al Awir site", source: "Website" });
  mk({ customerId: "c9", packageId: "p1", date: addDaysISO(7), adults: 8, children: 2, status: "inquiry", pickupTime: "15:30", pickupLocation: "Two pickups — Downtown & JVC", source: "Phone", notes: "Needs 2 vehicles." });
  mk({ customerId: "c4", packageId: "p5", date: addDaysISO(8), adults: 4, children: 0, status: "pending", pickupTime: "15:30", pickupLocation: "Al Barsha — Rotana Hotel", source: "Website" });
  void up4; void up3; void up2; void up1;

  // T2 bookings
  const t2mk = (o: Partial<Booking> & { customerId: string; date: string; status: Booking["status"]; pickupTime: string; pickupLocation: string }) => {
    const b: Booking = {
      id: uid(), tenantId: T2, code: `AN-2026-${String(++seq).padStart(6, "0")}`, packageId: "tp1",
      adults: 2, children: 0, pickupAddress: "", dropoffLocation: "Same as pickup", specialReq: "",
      vehicleId: null, driverId: null, addons: [], discount: 0, taxPct: 5, total: 400, source: "Website",
      notes: "", createdAt: now, createdBy: "u5", ...o,
    } as Booking;
    bookings.push(b); return b;
  };
  t2mk({ customerId: "c11", date: todayISO(), status: "assigned", pickupTime: "15:30", pickupLocation: "Corniche — Hilton", vehicleId: "v6", driverId: "td1" });
  t2mk({ customerId: "c12", date: addDaysISO(2), status: "confirmed", pickupTime: "15:00", pickupLocation: "Saadiyat — Rotana" });
  t2mk({ customerId: "c11", date: addDaysISO(-3), status: "completed", pickupTime: "15:30", pickupLocation: "Corniche — Hilton", vehicleId: "v6", driverId: "td1" });

  drivers[0].status = "on_trip"; // Rashid is on today's pickup run
  const t2drivers = [{ id: "td1", tenantId: T2, name: "Yousef Ali", phone: "+971 50 999 1122", whatsapp: "+971 50 999 1122", email: "yousef@arabiannights.ae", licenseNo: "DL-118827", licenseExpiry: addDaysISO(200), visaExpiry: addDaysISO(300), vehicleId: "v6", status: "assigned" as const, rating: 4.6, totalTrips: 88, completedTrips: 85, notes: "", daysOff: [5], joinedAt: addDaysISO(-300) }];

  const trips = [
    { id: uid(), tenantId: T1, bookingId: bt2.id, status: "safari_started" as const, driverId: "dr3", vehicleId: "v3", startAt: iso(0, 15, 10), notes: "", mileageStart: 92875 },
    { id: uid(), tenantId: T1, bookingId: bt3.id, status: "on_the_way" as const, driverId: "dr1", vehicleId: "v1", startAt: iso(0, 15, 25), notes: "" },
    { id: uid(), tenantId: T1, bookingId: bt1.id, status: "driver_assigned" as const, driverId: "dr2", vehicleId: "v2", notes: "" },
    { id: uid(), tenantId: T1, bookingId: bt5.id, status: "completed" as const, driverId: "dr1", vehicleId: "v1", startAt: iso(0, 8, 40), endAt: iso(0, 12, 30), notes: "Lovely group, left tip.", mileageStart: 48190, mileageEnd: 48210 },
  ];

  const quotations = [
    { id: "q1", tenantId: T1, code: "QT-2026-0411", partyName: "Oliver Bennett", customerId: null, leadId: "l1", packageId: "p1", date: addDaysISO(3), adults: 2, children: 2, pickupLocation: "Atlantis The Palm", discount: 80, taxPct: 5, total: 756, status: "sent" as const, validUntil: addDaysISO(5), notes: "Family discount 10% applied.", createdAt: iso(2, 11, 0) },
    { id: "q2", tenantId: T1, code: "QT-2026-0412", partyName: "Rajesh Iyer — TechNova GmbH", customerId: null, leadId: "l3", packageId: "p1", date: addDaysISO(2), adults: 6, children: 0, pickupLocation: "Al Barsha — Rotana Hotel", discount: 150, taxPct: 5, total: 1417.5, status: "draft" as const, validUntil: addDaysISO(6), notes: "Single corporate invoice requested.", createdAt: iso(1, 9, 0) },
    { id: "q3", tenantId: T1, code: "QT-2026-0409", partyName: "Sofia Rossi", customerId: "c6", leadId: null, packageId: "p4", date: addDaysISO(2), adults: 2, children: 0, pickupLocation: "Jumeirah Beach Hotel", discount: 0, taxPct: 5, total: 1470, status: "accepted" as const, validUntil: addDaysISO(1), notes: "Converted to VIP booking.", createdAt: iso(4, 14, 0) },
  ];

  const notifs = [
    { id: "n1", tenantId: T1, kind: "booking", title: "New booking DS-2026-010019", body: "Sofia Rossi booked VIP Private Desert Safari for 2 guests.", at: iso(0, 9, 12), read: false, link: { page: "bookings", id: up2.id } },
    { id: "n2", tenantId: T1, kind: "payment", title: "Payment received — AED 1,470", body: "Online payment captured for VIP Private Safari (Rossi).", at: iso(0, 8, 40), read: false, link: { page: "payments", id: up2.id } },
    { id: "n3", tenantId: T1, kind: "lead", title: "4 new WhatsApp leads today", body: "Oliver Bennett, Linda Karlsson, Mikkel Jensen and Viktor Novak are waiting for a reply.", at: iso(0, 8, 0), read: false, link: { page: "crm" } },
    { id: "n4", tenantId: T1, kind: "followup", title: "3 follow-ups due today", body: "Bennett, Iyer and O'Connor follow-ups are due. Don't let them go cold.", at: iso(0, 7, 30), read: false, link: { page: "crm" } },
    { id: "n5", tenantId: T1, kind: "vehicle", title: "Insurance expiring — DXB 78410", body: "Land Cruiser GXR insurance expires in 16 days. Renew with Oman Insurance.", at: iso(1, 10, 0), read: true, link: { page: "fleet", id: "v2" } },
    { id: "n6", tenantId: T1, kind: "driver", title: "Licence expired — Ahmed Suleiman", body: "Driving licence expired 9 days ago. Ahmed must not be assigned trips.", at: iso(1, 9, 0), read: true, link: { page: "drivers", id: "dr5" } },
    { id: "n7", tenantId: T1, kind: "driver", title: "Licence expiring — Fatima Zahra", body: "Expires in 14 days. Book RTA renewal slot.", at: iso(2, 10, 0), read: true, link: { page: "drivers", id: "dr4" } },
    { id: "n8", tenantId: T1, kind: "vehicle", title: "Service overdue — DXB 55127", body: "Land Cruiser VXR passed its service date by 4 days.", at: iso(2, 9, 0), read: true, link: { page: "fleet", id: "v4" } },
  ];

  const reviews = [
    { id: uid(), tenantId: T1, bookingId: bookings[0].id, customerId: "c1", rating: 5, text: "Absolutely unforgettable. Rashid was the best guide — the kids still talk about the camel ride!", date: addDaysISO(-1) },
    { id: uid(), tenantId: T1, bookingId: bookings[4].id, customerId: "c5", rating: 5, text: "Very professional team, clean vehicles and the BBQ was delicious.", date: addDaysISO(-4) },
    { id: uid(), tenantId: T1, bookingId: bookings[9].id, customerId: "c9", rating: 4, text: "Great dune bashing! Pickup was 10 minutes late but the safari made up for it.", date: addDaysISO(-11) },
    { id: uid(), tenantId: T1, bookingId: bookings[5].id, customerId: "c6", rating: 5, text: "The VIP safari was worth every dirham. Private majlis under the stars — pure magic.", date: addDaysISO(-5) },
  ];

  const audit = [
    { id: uid(), tenantId: T1, userId: "u3", userName: "Daniel Cruz", action: "lead.created", entity: "Lead", entityId: "l14", detail: "New lead: Mikkel Jensen (website)", at: iso(0, 7, 40), ip: "94.200.15.22 · Chrome / macOS" },
    { id: uid(), tenantId: T1, userId: "u2", userName: "Priya Nair", action: "booking.assigned", entity: "Booking", entityId: bt1.id, detail: `Assigned Rashid Khan + DXB 78410 to ${bt1.code}`, at: iso(0, 7, 15), ip: "103.102.44.9 · Safari / iPad" },
    { id: uid(), tenantId: T1, userId: "u1", userName: "Omar Al Mansoori", action: "payment.recorded", entity: "Payment", entityId: up1.id, detail: "AED via bank transfer recorded", at: iso(1, 11, 20), ip: "87.201.12.4 · Chrome / Windows" },
    { id: uid(), tenantId: T1, userId: "u3", userName: "Daniel Cruz", action: "quote.created", entity: "Quotation", entityId: "q1", detail: "QT-2026-0411 sent to Oliver Bennett", at: iso(2, 11, 2), ip: "94.200.15.22 · Chrome / macOS" },
  ];

  const schedules: import("./types").Schedule[] = [];
  for (let d = 0; d < 7; d++) {
    const date = addDaysISO(d);
    const wd = new Date(date + "T12:00:00").getDay();
    drivers.forEach((dr) => {
      if (dr.daysOff.includes(wd)) schedules.push({ id: uid(), tenantId: T1, driverId: dr.id, date, shift: "off" as const });
      else schedules.push({ id: uid(), tenantId: T1, driverId: dr.id, date, shift: d % 2 === 0 ? ("evening" as const) : ("morning" as const) });
    });
  }

  const inspections = [
    { id: uid(), tenantId: T1, vehicleId: "v1", date: todayISO(), by: "Priya Nair", items: INSPECTION_ITEMS.map((i) => ({ ...i, ok: true })), passed: true },
    { id: uid(), tenantId: T1, vehicleId: "v3", date: todayISO(), by: "Priya Nair", items: INSPECTION_ITEMS.map((i) => ({ ...i, ok: i.key !== "fuel", note: i.key === "fuel" ? "Half tank — refill before 3 PM" : undefined })), passed: false },
  ];

  const db: DB = {
    tenants: [
      { id: T1, name: "Dune Horizon Desert Safaris", slug: "dune-horizon", plan: "professional", planStatus: "trial", trialEnds: addDaysISO(9), active: true, createdAt: addDaysISO(-34), billing: [{ id: uid(), date: addDaysISO(-34), amount: 0, plan: "professional", status: "paid" }] },
      { id: T2, name: "Arabian Nights Safari Co.", slug: "arabian-nights", plan: "starter", planStatus: "active", trialEnds: addDaysISO(-40), active: true, createdAt: addDaysISO(-80), billing: [{ id: uid(), date: addDaysISO(-40), amount: 149, plan: "starter", status: "paid" }, { id: uid(), date: addDaysISO(-10), amount: 149, plan: "starter", status: "paid" }] },
    ],
    users: [
      { id: "su1", tenantId: null, name: "Layla Haddad", email: "super@dunesuite.app", password: "demo1234", role: "super_admin", active: true, color: "#855c18", createdAt: iso(400, 9, 0) },
      { id: "u1", tenantId: T1, name: "Omar Al Mansoori", email: "admin@dunehorizon.ae", password: "demo1234", role: "admin", phone: "+971 50 555 0182", active: true, color: "#a87520", createdAt: iso(34, 9, 0) },
      { id: "u2", tenantId: T1, name: "Priya Nair", email: "ops@dunehorizon.ae", password: "demo1234", role: "ops", phone: "+971 55 555 0144", active: true, color: "#2f7e76", createdAt: iso(30, 9, 0) },
      { id: "u3", tenantId: T1, name: "Daniel Cruz", email: "sales@dunehorizon.ae", password: "demo1234", role: "sales", phone: "+971 52 555 0163", active: true, color: "#46558c", createdAt: iso(28, 9, 0) },
      { id: "u4", tenantId: T1, name: "Rashid Khan", email: "driver@dunehorizon.ae", password: "demo1234", role: "driver", phone: "+971 50 221 4431", active: true, color: "#3c6447", driverId: "dr1", createdAt: iso(26, 9, 0) },
      { id: "u5", tenantId: T2, name: "Sara Ahmed", email: "admin@arabiannights.ae", password: "demo1234", role: "admin", active: true, color: "#96402a", createdAt: iso(80, 9, 0) },
    ],
    settings: [defaultSettings(T1, "Dune Horizon Desert Safaris", "DS"), defaultSettings(T2, "Arabian Nights Safari Co.", "AN")],
    customers, leads, messages, templates: seedTemplates(), packages,
    bookings, payments, vehicles, inspections,
    drivers: [...drivers, ...t2drivers], schedules, trips, quotations, notifs, reviews, audit, seq,
  };
  // add T2 package
  db.packages.push({ id: "tp1", tenantId: T2, name: "Abu Dhabi Evening Safari", description: "Evening desert safari with BBQ dinner.", duration: "6 hours", adultPrice: 200, childPrice: 120, privatePrice: 1300, maxPax: 8, pickup: "3:00 PM – 4:00 PM", includes: ["Pickup", "Dune bashing", "BBQ dinner"], excludes: ["Quad biking"], terms: "", active: true, accent: "#96402a" });
  return db;
}
