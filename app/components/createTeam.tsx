
"use client"  
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogClose, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus } from "lucide-react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useState, useMemo } from "react"
import { X } from "lucide-react"

export function DialogDemo() {
  const advisers = useQuery(api.users.getAdvisers);
  const students = useQuery(api.users.getStudents);
  const allProjects = useQuery(api.dashboard.getTeams);
  const createProject = useMutation(api.dashboard.createCapstoneProject);

  const [open, setOpen] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [adviserId, setAdviserId] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [searchStudent, setSearchStudent] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check which students already have teams
  const studentsWithTeams = useMemo(() => {
    const withTeams = new Set<string>();
    if (allProjects) {
      allProjects.forEach(project => {
        if (project.members) {
          project.members.forEach(memberId => {
            withTeams.add(memberId);
          });
        }
      });
    }
    return withTeams;
  }, [allProjects]);

  const filteredStudents = students?.filter(s =>
    s.name.toLowerCase().includes(searchStudent.toLowerCase()) &&
    !selectedStudents.includes(s._id) &&
    !studentsWithTeams.has(s._id)
  ) ?? [];

  const addStudent = (id: string) => {
    if (studentsWithTeams.has(id)) {
      alert("You are already a member of a team. To join a new one, you must leave your current team first.");
      return;
    }
    setSelectedStudents(prev => [...prev, id]);
    setSearchStudent("");
  };

  const removeStudent = (id: string) => {
    setSelectedStudents(prev => prev.filter(s => s !== id));
  };

  const getStudentName = (id: string) => {
    return students?.find(s => s._id === id)?.name ?? id;
  };

  const handleSubmit = async () => {
    if (!teamName || !projectTitle || !adviserId || selectedStudents.length === 0) {
      alert("Please fill all fields and select at least one member");
      return;
    }

    // Validate that no selected students already have teams
    const studentAlreadyInTeam = selectedStudents.some(id => studentsWithTeams.has(id));
    if (studentAlreadyInTeam) {
      alert("One or more selected students is already in a team. Each student can only be in one team.");
      return;
    }

    setIsLoading(true);
    try {
      await createProject({
        teamName,
        projectTitle,
        adviserId,
        members: selectedStudents,
      });
      // Reset form
      setTeamName("");
      setProjectTitle("");
      setAdviserId("");
      setSelectedStudents([]);
      setOpen(false);
      alert("Team created successfully!");
    } catch (error) {
      console.error("Failed to create team:", error);
      alert("Failed to create team");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="text-sm flex items-center justify-center px-3 bg-black dark:bg-gray-50 text-background hover:bg-gray-800 hover:text-background dark:hover:bg-gray-200">
          <Plus /> Create Team
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Create New Team</DialogTitle>
          <DialogDescription>
            Setup a new project team with members and adviser. Each student can only be in one team.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="space-y-1">
            <Label htmlFor="TeamName">Team Name</Label>
            <Input id="TeamName" placeholder="e.g. Project Alpha" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="projectTitle">Project Title</Label>
            <Input id="projectTitle" placeholder="e.g. Thesis Management System" value={projectTitle} onChange={(e) => setProjectTitle(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="adviser">Adviser</Label>
             <Select value={adviserId} onValueChange={setAdviserId}>
              <SelectTrigger className="w-full py-3 text-xs">
                <SelectValue placeholder="Select adviser" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {advisers === undefined ? (
                    <SelectItem value="loading" disabled>Loading...</SelectItem>
                  ) : advisers.length === 0 ? (
                    <SelectItem value="none" disabled>No advisers found</SelectItem>
                  ) : (
                    advisers.map((adviser) => (
                      <SelectItem key={adviser._id} value={adviser._id}>
                        {adviser.name}
                      </SelectItem>
                    ))
                  )}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Members(If the student is missing from the search, they are already on a team.)</Label>
            {selectedStudents.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1">
                {selectedStudents.map(id => (
                  <span key={id} className="inline-flex items-center gap-1 bg-sidebar-accent text-xs rounded-full px-2 py-0.5">
                    {getStudentName(id)}
                    <button onClick={() => removeStudent(id)}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <Input
              placeholder="Search student by name..."
              value={searchStudent}
              onChange={e => setSearchStudent(e.target.value)}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              disabled={selectedStudents.length >= 1}
            />
            {selectedStudents.length >= 1 && (
              <p className="text-xs text-amber-600 mt-1">Only 1 student per team allowed</p>
            )}
            {showDropdown && filteredStudents.length > 0 && selectedStudents.length < 1 && (
              <div className="border border-gray-200 rounded-lg max-h-32 overflow-y-auto mt-1">
                {filteredStudents.map(student => (
                  <div
                    key={student._id}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => addStudent(student._id)}
                    className=" px-2 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-950 cursor-pointer"
                  >
                    {student.name}
                    <span className="text-xs text-gray-400 ml-2">{student.email}</span>
                  </div>
                ))}
              </div>
            )}
            {searchStudent && filteredStudents.length === 0 && selectedStudents.length < 1 && (
              <p className="text-xs text-gray-400 mt-1">No available students found</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isLoading}>Cancel</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={isLoading || selectedStudents.length !== 1}>
            {isLoading ? "Creating..." : "Create Team"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}



