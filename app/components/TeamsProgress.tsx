"use client"

import { Progress } from "@/components/ui/progress"

interface InstructorProgressProps {
  progress: number;
}

export function InstructorProgress({ progress }: InstructorProgressProps) {
  return <Progress value={progress ?? 0} className="w-full h-1.5" />
}