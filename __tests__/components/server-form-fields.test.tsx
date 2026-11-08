import { fireEvent, render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { Form } from "@/components/ui/form";
import { ServerFormFields } from "@/components/mcp/server-form-fields";

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

function TestFormWrapper({
  defaultValues = {
    name: "Test",
    url: "https://example.com",
    authType: "none",
    headers: "",
    oauthClientId: "",
    oauthClientSecret: "",
    oauthScope: "",
    isPublic: false,
  },
  ...props
}: any) {
  const form = useForm({
    defaultValues,
  });

  return (
    <Form {...form}>
      <form>
        <ServerFormFields form={form} {...props} />
      </form>
    </Form>
  );
}

describe("ServerFormFields", () => {
  it("renders connection fields and auth selection tabs", () => {
    render(<TestFormWrapper />);

    expect(screen.getByLabelText("Name")).toBeDefined();
    expect(screen.getByLabelText("Endpoint URL")).toBeDefined();
    expect(screen.getByRole("tab", { name: /no auth/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /custom headers/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /oauth 2\.1/i })).toBeDefined();
  });

  it("renders OAuth fields in advanced settings when authType is oauth", () => {
    render(
      <TestFormWrapper
        defaultValues={{
          name: "OAuth Server",
          url: "https://example.com",
          authType: "oauth",
          headers: "",
          oauthClientId: "",
          oauthClientSecret: "",
          oauthScope: "",
          isPublic: false,
        }}
      />,
    );

    // Advanced settings accordion is open by default
    expect(screen.getByText("Advanced Settings")).toBeDefined();
    expect(screen.getByLabelText(/client id/i)).toBeDefined();
    expect(screen.getByLabelText(/client secret/i)).toBeDefined();
    expect(screen.getByLabelText(/custom scope/i)).toBeDefined();
  });

  it("triggers onOAuthConnect when Connect button is clicked", () => {
    const onOAuthConnect = vi.fn();
    render(
      <TestFormWrapper
        defaultValues={{
          name: "OAuth Server",
          url: "https://example.com",
          authType: "oauth",
          headers: "",
          isPublic: false,
        }}
        serverId="srv-123"
        oauthConnected={false}
        onOAuthConnect={onOAuthConnect}
      />,
    );

    const connectBtn = screen.getByRole("button", { name: /connect account/i });
    fireEvent.click(connectBtn);
    expect(onOAuthConnect).toHaveBeenCalled();
  });

  it("triggers onOAuthDisconnect when Disconnect button is clicked", () => {
    const onOAuthDisconnect = vi.fn();
    render(
      <TestFormWrapper
        defaultValues={{
          name: "OAuth Server",
          url: "https://example.com",
          authType: "oauth",
          headers: "",
          isPublic: false,
        }}
        serverId="srv-123"
        oauthConnected={true}
        onOAuthDisconnect={onOAuthDisconnect}
      />,
    );

    const disconnectBtn = screen.getByRole("button", { name: /disconnect/i });
    fireEvent.click(disconnectBtn);
    expect(onOAuthDisconnect).toHaveBeenCalled();
  });

  it("renders public server toggle when showPublicToggle is true and isInstalled is false", () => {
    render(<TestFormWrapper showPublicToggle={true} isInstalled={false} />);
    expect(screen.getByLabelText(/public server/i)).toBeDefined();
  });

  it("does not render public server toggle when showPublicToggle is false", () => {
    render(<TestFormWrapper showPublicToggle={false} isInstalled={false} />);
    expect(screen.queryByLabelText(/public server/i)).toBeNull();
  });
});
