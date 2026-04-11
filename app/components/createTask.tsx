
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

export function TaskDialogDemo() {
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
            <Label htmlFor="TeamName">Select a team</Label>
            <SelectTeam />
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
          <Button type="submit">Create Team</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 

