import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProviderFormFields } from "@/components/settings/providers/provider-form-fields";

describe("ProviderFormFields", () => {
  const defaultProps = {
    providerType: "openai-compatible" as const,
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKey: "",
    requiresKey: true,
    isEnabled: true,
    headerRows: [{ key: "", value: "" }],
    isEdit: false,
    onProviderTypeChange: vi.fn(),
    onNameChange: vi.fn(),
    onBaseUrlChange: vi.fn(),
    onApiKeyChange: vi.fn(),
    onRequiresKeyChange: vi.fn(),
    onIsEnabledChange: vi.fn(),
    onHeaderRowsChange: vi.fn(),
  };

  it("renders 'Header value' placeholder and no saved-headers notice when isEdit is false", () => {
    render(<ProviderFormFields {...defaultProps} isEdit={false} />);

    expect(screen.getByPlaceholderText("Header value")).toBeInTheDocument();
    expect(
      screen.queryByText(/Custom headers are encrypted and cannot be read back/),
    ).not.toBeInTheDocument();
  });

  it("renders 'Header value' placeholder and no saved-headers notice when hasSavedHeaders is false on edit", () => {
    render(
      <ProviderFormFields
        {...defaultProps}
        isEdit={true}
        hasSavedHeaders={false}
      />,
    );

    expect(screen.getByPlaceholderText("Header value")).toBeInTheDocument();
    expect(
      screen.queryByText(/Custom headers are encrypted and cannot be read back/),
    ).not.toBeInTheDocument();
  });

  it("renders 'Saved — enter new value to replace' placeholder and helper message when isEdit and hasSavedHeaders are true", () => {
    render(
      <ProviderFormFields
        {...defaultProps}
        isEdit={true}
        hasSavedHeaders={true}
      />,
    );

    expect(
      screen.getByPlaceholderText("Saved — enter new value to replace"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Custom headers are encrypted and cannot be read back. Leave empty to keep current headers, or enter new key-value pairs to replace them.",
      ),
    ).toBeInTheDocument();
  });

  it("calls onHeaderRowsChange when adding, updating, and removing header rows", async () => {
    const user = userEvent.setup();
    const onHeaderRowsChange = vi.fn();

    render(
      <ProviderFormFields
        {...defaultProps}
        headerRows={[{ key: "X-Custom", value: "foo" }]}
        onHeaderRowsChange={onHeaderRowsChange}
      />,
    );

    // Update key
    const keyInput = screen.getByPlaceholderText("Header name");
    fireEvent.change(keyInput, { target: { value: "X-Auth" } });
    expect(onHeaderRowsChange).toHaveBeenCalledWith([
      { key: "X-Auth", value: "foo" },
    ]);

    // Add row
    const addButton = screen.getByRole("button", { name: /Add Header/i });
    await user.click(addButton);
    expect(onHeaderRowsChange).toHaveBeenCalledWith([
      { key: "X-Custom", value: "foo" },
      { key: "", value: "" },
    ]);

    // Remove row
    const removeButton = screen.getByRole("button", { name: /Remove/i });
    await user.click(removeButton);
    expect(onHeaderRowsChange).toHaveBeenCalledWith([{ key: "", value: "" }]);
  });

  it("renders editable Provider Type select when isEdit is false", () => {
    render(<ProviderFormFields {...defaultProps} isEdit={false} />);

    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("https://openrouter.ai/api/v1"),
    ).toBeInTheDocument();
  });

  it("updates Base URL placeholder dynamically from providerType", () => {
    render(
      <ProviderFormFields
        {...defaultProps}
        providerType="anthropic"
        isEdit={false}
      />,
    );

    expect(
      screen.getByPlaceholderText("https://api.anthropic.com/v1"),
    ).toBeInTheDocument();
  });

  it("renders read-only Provider Type row with label and BETA badge when isEdit is true", () => {
    render(
      <ProviderFormFields
        {...defaultProps}
        providerType="openrouter"
        isEdit={true}
      />,
    );

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("OpenRouter")).toBeInTheDocument();
    expect(screen.getByText("BETA")).toBeInTheDocument();
  });
});
