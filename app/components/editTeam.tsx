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
import { useState, useEffect } from "react"
import { Pencil } from "lucide-react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"

interface EditTeamProps {
  teamId: Id<"capstoneProjects">;
  initialTeamName: string;
  initialProjectTitle: string;
  initialPhase: string;
}

export function EditTeam({
  teamId,
  initialTeamName,
  initialProjectTitle,
  initialPhase,
}: EditTeamProps) {
  const [open, setOpen] = useState(false);
  const [teamName, setTeamName] = useState(initialTeamName);
  const [projectTitle, setProjectTitle] = useState(initialProjectTitle);
  const [phase, setPhase] = useState(initialPhase);

  const updateTeam = useMutation(api.dashboard.updateTeam);

  useEffect(() => {
    if (open) {
      setTeamName(initialTeamName);
      setProjectTitle(initialProjectTitle);
      setPhase(initialPhase);
    }
  }, [open, initialTeamName, initialProjectTitle, initialPhase]);

  const handleSubmit = async () => {
    if (!teamName || !projectTitle || !phase) {
      toast.error("Please fill in all required fields.");
      return;
    }
    try {
      await updateTeam({
        teamId,
        teamName,
        projectTitle,
        phase: phase as any,
      });
      setOpen(false);
      toast.success("Team updated successfully!");
    } catch (error) {
      console.error("Failed to update team:", error);
      toast.error("Failed to update team");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs">
          <Pencil className="w-3 h-3 mr-1" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Team</DialogTitle>
          <DialogDescription>
            Update team details. Click save when you&apos;re done.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="space-y-1">
            <Label>Team Name</Label>
            <Input
              placeholder="e.g. CodeVenger"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Project Title</Label>
            <Input
              placeholder="e.g. E-Capstone Thesis Management"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1 mb-3">
            <Label>Phase</Label>
            <Select value={phase} onValueChange={setPhase}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a phase" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="Proposal">Proposal</SelectItem>
                  <SelectItem value="Development">Development</SelectItem>
                  <SelectItem value="Testing">Testing</SelectItem>
                  <SelectItem value="Final">Final</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
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