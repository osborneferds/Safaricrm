import { useEffect } from "react";
import { StoreProvider, useStore } from "./lib/store";
import { Toasts } from "./components/ui";
import Layout from "./components/Layout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Bookings from "./pages/Bookings";
import CRM from "./pages/CRM";
import Customers from "./pages/Customers";
import Fleet from "./pages/Fleet";
import Drivers from "./pages/Drivers";
import Packages from "./pages/Packages";
import Finance from "./pages/Finance";
import { CalendarPage, OpsBoard, Pickups, Trips } from "./pages/Planning";
import { Analytics, Reports } from "./pages/Insights";
import { AuditPage, SettingsPage, SubscriptionPage, UsersPage } from "./pages/Settings";
import AdminConsole from "./pages/AdminConsole";
import DriverApp from "./pages/DriverApp";
import PublicBooking from "./pages/PublicBooking";

function Root() {
  const { session, user, route, setRoute } = useStore();

  // Deep links: /#/public (booking widget / customer page)
  useEffect(() => {
    if (window.location.hash.startsWith("#/public")) setRoute({ page: "public" });
  }, [setRoute]);

  // Default landing per session/role
  useEffect(() => {
    if (!session) return;
    if (user?.role === "super_admin") setRoute({ page: "admin" });
    else if (user?.role === "driver") setRoute({ page: "dashboard" });
    else setRoute({ page: "dashboard" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.userId]);

  if (route.page === "public") return <PublicBooking onBack={() => setRoute({ page: "dashboard" })} />;
  if (!session || !user) return <Auth onPublic={() => setRoute({ page: "public" })} />;
  if (user.role === "driver") return <DriverApp />;

  const page = (() => {
    switch (route.page) {
      case "bookings": return <Bookings />;
      case "crm": return <CRM />;
      case "customers": return <Customers />;
      case "fleet": return <Fleet />;
      case "drivers": return <Drivers />;
      case "packages": return <Packages />;
      case "payments": return <Finance key="payments" initialTab="payments" />;
      case "quotations": return <Finance key="quotes" initialTab="quotes" />;
      case "calendar": return <CalendarPage />;
      case "ops": return <OpsBoard />;
      case "pickups": return <Pickups />;
      case "trips": return <Trips />;
      case "reports": return <Reports />;
      case "analytics": return <Analytics />;
      case "settings": return <SettingsPage />;
      case "users": return <UsersPage />;
      case "audit": return <AuditPage />;
      case "subscription": return <SubscriptionPage />;
      case "admin": return <AdminConsole />;
      default: return <Dashboard />;
    }
  })();

  return <Layout>{page}</Layout>;
}

export default function App() {
  return (
    <StoreProvider>
      <Root />
      <Toasts />
    </StoreProvider>
  );
}
