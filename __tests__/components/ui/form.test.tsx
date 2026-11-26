import { render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

function TestForm({ withError, emptyMessage }: { withError?: boolean; emptyMessage?: boolean }) {
  const form = useForm({
    defaultValues: { name: "" },
    errors: withError
      ? { name: { type: "manual", message: emptyMessage ? undefined : "Required" } }
      : undefined,
  });

  return (
    <Form {...form}>
      <form>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <input {...field} />
              </FormControl>
              <FormDescription>Enter name</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}

describe("Form", () => {
  it("renders form without error and with error message", () => {
    const { rerender } = render(<TestForm />);
    expect(screen.getByText("Enter name")).toBeInTheDocument();
    expect(screen.queryByText("Required")).not.toBeInTheDocument();

    rerender(<TestForm withError />);
    expect(screen.getByText("Required")).toBeInTheDocument();

    rerender(<TestForm withError emptyMessage />);
    expect(screen.queryByText("Required")).not.toBeInTheDocument();
  });
});
