"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import {
  Archive,
  CheckCircle2,
  Clock3,
  FileCheck2,
  RotateCcw,
} from "lucide-react";
import { api } from "@/convex/_generated/api";

const cards = [
  {
    key: "awaitingVerification",
    label: "Awaiting verification",
    icon: Clock3,
    color: "text-amber-700 bg-amber-100 dark:bg-amber-950 dark:text-amber-300",
  },
  {
    key: "verified",
    label: "Verified",
    icon: CheckCircle2,
    color:
      "text-emerald-700 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300",
  },
  {
    key: "returned",
    label: "Changes requested",
    icon: RotateCcw,
    color: "text-orange-700 bg-orange-100 dark:bg-orange-950 dark:text-orange-300",
  },
  {
    key: "archived",
    label: "Archived",
    icon: Archive,
    color: "text-blue-700 bg-blue-100 dark:bg-blue-950 dark:text-blue-300",
  },
] as const;

function formatCount(count: number) {
  return count > 100 ? "100+" : count;
}

export default function ResearchCoordinatorDashboard() {
  const router = useRouter();
  const me = useQuery(api.users.getMe);
  const hasAccess =
    me?.role === "coordinator" &&
    me.status !== "pending" &&
    me.status !== "rejected";
  const stats = useQuery(
    api.researchCoordinator.getDashboardStats,
    hasAccess ? {} : "skip"
  );
  const activity = useQuery(
    api.researchCoordinator.recentActivity,
    hasAccess ? {} : "skip"
  );

  useEffect(() => {
    if (me !== undefined && (!me || me.role !== "coordinator")) {
      router.replace("/unauthorized");
    }
  }, [me, router]);

  if (!me || stats === undefined || activity === undefined) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-rose-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 font-Poppins sm:p-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">
          Welcome, {me.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Review final IMRaD submissions and manage the research archive.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ key, label, icon: Icon, color }) => (
          <div
            key={key}
            className="flex items-center gap-4 rounded-xl border border-border bg-card p-4"
          >
            <div className={`rounded-lg p-3 ${color}`}>
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="text-2xl font-semibold text-foreground">
                {formatCount(stats[key])}
              </p>
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-foreground">Recent activity</h2>
              <p className="text-sm text-muted-foreground">
                Latest IMRaD verification and archive actions.
              </p>  
            </div>
            <FileCheck2 className="h-5 w-5 text-rose-600" />
          </div>

          {activity.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No verification or archive activity yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {activity.map((item) => (
                <li
                  key={item._id}
                  className="flex items-start justify-between gap-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {item.action}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.details} · by {item.userName}
                    </p>
                  </div>
                  <time className="whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(item._creationTime).toLocaleDateString("en-PH")}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-3">
          <Link
            href="/dashboard/research-coordinator/imrad-final-verification"
            className="block rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50"
          >
            <span className="font-semibold text-foreground">
              Final verification
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">
              Review documents awaiting a coordinator decision.
            </span>
          </Link>
          <Link
            href="/dashboard/research-coordinator/archive-management"
            className="block rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50"
          >
            <span className="font-semibold text-foreground">
              Archive management
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">
              Upload, edit, and remove archived project records.
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}
