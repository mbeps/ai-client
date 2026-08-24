import { ProviderNotConfiguredError } from "@/constants/errors";
import { buildSdkProvider } from "@/lib/chat/build-sdk-provider";

describe("buildSdkProvider", () => {
  it("builds provider with apiKey", () => {
    const provider = buildSdkProvider({
      providerName: "openai",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-test",
      headers: {},
    });
    expect(provider).toBeDefined();
  });

  it("throws when apiKey missing and requiresKey is true (default)", () => {
    expect(() =>
      buildSdkProvider({
        providerName: "openai",
        baseUrl: "https://api.openai.com/v1",
        apiKey: null,
        headers: {},
      }),
    ).toThrow(ProviderNotConfiguredError);
  });

  it("throws when apiKey missing and requiresKey explicitly true", () => {
    expect(() =>
      buildSdkProvider({
        providerName: "openai",
        baseUrl: "https://api.openai.com/v1",
        apiKey: null,
        headers: {},
        requiresKey: true,
      }),
    ).toThrow(ProviderNotConfiguredError);
  });

  it("does not throw for keyless provider (requiresKey=false)", () => {
    const provider = buildSdkProvider({
      providerName: "ollama",
      baseUrl: "http://localhost:11434/v1",
      apiKey: null,
      headers: {},
      requiresKey: false,
    });
    expect(provider).toBeDefined();
  });
});
