"use client";

import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect } from "react";

type Role = "student" | "instructor" | "adviser";

export default function LandingPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();
  const me = useQuery(api.users.getMe);

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn && me && me.role) {
      router.push(`/dashboard/${me.role}`);
    }
  }, [isLoaded, isSignedIn, me]);

  const handleClick = (role: Role) => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("intendedRole", role);
    }
    router.push("/auth-callback");
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <>
      <div className="font-Poppins bg-background min-h-screen scroll-smooth">
        <div className="flex items-center justify-center px-4 sm:px-6 md:px-10 lg:px-40">
          <div className="flex flex-col items-center text-center mt-10 md:mt-20 max-w-6xl w-full">
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
              Welcome to the Portal
            </h1>

            <p className="text-base sm:text-lg md:text-xl max-w-2xl mx-auto mt-4 text-muted-foreground">
              Select your role to access your personalized dashboard and start managing your thesis projects.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8 mt-10 w-full">

              {/* Student */}
              <div className="group bg-card border-blue-300 hover:border-blue-700 hover:shadow-blue-300 hover:shadow-md border flex flex-col items-center justify-center rounded-2xl p-4 sm:p-5 md:p-6 cursor-pointer transition-all duration-300">
                <div className="text-center my-4">
                  <div className="group-hover:scale-110 bg-blue-600 rounded-2xl p-4 inline-flex items-center justify-center transition-all duration-300">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7 sm:h-8 sm:w-8 text-white">
                      <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"></path>
                      <path d="M22 10v6"></path>
                      <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"></path>
                    </svg>
                  </div>
                  <h1 className="mt-6 text-xl sm:text-2xl font-semibold text-foreground">Student</h1>
                  <p className="mt-3 text-sm sm:text-md text-muted-foreground">
                    Upload deliverables, track progress, and collaboration with your team
                  </p>
                  <div className="flex flex-col mt-5">
                    <ul className="list-disc pl-5 text-start text-sm sm:text-md marker:text-blue-600 space-y-3 text-foreground">
                      <li>Upload project deliverables</li>
                      <li>Track submission status</li>
                      <li>View feedback from advisers</li>
                      <li>Manage team tasks</li>
                    </ul>
                    <button
                      onClick={() => handleClick("student")}
                      className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 sm:px-5 rounded-md mt-6 transition-transform duration-300"
                    >
                      Continue as Student
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform">
                        <path d="M5 12h14"></path>
                        <path d="m12 5 7 7-7 7"></path>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Adviser */}
              <div className="group bg-card border-green-300 hover:border-green-700 hover:shadow-green-300 hover:shadow-md border flex flex-col items-center justify-center rounded-2xl p-4 sm:p-5 md:p-6 cursor-pointer transition-all duration-300">
                <div className="text-center my-4">
                  <div className="group-hover:scale-110 bg-green-600 rounded-2xl p-4 inline-flex items-center justify-center transition-all duration-300">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 sm:h-8 sm:w-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <polyline points="16 11 18 13 22 9"></polyline>
                    </svg>
                  </div>
                  <h1 className="mt-6 text-xl sm:text-2xl font-semibold text-foreground">Thesis Adviser</h1>
                  <p className="mt-3 text-sm sm:text-md text-muted-foreground">
                    Review student works, provide feedbacks, and guide project development.
                  </p>
                  <div className="flex flex-col mt-5">
                    <ul className="list-disc pl-5 text-start text-sm sm:text-md marker:text-green-600 space-y-3 text-foreground">
                      <li>Review team deliverables</li>
                      <li>Provide target feedback</li>
                      <li>Track student progress</li>
                      <li>Approve submissions</li>
                    </ul>
                    <button
                      onClick={() => handleClick("adviser")}
                      className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2 px-4 sm:px-5 rounded-md mt-6 transition-transform duration-300"
                    >
                      Continue as Adviser
                      <svg xmlns="http://www.w3.org/2000/svg" className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12h14"></path>
                        <path d="m12 5 7 7-7 7"></path>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Instructor */}
              <div className="group bg-card border-purple-300 hover:border-purple-700 hover:shadow-purple-300 hover:shadow-md border flex flex-col items-center justify-center rounded-2xl p-4 sm:p-5 md:p-6 cursor-pointer transition-all duration-300">
                <div className="text-center my-4">
                  <div className="group-hover:scale-110 bg-purple-600 rounded-2xl p-4 inline-flex items-center justify-center transition-all duration-300">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 sm:h-8 sm:w-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"></path>
                      <path d="M22 10v6"></path>
                      <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"></path>
                    </svg>
                  </div>
                  <h1 className="mt-6 text-xl sm:text-2xl font-semibold text-foreground">Subject Instructor</h1>
                  <p className="mt-3 text-sm sm:text-md text-muted-foreground">
                    Create teams, assign tasks, and oversee multiple projects.
                  </p>
                  <div className="flex flex-col mt-5">
                    <ul className="list-disc pl-5 text-start text-sm sm:text-md marker:text-purple-600 space-y-3 text-foreground">
                      <li>Create project teams</li>
                      <li>Assign tasks</li>
                      <li>Monitor progress</li>
                      <li>Manage project workflow</li>
                    </ul>
                    <button
                      onClick={() => handleClick("instructor")}
                      className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 sm:px-5 rounded-md mt-6 transition-transform duration-300"
                    >
                      Continue as Instructor
                      <svg xmlns="http://www.w3.org/2000/svg" className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12h14"></path>
                        <path d="m12 5 7 7-7 7"></path>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

            </div>

            <div className="flex flex-col items-center mt-10 max-w-2xl bg-card rounded-lg p-6 border border-border shadow-md">
              <h1 className="text-lg font-semibold mb-3 text-foreground">New to the system?</h1>
              <p className="text-muted-foreground mb-4">This platform streamlines thesis and capstone project management with role-based access, version control, feedback system, and a searchable project archive.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg flex flex-col items-center gap-1">
                  <h1 className="text-md md:text-sm font-semibold text-blue-900 dark:text-blue-300">Colaboration</h1>
                  <p className="text-blue-700 dark:text-blue-400 text-md md:text-sm">Real-time feedback and comments</p>
                </div>
                <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg flex flex-col items-center gap-1">
                  <h1 className="text-md md:text-sm font-semibold text-green-900 dark:text-green-300">Progress Tracking</h1>
                  <p className="text-green-700 dark:text-green-400 text-md md:text-sm">Monitor every project phase</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded-lg flex flex-col items-center gap-1">
                  <h1 className="text-md md:text-sm font-semibold text-purple-900 dark:text-purple-300">Searchable Archive</h1>
                  <p className="text-purple-700 dark:text-purple-400 text-md md:text-sm">Easily find and access past projects</p>
                </div>
              </div>
            </div>

          </div>
        </div>

        <footer className="bg-card border-t border-border mt-8 py-6">
          <div className="px-4 sm:px-6 md:px-10 lg:px-40">
            <p className="text-center text-sm text-muted-foreground">
              &copy; 2026 Thesis Management System. All rights reserved.
            </p>
            <p className="text-center text-sm text-muted-foreground">
              Developed by Kit Francis Besa, Carl Andrei Diomon, Stephen Gabarda and Kyle Steven Morillo.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}