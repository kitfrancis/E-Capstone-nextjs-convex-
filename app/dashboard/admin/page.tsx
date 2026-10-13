"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Users, FolderKanban, Archive, ClipboardCheck } from "lucide-react";

function timeAgo(ts: number) {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} day(s) ago`;
}

export default function AdminDashboard() {
  const me = useQuery(api.users.getMe);
  const stats = useQuery(api.admin.getDashboardStats);
  const activity = useQuery(api.admin.recentActivity, { limit: 8 });

  const cards = [
    {
      label: "Total Users",
      value: stats?.totalUsers,
      icon: Users,
      color: "text-blue-600 bg-blue-100 dark:bg-blue-950",
    },
    {
      label: "Capstone Teams",
      value: stats?.totalTeams,
      icon: FolderKanban,
      color: "text-green-600 bg-green-100 dark:bg-green-950",
    },
    {
      label: "Archived Projects",
      value: stats?.archivedProjects,
      icon: Archive,
      color: "text-purple-600 bg-purple-100 dark:bg-purple-950",
    },
    {
      label: "Awaiting Review",
      value: stats?.underReview,
      icon: ClipboardCheck,
      color: "text-orange-600 bg-orange-100 dark:bg-orange-950",
    },
  ];

  const roles = [
    { label: "Students", value: stats?.roles.student },
    { label: "Advisers", value: stats?.roles.adviser },
    { label: "Instructors", value: stats?.roles.instructor },
    { label: "Admins", value: stats?.roles.admin },
  ];

  return (
    <div className="space-y-6 p-4 font-Poppins sm:p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Welcome back, {me?.name ?? "Admin"}!
        </h1>
        <p className="text-sm text-muted-foreground">
          Here&apos;s an overview of the system activity and key information.
        </p>
      </div>

      {/* Stat cards */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="flex items-center gap-4 rounded-xl border border-border bg-card p-4"
          >
            <div className={`rounded-lg p-3 ${color}`}>
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="text-2xl font-semibold text-foreground">
                {value ?? "–"}
              </p>
            </div>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent activity */}
        <section className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
          <h2 className="mb-3 font-semibold text-foreground">
            Recent Activity
          </h2>

          {activity === undefined && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          )}

          {activity && activity.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No activity yet. Actions like registrations and role changes will
              show up here.
            </p>
          )}

          <ul className="divide-y divide-border">
            {activity?.map((log) => (
              <li
                key={log._id}
                className="flex items-start justify-between gap-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {log.action}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {log.details} · by {log.userName}
                  </p>
                </div>
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  {timeAgo(log._creationTime)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <div className="space-y-6">
          {/* Users by role */}
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 font-semibold text-foreground">Users by Role</h2>
            <ul className="space-y-2">
              {roles.map((r) => (
                <li key={r.label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className="font-medium text-foreground">
                    {r.value ?? "–"}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Quick actions */}
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 font-semibold text-foreground">
              Quick Actions
            </h2>
            <Link
              href="/dashboard/admin/Users"
              className="flex items-center gap-2 rounded-md bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300"
            >
              <Users className="h-4 w-4" />
              Manage Users
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}