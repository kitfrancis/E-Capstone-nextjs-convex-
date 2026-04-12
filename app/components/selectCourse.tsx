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
      <SelectTrigger className="w-full py-5 ">
        <SelectValue placeholder="Select a course" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem className="text-xs" value="Computer Science">Computer Science</SelectItem>
          <SelectItem className="text-xs" value="Information Technology">Information Technology</SelectItem>
          <SelectItem className="text-xs" value="Software Engineering">Software Engineering</SelectItem>
          <SelectItem className="text-xs" value="BLIS">BLIS</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
