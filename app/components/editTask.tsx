"use client";

import { Button } from "@/components/ui/button"
import {
  Dialog, DialogClose, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectGroup, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useState, type ReactNode } from "react"
import { Pencil } from "lucide-react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { toast } from "sonner"
import type { Id } from "@/convex/_generated/dataModel"

const TEAM_ROLES = [
  "Project Manager",
  "Programmer",
  "Designer",
  "System Analyst",
  "System Architect",
] as const;
type TaskTargetRole = (typeof TEAM_ROLES)[number] | "all_roles";

interface EditTaskProps {
  taskId: Id<"tasks">;
  initialTitle: string;
  initialDescription: string;
  initialDueDate: string;
  initialTeamId: Id<"capstoneProjects">;
  initialTargetRole?: (typeof TEAM_ROLES)[number];
  trigger?: ReactNode;
}

export function EditTask({
  taskId,
  initialTitle,
  initialDescription,
  initialDueDate,
  initialTeamId,
  initialTargetRole,
  trigger,
}: EditTaskProps) {
  const [open, setOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [dueDate, setDueDate] = useState(initialDueDate);
  const [selectedTeamId, setSelectedTeamId] =
    useState<Id<"capstoneProjects"> | "">(initialTeamId);
  const [targetRole, setTargetRole] = useState<TaskTargetRole>(
    initialTargetRole ?? "all_roles"
  );

  const teams = useQuery(api.dashboard.getTeams);
  const updateTask = useMutation(api.dashboard.updateTask);


  const handleSubmit = async () => {
    if (!selectedTeamId || !taskTitle || !dueDate) {
      toast.error("Please fill in all required fields.");
      return;
    }

    try {
      await updateTask({
        taskId,
        title: taskTitle,
        description: description || "No description provided",
        dueDate,
        capstoneProjectId: selectedTeamId,
        targetRole,
      });

      setOpen(false);
      toast.success("Task updated successfully!");
    } catch (error) {
      console.error("Failed to update task:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update task.");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setTaskTitle(initialTitle);
          setDescription(initialDescription);
          setDueDate(initialDueDate);
          setSelectedTeamId(initialTeamId);
          setTargetRole(initialTargetRole ?? "all_roles");
        }
        setOpen(nextOpen);
      }}
    >
      <DialogTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <Button variant="outline" size="sm"><Pencil className="w-3 h-3 mr-1" /> Edit</Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>
            Make changes to the task. Click save when you&apos;re done.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="space-y-1">
            <Label>Team</Label>
            <Select
              value={selectedTeamId}
              onValueChange={(value) =>
                setSelectedTeamId(value as Id<"capstoneProjects">)
              }
            >
              <SelectTrigger className="w-full overflow-hidden">
                <SelectValue placeholder="Select a team" className="w-full overflow-hidden" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {teams === undefined ? (
                    <SelectItem value="loading" disabled>Loading...</SelectItem>
                  ) : teams.length === 0 ? (
                    <SelectItem value="none" disabled>No teams found</SelectItem>
                  ) : (
                    teams.map(team => (
                      <SelectItem key={team._id} value={team._id} className="text-xs">
                         <span className="max-w-56 lg:max-w-72 truncate block">{team.teamName} — {team.projectTitle}</span>
                      </SelectItem>
                    ))
                  )}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Assign to role</Label>
            <Select
              value={targetRole}
              onValueChange={(value) => setTargetRole(value as TaskTargetRole)}
            >
              <SelectTrigger className="w-full">
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
          </div>
          <div className="space-y-1">
            <Label>Task Title</Label>
            <Input
              placeholder="e.g. Complete UI design"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea
              placeholder="Provide details about the task."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1 mb-3">
            <Label>Due Date</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSubmit}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}