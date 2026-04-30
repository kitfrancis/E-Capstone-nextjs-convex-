"use client";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {ButtonGroup } from "@/components/ui/button-group";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"

export default function Archive() {
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const projectsData = useQuery(api.archive.getAll);

  const Year = ["All Year", "2025", "2026", "2027", "2028"]
  const Course = ["All Department", "Computer Science", "Information Technology", "Software Engineering", "BLIS"]


  if (projectsData === undefined) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  const projects = projectsData ?? [];
  const uniqueCourses = [...new Set(projects.map(p => p.course))];
  const uniqueYears = [...new Set(projects.map(p => p.year))];
  const uniqueKeywords = [...new Set(projects.flatMap(p => p.keywords))];

  return (
    <div className="scroll-smooth font-Poppins">
      <div className="lg:ml-1 max-h-auto ">
        <h1 className="text-3xl font-semibold text-foreground mt-10 px-1">Project Archive and Repository</h1>
        <p className="text-muted-foreground mt-2 px-1">Searchable digital library of completed thesis and capstone projects</p>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-5 md:mt-10">
          <div className="bg-muted flex flex-col items-center justify-center rounded-lg p-4 px-6">
            <div className="text-center my-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 mx-auto mb-2 text-blue-600"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
              <h1 className="text-2xl font-semibold text-foreground">{projects.length}</h1>
              <p className="text-sm text-muted-foreground">Total Projects</p>
            </div>
          </div>
          <div className="bg-muted flex flex-col items-center justify-center rounded-lg p-4 px-6">
            <div className="text-center my-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 mx-auto mb-2 text-green-600"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>
              <h1 className="text-2xl font-semibold text-foreground">{uniqueYears.length}</h1>
              <p className="text-sm text-muted-foreground">Academic Year</p>
            </div>
          </div>
          <div className="bg-muted flex flex-col items-center justify-center rounded-lg p-4 px-6">
            <div className="text-center my-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 mx-auto mb-2 text-purple-600"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>
              <h1 className="text-2xl font-semibold text-foreground">{uniqueKeywords.length}</h1>
              <p className="text-sm text-muted-foreground">Unique Keywords</p>
            </div>
          </div>
          <div className="bg-muted rounded-lg p-4">
            <div className="text-center my-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 mx-auto mb-2 text-orange-600"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/></svg>
              <h1 className="text-2xl font-semibold text-foreground">{uniqueCourses.length}</h1>
              <p className="text-sm text-muted-foreground">Department</p>
            </div>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="bg-muted gap-6 flex flex-col mt-5 md:mt-8 rounded-lg p-4 px-6">
          <h1 className="font-semibold text-md flex items-center gap-4 text-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z"/></svg>
            Search & Filter
          </h1>
          <div className="md:col-span-3 gap-2">
            <Field>
              <FieldLabel htmlFor="input-button-group" className="text-sm">Search Project</FieldLabel>
              <ButtonGroup>
                <Input id="input-button-group" placeholder="Search by title, keyword, abstract, or team name..." />
                <Button variant="outline">Search</Button>
              </ButtonGroup>
            </Field>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mt-5 py-3">
              <div className="space-y-1 flex flex-col">
                <label className="font-semibold text-sm text-foreground">Year</label>
                <Combobox items={Year}>
                  <ComboboxInput placeholder="Select a year" />
                  <ComboboxContent>
                    <ComboboxEmpty>No items found.</ComboboxEmpty>
                    <ComboboxList>
                      {(item) => (
                        <ComboboxItem key={item} value={item}>
                          {item}
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
                
              </div>
              <div className="space-y-1 flex flex-col">
                <label className="font-semibold text-sm text-foreground">Department</label>
                <Combobox items={Course}>
                  <ComboboxInput placeholder="Select a department" />
                  <ComboboxContent>
                    <ComboboxEmpty>No items found.</ComboboxEmpty>
                    <ComboboxList>
                      {(item) => (
                        <ComboboxItem key={item} value={item}>
                          {item}
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>

              </div>
              <div className="flex items-end">
                <Button className="bg-sidebar inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium border border-border text-foreground h-10 px-4 py-2 w-full hover:bg-muted">Clear Filters</Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Showing {projects.length} of {projects.length} projects.</p>
          </div>
        </div>

        {/* Projects + Detail */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5 md:mt-8 items-start">
          <div className="space-y-4">
            <h1 className="font-semibold text-xl text-foreground">Projects</h1>
            {projects.map((project, index) => (
              <div key={index} onClick={() => setSelectedProject(project)} className="bg-card border border-border mt-4 md:mt-6 rounded-lg p-4 px-6 mb-6 hover:shadow-md cursor-pointer">
                <div className="flex flex-col mt-4">
                  <div className="flex justify-between">
                    <h1 className="text-lg font-semibold text-foreground">{project.title}</h1>
                    <span className="inline-flex items-center justify-center rounded-md border border-border px-2 text-xs font-medium gap-1 h-6 text-foreground">{project.grade}</span>
                  </div>
                  <p className="text-muted-foreground font-medium mt-2">{project.team} • {project.year}</p>
                </div>
                <div className="mt-5 md:mt-6 pb-3">
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{project.abstract}</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {project.keywords.map((keyword, i) => (
                      <div key={i} className="inline-flex items-center bg-muted rounded-lg font-medium py-0.5 w-fit px-3">
                        <h1 className="text-xs font-medium line-clamp-1 text-foreground">{keyword}</h1>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">{project.course} • Archived {project.archivedDate}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Detail Panel */}
          <div className={`mt-4 md:mt-6 rounded-lg w-full py-4 px-6 flex flex-col bg-card border border-border ${!selectedProject ? "max-h-auto md:max-h-50 justify-center" : ""}`}>
            {selectedProject ? (
              <>
                <div className="flex justify-between items-start">
                  <div className="flex flex-col mt-1">
                    <h1 className="font-semibold text-md text-foreground">{selectedProject.title}</h1>
                    <p className="text-muted-foreground font-medium">{selectedProject.team} • {selectedProject.year}</p>
                  </div>
                  <span className="inline-flex items-center justify-center rounded-md border px-2 bg-primary text-primary-foreground text-sm font-medium gap-1 h-10 w-10">{selectedProject.grade}</span>
                </div>

                <div className="mt-5 md:mt-6 pb-6">
                  <h1 className="font-semibold mb-2 text-lg text-foreground">Abstract</h1>
                  <p className="text-sm text-muted-foreground mb-3">{selectedProject.abstract}</p>

                  <h1 className="font-semibold mb-2 text-lg text-foreground">Keywords</h1>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {selectedProject.keywords.map((keyword: string, i: number) => (
                      <div key={i} className="inline-flex items-center bg-muted rounded-lg font-medium py-0.5 w-fit px-3">
                        <span className="text-xs font-medium text-foreground">{keyword}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5">
                    <h1 className="font-semibold mb-2 text-lg text-foreground">Team Members</h1>
                    <div className="space-y-1">
                      {selectedProject.members.map((member: string, i: number) => (
                        <div key={i} className="flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-muted-foreground"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                          <p className="text-sm text-foreground">{member}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4">
                    <h1 className="font-semibold mb-2 text-lg text-foreground">Adviser</h1>
                    <div className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-muted-foreground"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                      <p className="text-sm text-foreground">{selectedProject.adviser}</p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <h1 className="font-semibold mb-2 text-lg text-foreground">Course</h1>
                    <p className="text-sm text-foreground">{selectedProject.course}</p>
                  </div>

                  <div className="mt-4">
                    <h1 className="font-semibold mb-2 text-lg text-foreground">Archived Date</h1>
                    <p className="text-xs text-foreground">{selectedProject.archivedDate}</p>
                  </div>

                  <div className="border-t border-border mt-3">
                    <button className="flex flex-row items-center justify-center bg-primary text-primary-foreground w-full rounded-lg mt-5 py-1">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 mr-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                      Download All Files
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-16 w-16 text-muted-foreground mb-4"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
                <h1 className="text-muted-foreground">Select a project to view details</h1>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}