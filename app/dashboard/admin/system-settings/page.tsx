"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Form = {
  systemName: string;
  institutionName: string;
  academicYear: string;
  allowRegistration: boolean;
  requireArchiveApproval: boolean;
  maintenanceMode: boolean;
  supportEmail: string;
};

const thisYear = new Date().getFullYear();
const ACADEMIC_YEARS = Array.from(
  { length: 6 },
  (_, i) => `${thisYear - 2 + i} - ${thisYear - 1 + i}`
);

function ToggleRow({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <Label htmlFor={id}>{label}</Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export default function SystemSettingsPage() {
  const settings = useQuery(api.adminSettings.get);
  const save = useMutation(api.adminSettings.update);

  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings && form === null) {
      const { updatedAt: _u, ...rest } = settings as Form & {
        updatedAt: number | null;
      };
      setForm(rest);
    }
  }, [settings, form]);

  if (!settings || !form) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Loading settings…</div>
    );
  }

  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  function cancel() {
    const { updatedAt: _u, ...rest } = settings as Form & {
      updatedAt: number | null;
    };
    setForm(rest);
  }

  async function onSave() {
    if (!form) return;
    setSaving(true);
    try {
      await save(form);
      toast.success("Settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  const updatedAt = (settings as { updatedAt: number | null }).updatedAt;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">System Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure system preferences and manage platform settings.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>General settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="systemName">System name</Label>
              <Input
                id="systemName"
                value={form.systemName}
                onChange={(e) => set("systemName", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="institutionName">Institution name</Label>
              <Input
                id="institutionName"
                value={form.institutionName}
                onChange={(e) => set("institutionName", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Academic year</Label>
              <Select
                value={form.academicYear}
                onValueChange={(v) => set("academicYear", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select academic year" />
                </SelectTrigger>
                <SelectContent>
                  {ACADEMIC_YEARS.map((y) => (
                    <SelectItem key={y} value={y}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="divide-y rounded-lg border px-4">
              <ToggleRow
                id="allowRegistration"
                label="Allow new user registration"
                description="Let new people sign up. Turn off to close signups."
                checked={form.allowRegistration}
                onChange={(v) => set("allowRegistration", v)}
              />
              <ToggleRow
                id="requireArchiveApproval"
                label="Require approval for archive uploads"
                description="Archive uploads wait for an admin before they go live."
                checked={form.requireArchiveApproval}
                onChange={(v) => set("requireArchiveApproval", v)}
              />
              <ToggleRow
                id="maintenanceMode"
                label="Maintenance mode"
                description="Block non-admin users while you make changes."
                checked={form.maintenanceMode}
                onChange={(v) => set("maintenanceMode", v)}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Platform information</CardTitle>
            <CardDescription>Shown to users who need help.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="supportEmail">Support email</Label>
              <Input
                id="supportEmail"
                type="email"
                placeholder="support@antiquespride.edu.ph"
                value={form.supportEmail}
                onChange={(e) => set("supportEmail", e.target.value)}
              />
            </div>
            <div className="text-sm">
              <p className="text-muted-foreground">Last updated</p>
              <p className="font-medium">
                {updatedAt
                  ? new Date(updatedAt).toLocaleString("en-PH", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })
                  : "Never saved"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={cancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={onSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          Save changes
        </Button>
      </div>
    </div>
  );
}