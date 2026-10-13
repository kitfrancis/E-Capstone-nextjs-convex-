"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, MoreHorizontal, Trash2 } from "lucide-react";

type Role = "student" | "instructor" | "adviser" | "admin";
type AssignableRole = Exclude<Role, "admin">;

const ROLES: Role[] = ["student", "adviser", "instructor", "admin"];
const ASSIGNABLE_ROLES: AssignableRole[] = ["student", "adviser", "instructor"];
const PAGE_SIZE = 10;

const roleStyles: Record<Role, string> = {
  student: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  adviser: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  instructor:
    "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
  admin: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function UserManagementPage() {
  const users = useQuery(api.users.listAllUsers);
  const setUserRole = useMutation(api.users.setUserRole);
  const deleteUser = useMutation(api.users.deleteUser);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const [userToDelete, setUserToDelete] = useState<{
    id: Id<"users">;
    name: string;
    email: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  // Back to page 1 whenever filters change
  useEffect(() => {
    setPage(1);
  }, [search, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleRoleChange = async (userId: Id<"users">, role: AssignableRole) => {
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

  const closeDeleteDialog = () => {
    if (deleting) return;
    setUserToDelete(null);
    setDeleteError(null);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteUser({ userId: userToDelete.id });
      setUserToDelete(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete user.";
      setDeleteError(message.replace(/^.*Error:\s*/, ""));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 p-4 font-Poppins sm:p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">User Management</h1>
        <p className="text-sm text-muted-foreground">
          Manage users and roles in the system.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or student no."
          className="sm:max-w-sm"
        />
        <Select
          value={roleFilter}
          onValueChange={(v) => setRoleFilter(v as Role | "all")}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {cap(r)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Table */}
      <section className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Student No.</th>
              <th className="px-4 py-3 font-medium">Program / Section</th>
              <th className="px-4 py-3 font-medium">Role</th>
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
                  Loading users…
                </td>
              </tr>
            )}

            {users && pageRows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No users found.
                </td>
              </tr>
            )}

            {pageRows.map((u) => {
              const isAdmin = u.role === "admin";
              const programSection = [u.program, u.section]
                .filter(Boolean)
                .join(" · ");

              return (
                <tr
                  key={u._id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-3 text-foreground">{u.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {u.studentNo || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {programSection || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${roleStyles[u.role as Role]}`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isAdmin ? (
                      <span className="text-xs text-muted-foreground">
                        Locked
                      </span>
                    ) : (
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={pendingId === u._id}
                            aria-label={`Actions for ${u.name}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuLabel>Change role</DropdownMenuLabel>
                          {ASSIGNABLE_ROLES.map((r) => (
                            <DropdownMenuItem
                              key={r}
                              disabled={r === u.role}
                              onSelect={() => handleRoleChange(u._id, r)}
                            >
                              <span className="flex-1">{cap(r)}</span>
                              {r === u.role && <Check className="h-4 w-4" />}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-500 focus:text-red-500"
                            onSelect={() =>
                              setUserToDelete({
                                id: u._id,
                                name: u.name,
                                email: u.email,
                              })
                            }
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove user
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Showing {pageRows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–
          {(page - 1) * PAGE_SIZE + pageRows.length} of {filtered.length} users
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      {/* Delete confirmation */}
      <Dialog
        open={!!userToDelete}
        onOpenChange={(open) => {
          if (!open) closeDeleteDialog();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove user?</DialogTitle>
            <DialogDescription>
              {userToDelete?.name} ({userToDelete?.email}) will be removed from
              the system and from any team they belong to. This can&apos;t be
              undone.
            </DialogDescription>
          </DialogHeader>

          {deleteError && <p className="text-sm text-red-500">{deleteError}</p>}

          <DialogFooter>
            <Button
              variant="outline"
              disabled={deleting}
              onClick={closeDeleteDialog}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={confirmDelete}
            >
              {deleting ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}