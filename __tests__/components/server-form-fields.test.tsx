import { act, fireEvent, render, screen } from "@testing-library/react";
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
  it("renders connection fields and auth selection tabs without accordion or custom headers for no auth", () => {
    render(<TestFormWrapper />);

    expect(screen.getByLabelText("Name")).toBeDefined();
    expect(screen.getByLabelText("Endpoint URL")).toBeDefined();
    expect(screen.getByRole("tab", { name: /no auth/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /api key/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /oauth 2\.1/i })).toBeDefined();
    expect(
      screen.queryByRole("button", { name: /advanced settings/i }),
    ).toBeNull();
    expect(screen.queryByLabelText(/api key/i)).toBeNull();
  });

  it("renders API key field and collapsed advanced settings for headers authType", () => {
    render(
      <TestFormWrapper
        defaultValues={{
          name: "Headers Server",
          url: "https://example.com",
          authType: "headers",
          headers: "",
          oauthClientId: "",
          oauthClientSecret: "",
          oauthScope: "",
          isPublic: false,
        }}
      />,
    );

    // API Key field is directly visible
    const apiKeyInput = screen.getByLabelText("API Key");
    expect(apiKeyInput).toBeDefined();

    act(() => {
      fireEvent.change(apiKeyInput, { target: { value: "sk-test-token" } });
    });

    // Advanced settings accordion is collapsed by default
    const trigger = screen.getByRole("button", { name: /advanced settings/i });
    expect(trigger).toBeDefined();
    expect(screen.queryByLabelText("Header Name")).toBeNull();

    // Expand accordion to reveal header name and pairs editor
    act(() => {
      fireEvent.click(trigger);
    });
    const headerNameInput = screen.getByLabelText("Header Name");
    expect(headerNameInput).toBeDefined();

    act(() => {
      fireEvent.change(headerNameInput, { target: { value: "X-API-Key" } });
    });

    expect(screen.getByRole("button", { name: /add header/i })).toBeDefined();

    // Add a custom header pair
    const addBtn = screen.getByRole("button", { name: /add header/i });
    act(() => {
      fireEvent.click(addBtn);
    });
    expect(screen.getByLabelText("Header Name 1")).toBeDefined();
    expect(screen.getByLabelText("Header Value 1")).toBeDefined();

    // Fill in custom header pair
    act(() => {
      fireEvent.change(screen.getByLabelText("Header Name 1"), {
        target: { value: "X-Tenant" },
      });
      fireEvent.change(screen.getByLabelText("Header Value 1"), {
        target: { value: "tenant-a" },
      });
    });

    // Remove the custom header pair
    const removeBtn = screen.getByLabelText("Remove Header 1");
    act(() => {
      fireEvent.click(removeBtn);
    });
    expect(screen.queryByLabelText("Header Name 1")).toBeNull();
  });

  it("parses pre-populated headers into API key and custom pairs", () => {
    render(
      <TestFormWrapper
        defaultValues={{
          name: "Existing Headers Server",
          url: "https://example.com",
          authType: "headers",
          headers: JSON.stringify({
            Authorization: "Bearer secret-123",
            "X-Custom-Env": "prod",
          }),
          isPublic: false,
        }}
      />,
    );

    // API Key input is pre-populated without the "Bearer " prefix
    expect(screen.getByDisplayValue("secret-123")).toBeDefined();

    // Expand accordion to inspect pairs
    const trigger = screen.getByRole("button", { name: /advanced settings/i });
    act(() => {
      fireEvent.click(trigger);
    });

    expect(screen.getByDisplayValue("X-Custom-Env")).toBeDefined();
    expect(screen.getByDisplayValue("prod")).toBeDefined();
  });

  it("renders OAuth fields in advanced settings when expanded and authType is oauth", () => {
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

    // Advanced settings accordion is collapsed by default
    const trigger = screen.getByRole("button", { name: /advanced settings/i });
    expect(trigger).toBeDefined();
    expect(screen.queryByLabelText(/client id/i)).toBeNull();

    // Expand accordion to reveal fields
    fireEvent.click(trigger);
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
