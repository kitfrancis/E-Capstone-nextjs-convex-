"use client"

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useEffect } from "react";
import { useClerk } from "@clerk/nextjs";
import { SelectCourseDemo } from "@/app/components/selectCourse";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Save, Mail, ShieldCheck, KeyRound, GraduationCap, BadgeCheck, Loader2 } from "lucide-react";

export default function AdviserProfile() {
  const me = useQuery(api.users.getMe);
  const updateProfile = useMutation(api.users.updateProfile);
  const { openUserProfile } = useClerk();

  const [name, setName] = useState("");
  const [program, setProgram] = useState("");
  const [section, setSection] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (me) {
      setName(me.name || "");
      setProgram(me.program || "");
      setSection(me.section || "");
    }
  }, [me]);

  async function handleSave() {
    setSaving(true);
    try {
      await updateProfile({ name, program, section });
      toast.success("Profile updated successfully", { position: "top-center" });
    } catch (error) {
      console.error("Failed to update profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  if (me === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  const inputClass = "h-10 rounded-xl text-sm";
  const lockedClass = "h-10 rounded-xl text-sm bg-muted text-muted-foreground cursor-not-allowed";

  return (
    <div className="scroll-smooth px-0 lg:px-5 pb-10 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="rounded-2xl bg-linear-to-r from-blue-100 via-blue-50 to-sky-100 dark:from-blue-950/60 dark:via-blue-950/30 dark:to-slate-900 p-6 lg:p-8">
        <h1 className="text-2xl lg:text-3xl font-semibold text-foreground">Profile settings</h1>
        <p className="text-sm lg:text-base text-muted-foreground mt-2">Manage your account information.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-5 items-start">
        {/* Identity card */}
        <div className="rounded-2xl border bg-card p-6 flex flex-col items-center text-center lg:sticky lg:top-4">
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-blue-100 text-4xl font-semibold text-blue-600 dark:bg-blue-900/50 dark:text-blue-300">
            {name?.[0]?.toUpperCase() || "?"}
          </span>
          <h2 className="mt-4 text-lg font-semibold text-foreground">{me?.name || "—"}</h2>
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-blue-600 px-3 py-0.5 text-xs font-medium capitalize text-white">
            <BadgeCheck className="h-3.5 w-3.5" />
            {me?.role || "—"}
          </span>
          <div className="mt-5 w-full border-t pt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground min-w-0">
            <Mail className="h-4 w-4 shrink-0" />
            <span className="truncate">{me?.email || "—"}</span>
          </div>
        </div>

        <div className="space-y-5">
          {/* Personal information */}
          <div className="rounded-2xl border bg-card p-5 lg:p-6">
            <h2 className="text-lg font-semibold text-foreground">Personal information</h2>
            <p className="text-sm text-muted-foreground">Update your personal details and preferences.</p>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="name" className="text-sm font-medium">Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <Input id="email" type="email" value={me?.email || ""} disabled className={lockedClass} />
                <p className="text-xs text-muted-foreground">Email is managed by your login provider.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="role" className="text-sm font-medium">Role</Label>
                <Input id="role" type="text" value={me?.role || "—"} disabled className={`${lockedClass} capitalize`} />
                <p className="text-xs text-muted-foreground">
                  Contact your administrator if this is incorrect.
                </p>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <GraduationCap className="h-4 w-4 text-blue-600" /> Course
                </Label>
                <SelectCourseDemo />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="h-10 w-full sm:w-auto rounded-xl gap-2 bg-blue-600 px-6 text-white hover:bg-blue-700"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </div>

          {/* Account security */}
          <div className="rounded-2xl border bg-card p-5 lg:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-foreground">Account security</h2>
                <p className="text-sm text-muted-foreground">Manage your password and security settings.</p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => openUserProfile()}
              className="mt-5 h-10 w-full rounded-xl gap-2"
            >
              <KeyRound className="h-4 w-4" /> Change password
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}