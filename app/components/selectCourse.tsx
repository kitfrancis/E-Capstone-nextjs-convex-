import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"


interface SelectCourseDemoProps {
  onValueChange?: (value: string) => void;
}


export function SelectCourseDemo({ onValueChange }: SelectCourseDemoProps) {
  return (
    <Select onValueChange={onValueChange}>
      <SelectTrigger className="w-full py-5 text-base">
        <SelectValue placeholder="Select a course" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem className="text-base" value="Computer Science">Computer Science</SelectItem>
          <SelectItem className="text-base" value="Information Technology">Information Technology</SelectItem>
          <SelectItem className="text-base" value="Software Engineering">Software Engineering</SelectItem>
          <SelectItem className="text-base" value="BLIS">BLIS</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
