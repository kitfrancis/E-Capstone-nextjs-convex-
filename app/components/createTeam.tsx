
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
import { useState } from "react"
import { X } from "lucide-react"

export function DialogDemo() {
  const advisers = useQuery(api.users.getAdvisers);
  const students = useQuery(api.users.getStudents);

  const [teamName, setTeamName] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [adviserId, setAdviserId] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [searchStudent, setSearchStudent] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const filteredStudents = students?.filter(s =>
    s.name.toLowerCase().includes(searchStudent.toLowerCase()) &&
    !selectedStudents.includes(s._id)
  ) ?? [];

  const addStudent = (id: string) => {
    setSelectedStudents(prev => [...prev, id]);
    setSearchStudent("");
  };

  const removeStudent = (id: string) => {
    setSelectedStudents(prev => prev.filter(s => s !== id));
  };

  const getStudentName = (id: string) => {
    return students?.find(s => s._id === id)?.name ?? id;
  };


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
            <Label>Members</Label>
            {selectedStudents.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1">
                {selectedStudents.map(id => (
                  <span key={id} className="inline-flex items-center gap-1 bg-gray-200 text-xs rounded-full px-2 py-0.5">
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
            />
            {showDropdown && filteredStudents.length > 0 && (
              <div className="border border-gray-200 rounded-lg max-h-32 overflow-y-auto mt-1">
                {filteredStudents.map(student => (
                  <div
                    key={student._id}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => addStudent(student._id)}
                    className="px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer"
                  >
                    {student.name}
                    <span className="text-xs text-gray-400 ml-2">{student.email}</span>
                  </div>
                ))}
              </div>
            )}
            {searchStudent && filteredStudents.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">No students found</p>
            )}
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

