"use client";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react"; 
import { api } from "@/convex/_generated/api";


export default function Dashboard() {

    const me = useQuery(api.users.getMe);
  const router = useRouter();
  return (
    
    <div className="scroll-smooth font-Poppins bg-background">
        <div className="lg:ml-1 mx-3 px-3 max-h-auto lg:px-5 ">
            <h1 className="text-3xl font-semibold text-primary- mt-10">Welcome back,  {me === undefined ? "Loading..." : me?.name ?? "—"}</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">Track your project progress and manage deliverables.</p>
        <div className="bg-gray-100 rounded-2xl p-1  max-h-auto  mt-6 md:mt-10">
            <div className="gap-1 mx-5 my-5">
              <div className="flex flex-col mb-5 md:mb-8 ">
           <h1 className="font-semibold text-md">Team Overview</h1>
          <p className="text-gray-500 text-md">[Team name - Project]</p>
              </div>

          <div className="space-y-4">
              <div className="flex justify-between items-center mb-2 w-full">
                <h2 className="text-sm font-medium">Current Phase: <span className="font-semibold">Development</span></h2>
                <span className="text-sm font-semibold">10%</span>
              </div>
              <div className="bg-gray-300 h-2 rounded-full w-full">
                <div className="bg-gray-700 h-2 rounded-full" style={{ width: "10%" }}></div>
              </div>
              
            <div className=" grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="text-center bg-green-50 p-3 rounded-xl">
                <h1 className="text-2xl font-semibold text-green-700">1</h1>
                  <h1 className="text-sm text-gray-600">Approved</h1>
              </div>
               <div className="text-center bg-blue-50 p-3 rounded-xl">
                <h1 className="text-2xl font-semibold text-blue-700">1</h1>
                  <h1 className="text-sm text-gray-600">Under Review</h1>
              </div>
               <div className="text-center bg-yellow-50 p-3 rounded-xl">
                <h1 className="text-2xl font-semibold text-yellow-700">0</h1>
                  <h1 className="text-sm text-gray-600">Needs Revision</h1>
              </div>

            </div>
            
          </div>
          

            </div>
        </div>

            <div className="bg-gray-200 rounded-full p-1 flex w-full max-w-auto mt-5">
  
              <button className="flex-1 text-sm bg-white text-black font-medium py-2 rounded-full shadow-sm">
                Deliverables
              </button>

              <button onClick={() => router.push("/uploads")} className="flex-1 text-sm text-gray-600 font-medium py-2 rounded-full hover:bg-gray-100">
                Upload New
              </button>

              <button onClick={() => router.push("/tasks")} className="flex-1 text-sm text-gray-600 font-medium py-2 rounded-full hover:bg-gray-100">
                Tasks
              </button>

            </div>
             <div className="bg-gray-100 mt-4 md:mt-6 rounded-lg p-4 px-7  mb-6">
               <div className="flex flex-col mt-4 md:mt-2 ">
                <div className="flex justify-between">
                  <div className="flex flex-col">
                      <h1 className="font-medium text-lg">Project Proposal.pdf</h1>
                    <p className="text-gray-500">Phase:Proposal • Version 2 </p>
                  </div>
                     <span className="inline-flex items-center justify-center rounded-lg border px-2 bg-green-500 text-white text-xs font-medium gap-1 h-6 "> Approved</span>
                </div>
               </div>
               <div className="flex justify-between items-center mt-4 md:mt-6 pb-3">
                <h1 className="text-gray-500 text-sm md:text-md">Oct 24, 2004</h1>
                <h1 className="text-gray-500 text-sm md:text-md">Size 2.0MB</h1>
              </div>
                <div className="border-t border-gray-300 pt-3">
                  <div className="flex items-center gap-2">
                      <h1 className="flex flex-row gap-2 font-medium mb-1"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-message-square h-4 w-4 text-gray-500"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>1 Comment</h1>
                  </div>
                  <button className="font-medium items-center justify-center w-full border border-gray-300 rounded-lg px-2 py-1 hover:bg-gray-300 transition-colors">
                    View Comments
                  </button>

                </div>
            </div>

        </div>
    </div>
  );
}