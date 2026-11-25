export type DashboardRole =
  | "student"
  | "instructor"
  | "adviser"
  | "coordinator"
  | "admin";

export function dashboardRouteForRole(role: DashboardRole) {
  return role === "coordinator"
    ? "/dashboard/research-coordinator"
    : `/dashboard/${role}`;
}
