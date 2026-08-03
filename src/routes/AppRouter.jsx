import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { ROLE } from "../constants/roles";
import { useAuth } from "../hooks/useAuth";
import DashboardLayout from "../layouts/DashboardLayout";
import PublicLayout from "../layouts/PublicLayout";
import ProtectedRoute from "./ProtectedRoute";
import LoginPage from "../pages/auth/LoginPage";
import ForgotPasswordPage from "../pages/auth/ForgotPasswordPage";
import DashboardPage from "../pages/dashboard/DashboardPage";
import TicketsPage from "../pages/tickets/TicketsPage";
import TicketDetailsPage from "../pages/tickets/TicketDetailsPage";
import MyTicketsPage from "../pages/tickets/MyTicketsPage";
import AssetsPage from "../pages/assets/AssetsPage";
import CreateAssetPage from "../pages/assets/CreateAssetPage";
import LocationsPage from "../pages/locations/LocationsPage";
import UsersPage from "../pages/users/UsersPage";
import ReportsPage from "../pages/reports/ReportsPage";
import CreateRequestPage from "../pages/public/CreateRequestPage";
import TrackRequestPage from "../pages/public/TrackRequestPage";
import ReporterDashboardPage from "../pages/reporter/ReporterDashboardPage";
import CreateReporterTicketPage from "../pages/reporter/CreateReporterTicketPage";
import NotFoundPage from "../pages/public/NotFoundPage";

const RouterContext = createContext({ path: "/", query: new URLSearchParams(), navigate: () => {} });

function currentLocation() {
  return { path: window.location.pathname || "/", query: new URLSearchParams(window.location.search) };
}

export function navigate(path, replace = false) {
  window.history[replace ? "replaceState" : "pushState"]({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function useRouter() {
  return useContext(RouterContext);
}

function PrivatePage({ children, allowedRoles }) {
  return <ProtectedRoute allowedRoles={allowedRoles}><DashboardLayout>{children}</DashboardLayout></ProtectedRoute>;
}

export default function AppRouter() {
  const [location, setLocation] = useState(currentLocation);
  const { role } = useAuth();

  useEffect(() => {
    const update = () => setLocation(currentLocation());
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);

  const content = useMemo(() => {
    const { path } = location;
    if (path === "/login") return <PublicLayout><LoginPage /></PublicLayout>;
    if (path === "/forgot-password") return <PublicLayout><ForgotPasswordPage /></PublicLayout>;
    if (path.startsWith("/request/")) return <PublicLayout><CreateRequestPage token={decodeURIComponent(path.slice(9))} /></PublicLayout>;
    if (path.startsWith("/track/")) return <PublicLayout><TrackRequestPage token={decodeURIComponent(path.slice(7))} /></PublicLayout>;
    if (path === "/reporter/new") return <PrivatePage allowedRoles={[ROLE.REGISTERED_REPORTER]}><CreateReporterTicketPage /></PrivatePage>;
    if (path === "/" && role === ROLE.REGISTERED_REPORTER) return <PrivatePage><ReporterDashboardPage /></PrivatePage>;
    if (path === "/") return <PrivatePage><DashboardPage /></PrivatePage>;
    if (path === "/tickets") return <PrivatePage><TicketsPage /></PrivatePage>;
    if (path === "/my-tickets") return <PrivatePage allowedRoles={[ROLE.TECHNICIAN]}><MyTicketsPage /></PrivatePage>;
    if (path.startsWith("/tickets/")) return <PrivatePage><TicketDetailsPage ticketId={decodeURIComponent(path.slice(9))} /></PrivatePage>;
    if (path === "/assets/new") return <PrivatePage><CreateAssetPage /></PrivatePage>;
    if (path === "/assets") return <PrivatePage><AssetsPage /></PrivatePage>;
    if (path === "/locations") return <PrivatePage><LocationsPage /></PrivatePage>;
    if (path === "/users") return <PrivatePage><UsersPage /></PrivatePage>;
    if (path === "/reports") return <PrivatePage><ReportsPage /></PrivatePage>;
    return <PublicLayout><NotFoundPage /></PublicLayout>;
  }, [location, role]);

  return <RouterContext.Provider value={{ ...location, navigate }}>{content}</RouterContext.Provider>;
}
