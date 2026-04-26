"use client";

import { Button } from "@/components/ui/button"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Trash2 } from "lucide-react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"

interface DeleteTeamProps {
  teamId: Id<"capstoneProjects">;
  teamName: string;
}

export function DeleteTeam({ teamId, teamName }: DeleteTeamProps) {
  const deleteTeam = useMutation(api.dashboard.deleteTeam);

  const handleDelete = async () => {
    try {
      await deleteTeam({ teamId });
      toast.success("Team deleted successfully!");
    } catch (error) {
      console.error("Failed to delete team:", error);
      toast.error("Failed to delete team");
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs text-red-500 border-red-500/30 hover:bg-red-500/10 hover:text-red-500">
          <Trash2 className="w-3 h-3 mr-1" /> Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete team?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete &quot;{teamName}&quot;? This will permanently remove the team and cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-500 hover:bg-red-600 text-white"
            onClick={handleDelete}
          >
            Yes, delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}