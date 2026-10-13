"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";

const SCHOOL_DOMAIN = "antiquespride.edu.ph";

export default function ApprovalsPage() {
  const users = useQuery(api.users.listAllUsers);
  const approveUser = useMutation(api.users.approveUser);
  const rejectUser = useMutation(api.users.rejectUser);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pending first, then rejected; newest first within each
  const queue = useMemo(() => {
    return (users ?? [])
      .filter((u) => u.status === "pending" || u.status === "rejected")
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "pending" ? -1 : 1;
        return b._creationTime - a._creationTime;
      });
  }, [users]);

  const pendingCount = queue.filter((u) => u.status === "pending").length;

  const run = async (
    id: Id<"users">,
    fn: (args: { userId: Id<"users"> }) => Promise<unknown>
  ) => {
    setError(null);
    setBusyId(id);
    try {
      await fn({ userId: id });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(message.replace(/^.*Error:\s*/, ""));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 p-4 font-Poppins sm:p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Approvals</h1>
        <p className="text-sm text-muted-foreground">
          Advisers and instructors can sign up on their own, but they can&apos;t
          use the system until you verify them.{" "}
          {users && `${pendingCount} waiting.`}
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <section className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Signed up</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users === undefined && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  Loading…
                </td>
              </tr>
            )}

            {users && queue.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No accounts waiting for approval.
                </td>
              </tr>
            )}

            {queue.map((u) => {
              const isSchoolEmail = u.email
                .toLowerCase()
                .endsWith(`@${SCHOOL_DOMAIN}`);
              const busy = busyId === u._id;

              return (
                <tr key={u._id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-foreground">{u.name}</td>
                  <td className="px-4 py-3">
                    <div className="text-muted-foreground">{u.email}</div>
                    <span
                      className={`text-xs ${
                        isSchoolEmail
                          ? "text-green-600"
                          : "text-orange-500"
                      }`}
                    >
                      {isSchoolEmail ? "School email" : "Not a school email"}
                    </span>
                  </td>
                  <td className="px-4 py-3 capitalize text-muted-foreground">
                    {u.role}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {new Date(u._creationTime).toLocaleDateString("en-PH", {
                      dateStyle: "medium",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                        u.status === "pending"
                          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300"
                          : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                      }`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => run(u._id, approveUser)}
                      >
                        Approve
                      </Button>
                      {u.status === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-500 hover:text-red-600"
                          disabled={busy}
                          onClick={() => run(u._id, rejectUser)}
                        >
                          Reject
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}