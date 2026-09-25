import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROUTES } from "@/config/routes";
import {
  ATTACHMENT_VISION_UNSUPPORTED_ERROR_CODE,
  MISSING_API_KEY_ERROR,
  MODEL_DUPLICATE_IMPORT_ERROR_CODE,
  MODEL_MALFORMED_ID_ERROR_CODE,
  MODEL_SYNC_LIMIT_EXCEEDED_ERROR_CODE,
  PROVIDER_NOT_CONFIGURED_ERROR_CODE,
  RAG_EXTRACTION_EMPTY_ERROR_CODE,
  RATE_LIMIT_ERROR_CODE,
  REASONING_NOT_SUPPORTED_ERROR_CODE,
  STRUCTURED_OUTPUT_NOT_SUPPORTED_ERROR_CODE,
  TOOLS_NOT_SUPPORTED_ERROR_CODE,
  UNAUTHORIZED_ERROR_CODE,
  VISION_NOT_SUPPORTED_ERROR_CODE,
} from "@/constants/errors";
import { useApiError } from "@/hooks/use-api-error";

const mockPush = vi.fn();
const mockRouter = { push: mockPush };

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

import { toast } from "sonner";

describe("useApiError hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false for general errors and shows fallbackMessage if provided", () => {
    const { result } = renderHook(() => useApiError());
    const handled = result.current.handleApiError(new Error("Test error"), "Fallback error");
    expect(handled).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("Fallback error");
  });

  it("returns false for general errors when no fallback message is provided", () => {
    const { result } = renderHook(() => useApiError());
    const handled = result.current.handleApiError(new Error("Test error"));
    expect(handled).toBe(false);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("handles string error messages", () => {
    const { result } = renderHook(() => useApiError());
    const handled = result.current.handleApiError("Simple string error", "Fallback");
    expect(handled).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("Fallback");
  });

  it("handles plain object errors with .error property", () => {
    const { result } = renderHook(() => useApiError());
    const handled = result.current.handleApiError({ error: "Something bad" });
    expect(handled).toBe(false);
  });

  it("handles plain object errors with .message property", () => {
    const { result } = renderHook(() => useApiError());
    const handled = result.current.handleApiError({ message: "Object message" });
    expect(handled).toBe(false);
  });

  it("handles empty plain object errors falling back to fallbackMessage or default", () => {
    const { result } = renderHook(() => useApiError());
    const handled1 = result.current.handleApiError({}, "Object fallback");
    expect(handled1).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("Object fallback");

    const handled2 = result.current.handleApiError({});
    expect(handled2).toBe(false);
  });

  it("handles null / undefined / primitive non-string values", () => {
    const { result } = renderHook(() => useApiError());
    const handled1 = result.current.handleApiError(null, "Null error");
    expect(handled1).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("Null error");

    const handled2 = result.current.handleApiError(12345);
    expect(handled2).toBe(false);
  });

  it("handles VISION_NOT_SUPPORTED_ERROR_CODE", () => {
    const { result } = renderHook(() => useApiError());
    const err = { code: VISION_NOT_SUPPORTED_ERROR_CODE, message: "No vision" };
    expect(result.current.handleApiError(err)).toBe(true);
    expect(toast.error).toHaveBeenCalledWith("Vision Not Supported", expect.objectContaining({
      description: expect.stringContaining("cannot see images"),
    }));
  });

  it("handles TOOLS_NOT_SUPPORTED_ERROR_CODE", () => {
    const { result } = renderHook(() => useApiError());
    const err = { code: TOOLS_NOT_SUPPORTED_ERROR_CODE, message: "No tools" };
    expect(result.current.handleApiError(err)).toBe(true);
    expect(toast.error).toHaveBeenCalledWith("Tools Not Supported", expect.objectContaining({
      description: expect.stringContaining("cannot use tools"),
    }));
  });

  it("handles REASONING_NOT_SUPPORTED_ERROR_CODE", () => {
    const { result } = renderHook(() => useApiError());
    const err = { code: REASONING_NOT_SUPPORTED_ERROR_CODE, message: "No reasoning" };
    expect(result.current.handleApiError(err)).toBe(true);
    expect(toast.error).toHaveBeenCalledWith("Reasoning Not Supported", expect.objectContaining({
      description: expect.stringContaining("reasoning tokens"),
    }));
  });

  it("handles STRUCTURED_OUTPUT_NOT_SUPPORTED_ERROR_CODE", () => {
    const { result } = renderHook(() => useApiError());
    const err = { code: STRUCTURED_OUTPUT_NOT_SUPPORTED_ERROR_CODE, message: "No json schema" };
    expect(result.current.handleApiError(err)).toBe(true);
    expect(toast.error).toHaveBeenCalledWith("Structured Output Not Supported", expect.objectContaining({
      description: expect.stringContaining("structured output"),
    }));
  });

  it("handles MODEL_SYNC_LIMIT_EXCEEDED_ERROR_CODE", () => {
    const { result } = renderHook(() => useApiError());
    const err = { code: MODEL_SYNC_LIMIT_EXCEEDED_ERROR_CODE, message: "Too many models" };
    expect(result.current.handleApiError(err)).toBe(true);
    expect(toast.warning).toHaveBeenCalledWith("Model Limit Reached", expect.objectContaining({
      description: expect.stringContaining("first 1,000"),
    }));
  });

  it("handles MODEL_DUPLICATE_IMPORT_ERROR_CODE with count and default fallback", () => {
    const { result } = renderHook(() => useApiError());
    const errWithCount = { code: MODEL_DUPLICATE_IMPORT_ERROR_CODE, duplicateCount: 5 };
    expect(result.current.handleApiError(errWithCount)).toBe(true);
    expect(toast.warning).toHaveBeenCalledWith("5 model(s) skipped (already exist)", expect.any(Object));

    const errWithoutCount = { code: MODEL_DUPLICATE_IMPORT_ERROR_CODE };
    expect(result.current.handleApiError(errWithoutCount)).toBe(true);
    expect(toast.warning).toHaveBeenCalledWith("some model(s) skipped (already exist)", expect.any(Object));
  });

  it("handles RATE_LIMIT_ERROR_CODE standard and openrouter credits variant with action click", () => {
    const { result } = renderHook(() => useApiError());
    const standardErr = { code: RATE_LIMIT_ERROR_CODE, message: "Too many requests" };
    expect(result.current.handleApiError(standardErr)).toBe(true);
    expect(toast.error).toHaveBeenCalledWith("Rate Limit Reached", expect.objectContaining({
      action: expect.objectContaining({ label: "View Providers" }),
    }));
    const standardAction = (toast.error as any).mock.calls[0][1].action;
    standardAction.onClick();
    expect(mockPush).toHaveBeenCalledWith(ROUTES.SETTINGS.PROVIDERS.path);

    vi.clearAllMocks();
    const openRouterErr = { code: RATE_LIMIT_ERROR_CODE, message: "OpenRouter out of credits" };
    expect(result.current.handleApiError(openRouterErr)).toBe(true);
    expect(toast.error).toHaveBeenCalledWith("Insufficient Credits", expect.objectContaining({
      action: expect.objectContaining({ label: "View Providers" }),
    }));
    const openRouterAction = (toast.error as any).mock.calls[0][1].action;
    openRouterAction.onClick();
    expect(mockPush).toHaveBeenCalledWith(ROUTES.SETTINGS.PROVIDERS.path);
  });

  it("handles UNAUTHORIZED_ERROR_CODE and navigation action", () => {
    const { result } = renderHook(() => useApiError());
    const err = { code: UNAUTHORIZED_ERROR_CODE, message: "Unauthorized" };
    expect(result.current.handleApiError(err)).toBe(true);
    expect(toast.error).toHaveBeenCalledWith("Session Expired", expect.objectContaining({
      action: expect.objectContaining({ label: "Log In" }),
    }));
    const action = (toast.error as any).mock.calls[0][1].action;
    action.onClick();
    expect(mockPush).toHaveBeenCalledWith(ROUTES.AUTH.LOGIN.path);
  });

  it("handles MODEL_MALFORMED_ID_ERROR_CODE with and without count", () => {
    const { result } = renderHook(() => useApiError());
    const errWithCount = { code: MODEL_MALFORMED_ID_ERROR_CODE, invalidCount: 3 };
    expect(result.current.handleApiError(errWithCount)).toBe(true);
    expect(toast.warning).toHaveBeenCalledWith("3 model(s) skipped (malformed ID)", expect.any(Object));

    const errWithoutCount = { code: MODEL_MALFORMED_ID_ERROR_CODE };
    expect(result.current.handleApiError(errWithoutCount)).toBe(true);
    expect(toast.warning).toHaveBeenCalledWith("some model(s) skipped (malformed ID)", expect.any(Object));
  });

  it("handles ATTACHMENT_VISION_UNSUPPORTED_ERROR_CODE", () => {
    const { result } = renderHook(() => useApiError());
    const err = { code: ATTACHMENT_VISION_UNSUPPORTED_ERROR_CODE, message: "No vision for attachments" };
    expect(result.current.handleApiError(err)).toBe(true);
    expect(toast.error).toHaveBeenCalledWith("Image Upload Not Supported", expect.any(Object));
  });

  it("handles RAG_EXTRACTION_EMPTY_ERROR_CODE", () => {
    const { result } = renderHook(() => useApiError());
    const err = { code: RAG_EXTRACTION_EMPTY_ERROR_CODE, message: "Empty parsed document" };
    expect(result.current.handleApiError(err)).toBe(true);
    expect(toast.error).toHaveBeenCalledWith("Empty Document", { description: "Empty parsed document" });
  });

  it("handles PROVIDER_NOT_CONFIGURED_ERROR_CODE with action navigation", () => {
    const { result } = renderHook(() => useApiError());
    const err = { code: PROVIDER_NOT_CONFIGURED_ERROR_CODE };
    expect(result.current.handleApiError(err)).toBe(true);
    expect(toast.error).toHaveBeenCalledWith("No AI Providers Configured", expect.objectContaining({
      action: expect.objectContaining({ label: "Set up Providers" }),
    }));
    const action = (toast.error as any).mock.calls[0][1].action;
    action.onClick();
    expect(mockPush).toHaveBeenCalledWith(ROUTES.SETTINGS.PROVIDERS.path);
  });

  it("handles API key errors recognized by isApiKeyError with navigation to App settings", () => {
    const { result } = renderHook(() => useApiError());
    const err = new Error(MISSING_API_KEY_ERROR);
    expect(result.current.handleApiError(err)).toBe(true);
    expect(toast.error).toHaveBeenCalledWith(MISSING_API_KEY_ERROR, expect.objectContaining({
      action: expect.objectContaining({ label: "Go to Settings" }),
    }));
    const action = (toast.error as any).mock.calls[0][1].action;
    action.onClick();
    expect(mockPush).toHaveBeenCalledWith(ROUTES.SETTINGS.APP.path);
  });

  it("maintains referential identity of handleApiError across re-renders", () => {
    const { result, rerender } = renderHook(() => useApiError());
    const firstRef = result.current.handleApiError;
    rerender();
    const secondRef = result.current.handleApiError;
    expect(firstRef).toBe(secondRef);
  });
});

