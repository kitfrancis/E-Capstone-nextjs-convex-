"use client"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogClose, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronRight, FileText } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useState } from "react"
import type { ReactNode } from "react"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import type { Id } from "@/convex/_generated/dataModel"

const TEAM_ROLES = [
  "Project Manager",
  "Programmer",
  "Designer",
  "System Analyst",
  "System Architect",
] as const;
type TaskTargetRole = (typeof TEAM_ROLES)[number] | "all_roles";

// `trigger` is optional: pass a compact button for headers, or omit it to get
// the original full-width card button.
export function TaskDialogDemo({ trigger }: { trigger?: ReactNode }) {
  const teams = useQuery(api.dashboard.getTeams);
  const me = useQuery(api.users.getMe);
  const createTask = useMutation(api.dashboard.createTask);
  const createTaskForAllTeams = useMutation(api.dashboard.createTaskForAllTeams);

  const [open, setOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] =
    useState<Id<"capstoneProjects"> | "">("");
  const [taskTitle, setTaskTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [targetRole, setTargetRole] = useState<TaskTargetRole>("all_roles");
  const [sendToAll, setSendToAll] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const manageableTeams =
    teams?.filter((team) => team.instructorId === me?._id) ?? [];

  const resetForm = () => {
    setSelectedTeamId("");
    setTaskTitle("");
    setDescription("");
    setDueDate("");
    setTargetRole("all_roles");
    setSendToAll(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (isSubmitting) return;
    setOpen(nextOpen);
    if (!nextOpen) resetForm();
  };

  const handleSubmit = async () => {
    const title = taskTitle.trim();
    if ((!sendToAll && !selectedTeamId) || !title || !dueDate) {
      toast.error("Choose a team and enter a title and due date.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (sendToAll) {
        const result = await createTaskForAllTeams({
          title,
          description: description.trim() || "No description provided",
          dueDate,
          targetRole,
          status: "pending",
        });
        const missingRoleMessage = result.teamsWithoutRoleCount
          ? ` ${result.teamsWithoutRoleCount} team${result.teamsWithoutRoleCount === 1 ? " had" : "s had"} no matching members; tasks were left unassigned.`
          : "";
        toast.success(
          `Task created for ${result.createdTeamCount} team${result.createdTeamCount === 1 ? "" : "s"}.${missingRoleMessage}`
        );
      } else {
        if (!selectedTeamId) {
          toast.error("Choose a team.");
          return;
        }
        const result = await createTask({
          capstoneProjectId: selectedTeamId,
          title,
          description: description.trim() || "No description provided",
          assignedTo: "Team",
          dueDate,
          targetRole,
          status: "pending",
        });
        toast.success(
          result.notifiedMemberCount > 0
            ? `Task created and assigned to ${result.notifiedMemberCount} team member${result.notifiedMemberCount === 1 ? "" : "s"}.`
            : targetRole === "all_roles"
              ? "Task created for the team, but there are no members to notify."
              : "Task created for the team, but no members currently have the selected role."
        );
      }

      resetForm();
      setOpen(false);
    } catch (error) {
      console.error("Failed to create task:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create task.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            variant="outline"
            className="group h-auto w-full justify-between rounded-2xl border-blue-100 bg-blue-50 px-4 py-3 text-foreground hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/40 dark:hover:bg-blue-950/70"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/60 dark:text-blue-300">
                <FileText className="h-5 w-5" />
              </span>
              <span className="flex flex-col items-start text-left">
                <span className="text-sm font-semibold leading-tight">Create Task</span>
                <span className="text-xs font-normal text-muted-foreground">Assign a task to one or all your teams</span>
              </span>
            </span>
            <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>
            Create a team task with a deadline.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {!sendToAll && (
            <div className="space-y-1">
              <Label htmlFor="task-team">Team</Label>
              <Select
                value={selectedTeamId}
                onValueChange={(value) =>
                  setSelectedTeamId(value as Id<"capstoneProjects">)
                }
              >
                <SelectTrigger id="task-team" className="w-full">
                  <SelectValue placeholder="Select a team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {teams === undefined || me === undefined ? (
                      <SelectItem value="loading" disabled>Loading...</SelectItem>
                    ) : manageableTeams.length === 0 ? (
                      <SelectItem value="none" disabled>No teams found</SelectItem>
                    ) : (
                      manageableTeams.map((team) => (
                        <SelectItem key={team._id} value={team._id} className="text-xs">
                          <span className="block max-w-56 truncate lg:max-w-72">
                            {team.teamName} — {team.projectTitle}
                          </span>
                        </SelectItem>
                      ))
                    )}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="projectTitle">Task Title</Label>
            <Input id="projectTitle" placeholder="e.g. Complete UI design" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" placeholder="Provide details about the task and its requirements." value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="task-role">Assign to role</Label>
            <Select
              value={targetRole}
              onValueChange={(value) => setTargetRole(value as TaskTargetRole)}
            >
              <SelectTrigger id="task-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all_roles">All Roles</SelectItem>
                  {TEAM_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>{role}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {targetRole === "all_roles"
                ? "The whole team will receive this task."
                : `Only team members with the ${targetRole} role will receive it.`}
            </p>
          </div>
          <div className="space-y-1 mb-3">
            <Label htmlFor="dueDate">Due Date</Label>
            <Input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="flex items-center justify-between ">
            <Label htmlFor="send-to-all">
              Assign to all your teams (Send to All)
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                Creates one task for each team you manage and notifies its members.
              </span>
            </Label>
            <Switch
              id="send-to-all"
              size="default"
              checked={sendToAll}
              onCheckedChange={(checked) => {
                setSendToAll(checked);
                if (checked) setSelectedTeamId("");
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button>
          </DialogClose>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              (sendToAll
                ? manageableTeams.length === 0
                : teams === undefined || manageableTeams.length === 0)
            }
          >
            {isSubmitting
              ? "Creating..."
              : sendToAll
                ? "Create for All Teams"
                : "Create Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}