import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";

describe("Drawer", () => {
  it("renders DrawerDescription", () => {
    render(
      <Drawer open>
        <DrawerContent>
          <DrawerTitle>Drawer Title</DrawerTitle>
          <DrawerDescription>Drawer Desc</DrawerDescription>
        </DrawerContent>
      </Drawer>,
    );

    expect(screen.getByText("Drawer Desc")).toBeInTheDocument();
  });
});
