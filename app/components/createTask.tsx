
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogClose, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus,  CalendarX2Icon} from "lucide-react"
import { SelectTeam } from "./selectTeam"
import { Textarea } from "@/components/ui/textarea"
import { use } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { getAll } from "@/convex/archive"
import { useState } from "react"

export function TaskDialogDemo() {
    const teams = useQuery(api.dashboard.getTeams);
    const createTask = useMutation(api.dashboard.createTask);

  const [open, setOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");

  const handleSubmit = async () => {
    if (!selectedTeamId || !taskTitle || !dueDate) {
      alert("Please fill in all required fields.");
      return;
    }

    await createTask({
      capstoneProjectId: selectedTeamId as any,
      title: taskTitle,
      description,
      assignedTo: "Team",
      dueDate,
      status: "pending",
    });

    setSelectedTeamId("");
    setTaskTitle("");
    setDescription("");
    setDueDate("");
    setOpen(false);
  };


  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="text-sm flex items-center justify-center px-3 bg-gray-50 dark:bg-black text-foreground">
          <CalendarX2Icon /> Create Task
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>
            Assign a task to a team with a deadline.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="space-y-1">
            <Label htmlFor="TeamName">Team</Label>
            <Select onValueChange={setSelectedTeamId}>
              <SelectTrigger className="w-full ">
                <SelectValue placeholder="Select a team" />
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
                        {team.teamName} — {team.projectTitle}
                      </SelectItem>
                    ))
                  )}
                </SelectGroup>
              </SelectContent>
            </Select>
            
          </div>
          <div className="space-y-1">
            <Label htmlFor="projectTitle">Task Title</Label>
            <Input id="projectTitle" name="projectTitle" placeholder="e.g. Complete UI design" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="adviser">Description</Label> 
            <Textarea id="description" name="description" placeholder="Provide details about the task and its requirements." />
          </div>
          <div className="space-y-1 mb-3">
            <Label htmlFor="teamMembers">Due Date</Label>
            <Input id="teamMembers" name="teamMembers" type="date" />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button type="submit">Create Task</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 

