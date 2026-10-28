"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mail, UserCheck, Users } from "lucide-react";

function displayLabel(value?: string) {
  if (!value) return "Not set";
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function InstructorTeamDetailsDialog({
  team,
  progress,
  deliverableCount,
  taskCount,
  completedTaskCount,
  onClose,
}: {
  team: Doc<"capstoneProjects"> | null;
  progress: number;
  deliverableCount: number;
  taskCount: number;
  completedTaskCount: number;
  onClose: () => void;
}) {
  const members = useQuery(
    api.dashboard.getProjectMembers,
    team ? { capstoneProjectId: team._id } : "skip",
  );
  const adviser = useQuery(
    api.dashboard.getProjectAdviser,
    team ? { capstoneProjectId: team._id } : "skip",
  );

  return (
    <Dialog open={team !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        {team && (
          <>
            <DialogHeader>
              <DialogTitle>{team.teamName}</DialogTitle>
              <DialogDescription>{team.projectTitle}</DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Current phase</p>
                <p className="mt-1 font-medium">{team.phase}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Project progress</p>
                <p className="mt-1 font-medium">{progress}%</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Deliverables and tasks</p>
                <p className="mt-1 font-medium">
                  {deliverableCount} deliverables · {completedTaskCount}/{taskCount} tasks complete
                </p>
              </div>
            </div>

            <section className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <UserCheck className="h-4 w-4 text-violet-600" />
                Adviser
              </h3>
              {adviser === undefined ? (
                <p className="text-sm text-muted-foreground">Loading adviser…</p>
              ) : adviser ? (
                <div className="rounded-lg border p-3">
                  <p className="font-medium">{adviser.name}</p>
                  <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    {adviser.email}
                  </p>
                </div>
              ) : (
                <p className="rounded-lg border p-3 text-sm text-muted-foreground">
                  No adviser assigned
                </p>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Users className="h-4 w-4 text-blue-600" />
                Team members
              </h3>
              {members === undefined ? (
                <p className="text-sm text-muted-foreground">Loading team members…</p>
              ) : members.length > 0 ? (
                <ul className="divide-y rounded-lg border px-3">
                  {members.map((member) => {
                    const role = team.teamRoles?.find(
                      (assignment) => assignment.memberId === member._id,
                    )?.role;
                    return (
                      <li
                        key={member._id}
                        className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="font-medium">{member.name}</p>
                          <p className="text-sm text-muted-foreground">{member.email}</p>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {role ?? "No team role"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="rounded-lg border p-3 text-sm text-muted-foreground">
                  No team members assigned
                </p>
              )}
            </section>

            <section className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Defense stage</p>
                <p className="mt-1 font-medium">{displayLabel(team.stage)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Defense result</p>
                <p className="mt-1 font-medium">{displayLabel(team.defenseResult)}</p>
              </div>
              {team.defenseDate && (
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Defense date</p>
                  <p className="mt-1 font-medium">
                    {new Date(team.defenseDate).toLocaleString()}
                  </p>
                </div>
              )}
              {team.defenseVenue && (
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Defense venue</p>
                  <p className="mt-1 font-medium">{team.defenseVenue}</p>
                </div>
              )}
            </section>

            <div className="flex justify-end">
              <DialogClose asChild>
                <Button variant="outline">Close</Button>
              </DialogClose>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
