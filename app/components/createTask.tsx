
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogClose, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus,  CalendarX2Icon} from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useState } from "react"
import { toast } from "sonner"

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

    try {
      await createTask({
        capstoneProjectId: selectedTeamId as any,
        title: taskTitle,
        description: description || "No description provided",
        assignedTo: "Team",
        dueDate,
        status: "pending",
      });

      setSelectedTeamId("");
      setTaskTitle("");
      setDescription("");
      setDueDate("");
      setOpen(false);
      toast.success("Task created successfully!");
    } catch (error) {
      console.error("Failed to create task:", error);
      toast.error("Failed to create task");
    }
  };


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="text-xs lg:text-sm flex items-center justify-center px-1.5 lg:px-3 bg-muted  text-foreground">
          <CalendarX2Icon /> Create Task
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm ">
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
            <Input  id="projectTitle"  placeholder="e.g. Complete UI design" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="description">Description</Label> 
            <Textarea  id="description" placeholder="Provide details about the task and its requirements." value={description} onChange={(e) => setDescription(e.target.value)}  />
          </div>
          <div className="space-y-1 mb-3">
            <Label htmlFor="dueDate">Due Date</Label>
            <Input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}/>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSubmit}>Create Task</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 

