import { Input } from "@/components/ui/input";
import { type ComponentProps } from "react";

/**
 * Controlled number input that surfaces numeric values instead of strings.
 * Converts the native `input` event value to a number, emitting `null` for
 * empty or non-numeric input. Designed for use with React Hook Form controllers.
 *
 * @param props.onChange - Receives the parsed number, or `null` for empty input
 * @param props.value - Current numeric value from the form controller
 * @author Maruf Bepary
 */
export function NumberInput({
  onChange,
  value,
  ...props
}: Omit<ComponentProps<typeof Input>, "type" | "onChange" | "value"> & {
  onChange: (value: number | null) => void;
  value: undefined | null | number;
}) {
  return (
    <Input
      {...props}
      onChange={(e) => {
        const number = e.target.valueAsNumber;
        onChange(isNaN(number) ? null : number);
      }}
      value={value ?? ""}
      type="number"
    />
  );
}
