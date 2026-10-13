"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useClerk } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";

type Role = "student" | "instructor" | "adviser" | "admin";

const ROLES: Role[] = ["student", "adviser", "instructor", "admin"];

const roleStyles: Record<Role, string> = {
  student: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  adviser: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  instructor:
    "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
  admin: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

export default function AdminDashboard() {
  const { signOut } = useClerk();
  const me = useQuery(api.users.getMe);
  const users = useQuery(api.users.listAllUsers);
  const setUserRole = useMutation(api.users.setUserRole);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<Role, number> = {
      student: 0,
      adviser: 0,
      instructor: 0,
      admin: 0,
    };
    users?.forEach((u) => {
      c[u.role as Role] += 1;
    });
    return c;
  }, [users]);

  const filtered = useMemo(() => {
    if (!users) return [];
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const matchesRole = roleFilter === "all" || u.role === roleFilter;
      const matchesSearch =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.studentNo ?? "").toLowerCase().includes(q);
      return matchesRole && matchesSearch;
    });
  }, [users, search, roleFilter]);

  const handleRoleChange = async (userId: Id<"users">, role: Role) => {
    setError(null);
    setPendingId(userId);
    try {
      await setUserRole({ userId, role });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update role.";
      setError(message.replace(/^.*Error:\s*/, ""));
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background font-Poppins">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">
              Admin Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">
              Signed in as {me?.name ?? "…"}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => signOut({ redirectUrl: "/" })}
          >
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        {/* Role counts */}
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {ROLES.map((role) => (
            <div
              key={role}
              className="rounded-xl border border-border bg-card p-4"
            >
              <p className="text-sm capitalize text-muted-foreground">
                {role}s
              </p>
              <p className="mt-1 text-3xl font-semibold text-foreground">
                {users ? counts[role] : "–"}
              </p>
            </div>
          ))}
        </section>

        {/* Filters */}
        <section className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or student no."
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-blue-500 sm:max-w-sm"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as Role | "all")}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
        </section>

        {error && (
          <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Users table */}
        <section className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Student No.</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Change role</th>
              </tr>
            </thead>
            <tbody>
              {users === undefined && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    Loading users…
                  </td>
                </tr>
              )}

              {users && filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No users found.
                  </td>
                </tr>
              )}

              {filtered.map((u) => {
                const isSelf = me?._id === u._id;
                return (
                  <tr
                    key={u._id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-3 text-foreground">
                      {u.name}
                      {isSelf && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (you)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {u.email}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {u.studentNo || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${roleStyles[u.role as Role]}`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        disabled={isSelf || pendingId === u._id}
                        onChange={(e) =>
                          handleRoleChange(u._id, e.target.value as Role)
                        }
                        className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r.charAt(0).toUpperCase() + r.slice(1)}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}