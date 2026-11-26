import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar";

describe("Avatar", () => {
  it("renders all avatar primitives including badge, group, and group count", () => {
    render(
      <AvatarGroup>
        <Avatar size="sm">
          <AvatarImage src="/a.png" alt="A" />
          <AvatarFallback>A</AvatarFallback>
          <AvatarBadge>1</AvatarBadge>
        </Avatar>
        <AvatarGroupCount>+2</AvatarGroupCount>
      </AvatarGroup>,
    );

    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
  });
});
