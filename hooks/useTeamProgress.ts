import { useMemo } from "react";
import { computeProgress } from "@/lib/progress";

type D = {
  _id: string;
  phase: string;
  version: number;
  status: string;
  uploadedAt: string;
};

const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

export function useTeamProgress(deliverables: D[] | undefined, stored = 0) {
  return useMemo(() => {
    if (!deliverables) return clamp(stored);
    return clamp(computeProgress(deliverables).total);
  }, [deliverables, stored]);
}