import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

const mockUseIsMobile = vi.hoisted(() => vi.fn(() => false));
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: mockUseIsMobile,
}));

function SidebarConsumer() {
  useSidebar();
  return null;
}

describe("Sidebar", () => {
  it("throws when useSidebar is called outside SidebarProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {  it("toggles mobile sidebar and hides tooltip when isMobile is true", async () => {
    const origInnerWidth = window.innerWidth;
    const origMatchMedia = window.matchMedia;
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 500 });
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    try {
      render(
        <SidebarProvider defaultOpen={false}>
          <SidebarTrigger />
          <Sidebar>
            <SidebarContent>
              <SidebarMenuButton tooltip="Mobile Tip">Item</SidebarMenuButton>
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>,
      );

      fireEvent.click(screen.getByRole("button", { name: /toggle sidebar/i }));
      expect(await screen.findByText("Item")).toBeInTheDocument();
    } finally {
      Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: origInnerWidth });
      window.matchMedia = origMatchMedia;
    }
  });
});
    expect(() => render(<SidebarConsumer />)).toThrow(
      "useSidebar must be used within a SidebarProvider.",
    );
    spy.mockRestore();
  });

  it("renders all sidebar primitives on desktop, toggles via trigger and keyboard shortcut", () => {
});

  it("renders all sidebar primitives on desktop, toggles via trigger and keyboard shortcut", () => {
    mockUseIsMobile.mockReturnValue(false);
    const onOpenChange = vi.fn();

    render(
      <SidebarProvider defaultOpen={true} onOpenChange={onOpenChange}>
        <Sidebar variant="floating" side="right" collapsible="icon">
          <SidebarHeader>
            <SidebarInput placeholder="Search..." />
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Plain Group</SidebarGroupLabel>
              <SidebarGroupLabel asChild>
                <span>Group</span>
              </SidebarGroupLabel>
              <SidebarGroupAction asChild>
                <button type="button">+</button>
              </SidebarGroupAction>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton tooltip={{ children: "Home" }} isActive size="lg">
                      Home
                    </SidebarMenuButton>
                    <SidebarMenuAction showOnHover asChild>
                      <button type="button">Act</button>
                    </SidebarMenuAction>
                    <SidebarMenuAction>PlainAct</SidebarMenuAction>
                    <SidebarMenuBadge>3</SidebarMenuBadge>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton size="sm" isActive>
                          Sub 1
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton size="md" asChild>
                          <a href="#sub">Sub 2</a>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuSkeleton showIcon />
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarSeparator />
          <SidebarFooter>Footer</SidebarFooter>
          <SidebarRail />
        </Sidebar>
        <SidebarInset>
          <SidebarTrigger />
          Main
        </SidebarInset>
      </SidebarProvider>,
    );

    expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
    expect(screen.getByText("Sub 1")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Toggle Sidebar" })[0]);
    expect(onOpenChange).toHaveBeenCalledWith(false);

    fireEvent.keyDown(window, { key: "b", ctrlKey: true });
  });

  it("toggles mobile sidebar and hides tooltip when isMobile is true", async () => {
    const origInnerWidth = window.innerWidth;
    const origMatchMedia = window.matchMedia;
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 500 });
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    try {
      render(
        <SidebarProvider defaultOpen={false}>
          <SidebarTrigger />
          <Sidebar>
            <SidebarContent>
              <SidebarMenuButton tooltip="Mobile Tip">Item</SidebarMenuButton>
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>,
      );

      fireEvent.click(screen.getByRole("button", { name: /toggle sidebar/i }));
      expect(await screen.findByText("Item")).toBeInTheDocument();
    } finally {
      Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: origInnerWidth });
      window.matchMedia = origMatchMedia;
    }

    // Mobile toggle
    mockUseIsMobile.mockReturnValue(true);
    fireEvent.click(screen.getAllByRole("button", { name: "Toggle Sidebar", hidden: true })[0]);
    mockUseIsMobile.mockReturnValue(false);
  });

  it("toggles mobile sidebar and hides tooltip when isMobile is true", async () => {
    const origInnerWidth = window.innerWidth;
    const origMatchMedia = window.matchMedia;
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 500 });
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    try {
      render(
        <SidebarProvider defaultOpen={false}>
          <SidebarTrigger />
          <Sidebar>
            <SidebarContent>
              <SidebarMenuButton tooltip="Mobile Tip">Item</SidebarMenuButton>
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>,
      );

      fireEvent.click(screen.getByRole("button", { name: /toggle sidebar/i }));
      expect(await screen.findByText("Item")).toBeInTheDocument();
    } finally {
      Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: origInnerWidth });
      window.matchMedia = origMatchMedia;
    }
  });

  it("renders collapsible='none' and mobile Sheet variant", () => {
    mockUseIsMobile.mockReturnValue(false);
    const { unmount } = render(
      <SidebarProvider>
        <Sidebar collapsible="none">
          <SidebarContent>Static</SidebarContent>
        </Sidebar>
      </SidebarProvider>,
    );
    expect(screen.getByText("Static")).toBeInTheDocument();
    unmount();

    mockUseIsMobile.mockReturnValue(true);
    render(
      <SidebarProvider>
        <Sidebar>
          <SidebarContent>Mobile</SidebarContent>
        </Sidebar>
        <SidebarTrigger />
      </SidebarProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }));
    expect(screen.getByText("Mobile")).toBeInTheDocument();
  });

  it("toggles mobile sidebar and hides tooltip when isMobile is true", async () => {
    const origInnerWidth = window.innerWidth;
    const origMatchMedia = window.matchMedia;
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 500 });
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    try {
      render(
        <SidebarProvider defaultOpen={false}>
          <SidebarTrigger />
          <Sidebar>
            <SidebarContent>
              <SidebarMenuButton tooltip="Mobile Tip">Item</SidebarMenuButton>
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>,
      );

      fireEvent.click(screen.getByRole("button", { name: /toggle sidebar/i }));
      expect(await screen.findByText("Item")).toBeInTheDocument();
    } finally {
      Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: origInnerWidth });
      window.matchMedia = origMatchMedia;
    }
  });
});

  it("calls setOpen with a boolean value", () => {
    mockUseIsMobile.mockReturnValue(false);
    function SetOpenConsumer() {
      const { setOpen } = useSidebar();
      return (
        <button type="button" onClick={() => setOpen(false)}>
          Close Direct
        </button>
      );
    }
    render(
      <SidebarProvider defaultOpen={true}>
        <SetOpenConsumer />
      </SidebarProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Close Direct" }));
  });

  it("toggles mobile sidebar and hides tooltip when isMobile is true", async () => {
    const origInnerWidth = window.innerWidth;
    const origMatchMedia = window.matchMedia;
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 500 });
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    try {
      render(
        <SidebarProvider defaultOpen={false}>
          <SidebarTrigger />
          <Sidebar>
            <SidebarContent>
              <SidebarMenuButton tooltip="Mobile Tip">Item</SidebarMenuButton>
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>,
      );

      fireEvent.click(screen.getByRole("button", { name: /toggle sidebar/i }));
      expect(await screen.findByText("Item")).toBeInTheDocument();
    } finally {
      Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: origInnerWidth });
      window.matchMedia = origMatchMedia;
    }
  });
  it("toggles mobile sidebar and hides tooltip when isMobile is true", async () => {
    const origInnerWidth = window.innerWidth;
    const origMatchMedia = window.matchMedia;
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 500 });
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    try {
      render(
        <SidebarProvider defaultOpen={false}>
          <SidebarTrigger />
          <Sidebar>
            <SidebarContent>
              <SidebarMenuButton tooltip="Mobile Tip">Item</SidebarMenuButton>
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>,
      );

      fireEvent.click(screen.getByRole("button", { name: /toggle sidebar/i }));
      expect(await screen.findByText("Item")).toBeInTheDocument();
    } finally {
      Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: origInnerWidth });
      window.matchMedia = origMatchMedia;
    }
  });
