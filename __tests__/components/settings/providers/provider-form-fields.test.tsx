import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProviderFormFields } from "@/components/settings/providers/provider-form-fields";

describe("ProviderFormFields", () => {
  const defaultProps = {
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKey: "",
    requiresKey: true,
    isEnabled: true,
    headerRows: [{ key: "", value: "" }],
    isEdit: false,
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

  it("calls name, baseUrl, apiKey, header value, and multi-row remove handlers", async () => {
    const user = userEvent.setup();
    const onNameChange = vi.fn();
    const onBaseUrlChange = vi.fn();
    const onApiKeyChange = vi.fn();
    const onHeaderRowsChange = vi.fn();

    render(
      <ProviderFormFields
        {...defaultProps}
        headerRows={[
          { key: "X-One", value: "1" },
          { key: "X-Two", value: "2" },
        ]}
        onNameChange={onNameChange}
        onBaseUrlChange={onBaseUrlChange}
        onApiKeyChange={onApiKeyChange}
        onHeaderRowsChange={onHeaderRowsChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Groq" } });
    expect(onNameChange).toHaveBeenCalledWith("Groq");

    fireEvent.change(screen.getByLabelText("Base URL"), {
      target: { value: "https://api.groq.com" },
    });
    expect(onBaseUrlChange).toHaveBeenCalledWith("https://api.groq.com");

    fireEvent.change(screen.getByLabelText("API Key"), {
      target: { value: "sk-new" },
    });
    expect(onApiKeyChange).toHaveBeenCalledWith("sk-new");

    const valueInputs = screen.getAllByPlaceholderText("Header value");
    fireEvent.change(valueInputs[0], { target: { value: "updated" } });
    expect(onHeaderRowsChange).toHaveBeenCalledWith([
      { key: "X-One", value: "updated" },
      { key: "X-Two", value: "2" },
    ]);

    const removeButtons = screen.getAllByRole("button", { name: /Remove/i });
    await user.click(removeButtons[0]);
    expect(onHeaderRowsChange).toHaveBeenCalledWith([{ key: "X-Two", value: "2" }]);
  });
});
