import { Input } from "@/components/ui/input"
import { type ComponentProps } from "react"

/**
 * Numeric input wrapper that keeps form values as numbers instead of strings.
 * @param onChange Handler that receives a number or null when the field changes.
 * @param value Current numeric value supplied by the form controller.
 * @param props Additional input props forwarded to the underlying input.
 * @returns Controlled number input using the shared styling.
 */
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
