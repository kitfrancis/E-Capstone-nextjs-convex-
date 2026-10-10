"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CHAPTERS = ["Chapter 1", "Chapter 2", "Chapter 3", "Chapter 4", "Chapter 5"];

export function SelectDemo({
  value,
  onValueChange,
}: {
  value?: string;
  onValueChange?: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select a chapter" />
      </SelectTrigger>
      <SelectContent>
        {CHAPTERS.map((c) => (
          <SelectItem key={c} value={c}>
            {c}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}