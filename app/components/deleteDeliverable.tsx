"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function DeleteDeliverable({
  deliverableId,
  fileName,
  trigger,
}: {
  deliverableId: Id<"deliverables">;
  fileName: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const deleteDeliverable = useMutation(api.dashboard.deleteDeliverable);

  const handleDelete = async () => {
    try {
      await deleteDeliverable({ deliverableId });
      toast.success("File deleted successfully.");
    } catch (error) {
      console.error("Failed to delete deliverable:", error);
      toast.error("Failed to delete file.");
    }
  };

  return (
    <>
      <div onClick={() => setOpen(true)}>
        {trigger ?? (
          <button className="text-xs px-2 py-1 rounded-md border border-destructive text-destructive hover:bg-destructive/10 transition-colors">
            Delete
          </button>
        )}
      </div>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this file?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">{fileName}</span> will
              be permanently deleted and cannot be recovered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-gray-200 text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}