import { describe, expect, it } from "vitest";
import {
  ATTACHMENT_VISION_UNSUPPORTED_ERROR_CODE,
  AttachmentVisionUnsupportedError,
  CONTENT_FILTER_ERROR_CODE,
  CONTEXT_WINDOW_EXCEEDED_ERROR_CODE,
  ContentFilterError,
  ContextWindowExceededError,
  INVALID_API_KEY_ERROR_CODE,
  InvalidApiKeyError,
  KB_NOT_READY_ERROR_CODE,
  KnowledgebaseNotReadyError,
  MISSING_API_KEY_ERROR,
  MODEL_CAPABILITY_ERROR_CODE,
  MODEL_DUPLICATE_IMPORT_ERROR_CODE,
  MODEL_MALFORMED_ID_ERROR_CODE,
  MODEL_SYNC_LIMIT_EXCEEDED_ERROR_CODE,
  ModelCapabilityError,
  ModelDuplicateImportError,
  ModelMalformedIdError,
  ModelSyncLimitExceededError,
  NotFoundError,
  PROVIDER_KEY_CORRUPTED_ERROR_CODE,
  PROVIDER_NOT_CONFIGURED_ERROR_CODE,
  ProviderKeyCorruptedError,
  ProviderNotConfiguredError,
  RAG_EXTRACTION_EMPTY_ERROR_CODE,
  RATE_LIMIT_ERROR_CODE,
  REASONING_NOT_SUPPORTED_ERROR_CODE,
  STRUCTURED_OUTPUT_NOT_SUPPORTED_ERROR_CODE,
  TOOLS_NOT_SUPPORTED_ERROR_CODE,
  VISION_NOT_SUPPORTED_ERROR_CODE,
  RagExtractionEmptyError,
  RateLimitError,
  ReasoningNotSupportedError,
  StructuredOutputNotSupportedError,
  ToolsNotSupportedError,
  VisionNotSupportedError,
  isApiKeyError,
} from "@/constants/errors";

