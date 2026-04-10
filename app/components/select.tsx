import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"


interface SelectDemoProps {
  onValueChange?: (value: string) => void;
}


export function SelectDemo({ onValueChange }: SelectDemoProps) {
  return (
    <Select onValueChange={onValueChange}>
      <SelectTrigger className="w-full py-3 text-xs">
        <SelectValue placeholder="Proposal" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value="Proposal">Proposal</SelectItem>
          <SelectItem value="Development">Development</SelectItem>
          <SelectItem value="Testing">Testing</SelectItem>
          <SelectItem value="Documents">Documents</SelectItem>
          <SelectItem value="Defense">Defense</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
