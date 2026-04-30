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
import { useState, useEffect, useMemo } from "react"
import { Pencil } from "lucide-react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"
import { X } from "lucide-react";

interface EditTeamProps {
  teamId: Id<"capstoneProjects">;
  initialTeamName: string;
  initialProjectTitle: string;
  initialPhase: string;
  initialMembers?: string[];
}

export function EditTeam({
  teamId,
  initialTeamName,
  initialProjectTitle,
  initialPhase,
  initialMembers = [],
}: EditTeamProps) {
  const [open, setOpen] = useState(false);
  const [teamName, setTeamName] = useState(initialTeamName);
  const [projectTitle, setProjectTitle] = useState(initialProjectTitle);
  const [phase, setPhase] = useState(initialPhase);
  const [selectedMembers, setSelectedMembers] = useState<string[]>(initialMembers?? []);
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

    const students = useQuery(api.dashboard.getStudents);
  const updateTeam = useMutation(api.dashboard.updateTeam);
  const updateTeamMembers = useMutation(api.dashboard.updateTeamMembers);
  const allTeam = useQuery(api.dashboard.getTeams);


const studentsInOtherTeams = useMemo(() => {
  const taken = new Set<string>();
  if (allTeam) {
    allTeam.forEach(team => {
      if (team._id === teamId) return;
      team.members?.forEach(id => taken.add(String(id))); // ← cast to string
    });
  }
  return taken;
}, [allTeam, teamId]);



  useEffect(() => {
    if (open) {
      setTeamName(initialTeamName);
      setProjectTitle(initialProjectTitle);
      setPhase(initialPhase);
      setSelectedMembers(initialMembers ?? []);
      setSearch("");
    }
  }, [open, initialTeamName, initialProjectTitle, initialPhase, initialMembers]);


  const filteredStudents = students?.filter(s =>
  !selectedMembers.includes(s._id) &&          // not already selected
  !studentsInOtherTeams.has(s._id) &&           // not in another team
  (s.name?.toLowerCase().includes(search.toLowerCase()) ||
   s.email?.toLowerCase().includes(search.toLowerCase()))
) ?? [];

    const addMember = (id: string) => {
    setSelectedMembers(prev => [...prev, id]);
    setSearch("");
  };

  const removeMember = (id: string) => {
    setSelectedMembers(prev => prev.filter(m => m !== id));
  };



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
      await updateTeamMembers({teamId, members: selectedMembers});
      setOpen(false);
      toast.success("Team updated successfully!");
    } catch (error) {
      console.error("Failed to update team:", error);
      toast.error("Failed to update team");
    }
  };


  const getMemberName = (id: string) => {
    const s = students?.find(s => s._id === id);
    return s?.name ?? s?.email ?? id;
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
          <div className="space-y-1">
            <Label>Members<span className="text-muted-foreground">(Can search unassigned students only.)</span></Label>

            {/* Selected member tags */}
            {selectedMembers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedMembers.map(id => (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 bg-muted text-foreground text-xs px-2 py-1 rounded-full border"
                  >
                    {getMemberName(id)}
                    <button
                      onClick={() => removeMember(id)}
                      className="hover:text-destructive transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <Input
              placeholder="Search students to add..."
  value={search}
  onChange={(e) => setSearch(e.target.value)}
  onFocus={() => setShowDropdown(true)}
  onBlur={() => setTimeout(() => setShowDropdown(false), 300)}
            />

            {(search || showDropdown) && (
              <div className="border rounded-md bg-popover max-h-36 overflow-y-auto mt-1">
                {filteredStudents.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-3 py-2">No students found</p>
                ) : (
                  filteredStudents.map(s => (
                    <button
                      key={s._id}
                      onClick={() => addMember(s._id)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-muted flex flex-col"
                    >
                      <span className="font-medium text-foreground">{s.name}</span>
                      <span className="text-muted-foreground">{s.email}</span>
                    </button>
                  ))
                )}
              </div>
            )}

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