describe("constants/errors", () => {
  it("RateLimitError has correct properties", () => {
    const err = new RateLimitError("Rate limit exceeded", 30);
    expect(err.name).toBe("RateLimitError");
    expect(err.code).toBe(RATE_LIMIT_ERROR_CODE);
    expect(err.status).toBe(429);
    expect(err.isRetryable).toBe(true);
    expect(err.retryAfter).toBe(30);
    expect(err.message).toBe("Rate limit exceeded");

    const errNoRetry = new RateLimitError("Rate limited");
    expect(errNoRetry.retryAfter).toBeUndefined();
  });

  it("ProviderNotConfiguredError with default and custom message", () => {
    const defaultErr = new ProviderNotConfiguredError();
    expect(defaultErr.name).toBe("ProviderNotConfiguredError");
    expect(defaultErr.code).toBe(PROVIDER_NOT_CONFIGURED_ERROR_CODE);
    expect(defaultErr.message).toBe("No AI provider/model configured for this request");

    const customErr = new ProviderNotConfiguredError("Custom provider missing");
    expect(customErr.message).toBe("Custom provider missing");
  });

  it("ContextWindowExceededError with default and custom message", () => {
    const defaultErr = new ContextWindowExceededError();
    expect(defaultErr.name).toBe("ContextWindowExceededError");
    expect(defaultErr.code).toBe(CONTEXT_WINDOW_EXCEEDED_ERROR_CODE);
    expect(defaultErr.status).toBe(400);

    const customErr = new ContextWindowExceededError("Custom too long");
    expect(customErr.message).toBe("Custom too long");
  });

  it("ContentFilterError with default and custom message", () => {
    const defaultErr = new ContentFilterError();
    expect(defaultErr.name).toBe("ContentFilterError");
    expect(defaultErr.code).toBe(CONTENT_FILTER_ERROR_CODE);
    expect(defaultErr.status).toBe(400);

    const customErr = new ContentFilterError("Custom blocked");
    expect(customErr.message).toBe("Custom blocked");
  });

  it("InvalidApiKeyError with default and custom message", () => {
    const defaultErr = new InvalidApiKeyError();
    expect(defaultErr.name).toBe("InvalidApiKeyError");
    expect(defaultErr.code).toBe(INVALID_API_KEY_ERROR_CODE);
    expect(defaultErr.status).toBe(401);

    const customErr = new InvalidApiKeyError("Custom invalid key");
    expect(customErr.message).toBe("Custom invalid key");
  });

  it("ModelMalformedIdError has correct properties", () => {
    const err = new ModelMalformedIdError(3);
    expect(err.name).toBe("ModelMalformedIdError");
    expect(err.code).toBe(MODEL_MALFORMED_ID_ERROR_CODE);
    expect(err.invalidCount).toBe(3);
    expect(err.message).toContain("3 model(s) were skipped");
  });

  it("ProviderKeyCorruptedError with default and custom message", () => {
    const defaultErr = new ProviderKeyCorruptedError();
    expect(defaultErr.name).toBe("ProviderKeyCorruptedError");
    expect(defaultErr.code).toBe(PROVIDER_KEY_CORRUPTED_ERROR_CODE);

    const customErr = new ProviderKeyCorruptedError("Corrupted key payload");
    expect(customErr.message).toBe("Corrupted key payload");
  });

  it("KnowledgebaseNotReadyError has correct properties", () => {
    const err = new KnowledgebaseNotReadyError("kb-123", "indexing");
    expect(err.name).toBe("KnowledgebaseNotReadyError");
    expect(err.code).toBe(KB_NOT_READY_ERROR_CODE);
    expect(err.kbId).toBe("kb-123");
    expect(err.status).toBe("indexing");
    expect(err.message).toContain("status: indexing");
  });

  it("ModelCapabilityError and subclasses have correct defaults and overrides", () => {
    const baseDefault = new ModelCapabilityError();
    expect(baseDefault.name).toBe("ModelCapabilityError");
    expect(baseDefault.code).toBe(MODEL_CAPABILITY_ERROR_CODE);
    const baseCustom = new ModelCapabilityError("Custom capability missing");
    expect(baseCustom.message).toBe("Custom capability missing");

    const visionDefault = new VisionNotSupportedError();
    expect(visionDefault.name).toBe("VisionNotSupportedError");
    expect(visionDefault.code).toBe(VISION_NOT_SUPPORTED_ERROR_CODE);
    const visionCustom = new VisionNotSupportedError("Vision not here");
    expect(visionCustom.message).toBe("Vision not here");

    const toolsDefault = new ToolsNotSupportedError();
    expect(toolsDefault.name).toBe("ToolsNotSupportedError");
    expect(toolsDefault.code).toBe(TOOLS_NOT_SUPPORTED_ERROR_CODE);
    const toolsCustom = new ToolsNotSupportedError("Tools disabled");
    expect(toolsCustom.message).toBe("Tools disabled");

    const reasoningDefault = new ReasoningNotSupportedError();
    expect(reasoningDefault.name).toBe("ReasoningNotSupportedError");
    expect(reasoningDefault.code).toBe(REASONING_NOT_SUPPORTED_ERROR_CODE);
    const reasoningCustom = new ReasoningNotSupportedError("Reasoning disabled");
    expect(reasoningCustom.message).toBe("Reasoning disabled");

    const structuredDefault = new StructuredOutputNotSupportedError();
    expect(structuredDefault.name).toBe("StructuredOutputNotSupportedError");
    expect(structuredDefault.code).toBe(STRUCTURED_OUTPUT_NOT_SUPPORTED_ERROR_CODE);
    const structuredCustom = new StructuredOutputNotSupportedError("Schema unsupported");
    expect(structuredCustom.message).toBe("Schema unsupported");
  });

  it("AttachmentVisionUnsupportedError with default and custom message", () => {
    const defaultErr = new AttachmentVisionUnsupportedError();
    expect(defaultErr.name).toBe("AttachmentVisionUnsupportedError");
    expect(defaultErr.code).toBe(ATTACHMENT_VISION_UNSUPPORTED_ERROR_CODE);

    const customErr = new AttachmentVisionUnsupportedError("Switch model now");
    expect(customErr.message).toBe("Switch model now");
  });

  it("ModelSyncLimitExceededError with default and custom message", () => {
    const defaultErr = new ModelSyncLimitExceededError();
    expect(defaultErr.name).toBe("ModelSyncLimitExceededError");
    expect(defaultErr.code).toBe(MODEL_SYNC_LIMIT_EXCEEDED_ERROR_CODE);

    const customErr = new ModelSyncLimitExceededError("Too many models");
    expect(customErr.message).toBe("Too many models");
  });

  it("ModelDuplicateImportError with default and custom message", () => {
    const defaultErr = new ModelDuplicateImportError(2, ["m1", "m2"]);
    expect(defaultErr.name).toBe("ModelDuplicateImportError");
    expect(defaultErr.code).toBe(MODEL_DUPLICATE_IMPORT_ERROR_CODE);
    expect(defaultErr.duplicateCount).toBe(2);
    expect(defaultErr.duplicateModelIds).toEqual(["m1", "m2"]);
    expect(defaultErr.message).toContain("2 model(s) skipped");

    const customErr = new ModelDuplicateImportError(1, ["m1"], "Custom duplicate message");
    expect(customErr.message).toBe("Custom duplicate message");
  });

  it("RagExtractionEmptyError with default and custom message", () => {
    const defaultErr = new RagExtractionEmptyError();
    expect(defaultErr.name).toBe("RagExtractionEmptyError");
    expect(defaultErr.code).toBe(RAG_EXTRACTION_EMPTY_ERROR_CODE);

    const customErr = new RagExtractionEmptyError("Custom empty");
    expect(customErr.message).toBe("Custom empty");
  });

  it("NotFoundError with default and custom message", () => {
    const defaultErr = new NotFoundError();
    expect(defaultErr.name).toBe("NotFoundError");
    expect(defaultErr.code).toBe("NOT_FOUND");
    expect(defaultErr.message).toBe("Not Found");

    const customErr = new NotFoundError("Project not found");
    expect(customErr.message).toBe("Project not found");
  });

  it("isApiKeyError recognizes missing API key messages", () => {
    expect(isApiKeyError(MISSING_API_KEY_ERROR)).toBe(true);
    expect(isApiKeyError("No AI provider is enabled")).toBe(true);
    expect(isApiKeyError("No provider/model configured for this request")).toBe(true);
    expect(isApiKeyError("Something completely different")).toBe(false);
  });
});

