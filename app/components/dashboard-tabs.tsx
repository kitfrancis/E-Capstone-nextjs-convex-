"use client";
import { useState, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SelectDemo } from "@/app/components/select";
import { Separator } from "@/components/ui/separator";
import { SeparatorVertical } from "lucide-react";
import { Toaster } from "@/components/ui/sonner"
import { toast } from "sonner";
import dynamic from "next/dynamic";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

// Dynamically import PDFViewer to avoid SSR issues
const PDFViewer = dynamic(() => import("@/app/components/PDFViewer").then(mod => ({ default: mod.PDFViewer })), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-64">Loading PDF viewer...</div>
});


export function TabsDemo({ capstoneProjectId }: { capstoneProjectId?: Id<"capstoneProjects"> }) {
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState("");
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  //for pdf viewer
  const [selectedDeliverable, setSelectedDeliverable] = useState<{fileName: string, storageId: string} | null>(null);
  const fileUrl = useQuery(api.dashboard.getFileUrl,selectedDeliverable ? { storageId: selectedDeliverable.storageId as Id<"_storage">} : "skip");
  const isPdf = (fileName: string) => fileName.toLowerCase().endsWith(".pdf");

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
  if (!file || !phase || !capstoneProjectId) {
    toast.error("Please select a file and phase first.");
    return;
  }
  setUploading(true);
  try {
    const uploadUrl = await generateUploadUrl();

    const formData = new FormData();
    formData.append("file", file);

    const result = await fetch(uploadUrl, {
      method: "POST",
      body: formData,
    });

    if (!result.ok) {
      throw new Error(`Upload failed with status ${result.status}`);
    }

    const { storageId } = await result.json();

    await saveDeliverable({
      storageId,
      fileName: file.name,
      phase,
      fileSize: `${(file.size / (1024 * 1024)).toFixed(2)}MB`,
      capstoneProjectId,
    });

    toast.success("Uploaded successfully!");
    setFile(null);
    setPhase("");
  } catch (err) {
    console.error(err);
    toast.error(`Upload failed: ${err}`);
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
          <TabsTrigger value="deliverables" className="md:text-sm">Deliverables</TabsTrigger>
          <TabsTrigger value="uploads" className="md:text-sm">Upload New</TabsTrigger>
          <TabsTrigger value="tasks" className="md:text-sm">Tasks</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="deliverables">
        
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
            <Card key={d._id} className="mb-5">
          <CardHeader>
            <CardDescription>
                  <div  className="flex flex-col mt-0 lg:mt-2 border-b  last:border-0">
                    <div className="flex justify-between">
                      <div className="flex flex-col">
                        <h1 className="font-medium text-foreground text-sm lg:text-base">{d.fileName}</h1>
                        <p className="text-muted-foreground text-xs font-medium">Phase: {d.phase} • Version {d.version}</p>
                      </div>
                      <span className={`inline-flex items-center justify-center rounded-lg border px-1 lg:px-2 ${getStatusColor(d.status)} text-white text-xs font-medium  h-5 lg:h-6`}>
                        {getStatusLabel(d.status)}
                      </span>
                    </div>
                    <Separator className="mt-3" />
                    <div className="flex justify-between items-center mt-4 ">
                      <h1 className="text-foreground text-xs items-center flex">{formatDate(d.uploadedAt)} • {d.fileSize}</h1>
                      {isPdf(d.fileName) ? (
                  <button
                    onClick={() => setSelectedDeliverable({ fileName: d.fileName, storageId: d.storageId! })}
                    className="text-xs lg:text-sm outline rounded-md py-1 px-2 transition-colors"
                  >
                    View File
                  </button>
                ) : (
                  <a
                    href={fileUrl ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs lg:text-sm outline rounded-md py-1 px-2 transition-colors"
                  >
                    Download File
                  </a>
                )}
                    </div>
                  </div>
                  </CardDescription>
          </CardHeader>
        </Card>
                ))
              )}
            
      </TabsContent>

      {/* Upload */}
      <TabsContent value="uploads">
        <Card>
          <CardHeader>
            <CardDescription>
              <div className="flex flex-col max-h-auto bg-sidebar rounded-lg mt-1 lg:p-5">
                <div className="flex flex-col gap-1">
                  <h1 className="text-foreground text-sm lg:text-base font-semibold">Upload Project Deliverable</h1>
                  <p className="text-xs lg:text-sm text-muted-foreground">Upload a new version of your project deliverable for review</p>
                </div>

                <div className="space-y-1 mt-3 lg:mt-5 flex flex-col w-full">
                  <label className="text-foreground text-xs lg:text-sm font-semibold">Project Phase</label>
                  <SelectDemo onValueChange={setPhase} />
                </div>

                <div className="space-y-2 mt-2">
                  <label className="font-semibold text-foreground items-center text-xs lg:text-sm">Select File</label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="cursor-pointer border-2 border-dashed border-gray-400 hover:border-gray-600 rounded-lg flex items-center justify-center p-5 lg:p-7 mt-1"
                  >
                    <div className="flex flex-col items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-12 w-12 mx-auto mb-3 text-gray-400"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                      {file ? (
                        <p className="text-gray-800 font-medium">{file.name}</p>
                      ) : (
                        <>
                          <p className="text-foreground text-xs">Click to select a file</p>
                          <p className="text-xs text-muted-foreground mt-1">PDF, DOC, DOCX, or ZIP (max 50MB)</p>
                        </>
                      )}
                    </div>
                    <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.zip" onChange={handleFileChange} className="hidden" />
                  </div>

                  {success && (
                  toast.success("Upload Successfully!")
                  )}


                  <div className="border-t border-gray-300 mt-1 lg:mt-3">
                    <button onClick={handleUpload} disabled={!file || !phase || uploading} className="text-xs lg:text-sm flex flex-row items-center justify-center bg-black text-gray-100 w-full rounded-lg mt-3 lg:mt-5 py-2 disabled:opacity-50 disabled:cursor-not-allowed" >
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 mr-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                      {uploading ? "Uploading..." : "Upload Deliverable"}
                    </button>
                  </div>
                </div>
              </div>
            </CardDescription>
          </CardHeader>
        </Card>
      </TabsContent>

      {/* task*/}
      <TabsContent value="tasks">
              {tasks === undefined ? (
                <p className="text-center py-4 text-gray-500">Loading...</p>
              ) : tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <p className="text-gray-500">No tasks yet</p>
                  <p className="text-xs text-gray-400 mt-1">Tasks will be created by your instructor</p>
                </div>
              ) : (
                tasks.map((task) => (
        <Card key={task._id} className="mb-3">
          <CardHeader>
            <CardDescription>
                  <div  className="rounded-lg">
                    <div className="flex flex-col">
                      <div className="flex justify-between">
                        <div className="flex flex-col">
                          <h1 className="text-foreground font-medium text-sm lg:text-base">{task.title}</h1>
                          <p className="text-muted-foreground text-xs">{task.assignedTo}</p>
                        </div>
                        <span className={`inline-flex items-center justify-center rounded-lg border px-2 ${task.status === "completed" ? "bg-green-500" : task.status === "in_progress" ? "bg-blue-500" : "bg-yellow-500"} text-white text-xs font-medium gap-1 h-6`}>
                          {task.status === "completed" ? "Completed" : task.status === "in_progress" ? "In Progress" : "Pending"}
                        </span>
                      </div>
                    </div>
                    <Separator className="mt-3"/>
                    <div className="grid grid-cols-1 gap-1 mt-3 ">
                      <p className="text-muted-foreground text-xs lg:text-sm mb-2 wrap-break-word"><span className="text-xs  font-medium text-popover-foreground">Description: </span><br />
                      {task.description}</p>
                      <p className="text-muted-foreground text-xs"><span className="font-medium">Due:</span> {formatDate(task.dueDate)}</p>
                    </div>
                  </div>
                  </CardDescription>
          </CardHeader>
        </Card>
                ))
              )}
            
      </TabsContent>
      {/* for pdf viewer */}
      <PDFViewer
  open={!!selectedDeliverable && !!fileUrl}
  fileUrl={fileUrl ?? ""}
  fileName={selectedDeliverable?.fileName ?? ""}
  onClose={() => setSelectedDeliverable(null)}
/>
    </Tabs>
    

  );
}