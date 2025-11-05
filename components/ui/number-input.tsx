import { Input } from "@/components/ui/input"
import { type ComponentProps } from "react"

export function NumberInput({
  onChange,
  value,
  ...props
}: Omit<ComponentProps<typeof Input>, "type" | "onChange" | "value"> & {
  onChange: (value: number | null) => void
  value: undefined | null | number
}) {
  return (
    <Input
      {...props}
      onChange={e => {
        const number = e.target.valueAsNumber
        onChange(isNaN(number) ? null : number)
      }}
      value={value ?? ""}
      type="number"
    />
  )
}
