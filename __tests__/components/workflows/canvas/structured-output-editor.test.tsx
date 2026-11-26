import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StructuredOutputSchemaEditor } from "@/components/workflows/canvas/config-sections/structured-output-editor";
import type { StructuredOutputSchema } from "@/types/workflows/workflow";

describe("StructuredOutputSchemaEditor", () => {
  it("renders empty state and adds a new field", () => {
    const onChange = vi.fn();
    render(
      <StructuredOutputSchemaEditor value={{ fields: [] }} onChange={onChange} />,
    );

    expect(
      screen.getByText(/no fields defined/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /add field/i }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as StructuredOutputSchema;
    expect(next.fields).toHaveLength(1);
    expect(next.fields[0]).toMatchObject({
      name: "",
      type: "string",
      required: true,
    });
  });

  it("updates field name, description, required toggle, and removes field", () => {
    const onChange = vi.fn();
    const initial: StructuredOutputSchema = {
      fields: [
        {
          id: "f1",
          name: "summary",
          type: "string",
          description: "",
          required: true,
        },
      ],
    };

    render(
      <StructuredOutputSchemaEditor value={initial} onChange={onChange} />,
    );

    fireEvent.change(screen.getByDisplayValue("summary"), {
      target: { value: "title" },
    });
    expect(onChange).toHaveBeenLastCalledWith({
      fields: [expect.objectContaining({ id: "f1", name: "title" })],
    });

    fireEvent.click(screen.getByRole("button", { name: /remove field/i }));
    expect(onChange).toHaveBeenLastCalledWith({ fields: [] });
  });

  it("renders and manages object_array subfields", () => {
    const onChange = vi.fn();
    const initial: StructuredOutputSchema = {
      fields: [
        {
          id: "f1",
          name: "invoices",
          type: "object_array",
          required: true,
          itemFields: [
            {
              id: "sf1",
              name: "amount",
              type: "number",
              required: true,
            },
          ],
        },
      ],
    };

    render(
      <StructuredOutputSchemaEditor value={initial} onChange={onChange} />,
    );

    expect(screen.getByDisplayValue("amount")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /add item field/i }));
    const afterAdd = onChange.mock.calls[0][0] as StructuredOutputSchema;
    expect(afterAdd.fields[0].itemFields).toHaveLength(2);
    expect(afterAdd.fields[0].itemFields?.[1]).toMatchObject({
      name: "",
      type: "string",
      required: true,
    });

    fireEvent.click(screen.getByRole("button", { name: /remove subfield/i }));
    const afterRemove = onChange.mock.calls[1][0] as StructuredOutputSchema;
    expect(afterRemove.fields[0].itemFields).toHaveLength(0);
  });

  it("shows inline validation errors for invalid, reserved, or duplicate field names", () => {
    const onChange = vi.fn();
    const initial: StructuredOutputSchema = {
      fields: [
        { id: "f1", name: "text", type: "string", required: true },
        { id: "f2", name: "1bad", type: "string", required: true },
        { id: "f3", name: "dup", type: "string", required: true },
        { id: "f4", name: "dup", type: "number", required: true },
      ],
    };

    render(
      <StructuredOutputSchemaEditor value={initial} onChange={onChange} />,
    );

    expect(screen.getByText(/"text" is a reserved field name/i)).toBeInTheDocument();
    expect(
      screen.getByText(/must start with a letter or _/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/duplicate field name "dup"/i)).toHaveLength(2);
  });
});
