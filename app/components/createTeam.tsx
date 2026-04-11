
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogClose, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus } from "lucide-react"

export function DialogDemo() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="text-sm flex items-center justify-center px-3 bg-black dark:bg-gray-50 text-background">
          <Plus /> Create Team
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Create New Team</DialogTitle>
          <DialogDescription>
            Setup a new project team with members and adviser.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="space-y-1">
            <Label htmlFor="TeamName">Team Name</Label>
            <Input id="TeamName" name="TeamName" placeholder="e.g. Project Alpha" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="projectTitle">Project Title</Label>
            <Input id="projectTitle" name="projectTitle" placeholder="e.g. Thesis Management System" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="adviser">Adviser</Label>
            <Select>
      <SelectTrigger className="w-full py-3 text-xs">
        <SelectValue placeholder="Select adviser" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value="Proposal"></SelectItem>
          <SelectItem value="Development"></SelectItem>
          <SelectItem value="Testing"></SelectItem>
          <SelectItem value="Documents"></SelectItem>
          <SelectItem value="Defense"></SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
          </div>
          <div className="space-y-1 mb-3">
            <Label htmlFor="teamMembers">Members</Label>
            <Input id="teamMembers" name="teamMembers" placeholder="Enter member names separated by commas" />
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

