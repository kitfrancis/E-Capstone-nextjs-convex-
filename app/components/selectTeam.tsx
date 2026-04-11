import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"


interface SelectTeamProps {
  onValueChange?: (value: string) => void;
}


export function SelectTeam({ onValueChange }: SelectTeamProps) {
  return (
    <Select onValueChange={onValueChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select a team" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem className="text-base" value=""> </SelectItem>
          <SelectItem className="text-base" value="Information Technology">Information Technology</SelectItem>
          <SelectItem className="text-base" value="Software Engineering">Software Engineering</SelectItem>
          <SelectItem className="text-base" value="BLIS">BLIS</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
