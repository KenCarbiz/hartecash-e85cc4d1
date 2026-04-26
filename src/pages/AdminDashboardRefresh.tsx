// /admin2 — refreshed-UI preview route.
//
// Wraps the existing AdminDashboard in a <UIRefreshOverrideProvider value={true}>
// so every kill-switch wrapper inside (AdminSidebar, AppraiserQueue,
// AppointmentManager, the AdminSectionRenderer's submissions branch, and
// the default-home effect in AdminDashboard) renders its REFRESHED variant
// regardless of site_config.ui_refresh_enabled.
//
// Identical to /admin in every other respect — same authentication, same
// data fetches, same role gating, same tenant context. The only difference
// is that the kill switch is forced ON.
//
// Use case: visual regression check + bypass any cache/deploy issues with
// the flag-read path. If /admin shows legacy and /admin2 shows refreshed,
// the bug is in the flag-read; the components themselves are fine.

import AdminDashboard from "./AdminDashboard";
import { UIRefreshOverrideProvider } from "@/hooks/useUIRefresh";

const AdminDashboardRefresh = () => (
  <UIRefreshOverrideProvider value={true}>
    <AdminDashboard />
  </UIRefreshOverrideProvider>
);

export default AdminDashboardRefresh;
