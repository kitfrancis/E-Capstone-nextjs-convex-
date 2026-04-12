"use client";
import { useState, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SelectDemo } from "@/app/components/select";

export function InstructorTabsDemo({ capstoneProjectId }: { capstoneProjectId?: Id<"capstoneProjects"> }) {
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState("");
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  

  const generateUploadUrl = useMutation(api.dashboard.generateUploadUrl);
  const saveDeliverable = useMutation(api.dashboard.saveDeliverable);
   const deliverables = useQuery(
    api.dashboard.getDeliverables,
    capstoneProjectId ? { capstoneProjectId } : "skip"
  );
   const tasks = useQuery(
    api.dashboard.getTasks,
    capstoneProjectId ? { capstoneProjectId } : "skip"
  );


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file || !phase || !capstoneProjectId) return;
    setUploading(true);
    try {
      // Get upload URL from Convex
      const uploadUrl = await generateUploadUrl();

      // Upload file to Convex storage
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = await result.json();

      // Save metadata to database
      await saveDeliverable({
        storageId,
        fileName: file.name,
        phase,
        fileSize: `${(file.size / (1024 * 1024)).toFixed(2)}MB`,
        capstoneProjectId: capstoneProjectId as any,
      });

      setSuccess(true);
      setFile(null);
      setPhase("");
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const getStatusColor = (status: string) => {
    if (status === "approved") return "bg-green-500";
    if (status === "under_review") return "bg-blue-500";
    return "bg-yellow-500";
  };

  const getStatusLabel = (status: string) => {
    if (status === "approved") return "Approved";
    if (status === "under_review") return "Under Review";
    return "Needs Revision";
  };

  const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

  return (
    <Tabs defaultValue="deliverables" className="w-full">
      <div className="flex justify-center items-center">
        <TabsList className="gap-6 w-full">
          <TabsTrigger value="deliverables" className="md:text-sm">Teams</TabsTrigger>
          <TabsTrigger value="uploads" className="md:text-sm">Submissions</TabsTrigger>
          <TabsTrigger value="tasks" className="md:text-sm">Tasks</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="deliverables">
        <Card>
          <CardHeader>
            <CardDescription>
              {deliverables === undefined ? (
                <p className="text-center py-4 text-gray-500">Loading...</p>
              ) : deliverables.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-12 w-12 text-gray-300 mb-3"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
                  <p className="text-gray-500">No deliverables yet</p>
                  <p className="text-xs text-gray-400 mt-1">Upload your first deliverable in the Upload tab</p>
                </div>
              ) : (
                deliverables.map((d, i) => (
                  <div key={i} className="flex flex-col mt-4 md:mt-2 border-b pb-4 mb-4 last:border-0">
                    <div className="flex justify-between">
                      <div className="flex flex-col">
                        <h1 className="font-medium text-lg">{d.fileName}</h1>
                        <p className="text-gray-500">Phase: {d.phase} • Version {d.version}</p>
                      </div>
                      <span className={`inline-flex items-center justify-center rounded-lg border px-2 ${getStatusColor(d.status)} text-white text-xs font-medium gap-1 h-6`}>
                        {getStatusLabel(d.status)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-4 pb-3">
                      <h1 className="text-gray-500 text-sm">{formatDate(d.uploadedAt)}</h1>
                      <h1 className="text-gray-500 text-sm">Size {d.fileSize}</h1>
                    </div>
                    <div className="border-t border-gray-300 pt-3">
                      <h1 className="flex flex-row gap-2 font-medium mb-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-gray-500"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        {d.comments} Comment{d.comments !== 1 ? "s" : ""}
                      </h1>
                      <button className="text-sm font-medium items-center justify-center w-full border border-gray-300 rounded-lg px-2 py-1 hover:bg-gray-300 transition-colors">
                        View Comments
                      </button>
                    </div>
                  </div>
                ))
              )}
            </CardDescription>
          </CardHeader>
        </Card>
      </TabsContent>

      {/* UPLOAD TAB */}
      <TabsContent value="uploads">
        <Card>
          <CardHeader>
            <CardDescription>
              
            </CardDescription>
          </CardHeader>
        </Card>
      </TabsContent>

      {/* TASKS TAB */}
      <TabsContent value="tasks">
        <Card>
          <CardHeader>
            <CardDescription>
              {tasks === undefined ? (
                <p className="text-center py-4 text-gray-500">Loading...</p>
              ) : tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <p className="text-gray-500">No tasks yet</p>
                </div>
              ) : (
                tasks.map((task, i) => (
                  <div key={i} className="rounded-lg px-3 mb-4 border-b pb-4 last:border-0">
                    <div className="flex flex-col mt-4 md:mt-2">
                      <div className="flex justify-between">
                        <div className="flex flex-col">
                          <h1 className="font-medium text-lg">{task.title}</h1>
                          <p className="text-gray-500">{task.assignedTo}</p>
                        </div>
                        <span className={`inline-flex items-center justify-center rounded-lg border px-2 ${task.status === "completed" ? "bg-green-500" : task.status === "in_progress" ? "bg-blue-500" : "bg-yellow-500"} text-white text-xs font-medium gap-1 h-6`}>
                          {task.status === "completed" ? "Completed" : task.status === "in_progress" ? "In Progress" : "Pending"}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col mt-4">
                      <p className="text-gray-500 text-sm">{task.description}</p>
                      <p className="text-gray-500 text-sm">Due: {task.dueDate}</p>
                    </div>
                  </div>
                ))
              )}
            </CardDescription>
          </CardHeader>
        </Card>
      </TabsContent>
    </Tabs>
  );
}