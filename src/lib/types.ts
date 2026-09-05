// ─── Core domain types for DuneSuite ────────────────────────────────────────

export type Role = "super_admin" | "admin" | "ops" | "sales" | "driver";
export type ID = string;

export type PlanId = "starter" | "professional" | "enterprise";
export type PlanStatus = "trial" | "active" | "past_due" | "suspended";

export interface BillingRecord { id: ID; date: string; amount: number; plan: PlanId; status: "paid" | "due"; }

export interface Tenant {
  id: ID; name: string; slug: string; plan: PlanId; planStatus: PlanStatus;
  trialEnds: string; active: boolean; createdAt: string; billing: BillingRecord[];
}

export interface User {
  id: ID; tenantId: ID | null; name: string; email: string; password: string;
  role: Role; phone?: string; active: boolean; color: string; driverId?: ID; createdAt: string;
}

export interface CompanySettings {
  tenantId: ID; name: string; tagline: string; address: string; phone: string;
  whatsapp: string; email: string; website: string; currency: string; taxPct: number;
  invoicePrefix: string; bookingPrefix: string; terms: string; cancellationPolicy: string;
  paymentInstructions: string;
  reminders: { day24: boolean; dayOf: boolean; after: boolean; unpaid: boolean };
  whatsappApi: { configured: boolean; phoneId: string; token: string; verifyToken: string; testNumber: string };
}

export type LeadStatus = "new" | "contacted" | "quoted" | "follow_up" | "confirmed" | "paid" | "completed" | "lost";
export type LeadSource = "whatsapp" | "website" | "instagram" | "walk_in" | "phone" | "agent" | "hotel";

export interface Lead {
  id: ID; tenantId: ID; name: string; phone: string; whatsapp: string; email: string;
  adults: number; children: number; preferredDate: string; packageId: ID | null;
  pickupLocation: string; source: LeadSource; agentId: ID | null; notes: string;
  followUpDate: string; status: LeadStatus; createdAt: string; customerId?: ID; bookingId?: ID;
}

export interface Message {
  id: ID; tenantId: ID; leadId: ID; dir: "in" | "out" | "note";
  text: string; at: string; by: string; status?: "queued" | "sent" | "delivered" | "read";
}

export interface Template { id: ID; key: string; name: string; body: string; }

export interface Customer {
  id: ID; tenantId: ID; name: string; phone: string; whatsapp: string; email: string;
  country: string; notes: string; createdAt: string; fromLeadId?: ID;
}

export interface SafariPackage {
  id: ID; tenantId: ID; name: string; description: string; duration: string;
  adultPrice: number; childPrice: number; privatePrice: number; maxPax: number;
  pickup: string; includes: string[]; excludes: string[]; terms: string;
  active: boolean; image?: string; accent: string;
}

export type BookingStatus =
  | "inquiry" | "pending" | "confirmed" | "paid" | "assigned"
  | "pickup" | "in_progress" | "completed" | "cancelled" | "no_show";

export interface Addon { name: string; price: number; }

export interface Booking {
  id: ID; tenantId: ID; code: string; customerId: ID; packageId: ID; date: string;
  adults: number; children: number; pickupLocation: string; pickupAddress: string;
  pickupTime: string; dropoffLocation: string; specialReq: string;
  vehicleId: ID | null; driverId: ID | null; addons: Addon[];
  discount: number; taxPct: number; total: number; paymentMethod?: PayMethod;
  source: string; notes: string; status: BookingStatus; createdAt: string; createdBy: string;
}

export type PayStatus = "unpaid" | "partial" | "paid" | "refunded";
export type PayMethod = "cash" | "card" | "bank" | "online" | "other";

export interface Payment {
  id: ID; tenantId: ID; bookingId: ID; invoiceNo: string; amount: number;
  method: PayMethod; date: string; ref: string; status: "captured" | "refunded"; note?: string;
}

export type VehicleStatus = "available" | "assigned" | "on_safari" | "maintenance" | "out_of_service";

export interface Vehicle {
  id: ID; tenantId: ID; plate: string; type: string; make: string; model: string;
  year: number; color: string; seats: number; status: VehicleStatus; driverId: ID | null;
  insuranceExpiry: string; regExpiry: string; permitExpiry: string;
  lastService: string; nextService: string; mileage: number; notes: string;
}

export interface InspectionItem { key: string; label: string; ok: boolean; note?: string; }
export interface Inspection { id: ID; tenantId: ID; vehicleId: ID; date: string; by: string; items: InspectionItem[]; passed: boolean; }

export type DriverStatus = "available" | "assigned" | "on_trip" | "off_duty" | "leave";

export interface Driver {
  id: ID; tenantId: ID; name: string; phone: string; whatsapp: string; email: string;
  licenseNo: string; licenseExpiry: string; visaExpiry: string; vehicleId: ID | null;
  status: DriverStatus; rating: number; totalTrips: number; completedTrips: number;
  notes: string; daysOff: number[]; joinedAt: string;
}

export interface Schedule { id: ID; tenantId: ID; driverId: ID; date: string; shift: "morning" | "evening" | "off"; }

export type TripStatus =
  | "scheduled" | "driver_assigned" | "on_the_way" | "arrived" | "guests_picked_up"
  | "safari_started" | "safari_completed" | "dropped_off" | "completed";

export interface Trip {
  id: ID; tenantId: ID; bookingId: ID; status: TripStatus; driverId: ID; vehicleId: ID;
  startAt?: string; endAt?: string; notes: string; mileageStart?: number; mileageEnd?: number;
}

export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";

export interface Quotation {
  id: ID; tenantId: ID; code: string; partyName: string; customerId: ID | null; leadId: ID | null;
  packageId: ID; date: string; adults: number; children: number; pickupLocation: string;
  discount: number; taxPct: number; total: number; status: QuoteStatus;
  validUntil: string; notes: string; createdAt: string;
}

export interface Notif {
  id: ID; tenantId: ID; kind: string; title: string; body: string; at: string;
  read: boolean; link?: { page: string; id?: ID };
}

export interface Review { id: ID; tenantId: ID; bookingId: ID; customerId: ID; rating: number; text: string; date: string; }

export interface AuditEntry {
  id: ID; tenantId: ID; userId: ID; userName: string; action: string; entity: string;
  entityId: ID; detail: string; at: string; ip: string;
}

export interface ReminderItem {
  id: string; when: string; kind: "24h_before" | "day_of" | "after" | "unpaid";
  bookingCode: string; customer: string; channel: string; text: string; state: "scheduled" | "ready" | "sent";
}

export interface DB {
  tenants: Tenant[]; users: User[]; settings: CompanySettings[];
  customers: Customer[]; leads: Lead[]; messages: Message[]; templates: Template[];
  packages: SafariPackage[]; bookings: Booking[]; payments: Payment[]; vehicles: Vehicle[];
  inspections: Inspection[]; drivers: Driver[]; schedules: Schedule[]; trips: Trip[];
  quotations: Quotation[]; notifs: Notif[]; reviews: Review[]; audit: AuditEntry[];
  seq: number;
}

export interface Session { userId: ID; tenantId: ID | null; }

export type PageId =
  | "dashboard" | "bookings" | "crm" | "customers" | "fleet" | "drivers" | "packages"
  | "payments" | "quotations" | "calendar" | "ops" | "pickups" | "trips" | "reports"
  | "analytics" | "settings" | "users" | "audit" | "subscription" | "admin" | "public";

export interface Route { page: PageId; params?: Record<string, string>; }
