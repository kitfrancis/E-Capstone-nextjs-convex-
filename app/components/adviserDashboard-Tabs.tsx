"use client";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import dynamic from "next/dynamic";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const PDFViewer = dynamic(
  () => import("@/app/components/PDFViewer").then((mod) => ({ default: mod.PDFViewer })),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-64">Loading PDF viewer...</div> }
);

type StatusFilter = "all" | "under_review" | "approved" | "needs_revision" | "pending";

export function AdviserTabsDemo({ capstoneProjectId }: { capstoneProjectId?: Id<"capstoneProjects"> }) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedDeliverable, setSelectedDeliverable] = useState<{ fileName: string; storageId: string; deliverableId: string } | null>(null);

  const me = useQuery(api.users.getMe);

  const deliverables = useQuery(
    api.dashboard.getDeliverables,
    capstoneProjectId ? { capstoneProjectId } : "skip"
  );

  const fileUrl = useQuery(
    api.dashboard.getFileUrl,
    selectedDeliverable ? { storageId: selectedDeliverable.storageId as Id<"_storage"> } : "skip"
  );
  const updateStatus = useMutation(api.dashboard.adviserDeliverableStatus);

  const getStatusColor = (status: string) => {
    if (status === "approved") return "bg-green-500";
    if (status === "under_review") return "bg-blue-500";
    if (status === "needs_revision") return "bg-yellow-500";
  };

  const getStatusLabel = (status: string) => {
    if (status === "approved") return "Approved";
    if (status === "under_review") return "Under Review";
    if (status === "needs_revision") return "Needs Revision";
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const filtered =
    deliverables?.filter((d) =>
      statusFilter === "all" ? true : d.status === statusFilter
    ) ?? [];

  const filterButtons: { label: string; value: StatusFilter }[] = [
    { label: "All", value: "all" },
    { label: "Under Review", value: "under_review" },
    { label: "Approved", value: "approved" },
    { label: "Needs Revision", value: "needs_revision" },
  ];

  return (
    <>
      <Tabs defaultValue="groupManagement" className="w-full">
        <div className="flex justify-center items-center">
          <TabsList className="gap-6 w-full">
            <TabsTrigger value="groupManagement" className="md:text-sm">
              <span className="block md:hidden">Groups</span>
              <span className="hidden md:block">Group Management</span>
            </TabsTrigger>
            <TabsTrigger value="reviewDeliverables" className="md:text-sm">
              <span className="block md:hidden">Reviews</span>
              <span className="hidden md:block">Review Deliverables</span>
            </TabsTrigger>
            <TabsTrigger value="trackProgress" className="md:text-sm">
              <span className="block md:hidden">Progress</span>
              <span className="hidden md:block">Track Progress</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Group Management */}
        <TabsContent value="groupManagement">
          <Card>
            <CardHeader>
              <CardDescription>Group management content here.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              You have 12 active projects and 3 pending tasks.
            </CardContent>
          </Card>
        </TabsContent>

        {/* Review Deliverables */}
        <TabsContent value="reviewDeliverables">
          <div className="flex flex-row items-center gap-2 my-3 overflow-x-auto whitespace-nowrap pb-2">
            {filterButtons.map((btn) => (
              <Button
                key={btn.value}
                variant={statusFilter === btn.value ? "default" : "outline"}
                className="text-xs rounded-lg"
                onClick={() => setStatusFilter(btn.value)}
              >
                {btn.label}
              </Button>
            ))}
          </div>

          {deliverables === undefined ? (
            <p className="text-center py-4 text-gray-500">Loading...</p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-12 w-12 text-gray-300 mb-3">
                <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
                <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
              </svg>
              <p className="text-gray-500">No deliverables found</p>
              <p className="text-xs text-gray-400 mt-1">
                {statusFilter === "all" ? "No submissions yet from any group." : `No deliverables with status "${getStatusLabel(statusFilter)}".`}
              </p>
            </div>
          ) : (
            filtered.map((d) => (
              <Card key={d._id} className="mb-4">
                <CardHeader>
                  <CardDescription>
                    <div className="flex flex-col">
                      <div className="flex justify-between items-start">
                        <div
                          className="flex flex-col cursor-pointer hover:opacity-80"
                          
                        >
                          <h1 className="font-medium text-foreground text-sm lg:text-base">{d.fileName}</h1>
                          <p className="text-muted-foreground text-xs font-medium">
                            Phase: {d.phase} • Version {d.version} • Submitted: {formatDate(d.uploadedAt)} • Comment:
                          </p>
                          
                        </div>
                        <span
                          className={`inline-flex items-center justify-center rounded-lg border px-1 lg:px-2 ${getStatusColor(d.status)} text-white text-xs font-medium h-5 lg:h-6`}
                        >
                          {getStatusLabel(d.status)}
                        </span>
                      </div>

                      <Separator className="mt-3" />

                <div className="flex justify-between items-center mt-3 gap-2">
  <button
    onClick={() => setSelectedDeliverable({ fileName: d.fileName, storageId: d.storageId!, deliverableId: d._id })}
    className="text-xs outline rounded-md py-1 px-2 transition-colors hover:bg-muted"
  >
    View Document
  </button>

  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button className="text-xs outline rounded-md py-1 px-2 transition-colors hover:bg-muted">
        <MoreHorizontal className="h-4 w-4" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-44">
      <DropdownMenuGroup>

        {d.status === "under_review" && (
          <>
            <DropdownMenuItem onClick={() => {}}>
              Add Comment
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => updateStatus({ deliverableId: d._id, status: "needs_revision" })}
              className="text-yellow-600 focus:text-yellow-600"
            >
              Request Revision
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => updateStatus({ deliverableId: d._id, status: "approved" })}
              className="text-green-600 focus:text-green-600"
            >
              Approve
            </DropdownMenuItem>
          </>
        )}

        {d.status === "needs_revision" && (
          <>
            <DropdownMenuItem onClick={() => {}}>
              View Feedback
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {}}>
              Add Comment
            </DropdownMenuItem>
          </>
        )}

        {d.status === "approved" && (
          <DropdownMenuItem onClick={() => {}}>
            View Comments
          </DropdownMenuItem>
        )}

      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>
</div>
                    </div>
                  </CardDescription>
                </CardHeader>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Track Progress */}
        <TabsContent value="trackProgress">
          <Card>
            <CardHeader>
              <CardTitle>Reports</CardTitle>
              <CardDescription>
                Generate and download your detailed reports.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              You have 5 reports ready and available to export.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* PDF Viewer shared across tabs */}
      <PDFViewer
        open={!!selectedDeliverable && typeof fileUrl === "string" && fileUrl.startsWith("http")}
        fileUrl={fileUrl ?? ""}
        fileName={selectedDeliverable?.fileName ?? ""}
        deliverableId={selectedDeliverable?.deliverableId as Id<"deliverables"> | undefined}
        userId={me?.clerkId}
        userName={me?.name ?? ""}
        onClose={() => setSelectedDeliverable(null)}
      />
    </>
  );
}