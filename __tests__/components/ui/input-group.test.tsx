import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group";

describe("InputGroup", () => {
  it("focuses input when addon is clicked (not button) and renders Text and Textarea", () => {
    render(
      <div>
        <InputGroup>
          <InputGroupAddon data-testid="addon">
            <InputGroupText>@</InputGroupText>
            <InputGroupButton>Btn</InputGroupButton>
          </InputGroupAddon>
          <InputGroupInput aria-label="username" />
        </InputGroup>
        <InputGroup>
          <InputGroupTextarea aria-label="bio" />
        </InputGroup>
      </div>,
    );

    const input = screen.getByLabelText("username");
    fireEvent.click(screen.getByText("@"));
    expect(document.activeElement).toBe(input);

    fireEvent.click(screen.getByRole("button", { name: "Btn" }));
    expect(screen.getByLabelText("bio")).toBeInTheDocument();
  });
});
