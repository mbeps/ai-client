import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { type MenuItem, ResponsiveMenu } from "@/components/shared/responsive-menu";

beforeAll(() => {
  if (typeof window !== "undefined") {
    if (!window.HTMLElement.prototype.setPointerCapture) {
      window.HTMLElement.prototype.setPointerCapture = () => {};
    }
    if (!window.HTMLElement.prototype.releasePointerCapture) {
      window.HTMLElement.prototype.releasePointerCapture = () => {};
    }
    if (!window.HTMLElement.prototype.hasPointerCapture) {
      window.HTMLElement.prototype.hasPointerCapture = () => false;
    }
    if (!window.HTMLElement.prototype.scrollIntoView) {
      window.HTMLElement.prototype.scrollIntoView = () => {};
    }
  }
});

afterEach(() => {
  document.body.style.pointerEvents = "auto";
});

describe("ResponsiveMenu", () => {
  describe("Desktop DropdownMenu (isMobile=false)", () => {
    it("renders trigger, opens menu with links, and triggers onClick on action item", async () => {
      const user = userEvent.setup();
      const onActionClick = vi.fn();
      const testItems: MenuItem[] = [
        {
          label: "Link Item",
          href: "/target-path",
        },
        {
          label: "Action Item",
          onClick: onActionClick,
        },
        {
          label: "Combined Item",
          href: "/combined-path",
          onClick: vi.fn(),
        },
        {
          label: "Destructive Item",
          onClick: vi.fn(),
          isDestructive: true,
        },
        {
          label: "Hidden Item",
          onClick: vi.fn(),
          hidden: true,
        },
      ];

      render(
        <ResponsiveMenu
          title="Test Menu"
          items={testItems}
          isMobile={false}
        />,
      );

      const trigger = screen.getByRole("button");
      await user.click(trigger);

      // Link Item renders as an anchor with menuitem role due to asChild
      const linkItem = screen.getByRole("menuitem", { name: /link item/i });
      expect(linkItem).toBeInTheDocument();
      expect(linkItem.tagName.toLowerCase()).toBe("a");
      expect(linkItem).toHaveAttribute("href", "/target-path");

      // Combined Item should also render as an anchor with href
      const combinedItem = screen.getByRole("menuitem", { name: /combined item/i });
      expect(combinedItem).toBeInTheDocument();
      expect(combinedItem.tagName.toLowerCase()).toBe("a");
      expect(combinedItem).toHaveAttribute("href", "/combined-path");

      // Hidden Item should not be rendered
      expect(screen.queryByText(/hidden item/i)).not.toBeInTheDocument();

      // Action Item click triggers callback
      const actionItem = screen.getByRole("menuitem", { name: /action item/i });
      expect(actionItem).toBeInTheDocument();
      await user.click(actionItem);
      expect(onActionClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("Mobile Drawer (isMobile=true)", () => {
    const mobileItems: MenuItem[] = [
      {
        label: "Mobile Link",
        href: "/mobile-path",
      },
      {
        label: "Mobile Action",
        onClick: vi.fn(),
      },
      {
        label: "Mobile Combined",
        href: "/mobile-combined",
        onClick: vi.fn(),
      },
      {
        label: "Hidden Item",
        onClick: vi.fn(),
        hidden: true,
      },
    ];

    it("renders drawer trigger and displays links and action buttons", async () => {
      const user = userEvent.setup();
      render(
        <ResponsiveMenu
          title="Mobile Menu Title"
          items={mobileItems}
          isMobile={true}
        />,
      );

      const trigger = screen.getByRole("button");
      await user.click(trigger);

      // Mobile drawer links
      const link = screen.getByRole("link", { name: /mobile link/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/mobile-path");

      const combinedLink = screen.getByRole("link", { name: /mobile combined/i });
      expect(combinedLink).toBeInTheDocument();
      expect(combinedLink).toHaveAttribute("href", "/mobile-combined");

      // Action buttons
      const actionBtn = screen.getByRole("button", { name: /mobile action/i });
      expect(actionBtn).toBeInTheDocument();

      // Hidden Item should not be in the document
      expect(screen.queryByText(/hidden item/i)).not.toBeInTheDocument();
    });

    it("triggers onClick on mobile drawer link item click", async () => {
      const user = userEvent.setup();
      const onCombinedClick = vi.fn();
      const singleItem: MenuItem[] = [
        {
          label: "Clickable Link Item",
          href: "/mobile-link",
          onClick: onCombinedClick,
        },
      ];

      render(
        <ResponsiveMenu
          title="Mobile Menu"
          items={singleItem}
          isMobile={true}
        />,
      );

      const trigger = screen.getByRole("button");
      await user.click(trigger);

      const link = screen.getByRole("link", { name: /clickable link item/i });
      await user.click(link);
      expect(onCombinedClick).toHaveBeenCalledTimes(1);
    });
  });
});
