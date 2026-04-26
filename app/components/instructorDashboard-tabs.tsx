"use client";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardDescription, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Pencil, Trash, Trash2 } from "lucide-react";
import { EditTask } from "@/app/components/editTask";
import { DeleteTask } from "./deleteTask";

export function InstructorTabsDemo({ capstoneProjectId }: { capstoneProjectId?: Id<"capstoneProjects"> }) {
  const { user } = useUser();

  const allDeliverables = useQuery(api.dashboard.getAllDeliverables, {});
  const allTeams = useQuery(api.dashboard.getTeams, {});
  const allTasks = useQuery(api.dashboard.getAllTasks, {});
  const projectTasks = useQuery(
    api.dashboard.getTasks,
    capstoneProjectId ? { capstoneProjectId } : "skip"
  );
  const tasks = capstoneProjectId ? projectTasks : allTasks;

  

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
    <Tabs defaultValue="teams" className="w-full">
      <div className="flex justify-center items-center">
        <TabsList className="gap-6 w-full">
          <TabsTrigger value="teams" className="md:text-sm">Teams</TabsTrigger>
          <TabsTrigger value="submissions" className="md:text-sm">Submissions</TabsTrigger>
          <TabsTrigger value="tasks" className="md:text-sm">Tasks</TabsTrigger>
        </TabsList>
      </div>

      {/* TEAMS TAB */}
      <TabsContent value="teams">
        {allTeams === undefined ? (
          <p className="text-center py-4 text-gray-500">Loading...</p>
        ) : allTeams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-gray-500">No teams created yet</p>
          </div>
        ) : (
          allTeams.map((team) => {
  const teamDeliverables = allDeliverables?.filter(d => d.capstoneProjectId === team._id) ?? [];
  const teamTasks = allTasks?.filter(t => t.capstoneProjectId === team._id) ?? [];
  const completedTasks = teamTasks.filter(t => t.status === "completed").length;

            
            
              return(
                   <Card key={team._id} className="mb-4">
  <CardHeader>
    <CardDescription>
      <div className="flex flex-col gap-3">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <h1 className="font-semibold text-foreground text-sm lg:text-base">{team.teamName}</h1>
            <p className="text-muted-foreground text-xs mt-0.5">{team.projectTitle}</p>
          </div>
          <span className="inline-flex items-center justify-center rounded-full px-2.5 py-0.5 bg-blue-500 text-white text-xs font-medium shrink-0">
            {team.phase}
          </span>
        </div>

        <Separator />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="">
            <p className="text-xs text-muted-foreground">Members</p>
            <p className="text-sm font-semibold text-foreground">{team.members?.length ?? 0}</p>
          </div>

          <div className="">
            <p className="text-xs text-muted-foreground">Deliverables</p>
            <p className="text-sm font-semibold text-foreground">{teamDeliverables.length}</p>
          </div>

          <div className="">
            <p className="text-xs text-muted-foreground">Tasks</p>
            <p className="text-sm font-semibold text-foreground">
              {completedTasks}/{teamTasks.length}
              <span className="text-xs font-normal text-muted-foreground ml-1">complete</span>
            </p>
          </div>

          <div className="">
            <p className="text-xs text-muted-foreground">Progress</p>
            <p className="text-sm font-semibold text-foreground">{team.progress ?? 0}%</p>
          </div>
        </div>
      </div>
    </CardDescription>
  </CardHeader>
</Card>
              );
           
       })
        )}
      </TabsContent>

      {/* SUBMISSIONS TAB */}
      <TabsContent value="submissions">
        {allDeliverables === undefined ? (
          <p className="text-center py-4 text-gray-500">Loading...</p>
        ) : allDeliverables.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-12 w-12 text-gray-300 mb-3">
              <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
              <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
            </svg>
            <p className="text-gray-500">No submissions yet</p>
          </div>
        ) : (
          allDeliverables.map((d) => (
            <Card key={d._id} className="mb-5">
              <CardHeader>
                <CardDescription>
                  <div className="flex flex-col mt-0 lg:mt-2">
                    <div className="flex justify-between">
                      <div className="flex flex-col">
                        <h1 className="font-medium text-foreground text-sm lg:text-base">{d.fileName}</h1>
                        <p className="text-muted-foreground text-xs font-medium">
                          Team: {d.teamName} • Phase: {d.phase} • Version {d.version}
                        </p>
                      </div>
                      <span className={`inline-flex items-center justify-center rounded-lg border px-1 lg:px-2 ${getStatusColor(d.status)} text-white text-xs font-medium h-5 lg:h-6`}>
                        {getStatusLabel(d.status)}
                      </span>
                    </div>
                    <Separator className="mt-3" />
                    <div className="flex justify-between items-center mt-4">
                      <h1 className="text-foreground text-xs">{formatDate(d.uploadedAt)} • {d.fileSize}</h1>
                      
                    </div>
                  </div>
                </CardDescription>
              </CardHeader>
            </Card>
          ))
        )}
      </TabsContent>

      {/* TASKS TAB */}
      <TabsContent value="tasks">
        {tasks === undefined ? (
          <p className="text-center py-4 text-gray-500">Loading...</p>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-gray-500">No tasks yet</p>
          </div>
        ) : (
          tasks.map((task, i) => (
            <Card key={i} className="mb-3">
              <CardHeader>
                <CardDescription>
                  <div className="rounded-lg">
                    <div className="flex flex-col">
                      <div className="flex justify-between">
                        <div className="flex flex-col">
                          <h1 className="text-foreground font-medium text-sm lg:text-base">{task.title}</h1>
                          <p className="text-muted-foreground text-xs">Team: {task.assignedTo}</p>
                        </div>
                        <span className={`inline-flex items-center justify-center rounded-lg border px-2 ${task.status === "completed" ? "bg-green-500" : task.status === "in_progress" ? "bg-blue-500" : "bg-yellow-500"} text-white text-xs font-medium gap-1 h-6`}>
                          {task.status === "completed" ? "Completed" : task.status === "in_progress" ? "In Progress" : "Pending"}
                        </span>
                      </div>
                    </div>
                    <Separator className="mt-3" />
                    <div className="grid grid-cols-1 gap-1 mt-3">
                      <div>
                        <p className="text-muted-foreground text-xs lg:text-sm mb-2 wrap-break-word">
                        <span className="text-xs font-medium text-popover-foreground">Description: </span><br />
                        {task.description}
                      </p>
                      </div>
                      <div className="flex items-center justify-between">
                          <p className="text-muted-foreground text-xs">
                        <span className="font-medium">Due:</span> {formatDate(task.dueDate)}
                      </p>
                      <div className="space-x-3 flex items-center">
                          <EditTask taskId={task._id} initialTitle={task.title}  initialDescription={task.description} initialDueDate={task.dueDate} initialTeamId={task.capstoneProjectId}/>
                          <DeleteTask taskId={task._id} taskTitle={task.title} />
                      </div>
                      </div>

                      
                    </div>
                  </div>
                </CardDescription>
              </CardHeader>
            </Card>
          ))
        )}
      </TabsContent>
    </Tabs>
  );
}