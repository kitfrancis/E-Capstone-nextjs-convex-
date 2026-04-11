"use client"

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useEffect } from "react";
import { SelectCourseDemo } from "@/app/components/selectCourse";
import { Label } from "@/components/ui/label";

export default function StudentProfile() {
  const me = useQuery(api.users.getMe);
  const updateProfile = useMutation(api.users.updateProfile);

  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [course, setCourse] = useState("computer-science");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (me) {
      setName(me.name || "");
      setCourse(me.course || "computer-science");
    }
  }, [me]);

  async function handleSave() {
    setSaving(true);
    await updateProfile({ name, studentId, course });
    setSaving(false);
  }

  return (
    <div className="scroll-smooth font-Poppins">
      <div className="mx-3 px-3 max-h-auto lg:px-60">
        <h1 className="text-3xl font-semibold text-gray-800 mt-10">Profile Settings</h1>
        <p className="text-gray-600 mt-2">Manage your account information</p>

        <div className="h-auto bg-gray-50 my-6 rounded-xl border border-gray-300">
          <div className="flex flex-col my-6 mx-6">
            <h1 className="text-md sm:text-xl font-semibold text-gray-800">Personal Information</h1>
            <p className="text-md text-gray-500">Update your personal details and preferences</p>
          </div>

          <div className="mx-6 my-6">
            <div className="flex items-center gap-4">
              <span className="bg-gray-200 flex w-18 h-18 size-full items-center justify-center rounded-full text-2xl">
                {name?.[0]?.toUpperCase() || "?"}
              </span>
              <div>
                <h1 className="font-semibold text-md sm:text-xl">{me?.name || "—"}</h1>
                <p className="text-sm sm:text-md text-gray-500">{me?.role || "—"}</p>
              </div>
            </div>

            <div className="flex flex-col gap-1 mt-4">
              <Label className="text-base font-semibold">Name</Label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-white border border-gray-300 text-sm rounded-lg px-4 py-2 h-9 sm:h-10"
              />

              <Label className="mt-2 font-semibold text-base">Email</Label>
              <input
                type="email"
                value={me?.email || ""}
                disabled
                className="bg-gray-100 border border-gray-300 text-sm rounded-lg px-4 py-2 h-9 sm:h-10 text-gray-400"
              />
              <p className="text-sm text-gray-500">Email is managed by your login provider.</p>

              <Label className="mt-2 font-semibold text-base">Student ID</Label   >
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="e.g. 2021-00123"
                className="bg-white border border-gray-300 text-sm rounded-lg px-4 py-2 h-9 sm:h-10"
              />
                <Label className="mt-2 font-semibold text-base">Course</Label>
              <SelectCourseDemo/>

              <Label className="mt-2 font-semibold text-base">Role</Label>
              <input
                type="text"
                value={me?.role || "—"}
                disabled
                className="bg-gray-100 border text-sm border-gray-300 font-medium rounded-lg px-4 py-2 h-9 sm:h-10"
              />
              <p className="text-sm text-gray-500">Role cannot be changed. Contact your administrator if this is incorrect.</p>

              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center justify-center w-full bg-black text-white py-2 mt-6 rounded-lg hover:bg-gray-800 transition-colors duration-300 disabled:opacity-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-save h-4 w-4 mr-2">
                  <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"></path>
                  <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"></path>
                  <path d="M7 3v4a1 1 0 0 0 1 1h7"></path>
                </svg>
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>

        <div className="h-auto bg-gray-50 my-6 rounded-xl border border-gray-300">
          <div className="flex flex-col my-6 mx-6">
            <h1 className="text-md sm:text-xl font-semibold text-gray-800">Account Security</h1>
            <p className="text-gray-600">Manage your password and security settings</p>
            <button className="w-full bg-white border border-gray-300 text-black py-2 mt-6 rounded-lg hover:bg-gray-100 transition-colors duration-300">
              Change Password
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}