"use client"  
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogClose, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Copy, Check, CheckCircle2 } from "lucide-react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useState, useRef } from "react"

export function DialogDemo() {
  const advisers = useQuery(api.users.getAdvisers);
  const me = useQuery(api.users.getMe);
  const createProject = useMutation(api.dashboard.createCapstoneProject);
  const isSubmitting = useRef(false);

  const [open, setOpen] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [adviserId, setAdviserId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState("");
  const [createdTeamName, setCreatedTeamName] = useState("");
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(createdCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetForm = () => {
    setTeamName("");
    setProjectTitle("");
    setAdviserId("");
    setCreatedCode("");
    setCreatedTeamName("");
    setCopied(false);
  };

  const handleDone = () => {
    resetForm();
    setOpen(false);
  };

  const handleSubmit = async () => {
    console.log("Submit clicked");
    if (isSubmitting.current) return;
    if (!teamName || !projectTitle || !adviserId) {
      alert("Please fill all fields");
      return;
    }

    isSubmitting.current = true;
    setIsLoading(true);
    try {
      const code = await createProject({
        teamName,
        projectTitle,
        adviserId,
        instructorId: me!._id,
      });
      setCreatedTeamName(teamName);
      setCreatedCode(code);
    } catch (error) {
      console.error("Failed to create project:", error);
      alert("Failed to create project");
    } finally {
      setIsLoading(false);
      isSubmitting.current = false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="text-xs lg:text-sm flex items-center justify-center px-1.5 lg:px-3 bg-black dark:bg-gray-50 text-background hover:bg-gray-800 hover:text-background dark:hover:bg-gray-200">
          <Plus /> Create Team
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-sm">
        {createdCode ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <DialogTitle>Team Created!</DialogTitle>
              </div>
              <DialogDescription>
                <span className="font-medium text-foreground">{createdTeamName}</span> has been set up successfully.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3 py-2">
              <div className="flex flex-col gap-1.5 p-4 rounded-lg border bg-muted/50">
                <p className="text-xs text-muted-foreground">
                  Share this invite code with your students. They'll enter it during sign-up to join this team.
                </p>
                <div className="flex items-center justify-between bg-background border rounded-md px-4 py-3 mt-1">
                  <span className="font-mono text-base tracking-widest font-semibold">
                    {createdCode}
                  </span>
                  <button onClick={copyCode} className="text-muted-foreground hover:text-foreground transition-colors ml-3">
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                {copied && <p className="text-xs text-green-500 text-right">Copied to clipboard!</p>}
              </div>
              <p className="text-xs text-muted-foreground text-center">
                You can also find this code later on the team card.
              </p>
            </div>

            <DialogFooter>
              <Button onClick={handleDone} className="w-full">Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Create New Team</DialogTitle>
              <DialogDescription>
                Setup a new project team with an adviser. Students join via invite code at sign-up.
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
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" disabled={isLoading}>Cancel</Button>
              </DialogClose>
              <Button type="button" onClick={handleSubmit} disabled={isLoading || !me?._id}>
                {isLoading ? "Creating..." : "Create Team"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}